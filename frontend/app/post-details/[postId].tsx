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
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useAuth } from "../../context/AuthContext";
import UserAvatar from "../../components/UserAvatar";
import axios from "axios";
import { Image } from "expo-image";
import { Video } from "expo-av";

const API_BASE_URL =
  process.env.EXPO_PUBLIC_BACKEND_URL || "https://backend.cofau.com";
const API_URL = `${API_BASE_URL}/api`;

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

  useEffect(() => {
    if (postId && token) {
      fetchPostDetails();
      fetchComments();
    }
  }, [postId, token]);

  const buildURL = (url) => {
    if (!url) return null;
    return url.startsWith("http")
      ? url
      : `${API_BASE_URL}${url.startsWith("/") ? url : "/" + url}`;
  };

  const fetchPostDetails = async () => {
    try {
      setLoading(true);

      const res = await axios.get(`${API_URL}/feed`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const found = res.data.find((p) => p.id === postId);

      if (!found) {
        Alert.alert("Error", "Post not found");
        router.back();
        return;
      }

      setPost({
        ...found,
        full_media_url: buildURL(found.media_url),
        full_image_url: buildURL(found.image_url),
        full_thumbnail_url: buildURL(found.thumbnail_url),
      });

      setIsLiked(found.is_liked_by_user || false);
      setLikesCount(found.likes_count || 0);
      setLoading(false);
    } catch (e) {
      console.log("❌ Post fetch error", e);
      Alert.alert("Error", "Unable to load post");
      setLoading(false);
    }
  };

  const fetchComments = async () => {
    try {
      const res = await axios.get(`${API_URL}/posts/${postId}/comments`);
      setComments(res.data);
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
      setIsLiked(prevLiked);
      setLikesCount(prevCount);
    }
  };

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

  const formatTime = (timestamp) => {
    if (!timestamp) return "";
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const mins = Math.floor(diffMs / 60000);
    const hrs = Math.floor(diffMs / 3600000);
    const days = Math.floor(diffMs / 86400000);

    if (mins < 60) return `${mins}m ago`;
    if (hrs < 24) return `${hrs}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

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

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={90}
    >
      {/* Header */}
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
        {/* MEDIA SECTION */}
        <View style={styles.mediaContainer}>
          {post.media_type === "video" ? (
            <Video
              ref={videoRef}
              source={{ uri: post.full_media_url }}
              style={styles.video}
              useNativeControls
              resizeMode="cover"
              isLooping
            />
          ) : (
            <Image
              source={{ uri: post.full_image_url }}
              style={styles.postImage}
              contentFit="cover"
            />
          )}
        </View>

        {/* POST INFO */}
        <View style={styles.postInfo}>
          {/* User Row */}
          <TouchableOpacity
            style={styles.userRow}
            onPress={() => router.push(`/profile?userId=${post.user_id}`)}
          >
            <UserAvatar
              profilePicture={post.user_profile_picture}
              username={post.username}
              level={post.user_level}
              size={40}
              showLevelBadge
            />
            <View style={{ marginLeft: 10 }}>
              <Text style={styles.username}>{post.username}</Text>
              <Text style={styles.timestamp}>{formatTime(post.created_at)}</Text>
            </View>
          </TouchableOpacity>

          {/* Review Text */}
          {post.review_text ? (
            <Text style={styles.caption}>{post.review_text}</Text>
          ) : null}

          {/* Rating */}
          {post.rating && (
            <View style={styles.ratingRow}>
              <Ionicons name="star" size={20} color="#FFD700" />
              <Text style={styles.ratingText}>{post.rating}/10</Text>
            </View>
          )}

          {/* Location */}
          {post.map_link && (
            <View style={styles.locationRow}>
              <Ionicons name="location" size={20} color="#666" />
              <Text style={styles.locationText}>{post.map_link}</Text>
            </View>
          )}
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
            onPress={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
          >
            <Ionicons name="chatbubble-outline" size={26} color="#000" />
            <Text style={styles.actionText}>{comments.length}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton} onPress={() => {}}>
            <Ionicons name="share-outline" size={26} color="#000" />
          </TouchableOpacity>
        </View>

        {/* COMMENTS */}
        <View style={styles.commentsSection}>
          <Text style={styles.commentsTitle}>Comments ({comments.length})</Text>

          {comments.length === 0 ? (
            <Text style={styles.noComments}>No comments yet</Text>
          ) : (
            comments.map((c) => (
              <View key={c.id} style={styles.commentItem}>
                <UserAvatar
                  profilePicture={c.profile_pic}
                  username={c.username}
                  size={32}
                  showLevelBadge
                />
                <View style={styles.commentContent}>
                  <Text style={styles.commentUsername}>{c.username}</Text>
                  <Text style={styles.commentText}>{c.comment_text}</Text>
                  <Text style={styles.commentTime}>{formatTime(c.created_at)}</Text>
                </View>
              </View>
            ))
          )}
        </View>

        <View style={{ height: 60 }} />
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
          placeholder="Add a comment..."
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

  locationRow: { flexDirection: "row", alignItems: "center", marginTop: 8 },

  locationText: { marginLeft: 6, fontSize: 14 },

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
