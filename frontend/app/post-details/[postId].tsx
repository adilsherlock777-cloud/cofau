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
  Modal,
  Share,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useAuth } from "../../context/AuthContext";
import UserAvatar from "../../components/UserAvatar";
import axios from "axios";
import { Image } from "expo-image";
import { Video } from "expo-av";
import { normalizeMediaUrl, normalizeProfilePicture } from "../../utils/imageUrlFix";

const BACKEND =
  process.env.EXPO_PUBLIC_BACKEND_URL || "https://backend.cofau.com";
const API_URL = `${BACKEND}/api`;
const SCREEN_HEIGHT = Dimensions.get("window").height;

/* ---------------------------------------------------------
   🔥 UNIVERSAL URL NORMALIZER (FINAL VERSION)
----------------------------------------------------------*/
const normalizeUrl = (url: string | null | undefined): string | null => {
  if (!url) return null;

  if (url.startsWith("http")) return url;

  let cleaned = url.trim();

  // remove duplicate slashes
  cleaned = cleaned.replace(/([^:]\/)\/+/g, "$1");

  // ensure leading slash
  if (!cleaned.startsWith("/")) cleaned = "/" + cleaned;

  const finalUrl = `${BACKEND}${cleaned}`;
  return finalUrl;
};

/* ---------------------------------------------------------
   POST ITEM COMPONENT (for feed view)
----------------------------------------------------------*/
function PostItem({ post, onPostPress, currentPostId, token }: any) {
  const router = useRouter();
  const [isLiked, setIsLiked] = useState(post.is_liked_by_user || false);
  const [likesCount, setLikesCount] = useState(post.likes_count || 0);
  const [isSaved, setIsSaved] = useState(post.is_saved_by_user || false);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const videoRef = useRef(null);

  const isVideo = (post.media_type || "").toLowerCase() === "video";
  const mediaUrl = normalizeMediaUrl(post.media_url || post.image_url);
  const imageUrl = normalizeMediaUrl(post.image_url || post.media_url);
  const profilePic = normalizeProfilePicture(post.user_profile_picture);

  // Ensure we have a valid URL for display (fallback to normalizeUrl if needed)
  const getDisplayUrl = () => {
    if (isVideo) {
      return mediaUrl || normalizeUrl(post.media_url || post.image_url);
    }
    return imageUrl || mediaUrl || normalizeUrl(post.image_url || post.media_url);
  };

  const displayUrl = getDisplayUrl();

  // Debug URLs for share modal
  useEffect(() => {
    if (showShareModal) {
      console.log("🔍 Share Modal Debug:");
      console.log("  Post ID:", post.id);
      console.log("  Is Video:", isVideo);
      console.log("  Original media_url:", post.media_url);
      console.log("  Original image_url:", post.image_url);
      console.log("  Normalized mediaUrl:", mediaUrl);
      console.log("  Normalized imageUrl:", imageUrl);
      console.log("  Display URL:", displayUrl);
    }
  }, [showShareModal, post.id, isVideo, mediaUrl, imageUrl, displayUrl]);

  useEffect(() => {
    if (showComments) {
      fetchComments();
    }
  }, [showComments, post.id]);

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
        await axios.post(
          `${API_URL}/posts/${post.id}/like`,
          {},
          { headers: { Authorization: `Bearer ${token}` } }
        );
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
        await axios.post(
          `${API_URL}/posts/${post.id}/save`,
          {},
          { headers: { Authorization: `Bearer ${token}` } }
        );
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

  const handleSharePost = async () => {
    try {
      const postUrl = `${BACKEND}/post/${post.id}`;
      const shareText = `${post.username} shared a post on Cofau!\n\n${post.review_text || ''}\n\nRating: ${post.rating}/10${post.location_name ? `\n📍 ${post.location_name}` : ''}\n\nView post: ${postUrl}`;

      const shareOptions = {
        message: shareText,
        url: postUrl,
        title: `Check out ${post.username}'s post on Cofau`,
      };

      const result = await Share.share(shareOptions);

      if (result.action === Share.sharedAction) {
        setShowShareModal(false);
        console.log("Post shared successfully");
      } else if (result.action === Share.dismissedAction) {
        console.log("Share dismissed");
      }
    } catch (error) {
      console.error("❌ Error sharing post:", error);
      Alert.alert("Error", "Unable to share post. Please try again.");
    }
  };

  return (
    <View style={styles.postItem}>
      {/* Header */}
      <View style={styles.postHeader}>
        <TouchableOpacity
          style={styles.userRowHeader}
          onPress={() => router.push(`/profile?userId=${post.user_id}`)}
        >
          <UserAvatar
            profilePicture={profilePic}
            username={post.username}
            level={post.user_level}
            size={40}
            showLevelBadge
          />
          <Text style={styles.headerUsername}>{post.username}</Text>
        </TouchableOpacity>
      </View>

      {/* Media */}
      <TouchableOpacity
        onPress={() => onPostPress(post.id)}
        activeOpacity={0.95}
      >
        <View style={styles.mediaContainer}>
          {isVideo ? (
            <Video
              ref={videoRef}
              source={{ uri: mediaUrl }}
              style={styles.video}
              resizeMode="cover"
              useNativeControls
              isLooping
            />
          ) : (
            <Image
              source={{ uri: imageUrl }}
              style={styles.postImage}
              contentFit="cover"
            />
          )}
        </View>
      </TouchableOpacity>

      {/* Post Details */}
      <View style={styles.postInfo}>
        <TouchableOpacity
          style={styles.userRow}
          onPress={() => router.push(`/profile?userId=${post.user_id}`)}
        >
          <UserAvatar
            profilePicture={profilePic}
            username={post.username}
            size={40}
            level={post.user_level}
            showLevelBadge
          />
          <View style={{ marginLeft: 10 }}>
            <Text style={styles.username}>{post.username}</Text>
            <Text style={styles.timestamp}>{formatTime(post.created_at)}</Text>
          </View>
        </TouchableOpacity>

        {post.review_text ? (
          <Text style={styles.caption}>{post.review_text}</Text>
        ) : null}

        {post.rating ? (
          <View style={styles.ratingRow}>
            <Ionicons name="star" size={20} color="#FFD700" />
            <Text style={styles.ratingText}>{post.rating}/10</Text>
          </View>
        ) : null}

        {post.location_name ? (
          <TouchableOpacity
            style={styles.locationRow}
            onPress={() => {
              if (post.map_link) {
                Linking.openURL(post.map_link);
              } else if (post.location_name) {
                const searchUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(post.location_name)}`;
                Linking.openURL(searchUrl);
              }
            }}
          >
            <Ionicons name="location" size={20} color="#4ECDC4" />
            <Text style={styles.locationText}>{post.location_name}</Text>
            <Ionicons name="chevron-forward" size={18} color="#4ECDC4" />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Actions */}
      <View style={styles.actionsRow}>
        <TouchableOpacity style={styles.actionButton} onPress={handleLikeToggle}>
          <Ionicons
            name={isLiked ? "heart" : "heart-outline"}
            size={28}
            color={isLiked ? "#FF6B6B" : "#000"}
          />
          <Text style={styles.actionText}>{likesCount}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => setShowComments(!showComments)}
        >
          <Ionicons name="chatbubble-outline" size={26} color="#000" />
          <Text style={styles.actionText}>{post.comments_count || comments.length}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => setShowShareModal(true)}
        >
          <Ionicons name="share-outline" size={26} color="#000" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton} onPress={handleSaveToggle}>
          <Ionicons
            name={isSaved ? "bookmark" : "bookmark-outline"}
            size={26}
            color={isSaved ? "#4dd0e1" : "#000"}
          />
        </TouchableOpacity>
      </View>

      {/* Comments Section */}
      {showComments && (
        <View style={styles.commentsSection}>
          <Text style={styles.commentsTitle}>
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
                  size={32}
                />
                <View style={styles.commentContent}>
                  <Text style={styles.commentUsername}>{c.username}</Text>
                  <Text style={styles.commentText}>{c.comment_text}</Text>
                  <Text style={styles.commentTime}>
                    {formatTime(c.created_at)}
                  </Text>
                </View>
              </View>
            ))
          )}

          {/* Comment Input */}
          <View style={styles.commentInputContainer}>
            <TextInput
              value={commentText}
              onChangeText={setCommentText}
              placeholder="Add a comment…"
              style={styles.commentInput}
            />

            <TouchableOpacity
              style={[
                styles.sendButton,
                !commentText.trim() && { backgroundColor: "#ccc" },
              ]}
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

      {/* Share Modal */}
      <Modal
        visible={showShareModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowShareModal(false)}
      >
        <View style={styles.shareModalOverlay}>
          <View style={styles.shareModalContent}>
            <View style={styles.shareModalHeader}>
              <Text style={styles.shareModalTitle}>Share Post</Text>
              <TouchableOpacity onPress={() => setShowShareModal(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            {/* Post Image */}
            {displayUrl && (
              <View style={styles.sharePostImageContainer}>
                {isVideo ? (
                  <Video
                    source={{ uri: displayUrl }}
                    style={styles.sharePostImage}
                    resizeMode="cover"
                    useNativeControls={false}
                    isLooping
                    shouldPlay={false}
                  />
                ) : (
                  <Image
                    source={{ uri: displayUrl }}
                    style={styles.sharePostImage}
                    contentFit="cover"
                    transition={200}
                  />
                )}
              </View>
            )}

            {/* Post Details */}
            <View style={styles.sharePostDetails}>
              {/* Rating */}
              {post.rating ? (
                <View style={styles.shareDetailRow}>
                  <Ionicons name="star" size={20} color="#FFD700" />
                  <Text style={styles.shareDetailText}>-{post.rating}/10</Text>
                </View>
              ) : null}

              {/* Location */}
              {post.location_name ? (
                <View style={styles.shareDetailRow}>
                  <Ionicons name="location" size={20} color="#FF3B30" />
                  <Text style={styles.shareDetailText}>-{post.location_name}</Text>
                </View>
              ) : null}

              {/* Link */}
              <TouchableOpacity
                style={styles.shareDetailRow}
                onPress={() => {
                  const postUrl = `${BACKEND}/post/${post.id}`;
                  Linking.openURL(postUrl).catch((err) =>
                    console.error("Failed to open URL:", err)
                  );
                }}
              >
                <Ionicons name="link" size={20} color="#888" />
                <Text style={styles.shareLinkText}>
                  click on this link to view on Cofau
                </Text>
              </TouchableOpacity>
            </View>

            {/* Share Button */}
            <TouchableOpacity
              style={styles.shareButton}
              onPress={handleSharePost}
            >
              <Ionicons name="share-outline" size={20} color="#fff" />
              <Text style={styles.shareButtonText}>Share Post</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

export default function PostDetailsScreen() {
  const router = useRouter();
  const { postId } = useLocalSearchParams();
  const { token, user } = useAuth();

  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [skip, setSkip] = useState(0);
  const [initialPostIndex, setInitialPostIndex] = useState(0);
  const flatListRef = useRef<FlatList<any> | null>(null);

  const LIMIT = 10;

  /* ---------------------------------------------------------
     LOAD INITIAL POST AND FEED
  ----------------------------------------------------------*/
  useEffect(() => {
    if (postId && token) {
      loadInitialPost();
    }
  }, [postId, token]);

  const loadInitialPost = async () => {
    try {
      setLoading(true);

      // Fetch feed to find the post and get initial posts
      const res = await axios.get(`${API_URL}/feed?limit=50&skip=0`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      // Find the current post index
      const currentIndex = res.data.findIndex((p) => p.id === postId);

      if (currentIndex === -1) {
        Alert.alert("Error", "Post not found");
        router.back();
        return;
      }

      // Normalize all posts
      const normalized = res.data.map((p: any) => ({
        ...p,
        media_url: normalizeUrl(p.media_url),
        image_url: normalizeUrl(p.image_url || p.media_url),
        thumbnail_url: normalizeUrl(p.thumbnail_url),
        user_profile_picture: normalizeUrl(p.user_profile_picture),
      }));

      // Start from the current post
      const postsFromCurrent = normalized.slice(currentIndex);

      setPosts(postsFromCurrent);
      setInitialPostIndex(0);
      setSkip(postsFromCurrent.length);

      // Scroll to the current post after a short delay
      setTimeout(() => {
        flatListRef.current?.scrollToIndex({
          index: 0,
          animated: false,
        });
      }, 100);
    } catch (e) {
      console.log("❌ Post fetch error", e);
      Alert.alert("Error", "Unable to load post");
    } finally {
      setLoading(false);
    }
  };

  /* ---------------------------------------------------------
     LOAD MORE POSTS (infinite scroll)
  ----------------------------------------------------------*/
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

      // Normalize new posts
      const normalized = res.data.map((p) => ({
        ...p,
        media_url: normalizeUrl(p.media_url),
        image_url: normalizeUrl(p.image_url || p.media_url),
        thumbnail_url: normalizeUrl(p.thumbnail_url),
        user_profile_picture: normalizeUrl(p.user_profile_picture),
      }));

      // Filter out duplicates
      const existingIds = new Set(posts.map((p: any) => p.id));
      const newPosts = normalized.filter((p: any) => !existingIds.has(p.id));

      setPosts((prev) => [...prev, ...newPosts]);
      setSkip((prev) => prev + newPosts.length);

      if (newPosts.length < LIMIT) {
        setHasMore(false);
      }
    } catch (e) {
      console.log("❌ Load more error", e);
    } finally {
      setLoadingMore(false);
    }
  };

  /* ---------------------------------------------------------
     HANDLE POST PRESS (navigate to that post)
  ----------------------------------------------------------*/
  const handlePostPress = useCallback(
    (newPostId: string) => {
      if (newPostId === postId) return; // Already viewing this post

      // Always navigate to new post detail page
      router.push(`/post-details/${newPostId}`);
    },
    [postId, router]
  );

  /* ---------------------------------------------------------
     RENDER POST ITEM
  ----------------------------------------------------------*/
  const renderPostItem = useCallback(
    ({ item, index }: any) => {
      return (
        <PostItem
          post={item}
          onPostPress={handlePostPress}
          currentPostId={postId}
          token={token}
        />
      );
    },
    [postId, token, handlePostPress]
  );

  /* ---------------------------------------------------------
     RENDER FOOTER (loading indicator)
  ----------------------------------------------------------*/
  const renderFooter = () => {
    if (!loadingMore) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color="#4dd0e1" />
      </View>
    );
  };

  /* ---------------------------------------------------------
     LOADING UI
  ----------------------------------------------------------*/
  if (loading)
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4dd0e1" />
        <Text>Loading post...</Text>
      </View>
    );

  if (posts.length === 0)
    return (
      <View style={styles.loadingContainer}>
        <Text>Post not found</Text>
      </View>
    );

  return (
    <View style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={26} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Posts</Text>
        <View style={{ width: 26 }} />
      </View>

      {/* FLATLIST FOR CONTINUOUS SCROLLING */}
      <FlatList
        // @ts-ignore - FlatList ref type issue
        ref={flatListRef}
        data={posts}
        renderItem={renderPostItem}
        keyExtractor={(item) => item.id}
        onEndReached={loadMorePosts}
        onEndReachedThreshold={0.5}
        ListFooterComponent={renderFooter}
        showsVerticalScrollIndicator={false}
        pagingEnabled={false}
        snapToInterval={SCREEN_HEIGHT}
        decelerationRate="fast"
        initialScrollIndex={initialPostIndex}
        getItemLayout={(data: any, index: number) => ({
          length: SCREEN_HEIGHT,
          offset: SCREEN_HEIGHT * index,
          index,
        })}
        onScrollToIndexFailed={(info: any) => {
          // Handle scroll to index failure
          const wait = new Promise((resolve) => setTimeout(resolve, 500));
          wait.then(() => {
            flatListRef.current?.scrollToIndex({
              index: info.index,
              animated: false,
            });
          });
        }}
      />
    </View>
  );
}

/* ---------------------------------------------------------
   STYLES
----------------------------------------------------------*/
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },

  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    borderBottomWidth: 1,
    borderColor: "#e5e5e5",
    backgroundColor: "#fff",
    zIndex: 10,
  },

  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#000",
  },

  userRowHeader: {
    flexDirection: "row",
    alignItems: "center",
  },

  headerUsername: { fontSize: 16, fontWeight: "600", marginLeft: 10 },

  postItem: {
    width: "100%",
    minHeight: SCREEN_HEIGHT - 100,
    backgroundColor: "#fff",
  },

  postHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderBottomWidth: 1,
    borderColor: "#e5e5e5",
  },

  mediaContainer: { width: "100%", backgroundColor: "#000" },

  video: { width: "100%", height: 400 },

  postImage: { width: "100%", height: 400 },

  postInfo: { padding: 16 },

  userRow: { flexDirection: "row", alignItems: "center", marginBottom: 10 },

  username: { fontSize: 15, fontWeight: "bold" },

  timestamp: { fontSize: 12, color: "#888" },

  caption: { marginTop: 8, fontSize: 15, lineHeight: 22 },

  ratingRow: { flexDirection: "row", alignItems: "center", marginTop: 8 },

  ratingText: { marginLeft: 6, fontWeight: "600" },

  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    backgroundColor: "#F3FFFD",
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#CFFAF0",
  },

  locationText: {
    marginLeft: 6,
    fontSize: 14,
    flex: 1,
    fontWeight: "500",
    color: "#333",
  },

  actionsRow: {
    padding: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#eee",
    flexDirection: "row",
  },

  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 20,
  },

  actionText: { marginLeft: 6, fontSize: 14 },

  commentsSection: { padding: 16 },

  commentsTitle: { fontSize: 18, fontWeight: "bold", marginBottom: 12 },

  noComments: { textAlign: "center", color: "#777", marginTop: 10 },

  commentItem: { flexDirection: "row", marginBottom: 14 },

  commentContent: { marginLeft: 10, flex: 1 },

  commentUsername: { fontSize: 14, fontWeight: "600" },

  commentText: { marginTop: 2, fontSize: 14 },

  commentTime: { marginTop: 4, fontSize: 12, color: "#666" },

  commentInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderColor: "#eee",
  },

  commentInput: {
    flex: 1,
    backgroundColor: "#f2f2f2",
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 8,
    marginRight: 10,
  },

  sendButton: {
    width: 40,
    height: 40,
    backgroundColor: "#4dd0e1",
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },

  footerLoader: {
    padding: 20,
    alignItems: "center",
  },

  // Share Modal Styles
  shareModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },

  shareModalContent: {
    backgroundColor: "#fff",
    borderRadius: 20,
    width: "90%",
    maxWidth: 400,
    padding: 20,
    alignItems: "center",
  },

  shareModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
    marginBottom: 20,
  },

  shareModalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#000",
  },

  sharePostImageContainer: {
    width: "100%",
    height: 300,
    borderRadius: 15,
    overflow: "hidden",
    marginBottom: 20,
    backgroundColor: "#000",
  },

  sharePostImage: {
    width: "100%",
    height: "100%",
  },

  sharePostDetails: {
    width: "100%",
    marginBottom: 20,
  },

  shareDetailRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    paddingVertical: 8,
  },

  shareDetailText: {
    marginLeft: 8,
    fontSize: 16,
    color: "#333",
    fontWeight: "500",
  },

  shareLinkText: {
    marginLeft: 8,
    fontSize: 16,
    color: "#888",
    textDecorationLine: "underline",
  },

  shareButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#4dd0e1",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 25,
    width: "100%",
  },

  shareButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },
});
