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
  TextInput,
  ActivityIndicator,
  Share,
  KeyboardAvoidingView,
  Keyboard,
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Video, ResizeMode } from 'expo-av';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import UserAvatar from '../../components/UserAvatar';
import { normalizeStoryUrl, normalizeProfilePicture, BACKEND_URL } from '../../utils/imageUrlFix';
import { markStoryViewed, getStoryViews } from '../../utils/api';
import { LinearGradient } from "expo-linear-gradient";
import MaskedView from "@react-native-masked-view/masked-view";

// ------------------------------------------------------------
// 🔥 GRADIENT HEART COMPONENT
// ------------------------------------------------------------
const GradientHeart = ({ size = 28 }) => {
  return (
    <MaskedView
      maskElement={
        <View style={{ backgroundColor: "transparent" }}>
          <Ionicons name="heart" size={size} color="#000" />
        </View>
      }
    >
      <LinearGradient
        colors={["#E94A37", "#F2CF68", "#1B7C82"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ width: size, height: size }}
      />
    </MaskedView>
  );
};

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
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showReplyInput, setShowReplyInput] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [sendingReply, setSendingReply] = useState(false);

  // Keyboard state for Android
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  // Keyboard listener for Android
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
        setKeyboardVisible(true);
        setKeyboardHeight(e.endCoordinates.height);
      }
    );
    const keyboardDidHideListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setKeyboardVisible(false);
        setKeyboardHeight(0);
      }
    );

    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, []);

  // Helper function to detect video content
  const isVideoContent = (story: any) => {
    if (!story) return false;
    if (actualMediaType === "video") return true;
    if (story.media_type === "video") return true;
    const url = story.media_url?.toLowerCase() || '';
    return url.endsWith('.mp4') || url.endsWith('.mov') || url.endsWith('.webm') || url.endsWith('.avi');
  };

  // Check if current user is owner (defined early for use in effects)
  const isOwner = user && storyUser && 
    String(user._id || user.id) === String(storyUser._id || storyUser.id);

  /* ----------------------------------------------------------
     CHECK IF STORY IS LIKED
  -----------------------------------------------------------*/
  const checkIfLiked = async (storyId: string) => {
    try {
      const response = await axios.get(`${API_URL}/stories/${storyId}/like-status`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setIsLiked(response.data.is_liked);
      setLikeCount(response.data.like_count || 0);
    } catch (error) {
      console.error('❌ Error checking like status:', error);
    }
  };

  /* ----------------------------------------------------------
     HANDLE LIKE/UNLIKE STORY
  -----------------------------------------------------------*/
  const handleLikeStory = async () => {
    const currentStory = stories[currentIndex];
    if (!currentStory) return;

    try {
      if (isLiked) {
        await axios.delete(`${API_URL}/stories/${currentStory.id}/like`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setIsLiked(false);
        setLikeCount(prev => Math.max(0, prev - 1));
      } else {
        await axios.post(`${API_URL}/stories/${currentStory.id}/like`, {}, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setIsLiked(true);
        setLikeCount(prev => prev + 1);
      }
    } catch (error) {
      console.error('❌ Error liking/unliking story:', error);
    }
  };

 /* ----------------------------------------------------------
   HANDLE SEND MESSAGE - Story Reply
-----------------------------------------------------------*/

const handleSendMessage = () => {
  setShowReplyInput(true);
};

const handleSendStoryReply = async () => {
  if (!replyText.trim() || !storyUser || sendingReply) return;
  
  const currentStory = stories[currentIndex];
  if (!currentStory) return;

  setSendingReply(true);
  
  try {
    const otherUserId = storyUser._id || storyUser.id;
    const wsUrl = `${BACKEND_URL.replace('https', 'wss').replace('http', 'ws')}/api/chat/ws/${otherUserId}?token=${encodeURIComponent(token || '')}`;
    
    const ws = new WebSocket(wsUrl);
    
    ws.onopen = () => {
      console.log("✅ WebSocket connected for story reply");
      ws.send(JSON.stringify({
        message: replyText.trim(),
        story_id: currentStory.id,
        story_data: {
          media_url: currentStory.media_url,
          media_type: currentStory.media_type,
          story_owner_id: otherUserId,
          story_owner_username: storyUser.username,
          story_owner_profile_picture: storyUser.profile_picture,
        }
      }));
    };

    ws.onmessage = (event) => {
      console.log("📨 Message confirmation received");
      // Message was saved and broadcast, now we can close
      ws.close();
      setShowReplyInput(false);
      setReplyText("");
      setSendingReply(false);
      Alert.alert("Sent!", "Your reply has been sent");
    };

    ws.onerror = (error) => {
      console.error("❌ WebSocket error:", error);
      setSendingReply(false);
      Alert.alert("Error", "Failed to send reply");
    };

    ws.onclose = () => {
      console.log("🔌 WebSocket closed");
    };

    // Timeout fallback in case no response
    setTimeout(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
        setSendingReply(false);
      }
    }, 5000);

  } catch (error) {
    console.error("❌ Error sending story reply:", error);
    setSendingReply(false);
    Alert.alert("Error", "Failed to send reply");
  }
};

  /* ----------------------------------------------------------
     HANDLE SHARE STORY OPTIONS
  -----------------------------------------------------------*/
  const handleShareStory = () => {
    setShowShareModal(true);
  };

  const handleAddToMyStory = async () => {
    const currentStory = stories[currentIndex];
    if (!currentStory) return;

    try {
      await axios.post(
        `${API_URL}/stories/${currentStory.id}/share`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setShowShareModal(false);
      Alert.alert('Shared!', 'Story added to your stories');
    } catch (error: any) {
      console.error('❌ Error sharing story:', error);
      Alert.alert('Error', error.response?.data?.detail || 'Failed to share story');
    }
  };

  const handleShareToCofauUsers = () => {
    setShowShareModal(false);
    const currentStory = stories[currentIndex];
    router.push({
      pathname: '/share-to-users',
      params: {
        mediaUrl: currentStory.media_url,
        mediaType: currentStory.media_type,
        storyId: currentStory.id,
        fromUser: storyUser?.username || 'Someone',
      }
    });
  };

  const handleShareToWhatsAppInstagram = async () => {
    const currentStory = stories[currentIndex];
    if (!currentStory) return;

    setShowShareModal(false);
    
    try {
      const shareUrl = `https://api.cofau.com/share/story/${currentStory.id}`;
      
      await Share.share({
        message: `Check out this story on Cofau! ${shareUrl}`,
        url: shareUrl,
      });
    } catch (error) {
      console.error('❌ Error sharing:', error);
    }
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
      
      // Check if story is liked (only for non-owners)
      const currentIsOwner = user && storyUser && 
        String(user._id || user.id) === String(storyUser._id || storyUser.id);
      if (!currentIsOwner && storyUser) {
        checkIfLiked(stories[currentIndex].id);
      }
      
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
  }, [currentIndex, stories, paused, mediaLoading, mediaError, storyUser]);

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
    const checkIsOwner =
      user && storyUser &&
      String(user._id || user.id) === String(storyUser._id || storyUser.id);

    if (!checkIsOwner) {
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
  const currentIsOwner = user && storyUser && 
    String(user._id || user.id) === String(storyUser._id || storyUser.id);

  console.log("🔍 Current story - isOwner:", currentIsOwner, "user:", user?._id || user?.id, "storyUser:", storyUser?._id || storyUser?.id)

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
            {currentIsOwner && (
              <Text style={styles.viewCountHeader}>
                👁 {viewCount} {viewCount === 1 ? 'view' : 'views'}
              </Text>
            )}
          </View>
        </View>

        <View style={styles.headerActions}>
          {currentIsOwner && (
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
              console.log("✅ Video loaded successfully");
              setActualMediaType("video");
              setMediaLoading(false);
              setMediaError(false);
              
              if (!paused) {
                startProgress();
              }
            }}
            onPlaybackStatusUpdate={(status) => {
              if (status.isLoaded) {
                if (status.positionMillis >= 10000) {
                  handleNext();
                }
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
              onLoad={(event) => {
                console.log("✅ Image loaded successfully");
                setActualMediaType("image");
                setMediaLoading(false);
                setMediaError(false);
                
                // Calculate image dimensions for watermark positioning
                if (event.nativeEvent?.source) {
                  const { width: imgWidth, height: imgHeight } = event.nativeEvent.source;
                  const containerWidth = SCREEN_WIDTH;
                  const containerHeight = SCREEN_HEIGHT - 150;
                  
                  const imageRatio = imgWidth / imgHeight;
                  const containerRatio = containerWidth / containerHeight;
                  
                  let renderedHeight;
                  let yPosition;
                  
                  if (imageRatio > containerRatio) {
                    renderedHeight = containerWidth / imageRatio;
                  } else {
                    renderedHeight = containerHeight;
                  }
                  
                  yPosition = (containerHeight - renderedHeight) / 2;
                  setContentLayout({ 
                    width: containerWidth, 
                    height: renderedHeight, 
                    y: yPosition 
                  });
                }
                
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
          contentLayout.height > 0 ? {
            position: 'absolute',
            bottom: undefined,
            top: contentLayout.y + contentLayout.height - 40,
            right: 20,
          } : {}
        ]}>COFAU</Text>

        {/* Tap zones */}
        <TouchableOpacity style={styles.tapLeft} onPress={handlePrevious} />
        <TouchableOpacity style={styles.tapRight} onPress={handleNext} />
      </View>

      {/* Bottom Section - OUTSIDE contentContainer */}
      {currentIsOwner ? (
        <TouchableOpacity
          style={styles.eyeIconContainer}
          onPress={() => setShowViewersModal(true)}
          activeOpacity={0.7}
        >
          <Ionicons name="eye" size={20} color="#FFF" />
          <Text style={styles.eyeIconText}>{viewCount}</Text>
        </TouchableOpacity>
      ) : (
        <View style={[
          styles.interactionBar,
          keyboardVisible && { bottom: keyboardHeight + 10 }
        ]}>
          {showReplyInput ? (
            <View style={styles.replyInputWrapper}>
              <TextInput
                style={styles.replyInput}
                placeholder="Reply to story..."
                placeholderTextColor="rgba(255,255,255,0.5)"
                value={replyText}
                onChangeText={setReplyText}
                autoFocus
                multiline
                maxLength={500}
              />
              <TouchableOpacity 
                style={styles.sendReplyButton}
                onPress={handleSendStoryReply}
                disabled={!replyText.trim() || sendingReply}
              >
                {sendingReply ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Ionicons name="send" size={20} color="#FFF" />
                )}
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.messageInputContainer}
              onPress={handleSendMessage}
              activeOpacity={0.7}
            >
              <Text style={styles.messageInputPlaceholder}>Send message</Text>
            </TouchableOpacity>
          )}
          
          <TouchableOpacity onPress={handleLikeStory} style={styles.interactionButton}>
            {isLiked ? (
              <GradientHeart size={28} />
            ) : (
              <Ionicons name="heart-outline" size={28} color="#FFF" />
            )}
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.interactionButton}
            onPress={handleShareStory}
          >
            <Ionicons name="share-outline" size={26} color="#FFF" />
          </TouchableOpacity>
        </View>
      )}

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
    
    {/* Show gradient heart if viewer liked the story */}
    {(item as any).has_liked && (
      <View style={styles.viewerLikedIcon}>
        <GradientHeart size={22} />
      </View>
    )}
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

      {/* Share Options Modal */}
      <Modal
        visible={showShareModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowShareModal(false)}
      >
        <TouchableOpacity 
          style={styles.shareModalOverlay}
          activeOpacity={1}
          onPress={() => setShowShareModal(false)}
        >
          <TouchableOpacity 
            activeOpacity={1} 
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.shareModalContent}>
              <Text style={styles.shareModalTitle}>Share Story</Text>
              <Text style={styles.shareModalSubtitle}>Choose how you want to share</Text>
              
              <TouchableOpacity 
                style={styles.shareOptionButton}
                onPress={handleAddToMyStory}
              >
                <Ionicons name="add-circle-outline" size={22} color="#FFF" style={styles.shareOptionIconStyle} />
                <Text style={styles.shareOptionText}>Add to Story</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.shareOptionButton}
                onPress={handleShareToCofauUsers}
              >
                <Ionicons name="people-outline" size={22} color="#FFF" style={styles.shareOptionIconStyle} />
                <Text style={styles.shareOptionText}>Share to Cofau Users</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.shareOptionButton}
                onPress={handleShareToWhatsAppInstagram}
              >
                <Ionicons name="share-social-outline" size={22} color="#FFF" style={styles.shareOptionIconStyle} />
                <Text style={styles.shareOptionText}>Share to WhatsApp/Instagram</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.shareOptionButton, styles.cancelButton]}
                onPress={() => setShowShareModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
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
    bottom: 100,
    right: 20,
    fontSize: 16,
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
  viewCountHeader: { color: "rgba(255,255,255,0.7)", fontSize: 12, marginTop: 2 },
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
    backgroundColor: "#2A9D9D",
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
    top: 0,
    bottom: 0,
    width: SCREEN_WIDTH * 0.3,
    zIndex: 1,
  },
  tapRight: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    width: SCREEN_WIDTH * 0.7,
    zIndex: 1,
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

  viewerLikedIcon: {
  marginLeft: 'auto',
  paddingLeft: 10,
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
    bottom: 40,
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
  interactionBar: {
    position: 'absolute',
    bottom: 40,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    zIndex: 100,
  },
  messageInputContainer: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.5)',
    justifyContent: 'center',
    paddingHorizontal: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  messageInputPlaceholder: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 15,
  },
  interactionButton: {
    padding: 8,
  },
  // Share Modal Styles
  shareModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  shareModalContent: {
    backgroundColor: 'rgba(60, 60, 60, 0.95)',
    borderRadius: 16,
    padding: 20,
    width: SCREEN_WIDTH - 40,
    maxWidth: 340,
  },
  shareModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFF',
    textAlign: 'center',
    marginBottom: 4,
  },
  replyInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    paddingLeft: 16,
    paddingRight: 4,
  },
  replyInput: {
    flex: 1,
    color: '#FFF',
    fontSize: 15,
    paddingVertical: 10,
    maxHeight: 80,
  },
  sendReplyButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#2A9D9D',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  shareModalSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    marginBottom: 20,
  },
  shareOptionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 10,
    marginBottom: 10,
  },
  shareOptionIconStyle: {
    marginRight: 10,
  },
  shareOptionText: {
    fontSize: 16,
    color: '#FFF',
    fontWeight: '500',
  },
  cancelButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    marginTop: 5,
  },
  cancelButtonText: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.7)',
    fontWeight: '500',
  },
});