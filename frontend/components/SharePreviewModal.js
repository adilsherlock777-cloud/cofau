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
  const [showSocialOptions, setShowSocialOptions] = useState(false);
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

  // Share Post function - now opens social media options
  const handleSharePost = () => {
    setShowSocialOptions(true);
  };

  // Share to specific platform
  const shareToWhatsApp = async () => {
    try {
      setLoading(true);
      const message = `Check out this post on Cofau!\n\n${post.review_text || post.description || ''}\n\nView post: ${shareUrl}`;
      
      const result = await RNShare.share({ 
        message,
        url: shareUrl 
      });

      if (result.action === RNShare.sharedAction) {
        setShowSocialOptions(false);
        onClose();
      }
    } catch (error) {
      console.error("WhatsApp share error:", error);
      Alert.alert("Error", "Failed to share to WhatsApp");
    } finally {
      setLoading(false);
    }
  };

  const shareToInstagram = async () => {
    try {
      setLoading(true);
      const message = `Check out this post on Cofau!\n\n${shareUrl}`;
      
      const result = await RNShare.share({ 
        message,
        url: shareUrl 
      });

      if (result.action === RNShare.sharedAction) {
        setShowSocialOptions(false);
        onClose();
      }
    } catch (error) {
      console.error("Instagram share error:", error);
      Alert.alert("Error", "Failed to share to Instagram");
    } finally {
      setLoading(false);
    }
  };

  const shareToTwitter = async () => {
    try {
      setLoading(true);
      const message = `Check out this post on Cofau! ${shareUrl}`;
      
      const result = await RNShare.share({ 
        message,
        url: shareUrl 
      });

      if (result.action === RNShare.sharedAction) {
        setShowSocialOptions(false);
        onClose();
      }
    } catch (error) {
      console.error("Twitter share error:", error);
      Alert.alert("Error", "Failed to share to Twitter");
    } finally {
      setLoading(false);
    }
  };

  const shareToFacebook = async () => {
    try {
      setLoading(true);
      const message = `Check out this post on Cofau!`;
      
      const result = await RNShare.share({ 
        message,
        url: shareUrl 
      });

      if (result.action === RNShare.sharedAction) {
        setShowSocialOptions(false);
        onClose();
      }
    } catch (error) {
      console.error("Facebook share error:", error);
      Alert.alert("Error", "Failed to share to Facebook");
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

      {/* Social Media Options Bottom Sheet */}
      <Modal
        visible={showSocialOptions}
        transparent
        animationType="slide"
        onRequestClose={() => setShowSocialOptions(false)}
      >
        <TouchableOpacity
          style={styles.bottomSheetOverlay}
          activeOpacity={1}
          onPress={() => setShowSocialOptions(false)}
        >
          <TouchableOpacity
            style={styles.bottomSheet}
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.bottomSheetHeader}>
              <Text style={styles.bottomSheetTitle}>Share to</Text>
              <TouchableOpacity onPress={() => setShowSocialOptions(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            <View style={styles.socialOptionsGrid}>
              {/* WhatsApp */}
              <TouchableOpacity
                style={styles.socialOption}
                onPress={shareToWhatsApp}
                disabled={loading}
              >
                <View style={[styles.socialIconCircle, { backgroundColor: "#25D366" }]}>
                  <Ionicons name="logo-whatsapp" size={32} color="#FFF" />
                </View>
                <Text style={styles.socialLabel}>WhatsApp</Text>
              </TouchableOpacity>

              {/* Instagram */}
              <TouchableOpacity
                style={styles.socialOption}
                onPress={shareToInstagram}
                disabled={loading}
              >
                <View style={[styles.socialIconCircle, { backgroundColor: "#E4405F" }]}>
                  <Ionicons name="logo-instagram" size={32} color="#FFF" />
                </View>
                <Text style={styles.socialLabel}>Instagram</Text>
              </TouchableOpacity>

              {/* Twitter */}
              <TouchableOpacity
                style={styles.socialOption}
                onPress={shareToTwitter}
                disabled={loading}
              >
                <View style={[styles.socialIconCircle, { backgroundColor: "#1DA1F2" }]}>
                  <Ionicons name="logo-twitter" size={32} color="#FFF" />
                </View>
                <Text style={styles.socialLabel}>Twitter</Text>
              </TouchableOpacity>

              {/* Facebook */}
              <TouchableOpacity
                style={styles.socialOption}
                onPress={shareToFacebook}
                disabled={loading}
              >
                <View style={[styles.socialIconCircle, { backgroundColor: "#1877F2" }]}>
                  <Ionicons name="logo-facebook" size={32} color="#FFF" />
                </View>
                <Text style={styles.socialLabel}>Facebook</Text>
              </TouchableOpacity>
            </View>

            {loading && (
              <View style={styles.loadingOverlay}>
                <ActivityIndicator color="#4dd0e1" size="large" />
              </View>
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
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
  // Social Media Bottom Sheet Styles
  bottomSheetOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  bottomSheet: {
    backgroundColor: "#FFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 30,
    minHeight: 280,
  },
  bottomSheetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  bottomSheetTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#333",
  },
  socialOptionsGrid: {
    flexDirection: "row",
    justifyContent: "space-around",
    padding: 30,
    paddingTop: 40,
  },
  socialOption: {
    alignItems: "center",
    gap: 12,
  },
  socialIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  socialLabel: {
    fontSize: 13,
    fontWeight: "500",
    color: "#666",
  },
  loadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(255, 255, 255, 0.8)",
    justifyContent: "center",
    alignItems: "center",
  },
});
