// app/post-details/[postId].tsx

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Linking,
  FlatList,
  Dimensions,
  ScrollView,
  Platform,
  SafeAreaView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useAuth } from "../../context/AuthContext";
import UserAvatar from "../../components/UserAvatar";
import SharePreviewModal from "../../components/SharePreviewModal";
import axios from "axios";
import { Image } from "expo-image";
import { Video, ResizeMode } from "expo-av";
import { LinearGradient } from "expo-linear-gradient";
import MaskedView from "@react-native-masked-view/masked-view";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { normalizeMediaUrl, normalizeProfilePicture } from "../../utils/imageUrlFix";

const BACKEND =
  process.env.EXPO_PUBLIC_BACKEND_URL || "https://backend.cofau.com";
const API_URL = `${BACKEND}/api`;
const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get("window");

/* ---------------------------------------------------------
   🔥 UNIVERSAL URL NORMALIZER
----------------------------------------------------------*/
const normalizeUrl = (url: string | null | undefined): string | null => {
  if (!url) return null;
  if (url.startsWith("http")) return url;
  let cleaned = url.trim();
  cleaned = cleaned.replace(/([^:]\/)\/+/g, "$1");
  if (!cleaned.startsWith("/")) cleaned = "/" + cleaned;
  return `${BACKEND}${cleaned}`;
};

/* ---------------------------------------------------------
   🔥 GRADIENT ICON COMPONENTS (Cofau Theme)
----------------------------------------------------------*/
const GradientHeart = ({ size = 28 }) => (
  <MaskedView
    maskElement={
      <View style={{ backgroundColor: 'transparent' }}>
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

const GradientBookmark = ({ size = 26 }) => (
  <MaskedView
    maskElement={
      <View style={{ backgroundColor: 'transparent' }}>
        <Ionicons name="bookmark" size={size} color="#000" />
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

/* ---------------------------------------------------------
   POST ITEM COMPONENT
----------------------------------------------------------*/
function PostItem({ post, currentPostId, token, bottomInset }: any) {
  const router = useRouter();
  const [isLiked, setIsLiked] = useState(post.is_liked_by_user || false);
  const [likesCount, setLikesCount] = useState(post.likes_count || 0);
  const [isSaved, setIsSaved] = useState(post.is_saved_by_user || false);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const videoRef = useRef(null);

  const isVideo = (post.media_type || "").toLowerCase() === "video";
  const mediaUrl = normalizeMediaUrl(post.media_url || post.image_url);
  const imageUrl = normalizeMediaUrl(post.image_url || post.media_url);
  const profilePic = normalizeProfilePicture(post.user_profile_picture);

  const getDisplayUrl = () => {
    if (isVideo) {
      return mediaUrl || normalizeUrl(post.media_url || post.image_url);
    }
    return imageUrl || mediaUrl || normalizeUrl(post.image_url || post.media_url);
  };

  const displayUrl = getDisplayUrl();

  // Calculate bottom nav height based on safe area
  const BOTTOM_NAV_HEIGHT = 60 + bottomInset;

  useEffect(() => {
    if (showComments) {
      fetchComments();
    }
  }, [showComments, post.id]);

  useEffect(() => {
    if (isVideo && videoRef.current && post.id === currentPostId) {
      const timer = setTimeout(() => {
        if (videoRef.current) {
          (videoRef.current as any).playAsync?.().catch((error: any) => {
            console.error("❌ Error playing video:", error);
          });
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isVideo, post.id, currentPostId]);

  const fetchComments = async () => {
    try {
      const res = await axios.get(`${API_URL}/posts/${post.id}/comments`);
      const normalized = res.data.map((c: any) => ({
        ...c,
        profile_pic: normalizeProfilePicture(c.profile_pic),
      }));
      setComments(normalized);
    } catch (e) {
      console.log("❌ Comment fetch error", e);
    }
  };

  const handleLikeToggle = async () => {
    const prevLiked = isLiked;
    const prevCount = likesCount;
    setIsLiked(!prevLiked);
    setLikesCount(prevLiked ? prevCount - 1 : prevCount + 1);
    try {
      if (prevLiked) {
        await axios.delete(`${API_URL}/posts/${post.id}/like`, {
          headers: { Authorization: `Bearer ${token}` },
        });
      } else {
        await axios.post(`${API_URL}/posts/${post.id}/like`, {}, {
          headers: { Authorization: `Bearer ${token}` },
        });
      }
    } catch (e) {
      setIsLiked(prevLiked);
      setLikesCount(prevCount);
    }
  };

  const handleSaveToggle = async () => {
    const prevSaved = isSaved;
    setIsSaved(!prevSaved);
    try {
      if (prevSaved) {
        await axios.delete(`${API_URL}/posts/${post.id}/save`, {
          headers: { Authorization: `Bearer ${token}` },
        });
      } else {
        await axios.post(`${API_URL}/posts/${post.id}/save`, {}, {
          headers: { Authorization: `Bearer ${token}` },
        });
      }
    } catch (e) {
      setIsSaved(prevSaved);
    }
  };

  const handleSubmitComment = async () => {
    if (!commentText.trim()) return;
    setSubmittingComment(true);
    try {
      const formData = new FormData();
      formData.append("comment_text", commentText.trim());
      await axios.post(`${API_URL}/posts/${post.id}/comment`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data",
        },
      });
      setCommentText("");
      fetchComments();
    } catch (e) {
      Alert.alert("Error", "Unable to add comment");
    } finally {
      setSubmittingComment(false);
    }
  };

  const formatTime = (timestamp: string | null | undefined): string => {
    if (!timestamp) return "";
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const mins = Math.floor(diff / 60000);
    const hrs = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    if (hrs < 24) return `${hrs}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <View style={styles.postItem}>
      {/* MEDIA CONTAINER */}
      <View style={styles.responsiveMediaContainer}>
        <TouchableOpacity 
          style={styles.mediaWrapper}
          activeOpacity={1}
          onPress={() => {
            if (isVideo) {
              setIsMuted(!isMuted);
            }
          }}
        >
          {isVideo ? (
            <>
              <Video
                ref={videoRef}
                source={{ uri: mediaUrl || displayUrl || '' }}
                style={styles.responsiveMedia}
                resizeMode={ResizeMode.CONTAIN}
                shouldPlay={true}
                isLooping
                isMuted={isMuted}
                useNativeControls={false}
              />
              <View style={styles.muteIndicatorReels}>
                <Ionicons 
                  name={isMuted ? "volume-mute" : "volume-high"} 
                  size={24} 
                  color="rgba(255,255,255,0.9)" 
                />
              </View>
            </>
          ) : (
            <Image
              source={{ uri: imageUrl || displayUrl || '' }}
              style={styles.responsiveMedia}
              contentFit="contain"
            />
          )}
        </TouchableOpacity>

        {/* User Info at Top with Back Button */}
        {!showDetails && (
          <View style={styles.topUserInfoBar}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.back()}
            >
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.topUserRow}
              onPress={() => router.push(`/profile?userId=${post.user_id}`)}
            >
              <UserAvatar
                profilePicture={profilePic}
                username={post.username}
                level={post.user_level}
                size={44}
                showLevelBadge
                style={{}}
              />
              <View style={styles.topUserDetails}>
                <Text style={styles.topUsername}>{post.username}</Text>
                <Text style={styles.topTimestamp}>{formatTime(post.created_at)}</Text>
              </View>
            </TouchableOpacity>
          </View>
        )}

        {/* Glass Bottom Overlay - Evenly Distributed Items */}
        {!showDetails && (
          <TouchableOpacity 
            style={[styles.glassBottomOverlay, { bottom: BOTTOM_NAV_HEIGHT + 10 }]}
            activeOpacity={0.9}
            onPress={() => setShowDetails(true)}
          >
            <View style={styles.glassBackground} />
            <View style={styles.glassContentRow}>
              {/* Rating */}
              <View style={styles.glassInfoItem}>
                <Ionicons name="star" size={16} color="#FFD700" />
                <Text style={styles.glassInfoText}>{post.rating || "N/A"}/10</Text>
              </View>
              
              {/* Location */}
              <View style={styles.glassInfoItem}>
                <Ionicons name="location" size={16} color="#FFD700" />
                <Text style={styles.glassInfoText} numberOfLines={1}>
                  {post.location_name || "N/A"}
                </Text>
              </View>
              
              {/* Username */}
              <View style={styles.glassInfoItem}>
                <Ionicons name="person" size={16} color="#FFD700" />
                <Text style={styles.glassInfoText} numberOfLines={1}>
                  {post.username || "N/A"}
                </Text>
              </View>
              
              {/* Chevron */}
              <View style={styles.glassChevronContainer}>
                <Ionicons name="chevron-up" size={18} color="#FFF" />
              </View>
            </View>
          </TouchableOpacity>
        )}
      </View>

      {/* EXPANDED DETAILS VIEW */}
      {showDetails && (
        <View style={styles.expandedDetailsOverlay}>
          {/* Shrunk Media */}
          <View style={styles.shrunkMediaContainer}>
            <TouchableOpacity 
              style={styles.shrunkMediaWrapper}
              activeOpacity={1}
              onPress={() => {
                if (isVideo) setIsMuted(!isMuted);
              }}
            >
              {isVideo ? (
                <>
                  <Video
                    ref={videoRef}
                    source={{ uri: mediaUrl || displayUrl || '' }}
                    style={styles.shrunkVideo}
                    resizeMode={ResizeMode.COVER}
                    shouldPlay={true}
                    isLooping
                    isMuted={isMuted}
                    useNativeControls={false}
                  />
                  <View style={styles.muteIndicatorShrunk}>
                    <Ionicons 
                      name={isMuted ? "volume-mute" : "volume-high"} 
                      size={20} 
                      color="rgba(255,255,255,0.9)" 
                    />
                  </View>
                </>
              ) : (
                <Image
                  source={{ uri: imageUrl || displayUrl || '' }}
                  style={styles.shrunkVideo}
                  contentFit="cover"
                />
              )}
            </TouchableOpacity>

            {/* Close Button */}
            <TouchableOpacity 
              style={styles.modernCloseButton}
              onPress={() => setShowDetails(false)}
            >
              <Ionicons name="close" size={26} color="#FFF" />
            </TouchableOpacity>
          </View>

          {/* Details Content */}
          <ScrollView style={styles.detailsContent} showsVerticalScrollIndicator={false}>
            {/* User Info Row with Dropdown Button */}
            <View style={styles.detailsUserRowContainer}>
              <TouchableOpacity
                style={styles.detailsUserRow}
                onPress={() => {
                  setShowDetails(false);
                  router.push(`/profile?userId=${post.user_id}`);
                }}
              >
                <UserAvatar
                  profilePicture={profilePic}
                  username={post.username}
                  level={post.user_level}
                  size={50}
                  showLevelBadge
                  style={{}}
                />
                <View style={styles.detailsUserInfo}>
                  <Text style={styles.detailsUsername}>{post.username}</Text>
                  <Text style={styles.detailsTimestamp}>{formatTime(post.created_at)}</Text>
                </View>
              </TouchableOpacity>
              
              {/* Dropdown/Collapse Button */}
              <TouchableOpacity 
                style={styles.dropdownButton}
                onPress={() => setShowDetails(false)}
              >
                <Ionicons name="chevron-down" size={28} color="#999" />
              </TouchableOpacity>
            </View>

            {/* Action Buttons with Cofau Theme */}
            <View style={styles.detailsActions}>
              <TouchableOpacity style={styles.detailsActionBtn} onPress={handleLikeToggle}>
                {isLiked ? (
                  <GradientHeart size={28} />
                ) : (
                  <Ionicons name="heart-outline" size={28} color="#000" />
                )}
                <Text style={styles.detailsActionText}>{likesCount}</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.detailsActionBtn}
                onPress={() => setShowComments(!showComments)}
              >
                <Ionicons name="chatbubble-outline" size={26} color="#000" />
                <Text style={styles.detailsActionText}>{post.comments_count || comments.length}</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.detailsActionBtn}
                onPress={() => {
                  setShowDetails(false);
                  setShowShareModal(true);
                }}
              >
                <Ionicons name="share-outline" size={26} color="#000" />
                <Text style={styles.detailsActionText}>Share</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.detailsActionBtn} onPress={handleSaveToggle}>
                {isSaved ? (
                  <GradientBookmark size={26} />
                ) : (
                  <Ionicons name="bookmark-outline" size={26} color="#000" />
                )}
                <Text style={styles.detailsActionText}>Save</Text>
              </TouchableOpacity>
            </View>

            {/* RATING Section */}
            {post.rating && (
              <View style={styles.detailsCard}>
                <View style={styles.detailsCardHeader}>
                  <Ionicons name="star" size={20} color="#FFD700" />
                  <Text style={styles.detailsCardLabel}>RATING</Text>
                </View>
                <Text style={styles.detailsRatingValue}>{post.rating}/10</Text>
              </View>
            )}

            {/* REVIEW Section */}
            {post.review_text && (
              <View style={styles.detailsCard}>
                <View style={styles.detailsCardHeader}>
                  <Ionicons name="create" size={20} color="#FFD700" />
                  <Text style={styles.detailsCardLabel}>REVIEW</Text>
                </View>
                <Text style={styles.detailsReviewText}>{post.review_text}</Text>
              </View>
            )}

            {/* LOCATION Section */}
            {post.location_name && (
              <TouchableOpacity 
                style={styles.detailsCard}
                onPress={() => {
                  if (post.map_link) {
                    Linking.openURL(post.map_link);
                  } else if (post.location_name) {
                    const searchUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(post.location_name)}`;
                    Linking.openURL(searchUrl);
                  }
                }}
              >
                <View style={styles.detailsCardHeader}>
                  <Ionicons name="location" size={20} color="#FFD700" />
                  <Text style={styles.detailsCardLabel}>LOCATION</Text>
                </View>
                <View style={styles.locationRow}>
                  <Text style={styles.detailsLocationText}>{post.location_name}</Text>
                  <Ionicons name="chevron-forward" size={20} color="#999" />
                </View>
              </TouchableOpacity>
            )}

            {/* Comments Section */}
            {showComments && (
              <View style={styles.detailsCommentsSection}>
                <Text style={styles.detailsCommentsTitle}>
                  Comments ({comments.length})
                </Text>

                {comments.length === 0 ? (
                  <Text style={styles.noComments}>No comments yet</Text>
                ) : (
                  comments.map((c: any) => (
                    <View key={c.id} style={styles.commentItem}>
                      <UserAvatar
                        profilePicture={c.profile_pic}
                        username={c.username}
                        size={36}
                        level={c.level || 1}
                        style={{}}
                      />
                      <View style={styles.commentContent}>
                        <Text style={styles.commentUsername}>{c.username}</Text>
                        <Text style={styles.commentText}>{c.comment_text}</Text>
                        <Text style={styles.commentTime}>{formatTime(c.created_at)}</Text>
                      </View>
                    </View>
                  ))
                )}

                <View style={styles.commentInputContainer}>
                  <TextInput
                    value={commentText}
                    onChangeText={setCommentText}
                    placeholder="Add a comment…"
                    style={styles.commentInput}
                  />
                  <TouchableOpacity
                    style={[styles.sendButton, !commentText.trim() && { backgroundColor: "#ccc" }]}
                    disabled={!commentText.trim() || submittingComment}
                    onPress={handleSubmitComment}
                  >
                    {submittingComment ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Ionicons name="send" size={20} color="#fff" />
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}

            <View style={{ height: 100 }} />
          </ScrollView>
        </View>
      )}

      {/* Bottom Navigation Bar */}
      {!showDetails && (
        <View style={[styles.bottomNavBar, { paddingBottom: bottomInset || 10 }]}>
          <TouchableOpacity style={styles.navItem} onPress={() => router.push("/feed")}>
            <Ionicons name="home-outline" size={24} color="#fff" />
            <Text style={styles.navLabelWhite}>Home</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.navItem} onPress={() => router.push("/explore")}>
            <Ionicons name="compass-outline" size={24} color="#fff" />
            <Text style={styles.navLabelWhite}>Explore</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.centerNavButton} onPress={() => router.push("/leaderboard")}>
            <View style={styles.centerNavButtonInner}>
              <Ionicons name="trophy" size={26} color="#333" />
            </View>
            <Text style={styles.navLabelWhite}>Leaderboard</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.navItem} onPress={() => router.push("/happening")}>
            <Ionicons name="restaurant-outline" size={24} color="#fff" />
            <Text style={styles.navLabelWhite}>Happening</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.navItem} onPress={() => router.push("/profile")}>
            <Ionicons name="person-outline" size={24} color="#fff" />
            <Text style={styles.navLabelWhite}>Profile</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Share Modal */}
      <SharePreviewModal
        visible={showShareModal}
        onClose={() => setShowShareModal(false)}
        post={post}
      />
    </View>
  );
}

export default function PostDetailsScreen() {
  const router = useRouter();
  const { postId } = useLocalSearchParams();
  const { token, user } = useAuth() as any;
  const insets = useSafeAreaInsets();

  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [skip, setSkip] = useState(0);
  const [initialPostIndex, setInitialPostIndex] = useState(0);
  const [currentVisiblePost, setCurrentVisiblePost] = useState<any>(null);
  const flatListRef = useRef<FlatList<any> | null>(null);

  const LIMIT = 10;

  const onViewableItemsChanged = useCallback(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      setCurrentVisiblePost(viewableItems[0].item);
    }
  }, []);

  const viewabilityConfig = { itemVisiblePercentThreshold: 50 };

  useEffect(() => {
    if (postId && token) loadInitialPost();
  }, [postId, token]);

  const loadInitialPost = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_URL}/feed?skip=0`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const currentIndex = res.data.findIndex((p: any) => p.id === postId);
      if (currentIndex === -1) {
        Alert.alert("Error", "Post not found");
        router.back();
        return;
      }

      const normalized = res.data.map((p: any) => ({
        ...p,
        media_url: normalizeUrl(p.media_url),
        image_url: normalizeUrl(p.image_url || p.media_url),
        thumbnail_url: normalizeUrl(p.thumbnail_url),
        user_profile_picture: normalizeUrl(p.user_profile_picture),
      }));

      const postsFromCurrent = normalized.slice(currentIndex);
      setPosts(postsFromCurrent);
      setInitialPostIndex(0);
      setCurrentVisiblePost(postsFromCurrent[0]);
      setSkip(postsFromCurrent.length);

      setTimeout(() => {
        flatListRef.current?.scrollToIndex({ index: 0, animated: false });
      }, 100);
    } catch (e) {
      console.log("❌ Post fetch error", e);
      Alert.alert("Error", "Unable to load post");
    } finally {
      setLoading(false);
    }
  };

  const loadMorePosts = async () => {
    if (loadingMore || !hasMore) return;
    try {
      setLoadingMore(true);
      const res = await axios.get(`${API_URL}/feed?limit=${LIMIT}&skip=${skip}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.data.length === 0) {
        setHasMore(false);
        return;
      }

      const normalized = res.data.map((p: any) => ({
        ...p,
        media_url: normalizeUrl(p.media_url),
        image_url: normalizeUrl(p.image_url || p.media_url),
        thumbnail_url: normalizeUrl(p.thumbnail_url),
        user_profile_picture: normalizeUrl(p.user_profile_picture),
      }));

      const existingIds = new Set(posts.map((p: any) => p.id));
      const newPosts = normalized.filter((p: any) => !existingIds.has(p.id));

      setPosts((prev) => [...prev, ...newPosts]);
      setSkip((prev) => prev + newPosts.length);
      if (newPosts.length < LIMIT) setHasMore(false);
    } catch (e) {
      console.log("❌ Load more error", e);
    } finally {
      setLoadingMore(false);
    }
  };

  const renderPostItem = useCallback(
    ({ item }: any) => (
      <PostItem
        post={item}
        currentPostId={postId}
        token={token}
        bottomInset={insets.bottom}
      />
    ),
    [postId, token, insets.bottom]
  );

  const renderFooter = () => {
    if (!loadingMore) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color="#4dd0e1" />
      </View>
    );
  };

  if (loading)
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4dd0e1" />
        <Text style={{ color: "#fff", marginTop: 10 }}>Loading post...</Text>
      </View>
    );

  if (posts.length === 0)
    return (
      <View style={styles.loadingContainer}>
        <Text style={{ color: "#fff" }}>Post not found</Text>
      </View>
    );

  return (
    <View style={styles.container}>
      <FlatList
        ref={flatListRef}
        data={posts}
        renderItem={renderPostItem}
        keyExtractor={(item) => item.id}
        onEndReached={loadMorePosts}
        onEndReachedThreshold={0.5}
        ListFooterComponent={renderFooter}
        showsVerticalScrollIndicator={false}
        pagingEnabled={true}
        snapToInterval={SCREEN_HEIGHT}
        decelerationRate="fast"
        initialScrollIndex={initialPostIndex}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        getItemLayout={(data: any, index: number) => ({
          length: SCREEN_HEIGHT,
          offset: SCREEN_HEIGHT * index,
          index,
        })}
        onScrollToIndexFailed={(info: any) => {
          setTimeout(() => {
            flatListRef.current?.scrollToIndex({ index: info.index, animated: false });
          }, 500);
        }}
      />
    </View>
  );
}

/* ---------------------------------------------------------
   STYLES
----------------------------------------------------------*/
const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: "#000" 
  },

  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#000",
  },

  postItem: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    backgroundColor: "#000",
  },

  responsiveMediaContainer: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    backgroundColor: "#000",
    position: "relative",
    justifyContent: "center",
    alignItems: "center",
  },

  mediaWrapper: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },

  responsiveMedia: {
    width: "100%",
    height: "100%",
  },

  muteIndicatorReels: {
    position: "absolute",
    top: 100,
    right: 20,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    borderRadius: 20,
    padding: 8,
    zIndex: 50,
  },

  /* Top User Info Bar */
  topUserInfoBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    paddingTop: Platform.OS === "ios" ? 50 : 40,
    paddingHorizontal: 16,
    paddingBottom: 16,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    zIndex: 10,
    flexDirection: "row",
    alignItems: "center",
  },

  backButton: {
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    borderRadius: 20,
    padding: 8,
    marginRight: 12,
  },

  topUserRow: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },

  topUserDetails: {
    marginLeft: 12,
    flex: 1,
  },

  topUsername: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFF",
  },

  topTimestamp: {
    fontSize: 11,
    color: "rgba(255, 255, 255, 0.9)",
    marginTop: 2,
  },

  /* Glass Bottom Overlay - Evenly Distributed */
  glassBottomOverlay: {
    position: "absolute",
    left: 16,
    right: 16,
    zIndex: 10,
    borderRadius: 20,
    overflow: "hidden",
  },

  glassBackground: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(40, 40, 40, 0.9)",
    borderRadius: 20,
  },

  glassContentRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 12,
  },

  glassInfoItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },

  glassInfoText: {
    color: "#FFF",
    fontSize: 12,
    fontWeight: "600",
  },

  glassChevronContainer: {
    width: 30,
    alignItems: "center",
    justifyContent: "center",
  },

  /* Bottom Navigation Bar */
  bottomNavBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "flex-end",
    paddingTop: 8,
    backgroundColor: "#000",
    zIndex: 20,
  },

  navItem: {
    alignItems: "center",
    justifyContent: "center",
    minWidth: 60,
  },

  navLabelWhite: {
    fontSize: 9,
    color: "#fff",
    marginTop: 4,
  },

  centerNavButton: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: -25,
  },

  centerNavButtonInner: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#333",
  },

  /* Expanded Details Overlay */
  expandedDetailsOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#FFF",
    zIndex: 70,
  },

  shrunkMediaContainer: {
    width: "100%",
    height: SCREEN_HEIGHT * 0.45,
    backgroundColor: "#000",
    position: "relative",
  },

  shrunkMediaWrapper: {
    width: "100%",
    height: "100%",
  },

  shrunkVideo: {
    width: "100%",
    height: "100%",
  },

  muteIndicatorShrunk: {
    position: "absolute",
    top: 16,
    right: 16,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    borderRadius: 16,
    padding: 6,
  },

  modernCloseButton: {
    position: "absolute",
    top: Platform.OS === "ios" ? 50 : 40,
    right: 20,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    borderRadius: 25,
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },

  detailsContent: {
    flex: 1,
    backgroundColor: "#FFF",
  },

  /* User Row with Dropdown Button */
  detailsUserRowContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },

  detailsUserRow: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },

  detailsUserInfo: {
    marginLeft: 12,
    flex: 1,
  },

  detailsUsername: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000",
  },

  detailsTimestamp: {
    fontSize: 13,
    color: "#999",
    marginTop: 2,
  },

  dropdownButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#F5F5F5",
    alignItems: "center",
    justifyContent: "center",
  },

  detailsActions: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },

  detailsActionBtn: {
    alignItems: "center",
    gap: 4,
  },

  detailsActionText: {
    fontSize: 13,
    color: "#666",
    fontWeight: "500",
  },

  /* Details Cards */
  detailsCard: {
    backgroundColor: "#F8F8F8",
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 12,
    padding: 16,
  },

  detailsCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },

  detailsCardLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#888",
    letterSpacing: 0.5,
  },

  detailsRatingValue: {
    fontSize: 24,
    fontWeight: "700",
    color: "#333",
  },

  detailsReviewText: {
    fontSize: 15,
    color: "#333",
    lineHeight: 22,
  },

  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  detailsLocationText: {
    fontSize: 15,
    color: "#333",
    fontWeight: "500",
    flex: 1,
  },

  detailsCommentsSection: {
    padding: 16,
  },

  detailsCommentsTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000",
    marginBottom: 12,
  },

  noComments: {
    textAlign: "center",
    color: "#8E8E8E",
    marginTop: 20,
    marginBottom: 20,
    fontSize: 14,
  },

  commentItem: {
    flexDirection: "row",
    marginBottom: 20,
    paddingBottom: 20,
    borderBottomWidth: 0.5,
    borderBottomColor: "#EFEFEF",
  },

  commentContent: {
    marginLeft: 12,
    flex: 1,
  },

  commentUsername: {
    fontSize: 14,
    fontWeight: "700",
    color: "#262626",
  },

  commentText: {
    marginTop: 4,
    fontSize: 14,
    color: "#262626",
    lineHeight: 20,
  },

  commentTime: {
    marginTop: 6,
    fontSize: 12,
    color: "#8E8E8E",
  },

  commentInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 0.5,
    borderColor: "#DBDBDB",
  },

  commentInput: {
    flex: 1,
    backgroundColor: "#FAFAFA",
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 12,
    marginRight: 12,
    fontSize: 14,
    borderWidth: 1,
    borderColor: "#DBDBDB",
  },

  sendButton: {
    width: 44,
    height: 44,
    backgroundColor: "#4dd0e1",
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },

  footerLoader: {
    padding: 20,
    alignItems: "center",
  },
});