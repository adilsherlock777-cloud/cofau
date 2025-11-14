import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
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
import axios from "axios";
import { Video } from "expo-av"; // ⭐ VIDEO SUPPORT ADDED
import UserAvatar from "../../components/UserAvatar";

const API_URL =
  process.env.EXPO_PUBLIC_API_URL || "https://backend.cofau.com/api";
const BACKEND_URL =
  process.env.EXPO_PUBLIC_BACKEND_URL || "https://backend.cofau.com";

export default function PostDetailsScreen() {
  const router = useRouter();
  const { postId } = useLocalSearchParams();
  const { token, user } = useAuth();
  const scrollViewRef = useRef(null);

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

  // ⭐ FETCH POST DETAILS
  const fetchPostDetails = async () => {
    try {
      setLoading(true);

      const response = await axios.get(`${API_URL}/feed`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const found = response.data.find((p) => p.id === postId);

      if (!found) {
        Alert.alert("Error", "Post not found");
        router.back();
        return;
      }

      // Build full media URL
      let fullUrl = found.media_url || found.image_url;
      if (fullUrl && !fullUrl.startsWith("http")) {
        fullUrl = `${BACKEND_URL}${
          fullUrl.startsWith("/") ? fullUrl : "/" + fullUrl
        }`;
      }

      const mediaType =
        found.media_type ||
        (fullUrl.endsWith(".mp4") || fullUrl.endsWith(".mov")
          ? "video"
          : "image");

      setPost({
        ...found,
        full_image_url: fullUrl,
        media_type: mediaType,
      });

      setIsLiked(found.is_liked_by_user || false);
      setLikesCount(found.likes_count || 0);
    } catch (err) {
      console.error("❌ Post fetch error:", err);
      Alert.alert("Error", "Failed to load post");
    } finally {
      setLoading(false);
    }
  };

  // ⭐ FETCH COMMENTS
  const fetchComments = async () => {
    try {
      const res = await axios.get(`${API_URL}/posts/${postId}/comments`);
      setComments(res.data);
    } catch (err) {
      console.error("❌ Comments fetch error:", err);
    }
  };

  // ⭐ TOGGLE LIKE
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
    } catch (err) {
      console.error("❌ Like toggle failed:", err);
      // revert
      setIsLiked(prevLiked);
      setLikesCount(prevCount);
    }
  };

  // ⭐ SUBMIT COMMENT
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
    } catch (err) {
      console.error("❌ Add comment failed:", err);
      Alert.alert("Error", "Failed to add comment.");
    } finally {
      setSubmittingComment(false);
    }
  };

  // ⭐ SHARE POST
  const handleShare = async () => {
    try {
      const message = `Check this post on Cofau\n\n${post.review_text || ""}\n\n${
        post.full_image_url || ""
      }`;

      if (Platform.OS === "web" && navigator.share) {
        await navigator.share({
          title: "Cofau",
          text: message,
          url: post.full_image_url,
        });
      } else {
        await Share.share({ message });
      }
    } catch (err) {}
  };

  const formatTimestamp = (ts) => {
    if (!ts) return "";
    const d = new Date(ts);
    const diff = Date.now() - d.getTime();
    const mins = Math.floor(diff / 60000);
    const hrs = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (mins < 60) return `${mins}m ago`;
    if (hrs < 24) return `${hrs}h ago`;
    if (days < 7) return `${days}d ago`;
    return d.toLocaleDateString();
  };

  if (loading || !post) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4dd0e1" />
        <Text style={styles.loadingText}>Loading post...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={26} color="#000" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.headerUser}
          onPress={() => router.push(`/profile?userId=${post.user_id}`)}
        >
          <UserAvatar
            profilePicture={post.user_profile_picture}
            username={post.username}
            size={36}
            level={post.user_level}
            showLevelBadge={true}
          />
          <Text style={styles.headerUsername}>{post.username}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView ref={scrollViewRef}>

        {/* ⭐ MEDIA SECTION (photo/video) */}
        <View style={styles.mediaContainer}>
          {post.media_type === "video" ? (
            <Video
              source={{ uri: post.full_image_url }}
              style={styles.media}
              useNativeControls
              resizeMode="cover"
              shouldPlay
              isLooping
            />
          ) : (
            <Image
              source={{ uri: post.full_image_url }}
              style={styles.media}
              resizeMode="cover"
            />
          )}
        </View>

        {/* USER & CAPTION */}
        <View style={styles.content}>
          <TouchableOpacity
            style={styles.userRow}
            onPress={() => router.push(`/profile?userId=${post.user_id}`)}
          >
            <UserAvatar
              profilePicture={post.user_profile_picture}
              username={post.username}
              size={40}
              level={post.user_level}
              showLevelBadge={true}
            />
            <View>
              <Text style={styles.username}>{post.username}</Text>
              <Text style={styles.timestamp}>
                {formatTimestamp(post.created_at)}
              </Text>
            </View>
          </TouchableOpacity>

          {post.review_text ? (
            <Text style={styles.caption}>{post.review_text}</Text>
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
            onPress={() => scrollViewRef.current?.scrollToEnd()}
          >
            <Ionicons name="chatbubble-outline" size={26} color="#000" />
            <Text style={styles.actionText}>{comments.length}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton} onPress={handleShare}>
            <Ionicons name="share-outline" size={26} color="#000" />
          </TouchableOpacity>
        </View>

        {/* COMMENTS */}
        <View style={styles.commentsSection}>
          <Text style={styles.commentsTitle}>
            Comments ({comments.length})
          </Text>

          {comments.length === 0 && (
            <Text style={styles.noComments}>No comments yet.</Text>
          )}

          {comments.map((c) => (
            <View key={c.id} style={styles.commentItem}>
              <UserAvatar
                profilePicture={c.profile_pic}
                username={c.username}
                size={32}
                level={c.level}
                showLevelBadge={true}
              />
              <View style={{ marginLeft: 10 }}>
                <Text style={styles.commentName}>{c.username}</Text>
                <Text style={styles.commentText}>{c.comment_text}</Text>
                <Text style={styles.commentTime}>
                  {formatTimestamp(c.created_at)}
                </Text>
              </View>
            </View>
          ))}
        </View>

        <View style={{ height: 80 }} />
      </ScrollView>

      {/* ADD COMMENT BAR */}
      <View style={styles.commentInputBar}>
        <UserAvatar
          profilePicture={user?.profile_picture}
          username={user?.username}
          size={32}
        />

        <TextInput
          style={styles.input}
          placeholder="Add a comment..."
          value={commentText}
          onChangeText={setCommentText}
        />

        <TouchableOpacity
          style={[
            styles.sendButton,
            !commentText.trim() && styles.sendDisabled,
          ]}
          disabled={!commentText.trim()}
          onPress={handleSubmitComment}
        >
          <Ionicons name="send" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

/* --------------------- STYLES ---------------------- */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },

  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { marginTop: 10, color: "#666" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderBottomWidth: 1,
    borderColor: "#eee",
  },

  headerUser: { flexDirection: "row", alignItems: "center", marginLeft: 10 },
  headerUsername: { marginLeft: 10, fontSize: 16, fontWeight: "600" },

  mediaContainer: { width: "100%", aspectRatio: 1, backgroundColor: "#000" },
  media: { width: "100%", height: "100%" },

  content: { padding: 16 },

  userRow: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  username: { fontSize: 16, fontWeight: "bold" },
  timestamp: { fontSize: 12, color: "#777" },

  caption: { marginTop: 10, fontSize: 15, color: "#333" },

  actionsRow: {
    flexDirection: "row",
    padding: 16,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#eee",
  },
  actionButton: { flexDirection: "row", alignItems: "center", marginRight: 20 },
  actionText: { marginLeft: 6, fontSize: 15 },

  commentsSection: { padding: 16 },
  commentsTitle: { fontSize: 18, fontWeight: "bold", marginBottom: 12 },
  noComments: { textAlign: "center", color: "#aaa" },

  commentItem: { flexDirection: "row", marginBottom: 16 },
  commentName: { fontWeight: "700" },
  commentText: { marginTop: 2, color: "#333" },
  commentTime: { marginTop: 4, fontSize: 12, color: "#777" },

  commentInputBar: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    borderTopWidth: 1,
    borderColor: "#eee",
    backgroundColor: "#fff",
  },
  input: {
    flex: 1,
    backgroundColor: "#f2f2f2",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    marginHorizontal: 10,
  },

  sendButton: {
    backgroundColor: "#4dd0e1",
    padding: 10,
    borderRadius: 20,
  },
  sendDisabled: {
    backgroundColor: "#ccc",
  },
});
