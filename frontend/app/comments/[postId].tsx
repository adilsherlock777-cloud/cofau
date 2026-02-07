import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { getComments, addComment } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import UserAvatar from '../../components/UserAvatar';

// 🔥 SAME universal DP normalizer we applied everywhere
const normalizeDP = (input: any) => {
  if (!input) return null;

  if (typeof input === "object") {
    input =
      input.profile_picture ||
      input.user_profile_picture ||
      input.profile_pic ||
      input.profile_picture_url ||
      input.userProfilePicture ||
      input.profilePicture ||
      null;
  }

  if (!input) return null;
  if (input.startsWith("http")) return input;

  const BASE = process.env.EXPO_PUBLIC_BACKEND_URL || "https://api.cofau.com";
  if (!input.startsWith("/")) return `${BASE}/${input}`;

  return `${BASE}${input}`;
};

export default function CommentsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { token } = useAuth();
  
  // Handle postId - it might be a string or array from expo-router
  const postId = Array.isArray(params.postId) ? params.postId[0] : params.postId;

  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (postId) {
      console.log('📝 CommentsScreen - postId:', postId, typeof postId);
      fetchComments();
    } else {
      console.error('❌ CommentsScreen - No postId found in params:', params);
      Alert.alert('Error', 'Post ID is missing. Please go back and try again.');
    }
  }, [postId]);

  const fetchComments = async () => {
    if (!postId) {
      console.error('❌ fetchComments - No postId available');
      return;
    }
    
    // Normalize postId
    const normalizedPostId = Array.isArray(postId) ? postId[0] : String(postId);
    
    if (!normalizedPostId || normalizedPostId === 'undefined' || normalizedPostId === 'null') {
      console.error('❌ fetchComments - Invalid postId:', postId, 'normalized:', normalizedPostId);
      return;
    }
    
    try {
      setLoading(true);
      console.log('📤 Fetching comments for postId:', normalizedPostId);
      const data = await getComments(normalizedPostId);

      // 🔥 Normalize DP inside every comment
      const fixed = data.map((c) => ({
        ...c,
        profile_pic: normalizeDP(
          c.profile_pic ||
          c.profile_picture ||
          c.user_profile_picture ||
          c.profile_picture_url ||
          c.userProfilePicture
        ),
      }));

      setComments(fixed);
    } catch (error) {
      console.error('Error fetching comments:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddComment = async () => {
    if (!commentText.trim()) return;
    
    // Normalize postId again to ensure it's correct
    const normalizedPostId = Array.isArray(postId) ? postId[0] : String(postId);
    
    if (!normalizedPostId || normalizedPostId === 'undefined' || normalizedPostId === 'null') {
      Alert.alert('Error', 'Post ID is missing or invalid. Please go back and try again.');
      console.error('❌ Invalid postId in handleAddComment:', postId, 'normalized:', normalizedPostId);
      return;
    }

    setSubmitting(true);
    try {
      console.log('📤 Submitting comment for postId:', normalizedPostId);
      await addComment(normalizedPostId, commentText, token);
      setCommentText('');
      await fetchComments();
    } catch (error) {
      console.error('❌ Error adding comment:', error);
      const errorMessage = error?.response?.data?.detail || 
                          error?.message || 
                          'Failed to add comment. Please check your connection and try again.';
      
      Alert.alert('Error', errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  const formatTimestamp = (timestamp) => {
    const commentDate = new Date(timestamp);
    return commentDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <View style={styles.container}>
      {/* HEADER - OUTSIDE KeyboardAvoidingView so it stays fixed */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Comments</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Wrap only scrollable content and input */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        {/* COMMENTS */}
        <ScrollView style={styles.commentsContainer}>
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#4dd0e1" />
            </View>
          ) : comments.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="chatbubble-outline" size={64} color="#CCC" />
              <Text style={styles.emptyText}>No comments yet</Text>
              <Text style={styles.emptySubtext}>Be the first to comment!</Text>
            </View>
          ) : (
            comments.map((comment) => (
              <View key={comment.id} style={styles.commentCard}>
                <View style={styles.commentHeader}>
                  <UserAvatar
                    profilePicture={comment.profile_pic}
                    username={comment.username}
                    size={36}
                    level={comment.level}
                    showLevelBadge={true}
                  />
                  <View style={styles.commentInfo}>
                    <Text style={styles.username}>{comment.username}</Text>
                    <Text style={styles.timestamp}>
                      {formatTimestamp(comment.created_at)}
                    </Text>
                  </View>
                </View>

                <Text style={styles.commentText}>{comment.comment_text}</Text>
              </View>
            ))
          )}
        </ScrollView>

        {/* ADD COMMENT */}
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Add a comment..."
            placeholderTextColor="#999"
            value={commentText}
            onChangeText={setCommentText}
            multiline
          />
          <TouchableOpacity
            style={[styles.sendButton, !commentText.trim() && styles.sendButtonDisabled]}
            onPress={handleAddComment}
            disabled={submitting || !commentText.trim()}
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#4dd0e1" />
            ) : (
              <Ionicons name="send" size={24} color={commentText.trim() ? "#4dd0e1" : "#CCC"} />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },

  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#333' },

  commentsContainer: { flex: 1, paddingHorizontal: 16 },

  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },

  emptyContainer: { alignItems: 'center', paddingVertical: 60 },

  emptyText: { fontSize: 18, fontWeight: '600', color: '#666', marginTop: 16 },

  emptySubtext: { fontSize: 14, color: '#999', marginTop: 8 },

  commentCard: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },

  commentHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },

  commentInfo: { marginLeft: 12, flex: 1 },

  username: { fontSize: 15, fontWeight: 'bold', color: '#333' },

  timestamp: { fontSize: 12, color: '#999', marginTop: 2 },

  commentText: {
    fontSize: 15,
    color: '#333',
    lineHeight: 20,
    marginLeft: 48,
  },

  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    backgroundColor: '#FFF',
  },

  header: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  paddingHorizontal: 16,
  paddingTop: 66,        // ← Very minimal top padding
  paddingBottom: 12,
  borderBottomWidth: 1,
  borderBottomColor: '#E0E0E0',
},

  input: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#F5F5F5',
    borderRadius: 24,
    fontSize: 15,
    maxHeight: 100,
  },

  sendButton: { marginLeft: 12, padding: 8 },
  sendButtonDisabled: { opacity: 0.5 },
});