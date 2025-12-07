import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Alert,
  ActivityIndicator,
  Share as RNShare,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { BACKEND_URL } from '../utils/imageUrlFix';

export default function ShareModal({ visible, onClose, post }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  if (!post) return null;

  // =====================================================
  // ALWAYS USE BACKEND OG PREVIEW URL (correct!)
  // =====================================================
  const buildShareUrl = () => `${BACKEND_URL}/share/${post.id}`;

  const buildShareText = (shareUrl) => {
    const base = post.review_text || post.description || '';
    const rating = post.rating ? `\n\nRating: ${post.rating}/10` : '';
    const location = post.location_name ? `\n📍 ${post.location_name}` : '';

    return `${post.username} shared a post on Cofau!\n\n${base}${rating}${location}\n\nView post: ${shareUrl}`;
  };

  // =====================================================
  // ADD TO STORY (Backend API)
  // =====================================================
  async function addToCofauStory() {
    try {
      setLoading(true);

      if (!post.token) {
        throw new Error("User token missing — ShareModal must be passed a token.");
      }

      const response = await fetch(`${BACKEND_URL}/api/stories/from-post`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${post.token}`,
        },
        body: JSON.stringify({ post_id: post.id }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Failed to create story");

      Alert.alert("Success", "Added to your Cofau story!");
      onClose();

    } catch (error) {
      console.error("Story creation error:", error);
      Alert.alert("Error", error.message);
    } finally {
      setLoading(false);
    }
  }

  // =====================================================
  // WHATSAPP
  // =====================================================
  async function shareToWhatsApp() {
    try {
      setLoading(true);

      const url = buildShareUrl();
      const message = buildShareText(url);

      const result = await RNShare.share({ message, url });

      if (result.action === RNShare.sharedAction) onClose();

    } catch (error) {
      console.error("WhatsApp error:", error);
      await shareToMore();
    } finally {
      setLoading(false);
    }
  }

  // =====================================================
  // INSTAGRAM
  // =====================================================
  async function shareToInstagram() {
    try {
      setLoading(true);

      const appUrl = "instagram://story-camera";
      const canOpen = await Linking.canOpenURL(appUrl);

      if (canOpen) {
        await Linking.openURL(appUrl);
      } else {
        Alert.alert("Instagram Not Installed", "Please install Instagram to share stories.");
      }

    } catch (error) {
      console.error("Instagram error:", error);
      await shareToMore();
    } finally {
      setLoading(false);
    }
  }

  // =====================================================
  // FACEBOOK
  // =====================================================
  async function shareToFacebook() {
    try {
      setLoading(true);

      const url = buildShareUrl();
      const message = buildShareText(url);

      const result = await RNShare.share({ message, url });
      if (result.action === RNShare.sharedAction) onClose();

    } catch (error) {
      console.error("Facebook error:", error);
      await shareToMore();
    } finally {
      setLoading(false);
    }
  }

  // =====================================================
  // TWITTER
  // =====================================================
  async function shareToTwitter() {
    try {
      setLoading(true);

      const url = buildShareUrl();
      const message = buildShareText(url);

      const result = await RNShare.share({ message, url });
      if (result.action === RNShare.sharedAction) onClose();

    } catch (error) {
      console.error("Twitter error:", error);
      await shareToMore();
    } finally {
      setLoading(false);
    }
  }

  // =====================================================
  // SYSTEM SHARE SHEET
  // =====================================================
  async function shareToMore() {
    try {
      setLoading(true);

      const url = buildShareUrl();
      const message = buildShareText(url);

      const result = await RNShare.share({ message, url });
      if (result.action === RNShare.sharedAction) onClose();

    } catch (error) {
      console.error("Share error:", error);
      Alert.alert("Error", "Failed to share.");
    } finally {
      setLoading(false);
    }
  }

  // =====================================================
  // SHARE OPTIONS LIST
  // =====================================================
  const shareOptions = [
    { id: "story", name: "Add to Story", icon: "images-outline", color: "#FF8C00", handler: addToCofauStory },
    { id: "whatsapp", name: "WhatsApp", icon: "logo-whatsapp", color: "#25D366", handler: shareToWhatsApp },
    { id: "instagram", name: "Instagram", icon: "logo-instagram", color: "#E4405F", handler: shareToInstagram },
    { id: "facebook", name: "Facebook", icon: "logo-facebook", color: "#1877F2", handler: shareToFacebook },
    { id: "twitter", name: "Twitter", icon: "logo-twitter", color: "#1DA1F2", handler: shareToTwitter },
    { id: "more", name: "More", icon: "share-outline", color: "#666", handler: shareToMore },
  ];

  // =====================================================
  // UI
  // =====================================================
  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <TouchableOpacity style={styles.backdrop} onPress={onClose} />

        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Share Post</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>

          <View style={styles.shareOptions}>
            {shareOptions.map((opt) => (
              <TouchableOpacity
                key={opt.id}
                style={styles.shareOption}
                onPress={opt.handler}
                disabled={loading}
              >
                <View style={[styles.shareIconContainer, { backgroundColor: opt.color + "20" }]}>
                  <Ionicons name={opt.icon} size={28} color={opt.color} />
                </View>
                <Text style={styles.shareOptionText}>{opt.name}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {loading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#4dd0e1" />
              <Text style={{ marginTop: 10 }}>Preparing to share...</Text>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  backdrop: { flex: 1 },
  modalContent: { backgroundColor: "#FFF", borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 20 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", padding: 20 },
  modalTitle: { fontSize: 20, fontWeight: "600" },
  shareOptions: { flexDirection: "row", justifyContent: "space-around", paddingVertical: 24 },
  shareOption: { alignItems: "center", width: 70 },
  shareIconContainer: { width: 60, height: 60, borderRadius: 30, justifyContent: "center", alignItems: "center", marginBottom: 8 },
  shareOptionText: { textAlign: "center" },
  loadingContainer: { alignItems: "center", padding: 20 },
});
