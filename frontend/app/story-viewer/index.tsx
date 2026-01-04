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
  ActionSheetIOS,
  Platform,
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Video, ResizeMode } from 'expo-av';
import axios from 'axios';
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
  const [actualMediaType, setActualMediaType] = useState<"video" | "image" | null>(null);
  const [viewCount, setViewCount] = useState(0);
  const [viewers, setViewers] = useState<any[]>([]);
  const [viewedStories, setViewedStories] = useState(new Set<string>());
  const [showViewersModal, setShowViewersModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [mediaLoading, setMediaLoading] = useState(true);
  const [mediaError, setMediaError] = useState(false);

  const progressAnims = useRef<any[]>([]);
  const autoAdvanceTimer = useRef<NodeJS.Timeout | null>(null);
  const [contentLayout, setContentLayout] = useState({ width: 0, height: 0, y: 0 });

  // Helper function to detect video content
  const isVideoContent = (story: any) => {
    if (!story) return false;
    if (actualMediaType === "video") return true;
    if (story.media_type === "video") return true;
    const url = story.media_url?.toLowerCase() || '';
    return url.endsWith('.mp4') || url.endsWith('.mov') || url.endsWith('.webm') || url.endsWith('.avi');
  };

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

      const fixedStories = parsedStories.map((s: any, idx: number) => {
        const fixedUrl = normalizeStoryUrl(s.media_url);

        let mediaType = s.media_type;
        if (!mediaType && fixedUrl) {
          const urlLower = fixedUrl.toLowerCase();
          if (urlLower.endsWith('.mp4') || urlLower.endsWith('.mov') || urlLower.endsWith('.avi') || urlLower.endsWith('.webm')) {
            mediaType = 'video';
          } else {
            mediaType = 'image';
          }
        }

        console.log(`📹 Story ${idx + 1}:`, {
          original_url: s.media_url,
          fixed_url: fixedUrl,
          media_type: mediaType,
        });

        const storyLength = s.story_length || (mediaType === 'video' ? 30 : 5);

        return {
          ...s,
          media_url: fixedUrl,
          media_type: mediaType || 'image',
          story_length: storyLength,
        };
      });

      const fixedUser = {
        ...parsedUser,
        profile_picture: normalizeProfilePicture(parsedUser.profile_picture),
      };

      setStories(fixedStories);
      setStoryUser(fixedUser);

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
    if (stories[currentIndex]) {
      setActualMediaType(stories[currentIndex].media_type);
      setMediaLoading(true);
      setMediaError(false);
      loadStoryViews(stories[currentIndex].id);
      if (!viewedStories.has(stories[currentIndex].id)) {
        markStoryAsViewed(stories[currentIndex].id);
      }
    }

    if (stories.length > 0 && !paused && !mediaLoading && !mediaError) {
      startProgress();
    } else if (paused) {
      if (autoAdvanceTimer.current) {
        clearTimeout(autoAdvanceTimer.current);
      }
    }

    return () => {
      if (autoAdvanceTimer.current) clearTimeout(autoAdvanceTimer.current);
    };
  }, [currentIndex, stories, paused, mediaLoading, mediaError]);

  /* ----------------------------------------------------------
     MARK STORY AS VIEWED
  -----------------------------------------------------------*/
  const markStoryAsViewed = async (storyId: string) => {
    try {
      await markStoryViewed(storyId);
      setViewedStories(prev => new Set([...prev, storyId]));
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
    if (!currentStory || mediaLoading || mediaError) return;

    if (autoAdvanceTimer.current) {
      clearTimeout(autoAdvanceTimer.current);
    }

    const duration = isVideoContent(currentStory) ? 10000 : 5000;

    progressAnims.current[currentIndex].setValue(0);

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

  /* ----------------------------------------------------------
     STORY DELETE & OPTIONS HANDLERS
  -----------------------------------------------------------*/
  const handleDeleteStory = async () => {
    const currentStory = stories[currentIndex];
    if (!currentStory || isDeleting) return;
    
    try {
      setIsDeleting(true);
      const storyId = currentStory.id || currentStory._id;

      await fetch(`${API_URL}/stories/${storyId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      router.back();
      Alert.alert('Story deleted', 'Your story has been deleted.');
    } catch (error) {
      console.error('Error deleting story', error);
      Alert.alert('Error', 'Could not delete story. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleStoryOptions = () => {
    const isOwner =
      user && storyUser &&
      String(user._id || user.id) === String(storyUser._id || storyUser.id);

    if (!isOwner) {
      Alert.alert('Story Options', 'No options available.');
      return;
    }

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Delete Story', 'Cancel'],
          destructiveButtonIndex: 0,
          cancelButtonIndex: 1,
        },
        (buttonIndex) => {
          if (buttonIndex === 0) handleDeleteStory();
        }
      );
    } else {
      Alert.alert('Story Options', 'Choose an action', [
        { text: 'Delete Story', style: 'destructive', onPress: handleDeleteStory },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  };

  if (!stories.length || !storyUser) return null;

  const currentStory = stories[currentIndex];
  const isOwner = user && storyUser && 
    String(user._id || user.id) === String(storyUser._id || storyUser.id);

  console.log("🔍 Current story - isOwner:", isOwner, "user:", user?._id || user?.id, "storyUser:", storyUser?._id || storyUser?.id)

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
            {isOwner && (
              <Text style={styles.viewCount}>
                👁 {viewCount} {viewCount === 1 ? 'view' : 'views'}
              </Text>
            )}
          </View>
        </View>

        <View style={styles.headerActions}>
          {isOwner && (
            <TouchableOpacity onPress={handleStoryOptions} style={styles.headerButton}>
              <Feather name="more-vertical" size={24} color="#FFF" />
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="close" size={28} color="#FFF" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Story Media with Blurred Background */}
      <View style={styles.contentContainer}>
        {/* Blurred Background */}
        {!isVideoContent(currentStory) && (
          <Image
            source={{ uri: currentStory.media_url }}
            style={styles.blurredBackground}
            blurRadius={25}
          />
        )}
        {isVideoContent(currentStory) && (
          <View style={[styles.blurredBackground, { backgroundColor: '#000' }]} />
        )}

        {mediaError && (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle" size={48} color="#FFF" />
            <Text style={styles.errorText}>Failed to load story</Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={() => {
                setMediaError(false);
                setMediaLoading(true);
                setActualMediaType(currentStory.media_type);
              }}
            >
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {!mediaError && isVideoContent(currentStory) ? (
          <Video
            key={`video-${currentStory.id}-${currentIndex}`}
            source={{ 
              uri: currentStory.media_url,
              headers: {
                'Accept': 'video/mp4, video/quicktime, video/*',
              }
            }}
            style={styles.storyVideo}
            shouldPlay={!paused}
            resizeMode={ResizeMode.CONTAIN}
            isMuted={false}
            volume={1.0}
            onError={(error) => {
              console.error("❌ Video playback error:", error);
              if (autoAdvanceTimer.current) {
                clearTimeout(autoAdvanceTimer.current);
              }
              setMediaError(true);
              setMediaLoading(false);
            }}
            onLoadStart={() => {
              console.log("📹 Video loading:", currentStory.media_url);
              setMediaLoading(true);
              setMediaError(false);
              if (autoAdvanceTimer.current) {
                clearTimeout(autoAdvanceTimer.current);
              }
            }}
            onLoad={(event) => {
  console.log("✅ Image loaded successfully");
  setActualMediaType("image");
  setMediaLoading(false);
  setMediaError(false);
  
  // Calculate actual rendered size
  const { width: imgWidth, height: imgHeight } = event.nativeEvent.source;
  const containerWidth = SCREEN_WIDTH;
  const containerHeight = SCREEN_HEIGHT - 150;
  
  const imageRatio = imgWidth / imgHeight;
  const containerRatio = containerWidth / containerHeight;
  
  let renderedHeight;
  if (imageRatio > containerRatio) {
    // Image is wider - width fills container
    renderedHeight = containerWidth / imageRatio;
  } else {
    // Image is taller - height fills container
    renderedHeight = containerHeight;
  }
  
  const yPosition = (containerHeight - renderedHeight) / 2;
  setContentLayout({ 
    width: containerWidth, 
    height: renderedHeight, 
    y: yPosition 
  });
  
  if (!paused) {
    startProgress();
  }
}}
            onPlaybackStatusUpdate={(status) => {
  if (status.isLoaded) {
    // Auto-advance after 10 seconds
    if (status.positionMillis >= 10000) {
      handleNext();
    }
    // Also handle if video naturally finishes before 10 seconds
    if (status.didJustFinish) {
      handleNext();
    }
  }
}}

onReadyForDisplay={(event) => {
  const { width: vidWidth, height: vidHeight } = event.naturalSize;
  const containerWidth = SCREEN_WIDTH;
  const containerHeight = SCREEN_HEIGHT - 150;
  
  const videoRatio = vidWidth / vidHeight;
  const containerRatio = containerWidth / containerHeight;
  
  let renderedHeight;
  if (videoRatio > containerRatio) {
    renderedHeight = containerWidth / videoRatio;
  } else {
    renderedHeight = containerHeight;
  }
  
  const yPosition = (containerHeight - renderedHeight) / 2;
  setContentLayout({ 
    width: containerWidth, 
    height: renderedHeight, 
    y: yPosition 
  });
}}
          />
        ) : (
          !mediaError && !isVideoContent(currentStory) && (
            <Image
              key={`image-${currentStory.id}-${currentIndex}`}
              source={{ uri: currentStory.media_url }}
              style={styles.storyImage}
              resizeMode="contain"
              onError={(error) => {
                console.error("❌ Image load error:", error);
                if (autoAdvanceTimer.current) {
                  clearTimeout(autoAdvanceTimer.current);
                }
                setMediaError(true);
                setMediaLoading(false);
              }}
              onLoadStart={() => {
                console.log("🖼️ Image loading:", currentStory.media_url);
                setMediaLoading(true);
                setMediaError(false);
                if (autoAdvanceTimer.current) {
                  clearTimeout(autoAdvanceTimer.current);
                }
              }}
              onLoad={() => {
                console.log("✅ Image loaded successfully");
                setActualMediaType("image");
                setMediaLoading(false);
                setMediaError(false);
                if (!paused) {
                  startProgress();
                }
              }}
            />
          )
        )}

        {/* COFAU Watermark */}
        <Text style={[
  styles.watermark,
  contentLayout.height > 0 && {
    bottom: undefined,
    top: contentLayout.y + contentLayout.height - 50, // 50px from bottom of content
  }
]}>COFAU</Text>
      </View>

      {/* Bottom Eye Icon with View Count */}
      <TouchableOpacity
        style={styles.eyeIconContainer}
        onPress={() => setShowViewersModal(true)}
        activeOpacity={0.7}
      >
        <Ionicons name="eye" size={20} color="#FFF" />
        <Text style={styles.eyeIconText}>{viewCount}</Text>
      </TouchableOpacity>

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
              <View>
                <Text style={styles.viewersModalTitle}>Views</Text>
                {viewCount > 0 && (
                  <Text style={styles.viewersModalSubtitle}>
                    {viewCount} {viewCount === 1 ? 'person viewed' : 'people viewed'} this story
                  </Text>
                )}
              </View>
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
                      <Text style={styles.viewerUsername}>
                        {(item as any).full_name || item.username}
                      </Text>
                      {(item as any).full_name && item.username && (item as any).full_name !== item.username && (
                        <Text style={styles.viewerUsernameSecondary}>@{item.username}</Text>
                      )}
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
  blurredBackground: {
    position: 'absolute',
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    top: 0,
    left: 0,
  },
 watermark: {
  position: 'absolute',
  bottom: SCREEN_HEIGHT * 0.19, // fallback
  right: 30,
  fontSize: 18,
  fontWeight: '700',
  color: 'rgba(255, 255, 255, 0.7)',
  fontFamily: Platform.OS === 'ios' ? 'Lobster-Regular' : 'Lobster',
  letterSpacing: 2,
  zIndex: 10,
  textShadowColor: 'rgba(0, 0, 0, 0.5)',
  textShadowOffset: { width: 1, height: 1 },
  textShadowRadius: 3,
},
  userInfo: { flexDirection: "row", alignItems: "center", gap: 10 },
  username: { color: "#FFF", fontSize: 16, fontWeight: "600" },
  viewCount: { color: "rgba(255,255,255,0.7)", fontSize: 12, marginTop: 2 },
  headerActions: { flexDirection: "row", gap: 16 },
  headerButton: { padding: 4 },
  contentContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  storyImage: { width: SCREEN_WIDTH, height: SCREEN_HEIGHT - 150 },
  storyVideo: { width: SCREEN_WIDTH, height: SCREEN_HEIGHT - 150, backgroundColor: '#000' },
  errorContainer: {
    position: "absolute",
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT - 150,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.8)",
  },
  errorText: {
    color: "#FFF",
    fontSize: 16,
    marginTop: 16,
    textAlign: "center",
  },
  retryButton: {
    marginTop: 20,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: "#4dd0e1",
    borderRadius: 8,
  },
  retryButtonText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "600",
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
  viewersModalSubtitle: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
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
  viewerUsernameSecondary: {
    fontSize: 13,
    color: '#999',
    marginTop: 1,
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
    bottom: 30,
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    zIndex: 10,
  },
  eyeIconText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  storyLengthText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '500',
  },
  shareModalBackdrop: {
    flex: 1,
  },
  shareModalContent: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 20,
  },
  shareModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  shareModalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
  },
  shareOptionsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 24,
    paddingHorizontal: 12,
  },
  shareOptionItem: {
    alignItems: 'center',
    width: 70,
  },
  shareOptionIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  shareOptionText: {
    fontSize: 12,
    color: '#333',
    textAlign: 'center',
  },
});