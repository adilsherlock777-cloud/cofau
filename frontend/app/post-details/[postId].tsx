// app/post-details/[postId].tsx

import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Share,
  Alert,
  Linking,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useAuth } from "../../context/AuthContext";
import UserAvatar from "../../components/UserAvatar";
import axios from "axios";
import { Image } from "expo-image";
import { Video } from "expo-av";

const BACKEND =
  process.env.EXPO_PUBLIC_BACKEND_URL || "https://backend.cofau.com";
const API_URL = `${BACKEND}/api`;

/* ---------------------------------------------------------
   🔥 UNIVERSAL URL NORMALIZER (FINAL VERSION)
----------------------------------------------------------*/
const normalizeUrl = (url) => {
  if (!url) return null;

  if (url.startsWith("http")) return url;

  let cleaned = url.trim();

  // remove duplicate slashes
  cleaned = cleaned.replace(/([^:]\/)\/+/g, "$1");

  // ensure leading slash
  if (!cleaned.startsWith("/")) cleaned = "/" + cleaned;

  const finalUrl = `${BACKEND}${cleaned}`;
  // console.log("PostDetails URL:", url, "→", finalUrl);
  return finalUrl;
};

export default function PostDetailsScreen() {
  const router = useRouter();
  const { postId } = useLocalSearchParams();
  const { token, user } = useAuth();

  const scrollViewRef = useRef(null);
  const videoRef = useRef(null);

  const [post, setPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);

  /* ---------------------------------------------------------
     LOAD POST DETAILS
  ----------------------------------------------------------*/
  useEffect(() => {
    if (postId && token) {
      fetchPostDetails();
      fetchComments();
    }
  }, [postId, token]);

  const fetchPostDetails = async () => {
    try {
      setLoading(true);

      // Fetch fresh feed list and find the matching post
      const res = await axios.get(`${API_URL}/feed`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const found = res.data.find((p) => p.id === postId);

      if (!found) {
        Alert.alert("Error", "Post not found");
        router.back();
        return;
      }

      const normalized = {
        ...found,
        media_url: normalizeUrl(found.media_url),
        image_url: normalizeUrl(found.image_url || found.media_url),
        thumbnail_url: normalizeUrl(found.thumbnail_url),
        user_profile_picture: normalizeUrl(found.user_profile_picture),
      };

      setPost(normalized);
      setIsLiked(normalized.is_liked_by_user || false);
      setLikesCount(normalized.likes_count || 0);
    } catch (e) {
      console.log("❌ Post fetch error", e);
      Alert.alert("Error", "Unable to load post");
    } finally {
      setLoading(false);
    }
  };

  /* ---------------------------------------------------------
     LOAD COMMENTS
  ----------------------------------------------------------*/
  const fetchComments = async () => {
    try {
      const res = await axios.get(`${API_URL}/posts/${postId}/comments`);
      const normalized = res.data.map((c) => ({
        ...c,
        profile_pic: normalizeUrl(c.profile_pic),
      }));
      setComments(normalized);
    } catch (e) {
      console.log("❌ Comment fetch error", e);
    }
  };

  /* ---------------------------------------------------------
     LIKE TOGGLE
  ----------------------------------------------------------*/
  const handleLikeToggle = async () => {
    const prevLiked = isLiked;
    const prevCount = likesCount;

    setIsLiked(!prevLiked);
    setLikesCount(prevLiked ? prevCount - 1 : prevCount + 1);

    try {
      if (prevLiked) {
        await axios.delete(`${API_URL}/posts/${postId}/like`, {
          headers: { Authorization: `Bearer ${token}` },
        });
      } else {
        await axios.post(
          `${API_URL}/posts/${postId}/like`,
          {},
          { headers: { Authorization: `Bearer ${token}` } }
        );
      }
    } catch (e) {
      // revert on failure
      setIsLiked(prevLiked);
      setLikesCount(prevCount);
    }
  };

  /* ---------------------------------------------------------
     ADD COMMENT
  ----------------------------------------------------------*/
  const handleSubmitComment = async () => {
    if (!commentText.trim()) return;

    setSubmittingComment(true);

    try {
      const formData = new FormData();
      formData.append("comment_text", commentText.trim());

      await axios.post(`${API_URL}/posts/${postId}/comment`, formData, {
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

  /* ---------------------------------------------------------
     TIME FORMAT
  ----------------------------------------------------------*/
  const formatTime = (timestamp) => {
    if (!timestamp) return "";
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;

    const mins = Math.floor(diff / 60000);
    const hrs = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    if (hrs < 24) return `${hrs}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
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

  if (!post)
    return (
      <View style={styles.loadingContainer}>
        <Text>Post not found</Text>
      </View>
    );

  const isVideo = (post.media_type || "").toLowerCase() === "video";

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={90}
    >
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={26} color="#000" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.userRowHeader}
          onPress={() => router.push(`/profile?userId=${post.user_id}`)}
        >
          <UserAvatar
            profilePicture={post.user_profile_picture}
            username={post.username}
            level={post.user_level}
            size={40}
            showLevelBadge
          />
          <Text style={styles.headerUsername}>{post.username}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView ref={scrollViewRef} showsVerticalScrollIndicator={false}>
        {/* MEDIA */}
        <View style={styles.mediaContainer}>
          {isVideo ? (
            <Video
              ref={videoRef}
              source={{ uri: post.media_url }}
              style={styles.video}
              resizeMode="cover"
              useNativeControls
              isLooping
            />
          ) : (
            <Image
              source={{ uri: post.image_url }}
              style={styles.postImage}
              contentFit="cover"
            />
          )}
        </View>

        {/* POST DETAILS */}
        <View style={styles.postInfo}>
          <TouchableOpacity
            style={styles.userRow}
            onPress={() => router.push(`/profile?userId=${post.user_id}`)}
          >
            <UserAvatar
              profilePicture={post.user_profile_picture}
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
                // If there's a map_link, open it
                if (post.map_link) {
                  Linking.openURL(post.map_link);
                }
                // If there's only location_name, generate a Google Maps search link
                else if (post.location_name) {
                  const searchUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(post.location_name)}`;
                  Linking.openURL(searchUrl);
                }
              }}
            >
              <Ionicons name="location" size={20} color="#4ECDC4" />
              <Text style={styles.locationText}>
                {post.location_name}
              </Text>
              <Ionicons name="chevron-forward" size={18} color="#4ECDC4" />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* ACTIONS */}
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
            onPress={() =>
              scrollViewRef.current?.scrollToEnd({ animated: true })
            }
          >
            <Ionicons name="chatbubble-outline" size={26} color="#000" />
            <Text style={styles.actionText}>{comments.length}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton}>
            <Ionicons name="share-outline" size={26} color="#000" />
          </TouchableOpacity>
        </View>

        {/* COMMENTS */}
        <View style={styles.commentsSection}>
          <Text style={styles.commentsTitle}>
            Comments ({comments.length})
          </Text>

          {comments.length === 0 ? (
            <Text style={styles.noComments}>No comments yet</Text>
          ) : (
            comments.map((c) => (
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
        </View>

        <View style={{ height: 70 }} />
      </ScrollView>

      {/* COMMENT INPUT */}
      <View style={styles.commentInputContainer}>
        <UserAvatar
          profilePicture={user?.profile_picture}
          username={user?.username}
          size={32}
        />

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
    </KeyboardAvoidingView>
  );
}

/* ---------------------------------------------------------
   STYLES
----------------------------------------------------------*/
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },

  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderBottomWidth: 1,
    borderColor: "#e5e5e5",
  },

  userRowHeader: { flexDirection: "row", alignItems: "center", marginLeft: 12 },

  headerUsername: { fontSize: 16, fontWeight: "600", marginLeft: 10 },

  mediaContainer: { width: "100%", backgroundColor: "#000" },

  video: { width: "100%", height: 350 },

  postImage: { width: "100%", height: 350 },

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

  actionButton: { flexDirection: "row", alignItems: "center", marginRight: 20 },

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
    padding: 10,
    borderTopWidth: 1,
    borderColor: "#eee",
    backgroundColor: "#fff",
  },

  commentInput: {
    flex: 1,
    backgroundColor: "#f2f2f2",
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 8,
    marginHorizontal: 10,
  },

  sendButton: {
    width: 40,
    height: 40,
    backgroundColor: "#4dd0e1",
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
});

