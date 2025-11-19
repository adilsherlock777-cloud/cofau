import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Dimensions,
  SafeAreaView,
  Alert,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Video } from 'expo-av';
import axios from 'axios';
import Constants from 'expo-constants';
import { useAuth } from '../../context/AuthContext';
import UserAvatar from '../../components/UserAvatar';
import { normalizeStoryUrl, normalizeProfilePicture, BACKEND_URL } from '../../utils/imageUrlFix';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const API_URL = `${BACKEND_URL}/api`;

export default function StoryViewerScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { user, token } = useAuth();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [stories, setStories] = useState([]);
  const [storyUser, setStoryUser] = useState(null);
  const [paused, setPaused] = useState(false);
  const [actualMediaType, setActualMediaType] = useState<"video" | "image" | null>(null); // Track actual working media type

  const progressAnims = useRef([]);
  const autoAdvanceTimer = useRef(null);

  /* ----------------------------------------------------------
     LOAD STORIES FROM PARAMS
  -----------------------------------------------------------*/
  useEffect(() => {
    try {
      const parsedStories = JSON.parse(params.stories);
      const parsedUser = JSON.parse(params.user);

      console.log("📦 Parsed stories:", parsedStories.length);
      console.log("👤 Parsed user:", parsedUser.username);

      // Normalize media URLs and ensure media_type is set
      const fixedStories = parsedStories.map((s, idx) => {
        const fixedUrl = normalizeStoryUrl(s.media_url);
        
        // Better media type detection
        let mediaType = s.media_type;
        if (!mediaType && fixedUrl) {
          const urlLower = fixedUrl.toLowerCase();
          // Check for video extensions
          if (urlLower.endsWith('.mp4') || urlLower.endsWith('.mov') || urlLower.endsWith('.avi') || urlLower.endsWith('.webm')) {
            mediaType = 'video';
          } else {
            // Default to image for jpeg, jpg, png, webp, gif
            mediaType = 'image';
          }
        }
        
        console.log(`📹 Story ${idx + 1}:`, {
          original_url: s.media_url,
          fixed_url: fixedUrl,
          media_type: mediaType,
        });

        return {
          ...s,
          media_url: fixedUrl,
          media_type: mediaType || 'image', // Default to image if still unknown
        };
      });

      // Fix DP
      const fixedUser = {
        ...parsedUser,
        profile_picture: normalizeProfilePicture(parsedUser.profile_picture),
      };

      setStories(fixedStories);
      setStoryUser(fixedUser);

      // Create progress bars
      fixedStories.forEach(() => {
        progressAnims.current.push(new Animated.Value(0));
      });
    } catch (error) {
      console.error("❌ STORY PARSE ERROR:", error);
      router.back();
    }
  }, []);

  /* ----------------------------------------------------------
     AUTO ADVANCE STORY
  -----------------------------------------------------------*/
  useEffect(() => {
    // Reset media type when story changes - will be determined by what actually loads
    if (stories[currentIndex]) {
      setActualMediaType(stories[currentIndex].media_type);
    }
    
    if (stories.length > 0 && !paused) {
      startProgress();
    }

    return () => {
      if (autoAdvanceTimer.current) clearTimeout(autoAdvanceTimer.current);
    };
  }, [currentIndex, stories, paused]);

  const startProgress = () => {
    const currentStory = stories[currentIndex];
    if (!currentStory) return;

    const duration =
      currentStory.media_type === "video" ? 30000 : 5000;

    Animated.timing(progressAnims.current[currentIndex], {
      toValue: 1,
      duration,
      useNativeDriver: false,
    }).start();

    autoAdvanceTimer.current = setTimeout(() => handleNext(), duration);
  };

  const handleNext = () => {
    if (autoAdvanceTimer.current) clearTimeout(autoAdvanceTimer.current);

    if (currentIndex < stories.length - 1) {
      progressAnims.current[currentIndex].setValue(1);
      setCurrentIndex(currentIndex + 1);
    } else {
      router.back();
    }
  };

  const handlePrevious = () => {
    if (autoAdvanceTimer.current) clearTimeout(autoAdvanceTimer.current);

    if (currentIndex > 0) {
      progressAnims.current[currentIndex].setValue(0);
      setCurrentIndex(currentIndex - 1);
    } else {
      router.back();
    }
  };

  /* ----------------------------------------------------------
     DELETE STORY
  -----------------------------------------------------------*/
  const handleDelete = async () => {
    const currentStory = stories[currentIndex];

    Alert.alert("Delete Story", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await axios.delete(`${API_URL}/stories/${currentStory.id}`, {
              headers: { Authorization: `Bearer ${token}` },
            });

            const updated = stories.filter((_, idx) => idx !== currentIndex);

            if (updated.length === 0) {
              Alert.alert("Deleted", "Story removed", [
                { text: "OK", onPress: () => router.back() },
              ]);
            } else {
              setStories(updated);
              if (currentIndex >= updated.length) {
                setCurrentIndex(updated.length - 1);
              }
            }
          } catch (err) {
            console.error("❌ DELETE STORY ERROR:", err);
            Alert.alert("Error", "Failed to delete");
          }
        },
      },
    ]);
  };

  if (!stories.length || !storyUser) return null;

  const currentStory = stories[currentIndex];
  const isOwner = storyUser?.id === user?._id;

  return (
    <SafeAreaView style={styles.container}>

      {/* Progress bars */}
      <View style={styles.progressContainer}>
        {stories.map((_, index) => (
          <View key={index} style={styles.progressBarBackground}>
            <Animated.View
              style={{
                ...styles.progressBarFill,
                width: progressAnims.current[index]?.interpolate({
                  inputRange: [0, 1],
                  outputRange: ["0%", "100%"],
                }),
              }}
            />
          </View>
        ))}
      </View>

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.userInfo}>
          <UserAvatar
            profilePicture={storyUser.profile_picture}
            username={storyUser.username}
            size={36}
            showLevelBadge={false}
          />
          <Text style={styles.username}>{storyUser.username}</Text>
        </View>

        <View style={styles.headerActions}>
          {isOwner && (
            <TouchableOpacity onPress={handleDelete}>
              <Ionicons name="trash-outline" size={24} color="#FFF" />
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="close" size={28} color="#FFF" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Story Media */}
      <View style={styles.contentContainer}>
        {(actualMediaType || currentStory.media_type) === "video" ? (
          <Video
            source={{ uri: currentStory.media_url }}
            style={styles.storyVideo}
            shouldPlay={!paused}
            resizeMode="cover"
            isLooping={false}
            useNativeControls={false}
            onError={(error) => {
              console.error("❌ Video playback error:", error);
              console.error("❌ Failed video URL:", currentStory.media_url);
              
              // Try to reload with timestamp to bypass cache
              const timestamp = new Date().getTime();
              const refreshedUrl = currentStory.media_url.includes('?') 
                ? `${currentStory.media_url}&_t=${timestamp}` 
                : `${currentStory.media_url}?_t=${timestamp}`;
              
              console.log("🔄 Refreshed URL:", refreshedUrl);
              
              // If still failing, try as image
              console.log("🔄 Trying as image instead...");
              setActualMediaType("image");
            }}
            onLoadStart={() => {
              console.log("📹 Video loading:", currentStory.media_url);
          }}
            onLoad={() => {
              console.log("✅ Video loaded successfully");
              setActualMediaType("video");
            }}
            onPlaybackStatusUpdate={(status) => {
              if (status.isLoaded && status.didJustFinish) {
                console.log("✅ Video finished, advancing to next story");
                handleNext();
              }
            }}
          />
        ) : (
          <Image
            source={{ uri: currentStory.media_url }}
            style={styles.storyImage}
            resizeMode="cover"
            onError={(error) => {
              console.error("❌ Image load error:", error);
              console.error("❌ Failed image URL:", currentStory.media_url);
              // Try to load as video as fallback
              console.log("🔄 Trying as video instead...");
              setActualMediaType("video");
            }}
            onLoadStart={() => {
              console.log("🖼️ Image loading:", currentStory.media_url);
            }}
            onLoad={() => {
              console.log("✅ Image loaded successfully");
              setActualMediaType("image");
            }}
          />
        )}
      </View>

      {/* Tap zones */}
      <TouchableOpacity style={styles.tapLeft} onPress={handlePrevious} />
      <TouchableOpacity style={styles.tapRight} onPress={handleNext} />
    </SafeAreaView>
  );
}

/* ---------------- STYLES ---------------- */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  progressContainer: {
    flexDirection: "row",
    paddingHorizontal: 8,
    paddingTop: 8,
    gap: 4,
  },
  progressBarBackground: {
    flex: 1,
    height: 3,
    backgroundColor: "rgba(255,255,255,0.3)",
    borderRadius: 2,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: "#FFF",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: "center",
  },
  userInfo: { flexDirection: "row", alignItems: "center", gap: 10 },
  username: { color: "#FFF", fontSize: 16, fontWeight: "600" },
  headerActions: { flexDirection: "row", gap: 16 },
  contentContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  storyImage: { width: SCREEN_WIDTH, height: SCREEN_HEIGHT - 150 },
  storyVideo: { width: SCREEN_WIDTH, height: SCREEN_HEIGHT - 150 },
  errorContainer: {
    position: "absolute",
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT - 150,
    justifyContent: "center",
    alignItems: "center",
  },
  tapLeft: {
    position: "absolute",
    left: 0,
    top: 150,
    bottom: 0,
    width: SCREEN_WIDTH * 0.3,
  },
  tapRight: {
    position: "absolute",
    right: 0,
    top: 150,
    bottom: 0,
    width: SCREEN_WIDTH * 0.7,
  },
});
