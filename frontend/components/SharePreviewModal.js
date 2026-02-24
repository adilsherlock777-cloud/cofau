import React, { useState, useEffect, useRef } from 'react';
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
  FlatList,
  TextInput,
  ScrollView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Video } from 'expo-av';
import * as Sharing from 'expo-sharing';
import { captureRef } from 'react-native-view-shot';
import * as MediaLibrary from 'expo-media-library';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../context/AuthContext';
import { normalizeMediaUrl, normalizeProfilePicture, BACKEND_URL } from '../utils/imageUrlFix';
import { getFollowers, getFollowing } from '../utils/api';
import UserAvatar from './UserAvatar';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Story card dimensions (9:16 for Instagram Stories)
const STORY_WIDTH = SCREEN_WIDTH;
const STORY_HEIGHT = STORY_WIDTH * (16 / 9);
const CARD_WIDTH = STORY_WIDTH * 0.88;

// =====================================================
// INSTAGRAM STORY CARD (hidden, for capture)
// =====================================================
const InstagramStoryCard = React.forwardRef(({ post }, ref) => {
  const mediaUrl = normalizeMediaUrl(post?.media_url || post?.image_url);

  return (
    <View ref={ref} style={storyCardStyles.container} collapsable={false}>
      {mediaUrl && (
        <Image
          source={{ uri: mediaUrl }}
          style={storyCardStyles.blurredBackground}
          contentFit="cover"
          blurRadius={30}
        />
      )}
      <View style={storyCardStyles.darkOverlay} />
      <View style={storyCardStyles.card}>
        <View style={storyCardStyles.imageWrapper}>
          {mediaUrl ? (
            <Image source={{ uri: mediaUrl }} style={storyCardStyles.foodImage} contentFit="cover" />
          ) : (
            <View style={storyCardStyles.placeholderImage}>
              <Ionicons name="image-outline" size={60} color="#ccc" />
            </View>
          )}
          {post?.dish_name && (
            <View style={storyCardStyles.dishNameContainer}>
              <Ionicons name="fast-food" size={14} color="#FFF" />
              <Text style={storyCardStyles.dishNameText} numberOfLines={1}>
                {post.dish_name.toUpperCase()}
              </Text>
            </View>
          )}
          <View style={storyCardStyles.watermarkContainer}>
            <Text style={storyCardStyles.watermarkText}>Cofau</Text>
          </View>
        </View>
        <View style={storyCardStyles.infoBoxesContainer}>
          <View style={storyCardStyles.infoBox}>
            <Ionicons name="star" size={22} color="#FFD700" />
            <Text style={storyCardStyles.infoBoxLabel}>Rating</Text>
            <Text style={storyCardStyles.infoBoxValue}>
              {post?.rating ? `${post.rating}/10` : '-'}
            </Text>
          </View>
          <View style={storyCardStyles.divider} />
          <View style={[storyCardStyles.infoBox, storyCardStyles.reviewBox]}>
            <Ionicons name="create" size={22} color="#FFD700" />
            <Text style={storyCardStyles.infoBoxLabel}>Review</Text>
            <Text style={storyCardStyles.infoBoxValue}>
              {post?.review_text || post?.description || '-'}
            </Text>
          </View>
          <View style={storyCardStyles.divider} />
          <View style={storyCardStyles.infoBox}>
            <Ionicons name="location" size={22} color="#E53935" />
            <Text style={storyCardStyles.infoBoxLabel}>Location</Text>
            <Text style={storyCardStyles.infoBoxValue}>
              {post?.location_name || '-'}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
});

const storyCardStyles = StyleSheet.create({
  container: { width: STORY_WIDTH, height: STORY_HEIGHT, position: 'absolute', left: -9999, top: 0, backgroundColor: '#000' },
  blurredBackground: { position: 'absolute', width: '100%', height: '100%' },
  darkOverlay: { position: 'absolute', width: '100%', height: '100%', backgroundColor: 'rgba(0, 0, 0, 0.35)' },
  card: { position: 'absolute', top: '10%', left: (STORY_WIDTH - CARD_WIDTH) / 2, width: CARD_WIDTH, backgroundColor: '#FFFFFF', borderRadius: 24, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.5, shadowRadius: 20, elevation: 15 },
  imageWrapper: { width: '100%', aspectRatio: 1, position: 'relative' },
  foodImage: { width: '100%', height: '100%' },
  placeholderImage: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center', backgroundColor: '#E0E0E0' },
  watermarkContainer: { position: 'absolute', bottom: 16, right: 16, backgroundColor: 'rgba(0, 0, 0, 0.6)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12 },
  watermarkText: { fontSize: 12, fontWeight: '700', color: '#FFFFFF', fontFamily: 'Lobster', letterSpacing: 1 },
  infoBoxesContainer: { flexDirection: 'row', paddingVertical: 20, paddingHorizontal: 12, backgroundColor: '#FFFFFF' },
  infoBox: { flex: 1, alignItems: 'center', paddingHorizontal: 6 },
  reviewBox: { flex: 1.4 },
  infoBoxLabel: { fontSize: 11, fontWeight: '700', color: '#999', marginTop: 6, textTransform: 'uppercase', letterSpacing: 0.8 },
  infoBoxValue: { fontSize: 13, fontWeight: '600', color: '#333', marginTop: 4, textAlign: 'center', lineHeight: 18 },
  divider: { width: 1, backgroundColor: '#E8E8E8', marginVertical: 8 },
  dishNameContainer: { position: 'absolute', bottom: 16, left: 16, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0, 0, 0, 0.6)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, maxWidth: '60%', gap: 4 },
  dishNameText: { color: '#FFF', fontSize: 12, fontWeight: '600' },
});

// =====================================================
// MAIN COMPONENT
// =====================================================
export default function SharePreviewModal({ visible, onClose, post, onStoryCreated }) {
  const [loading, setLoading] = useState(false);
  const [sharingPlatform, setSharingPlatform] = useState(null);
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUsers, setSelectedUsers] = useState([]);
  const storyCardRef = useRef(null);
  const { user, token } = useAuth();

  if (!post) return null;

  const mediaUrl = normalizeMediaUrl(post.media_url || post.image_url);
  const thumbnailUrl = post.thumbnail_url ? normalizeMediaUrl(post.thumbnail_url) : null;
  const isVideo = post.media_type === 'video' || mediaUrl?.toLowerCase().endsWith('.mp4');
  const shareUrl = `${BACKEND_URL}/share/${post.id}`;

  // Fetch Cofau users
  useEffect(() => {
    if (visible && user?.id) {
      fetchUsers();
    } else {
      setUsers([]);
      setSelectedUsers([]);
      setSearchQuery('');
    }
  }, [visible, user?.id]);

  const fetchUsers = async () => {
    if (!user?.id || !token) return;
    setLoadingUsers(true);
    try {
      const [followers, following] = await Promise.all([
        getFollowers(user.id).catch(() => []),
        getFollowing(user.id).catch(() => []),
      ]);

      const allUsersMap = new Map();
      (followers || []).forEach((f) => {
        const id = f.id || f.user_id || f._id;
        if (id && id !== user.id) {
          allUsersMap.set(id, {
            id, username: f.username || f.full_name || 'Unknown',
            full_name: f.full_name || f.username || 'Unknown',
            profile_picture: f.profile_picture || f.profile_picture_url,
          });
        }
      });
      (following || []).forEach((f) => {
        const id = f.id || f.user_id || f._id;
        if (id && id !== user.id && !allUsersMap.has(id)) {
          allUsersMap.set(id, {
            id, username: f.username || f.full_name || 'Unknown',
            full_name: f.full_name || f.username || 'Unknown',
            profile_picture: f.profile_picture || f.profile_picture_url,
          });
        }
      });
      setUsers(Array.from(allUsersMap.values()));
    } catch (e) {
      // silenced
    } finally {
      setLoadingUsers(false);
    }
  };

  const filteredUsers = users.filter((u) => {
    const q = searchQuery.toLowerCase();
    return u.username.toLowerCase().includes(q) || u.full_name.toLowerCase().includes(q);
  });

  const toggleUser = (userId) => {
    setSelectedUsers((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleSendToUsers = () => {
    if (selectedUsers.length === 0) return;
    Alert.alert('Shared!', `Post shared with ${selectedUsers.length} user(s)`);
    setSelectedUsers([]);
  };

  // Share to Instagram Story
  const shareToInstagramStory = async () => {
    try {
      setLoading(true);
      setSharingPlatform('instagram-story');

      const uri = await captureRef(storyCardRef, {
        format: 'png',
        quality: 1,
        result: 'tmpfile',
      });

      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please allow access to save images.');
        return;
      }

      await MediaLibrary.createAssetAsync(uri);

      await Sharing.shareAsync(uri, {
        mimeType: 'image/png',
        dialogTitle: 'Share to Instagram Story',
        UTI: 'public.png',
      });

      onClose();
    } catch (error) {
      Alert.alert('Error', 'Failed to create story image. Please try again.');
    } finally {
      setLoading(false);
      setSharingPlatform(null);
    }
  };

  // Add to Cofau Story
  const handleAddToStory = async () => {
    try {
      setLoading(true);
      setSharingPlatform('cofau-story');

      const response = await fetch(`${BACKEND_URL}/api/stories/create-from-post`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          post_id: post.id,
          media_url: post.media_url || post.image_url,
          review: post.review_text || post.description || '',
          rating: post.rating || 0,
          location: post.location_name || '',
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'Failed to create story');

      if (onStoryCreated) onStoryCreated(data.story);

      Alert.alert('Success', 'Added to your Cofau story!', [{ text: 'OK', onPress: onClose }]);
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to add to story');
    } finally {
      setLoading(false);
      setSharingPlatform(null);
    }
  };

  // Generic share (WhatsApp, Instagram, etc.)
  const shareGeneric = async (platform) => {
    try {
      setLoading(true);
      setSharingPlatform(platform);

      let message = `${post.username || 'Someone'} shared a post on Cofau!\n\n`;
      if (post.review_text) message += `${post.review_text}\n\n`;
      if (post.rating) message += `Rating: ${post.rating}/10\n`;
      if (post.location_name) message += `Location: ${post.location_name}\n`;
      message += `\nView on Cofau: ${shareUrl}`;

      await RNShare.share({ message, url: shareUrl, title: `${post.username} on Cofau` });
      onClose();
    } catch (error) {
      // user cancelled
    } finally {
      setLoading(false);
      setSharingPlatform(null);
    }
  };

  // More options (system share sheet)
  const shareMore = async () => {
    try {
      setLoading(true);
      setSharingPlatform('more');

      let message = `Check out this post on Cofau!\n${shareUrl}`;
      await RNShare.share({ message, url: shareUrl });
      onClose();
    } catch (error) {
      // user cancelled
    } finally {
      setLoading(false);
      setSharingPlatform(null);
    }
  };

  const renderUserItem = ({ item }) => {
    const isSelected = selectedUsers.includes(item.id);
    const profilePic = normalizeProfilePicture(item.profile_picture);

    return (
      <TouchableOpacity style={styles.userChip} onPress={() => toggleUser(item.id)}>
        <View style={[styles.userAvatarWrap, isSelected && styles.userAvatarSelected]}>
          <UserAvatar
            profilePicture={profilePic}
            username={item.username}
            size={52}
            showLevelBadge={false}
          />
          {isSelected && (
            <View style={styles.selectedCheck}>
              <Ionicons name="checkmark-circle" size={20} color="#FF2E2E" />
            </View>
          )}
        </View>
        <Text style={styles.userChipName} numberOfLines={1}>{item.username}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      {/* Hidden Story Card for Instagram capture */}
      <InstagramStoryCard ref={storyCardRef} post={post} />

      <View style={styles.overlay}>
        <TouchableOpacity style={styles.overlayTop} activeOpacity={1} onPress={onClose} />

        <View style={styles.sheet}>
          {/* Handle bar */}
          <View style={styles.handleBar} />

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Share Post</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
            {/* Full-width Post Image */}
            <View style={styles.imageContainer}>
              {isVideo ? (
                <Image
                  source={{ uri: thumbnailUrl || mediaUrl }}
                  style={styles.fullImage}
                  contentFit="cover"
                />
              ) : (
                <Image
                  source={{ uri: mediaUrl }}
                  style={styles.fullImage}
                  contentFit="cover"
                />
              )}
              {/* Cofau watermark */}
              <View style={styles.imageWatermark}>
                <Text style={styles.imageWatermarkText}>Cofau</Text>
              </View>
            </View>

            {/* Post Info */}
            <View style={styles.postInfo}>
              {post.rating > 0 && (
                <View style={styles.infoChip}>
                  <Ionicons name="star" size={14} color="#FFD700" />
                  <Text style={styles.infoChipText}>{post.rating}/10</Text>
                </View>
              )}
              {post.location_name && (
                <View style={styles.infoChip}>
                  <Ionicons name="location" size={14} color="#FF6B6B" />
                  <Text style={styles.infoChipText} numberOfLines={1}>{post.location_name}</Text>
                </View>
              )}
              {post.dish_name && (
                <View style={styles.infoChip}>
                  <Ionicons name="fast-food" size={14} color="#FF7A18" />
                  <Text style={styles.infoChipText} numberOfLines={1}>{post.dish_name}</Text>
                </View>
              )}
            </View>

            {/* Cofau Users Section */}
            <View style={styles.sectionContainer}>
              <Text style={styles.sectionTitle}>Share with Cofau Users</Text>

              {/* Search */}
              <View style={styles.userSearchBar}>
                <Ionicons name="search" size={16} color="#999" />
                <TextInput
                  style={styles.userSearchInput}
                  placeholder="Search users..."
                  placeholderTextColor="#999"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setSearchQuery('')}>
                    <Ionicons name="close-circle" size={18} color="#999" />
                  </TouchableOpacity>
                )}
              </View>

              {/* Users horizontal list */}
              {loadingUsers ? (
                <View style={styles.usersLoading}>
                  <ActivityIndicator size="small" color="#FF2E2E" />
                </View>
              ) : filteredUsers.length === 0 ? (
                <View style={styles.usersEmpty}>
                  <Text style={styles.usersEmptyText}>
                    {searchQuery ? 'No users found' : 'Follow users to share with them'}
                  </Text>
                </View>
              ) : (
                <FlatList
                  data={filteredUsers}
                  keyExtractor={(item) => item.id}
                  renderItem={renderUserItem}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.usersList}
                />
              )}

              {/* Send button */}
              {selectedUsers.length > 0 && (
                <TouchableOpacity style={styles.sendButton} onPress={handleSendToUsers}>
                  <LinearGradient
                    colors={['#FF2E2E', '#FF7A18']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.sendButtonGradient}
                  >
                    <Ionicons name="send" size={16} color="#FFF" />
                    <Text style={styles.sendButtonText}>Send ({selectedUsers.length})</Text>
                  </LinearGradient>
                </TouchableOpacity>
              )}
            </View>

            {/* Share Options Section */}
            <View style={styles.sectionContainer}>
              <Text style={styles.sectionTitle}>Share to Apps</Text>

              <View style={styles.appsRow}>
                {/* Instagram Story */}
                <TouchableOpacity
                  style={styles.appOption}
                  onPress={shareToInstagramStory}
                  disabled={loading}
                >
                  {loading && sharingPlatform === 'instagram-story' ? (
                    <ActivityIndicator color="#E1306C" />
                  ) : (
                    <View style={[styles.appIconCircle, { backgroundColor: '#E1306C' }]}>
                      <Ionicons name="add-circle" size={28} color="#FFF" />
                    </View>
                  )}
                  <Text style={styles.appLabel}>Instagram{'\n'}Story</Text>
                </TouchableOpacity>

                {/* Cofau Story */}
                <TouchableOpacity
                  style={styles.appOption}
                  onPress={handleAddToStory}
                  disabled={loading}
                >
                  {loading && sharingPlatform === 'cofau-story' ? (
                    <ActivityIndicator color="#FF2E2E" />
                  ) : (
                    <LinearGradient
                      colors={['#FF2E2E', '#FF7A18']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.appIconCircle}
                    >
                      <Ionicons name="flame" size={28} color="#FFF" />
                    </LinearGradient>
                  )}
                  <Text style={styles.appLabel}>Cofau{'\n'}Story</Text>
                </TouchableOpacity>

                {/* WhatsApp */}
                <TouchableOpacity
                  style={styles.appOption}
                  onPress={() => shareGeneric('whatsapp')}
                  disabled={loading}
                >
                  {loading && sharingPlatform === 'whatsapp' ? (
                    <ActivityIndicator color="#25D366" />
                  ) : (
                    <View style={[styles.appIconCircle, { backgroundColor: '#25D366' }]}>
                      <Ionicons name="logo-whatsapp" size={28} color="#FFF" />
                    </View>
                  )}
                  <Text style={styles.appLabel}>WhatsApp</Text>
                </TouchableOpacity>

                {/* Instagram */}
                <TouchableOpacity
                  style={styles.appOption}
                  onPress={() => shareGeneric('instagram')}
                  disabled={loading}
                >
                  {loading && sharingPlatform === 'instagram' ? (
                    <ActivityIndicator color="#E4405F" />
                  ) : (
                    <View style={[styles.appIconCircle, { backgroundColor: '#E4405F' }]}>
                      <Ionicons name="logo-instagram" size={28} color="#FFF" />
                    </View>
                  )}
                  <Text style={styles.appLabel}>Instagram</Text>
                </TouchableOpacity>

                {/* More */}
                <TouchableOpacity
                  style={styles.appOption}
                  onPress={shareMore}
                  disabled={loading}
                >
                  {loading && sharingPlatform === 'more' ? (
                    <ActivityIndicator color="#666" />
                  ) : (
                    <View style={[styles.appIconCircle, { backgroundColor: '#666' }]}>
                      <Ionicons name="ellipsis-horizontal" size={28} color="#FFF" />
                    </View>
                  )}
                  <Text style={styles.appLabel}>More</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={{ height: 30 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// =====================================================
// STYLES
// =====================================================
const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  overlayTop: {
    flex: 1,
  },
  sheet: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: SCREEN_HEIGHT * 0.88,
    paddingBottom: Platform.OS === 'ios' ? 30 : 20,
  },
  handleBar: {
    width: 40,
    height: 4,
    backgroundColor: '#DDD',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 6,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
  },

  // Full image
  imageContainer: {
    width: '100%',
    position: 'relative',
  },
  fullImage: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: '#F0F0F0',
  },
  imageWatermark: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
  },
  imageWatermarkText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
    fontStyle: 'italic',
    letterSpacing: 0.5,
  },

  // Post info chips
  postInfo: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  infoChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 4,
  },
  infoChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
    maxWidth: 120,
  },

  // Section
  sectionContainer: {
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#333',
    marginBottom: 10,
  },

  // User search
  userSearchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 10,
    paddingHorizontal: 10,
    height: 36,
    marginBottom: 10,
    gap: 6,
  },
  userSearchInput: {
    flex: 1,
    fontSize: 14,
    color: '#333',
    padding: 0,
  },

  // Users list
  usersList: {
    paddingVertical: 4,
    gap: 12,
  },
  usersLoading: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  usersEmpty: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  usersEmptyText: {
    fontSize: 13,
    color: '#999',
  },
  userChip: {
    alignItems: 'center',
    width: 70,
  },
  userAvatarWrap: {
    position: 'relative',
    borderRadius: 30,
    padding: 2,
  },
  userAvatarSelected: {
    borderWidth: 2,
    borderColor: '#FF2E2E',
    borderRadius: 30,
  },
  selectedCheck: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#FFF',
    borderRadius: 10,
  },
  userChipName: {
    fontSize: 11,
    color: '#333',
    marginTop: 4,
    textAlign: 'center',
    fontWeight: '500',
  },

  // Send button
  sendButton: {
    marginTop: 10,
    borderRadius: 20,
    overflow: 'hidden',
  },
  sendButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    gap: 6,
  },
  sendButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },

  // Apps row
  appsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 8,
  },
  appOption: {
    alignItems: 'center',
    gap: 6,
    width: 64,
  },
  appIconCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  appLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
    lineHeight: 14,
  },
});
