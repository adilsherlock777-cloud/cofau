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
  Modal,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Video, ResizeMode } from 'expo-av';
import axios from 'axios';
import Constants from 'expo-constants';
import { useAuth } from '../../context/AuthContext';
import UserAvatar from '../../components/UserAvatar';
import { normalizeStoryUrl, normalizeProfilePicture, BACKEND_URL } from '../../utils/imageUrlFix';
import { markStoryViewed, getStoryViews } from '../../utils/api';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const API_URL = `${BACKEND_URL}/api`;

export default function StoryViewerScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const auth = useAuth() as { user: any; token: string | null };
  const { user, token } = auth;

  const [currentIndex, setCurrentIndex] = useState(0);
  const [stories, setStories] = useState<any[]>([]);
  const [storyUser, setStoryUser] = useState<any>(null);
  const [paused, setPaused] = useState(false);
  const [actualMediaType, setActualMediaType] = useState<"video" | "image" | null>(null); // Track actual working media type
  const [viewCount, setViewCount] = useState(0);
  const [viewers, setViewers] = useState<any[]>([]);
  const [viewedStories, setViewedStories] = useState(new Set<string>());
  const [showViewersModal, setShowViewersModal] = useState(false);

  const progressAnims = useRef<any[]>([]);
  const autoAdvanceTimer = useRef<NodeJS.Timeout | null>(null);

  /* ----------------------------------------------------------
     LOAD STORIES FROM PARAMS
  -----------------------------------------------------------*/
  useEffect(() => {
    try {
      const storiesParam = Array.isArray(params.stories) ? params.stories[0] : params.stories;
      const userParam = Array.isArray(params.user) ? params.user[0] : params.user;
      const parsedStories = JSON.parse(storiesParam as string);
      const parsedUser = JSON.parse(userParam as string);

      console.log("📦 Parsed stories:", parsedStories.length);
      console.log("👤 Parsed user:", parsedUser.username);

      // Normalize media URLs and ensure media_type is set
      const fixedStories = parsedStories.map((s: any, idx: number) => {
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
      progressAnims.current = [];
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
      // Load view count for current story
      loadStoryViews(stories[currentIndex].id);
      // Mark story as viewed if not already viewed
      if (!viewedStories.has(stories[currentIndex].id)) {
        markStoryAsViewed(stories[currentIndex].id);
      }
    }

    if (stories.length > 0 && !paused) {
      startProgress();
    }

    return () => {
      if (autoAdvanceTimer.current) clearTimeout(autoAdvanceTimer.current);
    };
  }, [currentIndex, stories, paused]);

  /* ----------------------------------------------------------
     MARK STORY AS VIEWED
  -----------------------------------------------------------*/
  const markStoryAsViewed = async (storyId: string) => {
    try {
      await markStoryViewed(storyId);
      setViewedStories(prev => new Set([...prev, storyId]));
      // Reload view count after marking as viewed
      loadStoryViews(storyId);
    } catch (error) {
      console.error('❌ Error marking story as viewed:', error);
    }
  };

  /* ----------------------------------------------------------
     LOAD STORY VIEWS
  -----------------------------------------------------------*/
  const loadStoryViews = async (storyId: string) => {
    try {
      const data = await getStoryViews(storyId);
      setViewCount(data.view_count || 0);
      if (data.is_owner && data.viewers) {
        setViewers(data.viewers || []);
      } else {
        setViewers([]);
      }
    } catch (error) {
      console.error('❌ Error loading story views:', error);
    }
  };

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
            level={storyUser.level || 1}
            showLevelBadge={false}
            style={{}}
          />
          <View>
            <Text style={styles.username}>{storyUser.username}</Text>
            {isOwner && viewCount > 0 && (
              <Text style={styles.viewCount}>
                {viewCount} {viewCount === 1 ? 'view' : 'views'}
              </Text>
            )}
          </View>
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
            resizeMode={ResizeMode.COVER}
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
            resizeMode={ResizeMode.COVER}
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

      {/* Bottom Eye Icon with View Count */}
      {isOwner && (
        <TouchableOpacity
          style={styles.eyeIconContainer}
          onPress={() => setShowViewersModal(true)}
          activeOpacity={0.7}
        >
          <Ionicons name="eye" size={24} color="#FFF" />
          {viewCount > 0 && (
            <View style={styles.viewCountBadge}>
              <Text style={styles.viewCountBadgeText}>{viewCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      )}

      {/* Tap zones */}
      <TouchableOpacity style={styles.tapLeft} onPress={handlePrevious} />
      <TouchableOpacity style={styles.tapRight} onPress={handleNext} />

      {/* Viewers Modal */}
      <Modal
        visible={showViewersModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowViewersModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.viewersModalContent}>
            <View style={styles.viewersModalHeader}>
              <Text style={styles.viewersModalTitle}>Views</Text>
              <TouchableOpacity onPress={() => setShowViewersModal(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            {viewers.length > 0 ? (
              <FlatList
                data={viewers}
                keyExtractor={(item, index) => `${item.user_id}-${index}`}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.viewerItem}
                    onPress={() => {
                      setShowViewersModal(false);
                      router.push(`/profile?userId=${(item as any).user_id}`);
                    }}
                    activeOpacity={0.7}
                  >
                    <UserAvatar
                      profilePicture={normalizeProfilePicture(item.profile_picture)}
                      username={item.username}
                      size={50}
                      level={1}
                      showLevelBadge={false}
                      style={{}}
                    />
                    <View style={styles.viewerInfo}>
                      <Text style={styles.viewerUsername}>{item.username}</Text>
                      <Text style={styles.viewerTime}>
                        {new Date(item.viewed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    </View>
                  </TouchableOpacity>
                )}
                ListEmptyComponent={
                  <View style={styles.emptyViewers}>
                    <Text style={styles.emptyViewersText}>No views yet</Text>
                  </View>
                }
              />
            ) : (
              <View style={styles.emptyViewers}>
                <Ionicons name="eye-outline" size={48} color="#ccc" />
                <Text style={styles.emptyViewersText}>No views yet</Text>
              </View>
            )}
          </View>
        </View>
      </Modal>
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
  viewCount: { color: "rgba(255,255,255,0.7)", fontSize: 12, marginTop: 2 },
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  viewersModalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: SCREEN_HEIGHT * 0.7,
    paddingBottom: 20,
  },
  viewersModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  viewersModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  viewerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  viewerInfo: {
    marginLeft: 12,
    flex: 1,
  },
  viewerUsername: {
    fontSize: 15,
    fontWeight: '500',
    color: '#333',
  },
  viewerTime: {
    fontSize: 13,
    color: '#999',
    marginTop: 2,
  },
  emptyViewers: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyViewersText: {
    marginTop: 12,
    fontSize: 16,
    color: '#999',
  },
  eyeIconContainer: {
    position: 'absolute',
    bottom: 20,
    left: SCREEN_WIDTH / 2 - 25,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  viewCountBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: '#FF3B30',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 5,
    borderWidth: 2,
    borderColor: '#000',
  },
  viewCountBadgeText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '600',
  },
});
