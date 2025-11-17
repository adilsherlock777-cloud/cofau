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

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Backend root
const BACKEND_URL =
  Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL ||
  'https://backend.cofau.com';

const API_URL = `${BACKEND_URL}/api`;

/* ----------------------------------------------------------
   ✅ FINAL UNIVERSAL URL NORMALIZER — FIXES ALL STORY URL PROBLEMS
-----------------------------------------------------------*/
const fixUrl = (url) => {
  if (!url) return null;

  let cleaned = url.trim();

  // REMOVE accidental /api/api/ duplication
  cleaned = cleaned.replace(/\/api\/api\//g, "/api/");

  // FIX missing /api/ prefix if server returns static/uploads/...
  if (cleaned.startsWith("static/") || cleaned.startsWith("/static/")) {
    cleaned = "/api/" + cleaned.replace(/^\//, "");
  }

  // Add leading slash
  if (!cleaned.startsWith("/")) cleaned = "/" + cleaned;

  const finalUrl = `${BACKEND_URL}${cleaned}`;
  console.log("🟦 FINAL STORY URL:", url, "➡️", finalUrl);

  return finalUrl;
};

export default function StoryViewerScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { user, token } = useAuth();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [stories, setStories] = useState([]);
  const [storyUser, setStoryUser] = useState(null);
  const [paused, setPaused] = useState(false);

  const progressAnims = useRef([]);
  const autoAdvanceTimer = useRef(null);

  /* ----------------------------------------------------------
     LOAD STORIES FROM PARAMS
  -----------------------------------------------------------*/
  useEffect(() => {
    try {
      const parsedStories = JSON.parse(params.stories);
      const parsedUser = JSON.parse(params.user);

      // Normalize media URLs
      const fixedStories = parsedStories.map((s) => ({
        ...s,
        media_url: fixUrl(s.media_url),
      }));

      // Fix DP
      const fixedUser = {
        ...parsedUser,
        profile_picture: fixUrl(parsedUser.profile_picture),
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
        {currentStory.media_type === "image" ? (
          <Image
            source={{ uri: currentStory.media_url }}
            style={styles.storyImage}
            resizeMode="cover"
          />
        ) : (
          <Video
            source={{ uri: currentStory.media_url }}
            style={styles.storyVideo}
            shouldPlay={!paused}
            resizeMode="cover"
            isLooping={false}
            onPlaybackStatusUpdate={(status) => {
              if (status.didJustFinish) handleNext();
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
