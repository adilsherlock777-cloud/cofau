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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { getComments, addComment } from '../../utils/api';
import UserAvatar from '../../components/UserAvatar';

export default function CommentsScreen() {
  const router = useRouter();
  const { postId } = useLocalSearchParams();
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchComments();
  }, [postId]);

  const fetchComments = async () => {
    try {
      setLoading(true);
      const data = await getComments(postId);
      setComments(data);
    } catch (error) {
      console.error('Error fetching comments:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddComment = async () => {
    if (!commentText.trim()) return;

    setSubmitting(true);
    try {
      await addComment(postId, commentText);
      setCommentText('');
      // Refresh comments
      await fetchComments();
    } catch (error) {
      console.error('Error adding comment:', error);
      if (Platform.OS === 'web') {
        window.alert('Failed to add comment');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const formatTimestamp = (timestamp) => {
    const now = new Date();
    const commentDate = new Date(timestamp);
    const diffInSeconds = Math.floor((now - commentDate) / 1000);

    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
    return commentDate.toLocaleDateString();
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Comments</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Comments List */}
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
                <View style={styles.avatar}>
                  <Text style={styles.avatarLetter}>
                    {comment.username ? comment.username.charAt(0).toUpperCase() : 'U'}
                  </Text>
                </View>
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

      {/* Add Comment Input */}
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
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  commentsContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
  },
  commentCard: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#4dd0e1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarLetter: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFF',
  },
  commentInfo: {
    marginLeft: 12,
    flex: 1,
  },
  username: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#333',
  },
  timestamp: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
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
  input: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#F5F5F5',
    borderRadius: 24,
    fontSize: 15,
    maxHeight: 100,
  },
  sendButton: {
    marginLeft: 12,
    padding: 8,
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
});
