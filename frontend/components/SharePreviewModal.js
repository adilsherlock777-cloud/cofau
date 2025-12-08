import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Alert,
  ActivityIndicator,
  Dimensions,
  Share as RNShare,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useAuth } from '../context/AuthContext';
import { normalizeMediaUrl, BACKEND_URL } from '../utils/imageUrlFix';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function SharePreviewModal({ visible, onClose, post, onStoryCreated }) {
  const [loading, setLoading] = useState(false);
  const { token } = useAuth();

  if (!post) return null;

  const mediaUrl = normalizeMediaUrl(post.media_url || post.image_url);
  const shareUrl = `${BACKEND_URL}/share/${post.id}`;

  // Add to Story function
  const handleAddToStory = async () => {
    try {
      setLoading(true);
      console.log("📸 Creating story from post...");

      const response = await fetch(`${BACKEND_URL}/api/stories/create-from-post`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ 
          post_id: post.id,
          media_url: post.media_url || post.image_url,
          review: post.review_text || post.description || "",
          rating: post.rating || 0,
          location: post.location_name || ""
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Failed to create story");

      console.log("✅ Story created successfully:", data);
      
      // Call the callback to refresh stories
      if (onStoryCreated) {
        onStoryCreated(data.story);
      }
      
      Alert.alert("Success", "Added to your Cofau story! 🎉", [
        {
          text: "OK",
          onPress: () => {
            onClose();
          }
        }
      ]);

    } catch (error) {
      console.error("❌ Story creation error:", error);
      Alert.alert("Error", error.message || "Failed to add to story");
    } finally {
      setLoading(false);
    }
  };

  // Share Post function
  const handleSharePost = async () => {
    try {
      setLoading(true);

      const message = `${post.username} shared a post on Cofau!\n\n${post.review_text || post.description || ''}\n\nView post: ${shareUrl}`;

      const result = await RNShare.share({ 
        message,
        url: shareUrl 
      });

      if (result.action === RNShare.sharedAction) {
        onClose();
      }

    } catch (error) {
      console.error("Share error:", error);
      Alert.alert("Error", "Failed to share.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.modalOverlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <TouchableOpacity
          style={styles.modalCard}
          activeOpacity={1}
          onPress={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Share Post</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>

          {/* Post Preview */}
          <View style={styles.postPreview}>
            {/* Post Image */}
            <View style={styles.imageContainer}>
              <Image
                source={{ uri: mediaUrl }}
                style={styles.postImage}
                contentFit="cover"
              />
            </View>

            {/* Post Info */}
            <View style={styles.postInfo}>
              <View style={styles.infoRow}>
                <Ionicons name="star" size={18} color="#FFD700" />
                <Text style={styles.infoText}>-{post.rating}/10</Text>
              </View>

              {post.location_name && (
                <View style={styles.infoRow}>
                  <Ionicons name="location" size={18} color="#FF6B6B" />
                  <Text style={styles.infoText}>-{post.location_name}</Text>
                </View>
              )}

              <View style={styles.linkRow}>
                <Ionicons name="link" size={18} color="#999" />
                <Text style={styles.linkText}>click on this link to view on Cofau</Text>
              </View>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            {/* Add to Story Button */}
            <TouchableOpacity
              style={styles.addToStoryButton}
              onPress={handleAddToStory}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#4dd0e1" />
              ) : (
                <>
                  <Ionicons name="add-circle-outline" size={20} color="#4dd0e1" />
                  <Text style={styles.addToStoryText}>Add to Story</Text>
                </>
              )}
            </TouchableOpacity>

            {/* Share Post Button */}
            <TouchableOpacity
              style={styles.shareButton}
              onPress={handleSharePost}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <>
                  <Ionicons name="share-outline" size={20} color="#FFF" />
                  <Text style={styles.shareButtonText}>Share Post</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalCard: {
    backgroundColor: "#FFF",
    borderRadius: 20,
    width: SCREEN_WIDTH * 0.9,
    maxWidth: 400,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#333",
  },
  closeButton: {
    padding: 4,
  },
  postPreview: {
    padding: 20,
  },
  imageContainer: {
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 16,
  },
  postImage: {
    width: "100%",
    aspectRatio: 16 / 9,
    backgroundColor: "#F0F0F0",
  },
  postInfo: {
    gap: 12,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  infoText: {
    fontSize: 14,
    color: "#333",
    fontWeight: "500",
  },
  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
  },
  linkText: {
    fontSize: 13,
    color: "#999",
    fontStyle: "italic",
  },
  actionButtons: {
    padding: 20,
    gap: 12,
  },
  addToStoryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#4dd0e1",
    backgroundColor: "#FFF",
  },
  addToStoryText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#4dd0e1",
  },
  shareButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: "#4dd0e1",
  },
  shareButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFF",
  },
});
