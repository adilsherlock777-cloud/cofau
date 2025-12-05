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
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { BACKEND_URL } from '../utils/imageUrlFix';
import { normalizeMediaUrl } from '../utils/imageUrlFix';

// Frontend URL for share pages - update this to your actual frontend domain
const FRONTEND_URL = process.env.EXPO_PUBLIC_FRONTEND_URL || 'https://cofau.com';

/**
 * ShareModal - Modal with share options for posts
 * 
 * NOTE: For full image-based sharing, install these packages:
 * npm install expo-file-system expo-sharing react-native-view-shot
 * 
 * Current version uses text-only sharing (works without additional packages)
 */
export default function ShareModal({ visible, onClose, post }) {
  const [loading, setLoading] = useState(false);

  // Share options with their respective handlers
  const shareOptions = [
    {
      id: 'whatsapp',
      name: 'WhatsApp',
      icon: 'logo-whatsapp',
      color: '#25D366',
      handler: shareToWhatsApp,
    },
    {
      id: 'instagram',
      name: 'Instagram',
      icon: 'logo-instagram',
      color: '#E4405F',
      handler: shareToInstagram,
    },
    {
      id: 'facebook',
      name: 'Facebook',
      icon: 'logo-facebook',
      color: '#1877F2',
      handler: shareToFacebook,
    },
    {
      id: 'twitter',
      name: 'Twitter',
      icon: 'logo-twitter',
      color: '#1DA1F2',
      handler: shareToTwitter,
    },
    {
      id: 'more',
      name: 'More',
      icon: 'share-outline',
      color: '#666',
      handler: shareToMore,
    },
  ];

  /**
   * Share to WhatsApp
   */
  async function shareToWhatsApp() {
    try {
      setLoading(true);

      // Build frontend share URL - this is what WhatsApp will scrape for preview
      const shareUrl = `${FRONTEND_URL}/share/${post.id}`;

      // Build share text with frontend URL
      const shareText = `${post.username} shared a post on Cofau!\n\n${post.review_text || post.description || ''}\n\nRating: ${post.rating}/10${post.location_name ? `\n📍 ${post.location_name}` : ''}\n\nView post: ${shareUrl}`;

      const shareOptions = {
        message: shareText,
        title: `${post.username} shared a post on Cofau!`,
        url: shareUrl, // Frontend URL with OG tags for WhatsApp preview
      };

      const result = await RNShare.share(shareOptions);

      if (result.action === RNShare.sharedAction) {
        onClose();
      }
    } catch (error) {
      console.error('❌ Error sharing to WhatsApp:', error);
      await shareToMore();
    } finally {
      setLoading(false);
    }
  }

  /**
   * Share to Instagram Stories
   */
  async function shareToInstagram() {
    try {
      setLoading(true);

      // Try to open Instagram
      const instagramUrl = 'instagram://story-camera';
      const canOpen = await Linking.canOpenURL(instagramUrl);

      if (canOpen) {
        await Linking.openURL(instagramUrl);
      } else {
        Alert.alert('Instagram Not Found', 'Instagram is not installed on this device. Please install it to share stories.');
      }
    } catch (error) {
      console.error('❌ Error opening Instagram:', error);
      await shareToMore();
    } finally {
      setLoading(false);
    }
  }

  /**
   * Share to Facebook
   */
  async function shareToFacebook() {
    try {
      setLoading(true);

      // Build frontend share URL - this is what Facebook will scrape for preview
      const shareUrl = `${FRONTEND_URL}/share/${post.id}`;

      const shareText = `${post.username} shared a post on Cofau!\n\n${post.review_text || post.description || ''}\n\nRating: ${post.rating}/10${post.location_name ? `\n📍 ${post.location_name}` : ''}\n\nView post: ${shareUrl}`;

      const shareOptions = {
        message: shareText,
        title: `${post.username} shared a post on Cofau!`,
        url: shareUrl, // Frontend URL with OG tags for Facebook preview
      };

      const result = await RNShare.share(shareOptions);

      if (result.action === RNShare.sharedAction) {
        onClose();
      }
    } catch (error) {
      console.error('❌ Error sharing to Facebook:', error);
      await shareToMore();
    } finally {
      setLoading(false);
    }
  }

  /**
   * Share to Twitter
   */
  async function shareToTwitter() {
    try {
      setLoading(true);

      // Build frontend share URL - this is what Twitter will scrape for preview
      const shareUrl = `${FRONTEND_URL}/share/${post.id}`;

      const shareText = `${post.username} shared a post on Cofau!\n\n${post.review_text || post.description || ''}\n\nRating: ${post.rating}/10${post.location_name ? `\n📍 ${post.location_name}` : ''}\n\nView post: ${shareUrl}`;

      const shareOptions = {
        message: shareText,
        title: `${post.username} shared a post on Cofau!`,
        url: shareUrl, // Frontend URL with OG tags for Twitter preview
      };

      const result = await RNShare.share(shareOptions);

      if (result.action === RNShare.sharedAction) {
        onClose();
      }
    } catch (error) {
      console.error('❌ Error sharing to Twitter:', error);
      await shareToMore();
    } finally {
      setLoading(false);
    }
  }

  /**
   * Share using native share sheet (More options)
   */
  async function shareToMore() {
    try {
      setLoading(true);

      // Build frontend share URL - this is what social media platforms will scrape for preview
      const shareUrl = `${FRONTEND_URL}/share/${post.id}`;

      // Build share text with post details and frontend URL
      const shareText = `${post.username} shared a post on Cofau!\n\n${post.review_text || post.description || ''}\n\nRating: ${post.rating}/10${post.location_name ? `\n📍 ${post.location_name}` : ''}\n\nView post: ${shareUrl}`;

      // Share with frontend URL - social media platforms will scrape this for OG tags
      const shareOptions = {
        message: shareText,
        title: `${post.username} shared a post on Cofau!`,
        url: shareUrl, // Frontend URL with OG tags for social media previews
      };

      console.log('📤 Sharing post:', {
        postId: post.id,
        shareUrl: shareUrl,
        frontendUrl: FRONTEND_URL,
      });

      const result = await RNShare.share(shareOptions);

      if (result.action === RNShare.sharedAction) {
        console.log('✅ Post shared successfully');
        onClose(); // Close modal after successful share
      } else if (result.action === RNShare.dismissedAction) {
        console.log('Share dismissed');
      }
    } catch (error) {
      console.error('❌ Error sharing:', error);
      Alert.alert('Error', 'Failed to share post. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  if (!post) return null;

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={onClose}
        />

        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Share Post</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>

          {/* Info Banner */}
          <View style={styles.infoBanner}>
            <Ionicons name="information-circle-outline" size={20} color="#4dd0e1" />
            <Text style={styles.infoText}>
              For enhanced image sharing, run: npm install expo-file-system expo-sharing react-native-view-shot
            </Text>
          </View>

          {/* Share Options */}
          <View style={styles.shareOptions}>
            {shareOptions.map((option) => (
              <TouchableOpacity
                key={option.id}
                style={styles.shareOption}
                onPress={option.handler}
                disabled={loading}
              >
                <View style={[styles.shareIconContainer, { backgroundColor: option.color + '20' }]}>
                  <Ionicons name={option.icon} size={28} color={option.color} />
                </View>
                <Text style={styles.shareOptionText}>{option.name}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Loading Indicator */}
          {loading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#4dd0e1" />
              <Text style={styles.loadingText}>Preparing to share...</Text>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  backdrop: {
    flex: 1,
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
  },
  closeButton: {
    padding: 4,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#E8F9FA',
    padding: 12,
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 8,
    gap: 8,
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    color: '#666',
    lineHeight: 16,
  },
  shareOptions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 24,
    paddingHorizontal: 12,
  },
  shareOption: {
    alignItems: 'center',
    width: 70,
  },
  shareIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  shareOptionText: {
    fontSize: 12,
    color: '#333',
    textAlign: 'center',
  },
  loadingContainer: {
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
  },
});
