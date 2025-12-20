import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  TextInput,
  Modal,
  Alert,
  FlatList,
  Dimensions,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import axios from 'axios';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import LevelBadge from '../components/LevelBadge';
import UserAvatar from '../components/UserAvatar';
import ProfileBadge from '../components/ProfileBadge';
import ComplimentModal from '../components/ComplimentModal';
import { sendCompliment, getFollowers } from '../utils/api';
import MaskedView from '@react-native-masked-view/masked-view';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://api.cofau.com';
const API_URL = `${BACKEND_URL}/api`;
const SCREEN_WIDTH = Dimensions.get('window').width;

const fixUrl = (url?: string | null) => {
  if (!url) return null;
  if (url.startsWith("http")) return url;
  url = url.replace(/\/+/g, "/");
  if (url.startsWith("/api/")) {
    return `${BACKEND_URL}${url}`;
  }
  return `${BACKEND_URL}${url.startsWith("/") ? url : "/" + url}`;
};

export default function ProfileScreen() {
  const router = useRouter();
  const { userId } = useLocalSearchParams();
  const auth = useAuth() as any;
  const { token, logout, user: currentUser } = auth;

  const [userData, setUserData] = useState<any>(null);
  const [userStats, setUserStats] = useState<any>(null);
  const [userPosts, setUserPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [activeTab, setActiveTab] = useState<'posts' | 'videos' | 'favourite'>('posts');
  const [complimentsCount, setComplimentsCount] = useState(0);
  const [hasComplimented, setHasComplimented] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editedBio, setEditedBio] = useState('');
  const [editedName, setEditedName] = useState('');
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [isOwnProfile, setIsOwnProfile] = useState(true);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [settingsModalVisible, setSettingsModalVisible] = useState(false);
  const [levelDetailsModalVisible, setLevelDetailsModalVisible] = useState(false);
  const [complimentModalVisible, setComplimentModalVisible] = useState(false);
  const [sendingCompliment, setSendingCompliment] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [selectedPostForDelete, setSelectedPostForDelete] = useState<any>(null);
  const [deletingPost, setDeletingPost] = useState(false);
  const [followersModalVisible, setFollowersModalVisible] = useState(false);
  const [followersList, setFollowersList] = useState<any[]>([]);
  const [loadingFollowers, setLoadingFollowers] = useState(false);
  const [followingStatus, setFollowingStatus] = useState<{ [key: string]: boolean }>({});

  useEffect(() => {
    if (!token) {
      setLoading(false);
      setError(true);
      return;
    }
    fetchProfileData();
  }, [token, userId]);

  useFocusEffect(
    React.useCallback(() => {
      if (token && userData) {
        console.log('🔄 Profile screen focused - refreshing posts');
        fetchUserPosts();
      }
    }, [token, userData, activeTab])
  );

  useEffect(() => {
    if (!isOwnProfile && userData?.id && token) {
      fetchFollowStatus();
    }
  }, [isOwnProfile, userData?.id, token]);

  useEffect(() => {
    if (userData) {
      fetchUserPosts();
      fetchComplimentsCount();
      checkIfComplimented();
    }
  }, [userData, activeTab]);

  const GradientHeart = ({ size = 24 }) => (
  <MaskedView maskElement={<Ionicons name="heart" size={size} color="#000" />}>
    <LinearGradient
      colors={["#E94A37", "#F2CF68", "#1B7C82"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ width: size, height: size }}
    />
  </MaskedView>
);

  const fetchProfileData = async () => {
    try {
      let user: any;

      const finalUserId = userId ?? currentUser?.id;
      const isOwn = !userId || finalUserId === currentUser?.id;
      setIsOwnProfile(isOwn);

      console.log('👤 Profile Detection:', {
        userId,
        currentUserId: currentUser?.id,
        finalUserId,
        isOwn,
      });

      if (userId && userId !== currentUser?.id) {
        console.log('📡 Fetching other user profile:', userId);

        const meResponse = await axios.get(`${API_URL}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (userId === (meResponse.data.user?.id || meResponse.data.id)) {
          user = meResponse.data.user || meResponse.data;
          setIsOwnProfile(true);
        } else {
          try {
            const userResponse = await axios.get(`${API_URL}/users/${userId}`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            user = userResponse.data;
            console.log('✅ Fetched user profile from /users endpoint:', user);
          } catch (userError: any) {
            console.log('⚠️ User endpoint failed, trying feed fallback:', userError.message);
            const feedResponse = await axios.get(`${API_URL}/feed`, {
              headers: { Authorization: `Bearer ${token}` },
            });

            const userPost = feedResponse.data.find(
              (post: any) => post.user_id === userId
            );
            if (userPost) {
              user = {
                id: userPost.user_id,
                full_name: userPost.username,
                profile_picture:
                  userPost.user_profile_picture ||
                  userPost.profile_picture ||
                  userPost.profile_picture_url,
                level: userPost.user_level,
                title: userPost.user_title,
              };
            } else {
              throw new Error('User not found');
            }
          }
        }
      } else {
        console.log('📡 Fetching own profile from:', `${API_URL}/auth/me`);
        setIsOwnProfile(true);
        const response = await axios.get(`${API_URL}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        user = response.data.user || response.data;
      }

      const rawProfilePicture =
        user.profile_image_url ||
        user.profile_picture ||
        user.profile_picture_url ||
        user.user_profile_picture;
      user.profile_picture = fixUrl(rawProfilePicture);

      setUserData(user);
      setEditedBio(user.bio || '');
      setEditedName(user.full_name || user.username || '');

      const statsResponse = await axios.get(`${API_URL}/users/${user.id}/stats`);
      setUserStats(statsResponse.data);

      setError(false);
    } catch (err: any) {
      console.error('❌ Profile fetch error:', err.response?.data || err.message);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const fetchUserPosts = async () => {
    if (!userData) return;

    try {
      const endpoint = `${API_URL}/users/${userData.id}/posts`;

      const response = await axios.get(endpoint, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const posts = response.data || [];

      const postsWithFullUrls = posts.map((post: any) => {
        const mediaUrl = post.media_url || post.full_image_url;
        const normalizedUrl = fixUrl(mediaUrl);
        const isVideo = 
          post.media_type === 'video' ||
          normalizedUrl?.toLowerCase().endsWith('.mp4') ||
          normalizedUrl?.toLowerCase().endsWith('.mov') ||
          normalizedUrl?.toLowerCase().endsWith('.avi') ||
          normalizedUrl?.toLowerCase().endsWith('.webm');
        
        let locationName = post.location_name || post.location || post.place_name;
        if (!locationName && post.map_link) {
          try {
            const url = new URL(post.map_link);
            const queryParam = url.searchParams.get('query');
            if (queryParam) {
              locationName = decodeURIComponent(queryParam);
            }
          } catch (e) {
            const match = post.map_link.match(/query=([^&]+)/);
            if (match) {
              locationName = decodeURIComponent(match[1]);
            }
          }
        }
        
        return {
          ...post,
          full_image_url: normalizedUrl,
          media_url: normalizedUrl,
          isVideo: isVideo,
          location_name: locationName || null,
          location: locationName || null,
          place_name: locationName || null,
        };
      });

      const sorted = postsWithFullUrls.sort((a: any, b: any) => {
        const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
        return dateB - dateA;
      });

      setUserPosts(sorted);
    } catch (err) {
      console.error('❌ Error fetching user posts:', err);
      setUserPosts([]);
    }
  };

  const fetchComplimentsCount = async () => {
    if (!userData?.id) return;

    try {
      const response = await axios.get(`${API_URL}/compliments/user/${userData.id}/count`);
      setComplimentsCount(response.data.compliments_count || 0);
    } catch (err) {
      console.error('❌ Error fetching compliments count:', err);
      setComplimentsCount(0);
    }
  };

  const checkIfComplimented = async () => {
    if (!userData?.id || !token || isOwnProfile) return;
    
    try {
      const response = await axios.get(
        `${API_URL}/compliments/check/${userData.id}`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      setHasComplimented(response.data.has_complimented || false);
    } catch (err) {
      console.error('❌ Error checking compliment status:', err);
      setHasComplimented(false);
    }
  };

  const fetchFollowStatus = async () => {
    if (!userData?.id || !token) return;

    try {
      const response = await axios.get(
        `${API_URL}/users/${userData.id}/follow-status`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setIsFollowing(response.data.isFollowing);
    } catch (err) {
      console.error('❌ Error fetching follow status:', err);
      setIsFollowing(false);
    }
  };

  const handleFollowToggle = async () => {
    if (!userData?.id || !token || followLoading) return;

    setFollowLoading(true);
    const previousFollowState = isFollowing;
    const previousFollowerCount = userStats?.followers_count || 0;

    setIsFollowing(!isFollowing);
    setUserStats((prev: any) => ({
      ...prev,
      followers_count: isFollowing
        ? previousFollowerCount - 1
        : previousFollowerCount + 1,
    }));

    try {
      const endpoint = isFollowing ? 'unfollow' : 'follow';
      await axios.post(
        `${API_URL}/users/${userData.id}/${endpoint}`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      console.log(`✅ ${isFollowing ? 'Unfollowed' : 'Followed'} successfully`);
    } catch (err) {
      console.error('❌ Error toggling follow:', err);
      setIsFollowing(previousFollowState);
      setUserStats((prev: any) => ({
        ...prev,
        followers_count: previousFollowerCount,
      }));
      Alert.alert('Error', 'Failed to update follow status. Please try again.');
    } finally {
      setFollowLoading(false);
    }
  };

  const fetchFollowers = async () => {
    if (!userData?.id || !token) return;

    setLoadingFollowers(true);
    try {
      const followers = await getFollowers(userData.id);
      
      console.log('📋 Raw followers data:', followers);
      
      const followersArray = Array.isArray(followers) ? followers : (followers?.followers || []);
      
      const normalizedFollowers = followersArray.map((follower: any) => ({
        ...follower,
        id: follower.id || follower.user_id || follower._id,
        user_id: follower.user_id || follower.id,
        full_name: follower.full_name || follower.username || follower.name,
        username: follower.username || follower.full_name || follower.name,
        profile_picture: fixUrl(follower.profile_picture || follower.profile_picture_url),
        level: follower.level || 1,
      }));
      
      setFollowersList(normalizedFollowers);
      
      const statusPromises = normalizedFollowers.map(async (follower: any) => {
        try {
          const response = await axios.get(
            `${API_URL}/users/${follower.id || follower.user_id}/follow-status`,
            {
              headers: { Authorization: `Bearer ${token}` },
            }
          );
          return { id: follower.id || follower.user_id, isFollowing: response.data.isFollowing || false };
        } catch {
          return { id: follower.id || follower.user_id, isFollowing: false };
        }
      });
      
      const statuses = await Promise.all(statusPromises);
      const statusMap: { [key: string]: boolean } = {};
      statuses.forEach((s) => {
        statusMap[s.id] = s.isFollowing;
      });
      setFollowingStatus(statusMap);
    } catch (err) {
      console.error('❌ Error fetching followers:', err);
      Alert.alert('Error', 'Failed to load followers. Please try again.');
    } finally {
      setLoadingFollowers(false);
    }
  };

  const handleFollowerFollowToggle = async (followerId: string) => {
    if (!token) return;

    const currentStatus = followingStatus[followerId] || false;
    const previousStatus = currentStatus;

    setFollowingStatus((prev) => ({
      ...prev,
      [followerId]: !currentStatus,
    }));

    try {
      const endpoint = currentStatus ? 'unfollow' : 'follow';
      await axios.post(
        `${API_URL}/users/${followerId}/${endpoint}`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      console.log(`✅ ${currentStatus ? 'Unfollowed' : 'Followed'} follower successfully`);
    } catch (err) {
      console.error('❌ Error toggling follower follow:', err);
      setFollowingStatus((prev) => ({
        ...prev,
        [followerId]: previousStatus,
      }));
      Alert.alert('Error', 'Failed to update follow status. Please try again.');
    }
  };

  const handleUpdateProfile = async () => {
    try {
      console.log('📝 Updating profile with:', { name: editedName, bio: editedBio });

      const formData = new FormData();
      if (editedName) formData.append('full_name', editedName);
      if (editedBio !== null && editedBio !== undefined)
        formData.append('bio', editedBio);

      const response = await axios.put(`${API_URL}/users/update`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
      });

      console.log('✅ Profile update response:', response.data);
      Alert.alert('Success', 'Profile updated successfully!');
      setEditModalVisible(false);

      setTimeout(() => {
        fetchProfileData();
      }, 500);
    } catch (err: any) {
      console.error(
        '❌ Error updating profile:',
        err.response?.data || err.message
      );
      Alert.alert('Error', 'Failed to update profile. Please try again.');
    }
  };

  const handleLogout = async () => {
    try {
      console.log('🚪 Starting logout process...');
      await axios.post(
        `${API_URL}/auth/logout`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      console.log('✅ Logout API call successful');
    } catch (err) {
      console.error('❌ Logout API error:', err);
    } finally {
      console.log('🧹 Clearing auth state...');
      await logout();
      console.log('🔄 Navigating to login screen...');
      router.push('/auth/login');
      console.log('✅ Logout complete!');
    }
  };

  const handleProfilePicturePress = () => {
    if (!isOwnProfile) return;

    const options: any[] = [
      { text: 'Take Photo', onPress: () => handleTakePhoto() },
      { text: 'Choose from Library', onPress: () => handleChoosePhoto() },
    ];

    if (userData?.profile_picture) {
      options.push({
        text: 'Remove Photo',
        onPress: () => handleRemovePhoto(),
        style: 'destructive',
      });
    }

    options.push({ text: 'Cancel', style: 'cancel' });

    if (Platform.OS === 'web') {
      const action = window.confirm(
        'Choose from library to upload a profile picture?'
      );
      if (action) handleChoosePhoto();
    } else {
      Alert.alert('Profile Picture', 'Choose an option', options);
    }
  };

  const handleTakePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission Denied',
          'Camera permission is required to take photos.'
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        await uploadProfilePicture(result.assets[0].uri);
      }
    } catch (error) {
      console.error('❌ Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo');
    }
  };

  const handleChoosePhoto = async () => {
    try {
      const { status } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission Denied',
          'Photo library permission is required.'
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        await uploadProfilePicture(result.assets[0].uri);
      }
    } catch (error) {
      console.error('❌ Error choosing photo:', error);
      Alert.alert('Error', 'Failed to choose photo');
    }
  };

  const uploadProfilePicture = async (uri: string) => {
    setUploadingImage(true);
    try {
      console.log('📤 Uploading profile picture:', uri);

      const formData = new FormData();
      const filename = uri.split('/').pop() || 'profile.jpg';
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : 'image/jpeg';

      formData.append('file', {
        uri,
        name: filename,
        type,
      } as any);

      const response = await axios.post(
        `${API_URL}/users/upload-profile-image`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      console.log('✅ Profile picture uploaded:', response.data);

      const apiProfilePicture =
        response.data.profile_image_url ||
        response.data.profile_picture ||
        response.data.profile_picture_url ||
        response.data.user_profile_picture;

      const normalizedProfilePicture = fixUrl(apiProfilePicture);

      setUserData((prev: any) => ({
        ...prev,
        profile_picture: normalizedProfilePicture,
        profile_picture_url: normalizedProfilePicture,
      }));

      setTimeout(() => {
        fetchProfileData();
      }, 500);

      Alert.alert('Success', 'Profile picture updated successfully!');
    } catch (error: any) {
      console.error(
        '❌ Error uploading profile picture:',
        error.response?.data || error.message
      );
      Alert.alert('Error', 'Failed to upload profile picture. Please try again.');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleRemovePhoto = async () => {
    if (Platform.OS === 'web') {
      const confirmRemove = window.confirm(
        'Are you sure you want to remove your profile picture?'
      );
      if (!confirmRemove) return;
      await removeProfilePicture();
      return;
    }

    Alert.alert(
      'Remove Profile Picture',
      'Are you sure you want to remove your profile picture?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          onPress: () => removeProfilePicture(),
          style: 'destructive',
        },
      ]
    );
  };

  const removeProfilePicture = async () => {
    setUploadingImage(true);
    try {
      console.log('🗑️ Removing profile picture');

      await axios.delete(`${API_URL}/users/profile-image`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      console.log('✅ Profile picture removed');

      setUserData((prev: any) => ({
        ...prev,
        profile_picture: null,
        profile_picture_url: null,
      }));

      Alert.alert('Success', 'Profile picture removed successfully!');
    } catch (error: any) {
      console.error(
        '❌ Error removing profile picture:',
        error.response?.data || error.message
      );
      Alert.alert('Error', 'Failed to remove profile picture. Please try again.');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleDeletePost = async () => {
    if (!selectedPostForDelete || !token) return;

    setDeletingPost(true);
    try {
      await axios.delete(`${API_URL}/posts/${selectedPostForDelete.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setUserPosts((prev) => prev.filter((p) => p.id !== selectedPostForDelete.id));
      
      if (userStats) {
        setUserStats((prev: any) => ({
          ...prev,
          total_posts: Math.max(0, (prev?.total_posts || 0) - 1),
        }));
      }

      Alert.alert('Success', 'Post deleted successfully');
      setDeleteModalVisible(false);
      setSelectedPostForDelete(null);
    } catch (error: any) {
      console.error('❌ Error deleting post:', error);
      Alert.alert(
        'Error',
        error.response?.data?.detail || 'Failed to delete post. Please try again.'
      );
    } finally {
      setDeletingPost(false);
    }
  };

  const renderGridItem = ({ item }: { item: any }) => {
    const mediaUrl = fixUrl(item.full_image_url || item.media_url);
    const isVideo =
      item.media_type === 'video' ||
      mediaUrl?.toLowerCase().endsWith('.mp4') ||
      mediaUrl?.toLowerCase().endsWith('.mov') ||
      mediaUrl?.toLowerCase().endsWith('.avi') ||
      mediaUrl?.toLowerCase().endsWith('.webm');

    const handlePostPress = () => {
      if (item.id) {
        console.log('📱 Navigating to post details:', item.id, 'isVideo:', isVideo);
        router.push(`/post-details/${item.id}`);
      } else {
        console.warn('⚠️ Post ID is missing:', item);
      }
    };

    const handleMenuPress = (e: any) => {
      e.stopPropagation();
      setSelectedPostForDelete(item);
      setDeleteModalVisible(true);
    };

    return (
      <TouchableOpacity
        style={styles.gridItem}
        onPress={handlePostPress}
        activeOpacity={0.8}
      >
        {mediaUrl && !isVideo ? (
          <Image source={{ uri: mediaUrl }} style={styles.gridImage} resizeMode="cover" />
        ) : mediaUrl && isVideo ? (
          <View style={styles.gridImageContainer}>
            <Image
              source={{ uri: mediaUrl }}
              style={styles.gridImage}
              resizeMode="cover"
            />
            <View style={styles.videoOverlay}>
              <Ionicons name="play-circle" size={40} color="#fff" />
            </View>
          </View>
        ) : (
          <View style={styles.gridPlaceholder}>
            <Ionicons
              name={isVideo ? 'play-circle-outline' : 'image-outline'}
              size={40}
              color="#ccc"
            />
          </View>
        )}
        {item.rating && (
          <View style={styles.ratingBadge}>
            <Text style={styles.ratingText}>{item.rating}</Text>
          </View>
        )}
        {isOwnProfile && (
          <TouchableOpacity
            style={styles.postMenuButton}
            onPress={handleMenuPress}
            activeOpacity={0.7}
          >
            <Ionicons name="ellipsis-horizontal" size={20} color="#fff" />
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  };
  
  const renderListItem = ({ item }: { item: any }) => {
  const mediaUrl = fixUrl(item.full_image_url || item.media_url);
  const isVideo =
    item.media_type === 'video' ||
    mediaUrl?.toLowerCase().endsWith('.mp4') ||
    mediaUrl?.toLowerCase().endsWith('.mov') ||
    mediaUrl?.toLowerCase().endsWith('.avi') ||
    mediaUrl?.toLowerCase().endsWith('.webm');

  const handlePostPress = () => {
    if (item.id) {
      console.log('📱 Navigating to post details:', item.id);
      router.push(`/post-details/${item.id}`);
    } else {
      console.warn('⚠️ Post ID is missing:', item);
    }
  };

  const handleMenuPress = (e: any) => {
    e.stopPropagation();
    setSelectedPostForDelete(item);
    setDeleteModalVisible(true);
  };

  return (
    <TouchableOpacity
      style={styles.listItem}
      onPress={handlePostPress}
      activeOpacity={0.8}
    >
      {/* Left Side - Image */}
      <View style={styles.listImageContainer}>
        {mediaUrl ? (
          <Image 
            source={{ uri: mediaUrl }} 
            style={styles.listImage} 
            resizeMode="cover" 
          />
        ) : (
          <View style={styles.listImagePlaceholder}>
            <Ionicons name="image-outline" size={40} color="#ccc" />
          </View>
        )}
        {isOwnProfile && (
          <TouchableOpacity
            style={styles.listMenuButton}
            onPress={handleMenuPress}
            activeOpacity={0.7}
          >
            <Ionicons name="ellipsis-horizontal" size={20} color="#fff" />
          </TouchableOpacity>
        )}
      </View>

      {/* Right Side - Details */}
<View style={styles.listDetails}>
 {/* Likes - Gradient Heart */}
<View style={styles.listDetailRow}>
  <GradientHeart size={20} />
  <Text style={styles.listDetailText}>
    {item.likes_count || item.likes || 0}
  </Text>
</View>

  {/* Rating */}
  {item.rating && (
    <View style={styles.listDetailRow}>
      <Ionicons name="star" size={20} color="#F2CF68" />
      <Text style={styles.listDetailText}>
        {item.rating}/10
      </Text>
    </View>
  )}

  {/* Reviews - Show if review_text exists */}
{item.review_text && (
  <View style={styles.listDetailRow}>
    <Ionicons name="create" size={20} color="#F2CF68" />
    <Text style={styles.listDetailText} numberOfLines={1}>
      {item.review_text}
    </Text>
  </View>
)}

  {/* Location */}
  {(item.location_name || item.location || item.place_name) && (
    <View style={styles.listDetailRow}>
      <Ionicons name="location" size={20} color="#F2CF68" />
      <Text style={styles.listDetailText} numberOfLines={2}>
        {item.location_name || item.location || item.place_name}
      </Text>
    </View>
  )}
</View>
    </TouchableOpacity>
  );
};

  const renderVideoListItem = ({ item }: { item: any }) => {
  const mediaUrl = fixUrl(item.full_image_url || item.media_url);

  const handlePostPress = () => {
    if (item.id) {
      console.log('📱 Navigating to post details:', item.id);
      router.push(`/post-details/${item.id}`);
    } else {
      console.warn('⚠️ Post ID is missing:', item);
    }
  };

  const handleMenuPress = (e: any) => {
    e.stopPropagation();
    setSelectedPostForDelete(item);
    setDeleteModalVisible(true);
  };

  return (
    <TouchableOpacity
      style={styles.listItem}
      onPress={handlePostPress}
      activeOpacity={0.8}
    >
      {/* Left Side - Video Thumbnail */}
      <View style={styles.listImageContainer}>
        {mediaUrl ? (
          <View style={styles.videoThumbnailContainer}>
            <Image 
              source={{ uri: mediaUrl }} 
              style={styles.listImage} 
              resizeMode="cover" 
            />
            <View style={styles.videoPlayOverlay}>
              <Ionicons name="play-circle" size={50} color="#fff" />
            </View>
          </View>
        ) : (
          <View style={styles.listImagePlaceholder}>
            <Ionicons name="videocam-outline" size={40} color="#ccc" />
          </View>
        )}
        {isOwnProfile && (
          <TouchableOpacity
            style={styles.listMenuButton}
            onPress={handleMenuPress}
            activeOpacity={0.7}
          >
            <Ionicons name="ellipsis-horizontal" size={20} color="#fff" />
          </TouchableOpacity>
        )}
      </View>

      {/* Right Side - Details */}
<View style={styles.listDetails}>
   {/* Likes - Gradient Heart */}
<View style={styles.listDetailRow}>
  <GradientHeart size={20} />
  <Text style={styles.listDetailText}>
    {item.likes_count || item.likes || 0}
  </Text>
</View>

  {/* Rating */}
  {item.rating && (
    <View style={styles.listDetailRow}>
      <Ionicons name="star" size={20} color="#F2CF68" />
      <Text style={styles.listDetailText}>
        {item.rating}/10
      </Text>
    </View>
  )}

  {/* Reviews - Show if review_text exists */}
{item.review_text && (
  <View style={styles.listDetailRow}>
    <Ionicons name="chatbubble-ellipses" size={20} color="#F2CF68" />
    <Text style={styles.listDetailText} numberOfLines={1}>
      {item.review_text}
    </Text>
  </View>
)}

  {/* Location */}
  {(item.location_name || item.location || item.place_name) && (
    <View style={styles.listDetailRow}>
      <Ionicons name="location" size={20} color="#F2CF68" />
      <Text style={styles.listDetailText} numberOfLines={2}>
        {item.location_name || item.location || item.place_name}
      </Text>
    </View>
  )}
</View>
    </TouchableOpacity>
  );
};
   

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#4dd0e1" />
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
      </View>
    );
  }

  if (error || !userData) {
    return (
      <View style={styles.container}>
        <View style={styles.centered}>
          <Ionicons name="alert-circle-outline" size={64} color="#999" />
          <Text style={styles.errorText}>Unable to load profile.</Text>
        </View>
        <View style={styles.navBar}>
          <TouchableOpacity style={styles.navItem} onPress={() => router.push('/feed')}>
            <Ionicons name="home-outline" size={28} color="#000" />
            <Text style={styles.navLabel}>Home</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.navItem} onPress={() => router.push('/explore')}>
            <Ionicons name="compass-outline" size={28} color="#000" />
            <Text style={styles.navLabel}>Explore</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.centerNavItem} onPress={() => router.push('/leaderboard')}>
            <View style={styles.centerIconCircle}>
              <Ionicons name="camera" size={28} color="#000" />
            </View>
            <Text style={styles.navLabel}>Top Posts</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.navItem} onPress={() => router.push('/happening')}>
            <Ionicons name="location-outline" size={28} color="#000" />
            <Text style={styles.navLabel}>Happening</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.navItem} onPress={() => router.push('/profile')}>
            <Ionicons name="person" size={28} color="#000" />
            <Text style={styles.navLabel}>Profile</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* ================= GRADIENT HEADER ================= */}
        <View style={styles.headerContainer}>
          <LinearGradient
            colors={["#E94A37", "#F2CF68", "#1B7C82"]}
            locations={[0, 0.5, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.gradientHeader}
          >
            {/* Top Row */}
            <View style={styles.headerRow}>
              {!isOwnProfile ? (
                <TouchableOpacity
                  style={styles.backButton}
                  onPress={() => router.back()}
                >
                  <Ionicons name="arrow-back" size={24} color="#fff" />
                </TouchableOpacity>
              ) : (
                <View style={styles.leftSpacer} />
              )}

              <Text style={styles.cofauTitle}>
                {isOwnProfile ? 'Cofau' : 'Abows'}
              </Text>

              <View style={styles.headerIcons}>
                {!isOwnProfile && (
                  <TouchableOpacity
                    style={styles.headerIconButton}
                    onPress={() => {}}
                  >
                    <Ionicons name="search-outline" size={24} color="#fff" />
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={styles.headerIconButton}
                  onPress={() => router.push('/cart')}
                >
                  <Ionicons name="menu" size={24} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>
          </LinearGradient>

          {/* ================= PROFILE CARD - OVERLAPS GRADIENT ================= */}
          <View style={styles.profileCardWrapper}>
            <View style={styles.profileCard}>
              {/* Profile Picture */}
              <View style={styles.profilePictureContainer}>
                {/* @ts-ignore */}
                <ProfileBadge
                  profilePicture={userData.profile_picture}
                  username={userData.full_name || userData.username}
                  level={userData.level || 1}
                  dpSize={90}
                  cameraIcon={
                    isOwnProfile ? (
                      <TouchableOpacity
                        style={styles.cameraIcon}
                        onPress={handleProfilePicturePress}
                        disabled={uploadingImage}
                      >
                        {uploadingImage ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <Ionicons name="camera" size={16} color="#fff" />
                        )}
                      </TouchableOpacity>
                    ) : null
                  }
                />
              </View>

              {/* Username */}
              <View style={styles.profileInfo}>
                <Text style={styles.profileUsername}>
                  {userData.username || userData.full_name || 'User'}
                </Text>
              </View>

            </View>
          </View>
        </View>

        {/* Stats Section */}
        <View style={styles.statsSection}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>
              {userStats?.total_posts || 0}
            </Text>
            <Text style={styles.statLabel}>Posts</Text>
          </View>
          <TouchableOpacity 
            style={styles.statBox}
            onPress={() => {
              if (userData?.id) {
                setFollowersModalVisible(true);
                fetchFollowers();
              }
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.statValue}>
              {userStats?.followers_count || 0}
            </Text>
            <Text style={styles.statLabel}>People</Text>
          </TouchableOpacity>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>
              {complimentsCount}
            </Text>
            <Text style={styles.statLabel}>Compliments</Text>
          </View>
        </View>

        {/* Action Buttons with Gradient */}
        <View style={styles.actionButtonsContainer}>
          {isOwnProfile ? (
            <>
              {/* Follow Button */}
              <TouchableOpacity
                style={styles.actionButtonWrapper}
                onPress={() => setEditModalVisible(true)}
              >
                <LinearGradient
                  colors={['#E94A37', '#F2CF68', '#1B7C82']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  locations={[0, 0.35, 0.9]}
                  style={styles.actionButton}
                >
                  <Ionicons name="person-add" size={16} color="#fff" />
                  <Text style={styles.actionButtonText}>Follow</Text>
                </LinearGradient>
              </TouchableOpacity>

              {/* Message Button */}
              <TouchableOpacity
                style={styles.actionButtonWrapper}
                onPress={() => {}}
              >
                <LinearGradient
                  colors={['#E94A37', '#F2CF68', '#1B7C82']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  locations={[0, 0.35, 0.9]}
                  style={styles.actionButton}
                >
                  <Ionicons name="chatbubble" size={16} color="#fff" />
                  <Text style={styles.actionButtonText}>Message</Text>
                </LinearGradient>
              </TouchableOpacity>

              {/* Compliment Button */}
              <TouchableOpacity
                style={styles.actionButtonWrapper}
                onPress={() => setComplimentModalVisible(true)}
              >
                <LinearGradient
                  colors={['#E94A37', '#F2CF68', '#1B7C82']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  locations={[0, 0.35, 0.9]}
                  style={styles.actionButton}
                >
                  <Ionicons name="heart" size={16} color="#fff" />
                  <Text style={styles.actionButtonText}>Compliment</Text>
                </LinearGradient>
              </TouchableOpacity>
            </>
          ) : (
            <>
              {/* Follow/Following Button */}
              <TouchableOpacity
                style={styles.actionButtonWrapper}
                onPress={handleFollowToggle}
                disabled={followLoading}
              >
                <LinearGradient
                  colors={isFollowing ? ['#4CAF50', '#4CAF50', '#4CAF50'] : ['#E94A37', '#F2CF68', '#1B7C82']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  locations={[0, 0.35, 0.9]}
                  style={styles.actionButton}
                >
                  {followLoading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Ionicons 
                        name={isFollowing ? "checkmark-circle" : "person-add"} 
                        size={16} 
                        color="#fff"
                      />
                      <Text style={styles.actionButtonText}>
                        {isFollowing ? 'Following' : 'Follow'}
                      </Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>

              {/* Message Button */}
              <TouchableOpacity
                style={styles.actionButtonWrapper}
                onPress={() => router.push(`/chat/${userData.id}`)}
              >
                <LinearGradient
                  colors={['#E94A37', '#F2CF68', '#1B7C82']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  locations={[0, 0.35, 0.9]}
                  style={styles.actionButton}
                >
                  <Ionicons name="chatbubble" size={16} color="#fff" />
                  <Text style={styles.actionButtonText}>Message</Text>
                </LinearGradient>
              </TouchableOpacity>

              {/* Compliment Button */}
              <TouchableOpacity
                style={styles.actionButtonWrapper}
                onPress={() => setComplimentModalVisible(true)}
                disabled={hasComplimented}
              >
                <LinearGradient
                  colors={hasComplimented ? ['#95A3A4', '#95A3A4', '#95A3A4'] : ['#E94A37', '#F2CF68', '#1B7C82']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  locations={[0, 0.35, 0.9]}
                  style={[styles.actionButton, hasComplimented && { opacity: 0.7 }]}
                >
                  <Ionicons 
                    name={hasComplimented ? "heart" : "heart"} 
                    size={16} 
                    color="#fff"
                  />
                  <Text style={styles.actionButtonText}>
                    {hasComplimented ? 'Complimented' : 'Compliment'}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Bio Section */}
        <View style={styles.bioSection}>
          <Text style={styles.bioLabel}>Bio:</Text>
          <Text style={styles.bioText}>
            {userData.bio || 'No bio yet. Add one by editing your profile!'}
          </Text>
        </View>

        {/* Tab Navigation */}
        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'posts' && styles.activeTab]}
            onPress={() => setActiveTab('posts')}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === 'posts' && styles.activeTabText,
              ]}
            >
              Photos
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'videos' && styles.activeTab]}
            onPress={() => setActiveTab('videos')}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === 'videos' && styles.activeTabText,
              ]}
            >
              Videos
            </Text>
          </TouchableOpacity>
        </View>

        {activeTab === 'videos' ? (
  <FlatList
    key="videos-list"
    data={userPosts.filter((post: any) => post.isVideo)}
    renderItem={renderVideoListItem}
    keyExtractor={(item: any) => item.id}
    scrollEnabled={false}
    ListEmptyComponent={() => (
      <View style={styles.emptyContainer}>
        <Ionicons name="videocam-outline" size={64} color="#ccc" />
        <Text style={styles.emptyText}>No videos yet</Text>
      </View>
    )}
  />
) : (
  <FlatList
    key="photos-list"
    data={userPosts.filter((post: any) => !post.isVideo)}
    renderItem={renderListItem}
    keyExtractor={(item: any) => item.id}
    scrollEnabled={false}
    ListEmptyComponent={() => (
      <View style={styles.emptyContainer}>
        <Ionicons name="images-outline" size={64} color="#ccc" />
        <Text style={styles.emptyText}>No posts yet</Text>
      </View>
    )}
  />
)}

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Bottom Navigation - Matching feed.tsx */}
      <View style={styles.navBar}>
        <TouchableOpacity style={styles.navItem} onPress={() => router.push('/feed')}>
          <Ionicons name="home-outline" size={28} color="#000" />
          <Text style={styles.navLabel}>Home</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => router.push('/explore')}>
          <Ionicons name="compass-outline" size={28} color="#000" />
          <Text style={styles.navLabel}>Explore</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.centerNavItem} onPress={() => router.push('/leaderboard')}>
          <View style={styles.centerIconCircle}>
            <Ionicons name="camera" size={28} color="#000" />
          </View>
          <Text style={styles.navLabel}>Top Posts</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => router.push('/happening')}>
          <Ionicons name="location-outline" size={28} color="#000" />
          <Text style={styles.navLabel}>Happening</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => router.push('/profile')}>
          <Ionicons name="person" size={28} color="#000" />
          <Text style={styles.navLabel}>Profile</Text>
        </TouchableOpacity>
      </View>

      {/* Edit Profile Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={editModalVisible}
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Profile</Text>
              <TouchableOpacity onPress={() => setEditModalVisible(false)}>
                <Ionicons name="close" size={28} color="#000" />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Name</Text>
            <TextInput
              style={styles.input}
              value={editedName}
              onChangeText={setEditedName}
              placeholder="Enter your name"
            />

            <Text style={styles.inputLabel}>Bio</Text>
            <TextInput
              style={[styles.input, styles.bioInput]}
              value={editedBio}
              onChangeText={setEditedBio}
              placeholder="Tell us about yourself..."
              multiline
              numberOfLines={4}
            />

            <TouchableOpacity
              style={styles.saveButton}
              onPress={handleUpdateProfile}
            >
              <Text style={styles.saveButtonText}>Save Changes</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Settings Modal - Instagram Style */}
      <Modal
        animationType="slide"
        transparent={false}
        visible={settingsModalVisible}
        onRequestClose={() => setSettingsModalVisible(false)}
      >
        <View style={styles.settingsModalContainer}>
          <View style={styles.settingsModalContent}>
            {/* Header */}
            <View style={styles.settingsModalHeader}>
              <TouchableOpacity onPress={() => setSettingsModalVisible(false)}>
                <Ionicons name="close" size={28} color="#333" />
              </TouchableOpacity>
              <Text style={styles.settingsModalTitle}>Menu</Text>
              <View style={{ width: 28 }} />
            </View>

            {/* Menu Options */}
            <View style={styles.settingsMenuOptions}>
              {/* Saved Posts */}
              <TouchableOpacity
                style={styles.settingsMenuItem}
                onPress={() => {
                  setSettingsModalVisible(false);
                  router.push('/saved-posts');
                }}
              >
                <View style={styles.settingsMenuIconContainer}>
                  <Ionicons name="bookmark-outline" size={24} color="#333" />
                </View>
                <Text style={styles.settingsMenuText}>Saved</Text>
                <Ionicons name="chevron-forward" size={20} color="#999" />
              </TouchableOpacity>

              {/* Settings */}
              <TouchableOpacity
                style={styles.settingsMenuItem}
                onPress={() => {
                  setSettingsModalVisible(false);
                  setLevelDetailsModalVisible(true);
                }}
              >
                <View style={styles.settingsMenuIconContainer}>
                  <Ionicons name="settings-outline" size={24} color="#333" />
                </View>
                <Text style={styles.settingsMenuText}>Settings</Text>
                <Ionicons name="chevron-forward" size={20} color="#999" />
              </TouchableOpacity>

              {/* Logout */}
              <TouchableOpacity
                style={[styles.settingsMenuItem, styles.logoutMenuItem]}
                onPress={() => {
                  setSettingsModalVisible(false);
                  if (Platform.OS === 'web') {
                    const confirmed = window.confirm(
                      'Are you sure you want to logout?'
                    );
                    if (confirmed) {
                      handleLogout();
                    }
                  } else {
                    Alert.alert('Logout', 'Are you sure you want to logout?', [
                      {
                        text: 'Cancel',
                        style: 'cancel',
                      },
                      {
                        text: 'Logout',
                        onPress: () => handleLogout(),
                        style: 'destructive',
                      },
                    ]);
                  }
                }}
              >
                <View style={styles.settingsMenuIconContainer}>
                  <Ionicons name="log-out-outline" size={24} color="#FF6B6B" />
                </View>
                <Text style={[styles.settingsMenuText, styles.logoutMenuText]}>Logout</Text>
                <Ionicons name="chevron-forward" size={20} color="#FF6B6B" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <ComplimentModal
        visible={complimentModalVisible}
        onClose={() => setComplimentModalVisible(false)}
        onSend={async (complimentType: string) => {
          if (!userData?.id || !token) return;

          setSendingCompliment(true);
          try {
            await sendCompliment(userData.id, complimentType);
            setHasComplimented(true);
            fetchComplimentsCount();
            Alert.alert('Success', 'Compliment sent successfully!');
            setComplimentModalVisible(false);
          } catch (error: any) {
            console.error('❌ Error sending compliment:', error);
            Alert.alert(
              'Error',
              error.response?.data?.detail || 'Failed to send compliment. Please try again.'
            );
          } finally {
            setSendingCompliment(false);
          }
        }}
        loading={sendingCompliment}
      />

      <Modal
        animationType="slide"
        transparent={true}
        visible={deleteModalVisible}
        onRequestClose={() => {
          setDeleteModalVisible(false);
          setSelectedPostForDelete(null);
        }}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Delete Post</Text>
              <TouchableOpacity
                onPress={() => {
                  setDeleteModalVisible(false);
                  setSelectedPostForDelete(null);
                }}
              >
                <Ionicons name="close" size={28} color="#000" />
              </TouchableOpacity>
            </View>

            <Text style={styles.deleteConfirmText}>
              Are you sure you want to delete this post? This action cannot be undone.
            </Text>

            <View style={styles.deleteModalButtons}>
              <TouchableOpacity
                style={[styles.deleteModalButton, styles.deleteCancelButton]}
                onPress={() => {
                  setDeleteModalVisible(false);
                  setSelectedPostForDelete(null);
                }}
              >
                <Text style={styles.deleteCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.deleteModalButton, styles.deleteConfirmButton]}
                onPress={handleDeletePost}
                disabled={deletingPost}
              >
                {deletingPost ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="trash-outline" size={20} color="#fff" />
                    <Text style={styles.deleteConfirmTextButton}>Delete</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        animationType="slide"
        transparent={true}
        visible={followersModalVisible}
        onRequestClose={() => setFollowersModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Followers</Text>
              <TouchableOpacity onPress={() => setFollowersModalVisible(false)}>
                <Ionicons name="close" size={28} color="#000" />
              </TouchableOpacity>
            </View>

            {loadingFollowers ? (
              <View style={styles.centered}>
                <ActivityIndicator size="large" color="#4dd0e1" />
                <Text style={styles.loadingText}>Loading followers...</Text>
              </View>
            ) : followersList.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="people-outline" size={64} color="#ccc" />
                <Text style={styles.emptyText}>No followers yet</Text>
              </View>
            ) : (
              <FlatList
                data={followersList}
                keyExtractor={(item) => item.id || item.user_id || String(Math.random())}
                renderItem={({ item }) => {
                  const followerId = item.id || item.user_id;
                  const isFollowingFollower = followingStatus[followerId] || false;
                  
                  return (
                    <TouchableOpacity
                      style={styles.followerItem}
                      onPress={() => {
                        setFollowersModalVisible(false);
                        router.push(`/profile?userId=${followerId}`);
                      }}
                      activeOpacity={0.7}
                    >
                      <UserAvatar
                        profilePicture={item.profile_picture}
                        username={item.full_name || item.username}
                        size={50}
                        level={item.level || 1}
                        showLevelBadge={false}
                        style={{}}
                      />
                      <View style={styles.followerInfo}>
                        <Text style={styles.followerName}>
                          {item.full_name || item.username || 'Unknown User'}
                        </Text>
                      </View>
                      {!isOwnProfile && (
                        <TouchableOpacity
                          style={[
                            styles.followerFollowButton,
                            isFollowingFollower && styles.followerFollowingButton,
                          ]}
                          onPress={(e) => {
                            e.stopPropagation();
                            handleFollowerFollowToggle(followerId);
                          }}
                          activeOpacity={0.7}
                        >
                          <Text
                            style={[
                              styles.followerFollowButtonText,
                              isFollowingFollower && styles.followerFollowingButtonText,
                            ]}
                          >
                            {isFollowingFollower ? 'Following' : 'Follow'}
                          </Text>
                        </TouchableOpacity>
                      )}
                    </TouchableOpacity>
                  );
                }}
                contentContainerStyle={styles.followersListContent}
              />
            )}
          </View>
        </View>
      </Modal>

      <Modal
        animationType="slide"
        transparent={true}
        visible={levelDetailsModalVisible}
        onRequestClose={() => setLevelDetailsModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Level Details</Text>
              <TouchableOpacity onPress={() => setLevelDetailsModalVisible(false)}>
                <Ionicons name="close" size={28} color="#000" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.levelDetailsContent}>
              <View style={styles.levelInfoCard}>
                <View style={styles.levelInfoRow}>
                  <Text style={styles.levelInfoLabel}>Current Level:</Text>
                  <View style={styles.levelBadgeContainer}>
                    <Text style={styles.levelBadgeText}>
                      Level {userData?.level || 1}
                    </Text>
                  </View>
                </View>

                <View style={styles.levelInfoRow}>
                  <Text style={styles.levelInfoLabel}>Title:</Text>
                  <Text style={styles.levelInfoValue}>
                    {userData?.title || 'Reviewer'}
                  </Text>
                </View>

                {userData?.points !== undefined && (
                  <View style={styles.levelInfoRow}>
                    <Text style={styles.levelInfoLabel}>Current Points:</Text>
                    <Text style={styles.levelInfoValue}>
                      {userData.points || 0}
                    </Text>
                  </View>
                )}

                {userData?.total_points !== undefined && (
                  <View style={styles.levelInfoRow}>
                    <Text style={styles.levelInfoLabel}>Total Points:</Text>
                    <Text style={styles.levelInfoValue}>
                      {userData.total_points || 0}
                    </Text>
                  </View>
                )}

                {userData?.requiredPoints !== undefined && (
                  <View style={styles.levelInfoRow}>
                    <Text style={styles.levelInfoLabel}>Points for Next Level:</Text>
                    <Text style={styles.levelInfoValue}>
                      {userData.requiredPoints || 1250}
                    </Text>
                  </View>
                )}

                {userData?.requiredPoints && userData?.points !== undefined && (
                  <View style={styles.progressContainer}>
                    <Text style={styles.progressLabel}>Progress to Next Level</Text>
                    <View style={styles.progressBar}>
                      <View
                        style={[
                          styles.progressFill,
                          {
                            width: `${Math.min(100, (userData.points / userData.requiredPoints) * 100)}%`
                          }
                        ]}
                      />
                    </View>
                    <Text style={styles.progressText}>
                      {userData.points} / {userData.requiredPoints} points
                    </Text>
                  </View>
                )}
              </View>

              <View style={styles.levelSystemInfo}>
                <Text style={styles.levelSystemTitle}>Level System</Text>
                <Text style={styles.levelSystemText}>
                  • Levels 1-4: Reviewer (25 points per post)
                </Text>
                <Text style={styles.levelSystemText}>
                  • Levels 5-8: Top Reviewer (15 points per post)
                </Text>
                <Text style={styles.levelSystemText}>
                  • Levels 9-12: Influencer (5 points per post)
                </Text>
                <Text style={styles.levelSystemText}>
                  • Earn points by creating posts and engaging with content
                </Text>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

/* ================= STYLES ================= */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollContent: {
    paddingBottom: 100,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  errorText: {
    marginTop: 16,
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
  },

  // List Layout Styles
listItem: {
  flexDirection: 'row',
  paddingVertical: 12,
  paddingHorizontal: 16,
  borderBottomWidth: 1,
  borderBottomColor: '#f0f0f0',
  backgroundColor: '#fff',
},
listImageContainer: {
  width: 200,
  height: 220,
  borderRadius: 12,
  overflow: 'hidden',
  position: 'relative',
  marginRight: 16,
},
listImage: {
  width: '100%',
  height: '100%',
},
listImagePlaceholder: {
  width: '100%',
  height: '100%',
  backgroundColor: '#f5f5f5',
  justifyContent: 'center',
  alignItems: 'center',
},
listMenuButton: {
  position: 'absolute',
  top: 8,
  right: 0,
  backgroundColor: 'rgba(0, 0, 0, 0.6)',
  borderRadius: 15,
  width: 30,
  height: 30,
  justifyContent: 'center',
  alignItems: 'center',
},
listDetails: {
  flex: 1,
  justifyContent: 'center',
  gap: 12,
},
listDetailRow: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 8,
},
listDetailText: {
  fontSize: 15,
  color: '#333',
  fontWeight: '600',
  flex: 1,
},

videoThumbnailContainer: {
  width: '100%',
  height: '100%',
  position: 'relative',
},
videoPlayOverlay: {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: 'rgba(0, 0, 0, 0.3)',
  justifyContent: 'center',
  alignItems: 'center',
},

gradientHeartContainer: {
  width: 32,
  height: 32,
  borderRadius: 16,
  overflow: 'hidden',
},
gradientHeart: {
  width: '100%',
  height: '100%',
  justifyContent: 'center',
  alignItems: 'center',
},

    // Settings Modal Styles (Instagram-like) - ADD THESE
  settingsModalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  settingsModalContent: {
    flex: 1,
    paddingTop: 60,
  },
  settingsModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  settingsModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  settingsMenuOptions: {
    paddingTop: 20,
  },
  settingsMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  settingsMenuIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  settingsMenuText: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  logoutMenuItem: {
    marginTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  logoutMenuText: {
    color: '#FF6B6B',
  },
  reviewerBadgeContainer: {
    position: 'absolute',
    right: 16,
    top: '50%',
    transform: [{ translateY: -40 }],
    alignItems: 'center',
  },

  headerContainer: {
    position: 'relative',
    marginBottom: 8,
  },
  gradientHeader: {
    paddingTop: 65,
    paddingBottom: 55,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  leftSpacer: {
    width: 40,
  },
  cofauTitle: {
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
    fontFamily: 'Lobster',
    fontSize: 36,
    color: '#fff',
    letterSpacing: 1,
    zIndex: -1,
    textShadowColor: 'rgba(0, 0, 0, 0.15)',
    textShadowOffset: { width: 4, height: 6 },
    textShadowRadius: 4,
  },
  headerIcons: {
    flexDirection: 'row',
    gap: 12,
  },
  headerIconButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },

  profileCardWrapper: {
    marginHorizontal: 35,
    marginTop: -40,
    marginBottom: 5,
  },
  profileCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    paddingVertical: 60,
    paddingLeft: 100,
    paddingRight: 100,
    justifyContent: 'center',
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    position: 'relative',
    borderWidth: 0,
  },
  profilePictureContainer: {
    position: 'absolute',
    left: 15,
    top: '400%',
    transform: [{ translateY: -45 }],
    zIndex: 10,
  },
  cameraIcon: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    backgroundColor: '#4dd0e1',
    borderRadius: 14,
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  profileInfo: {
    flex: 1,
    alignItems: 'flex-start',
    paddingLeft: 10,
  },
  profileUsername: {
    fontSize: 17,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
    marginTop: -10,
  },

  statsSection: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  statBox: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
    minWidth: 100,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 11,
    color: '#666',
  },

  actionButtonsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 40,
    gap: 14,
    marginBottom: 8,
  },
  actionButtonWrapper: {
    flex: 1,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    borderRadius: 18,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },

  bioSection: {
    paddingHorizontal: 20,
    paddingVertical: 4,
    marginBottom: 16,
  },
  bioLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#333',
    marginBottom: 4,
  },
  bioText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 40,
  },

  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    marginBottom: 2,
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#4dd0e1',
  },
  tabText: {
    fontSize: 15,
    color: '#999',
  },
  activeTabText: {
    color: '#333',
    fontWeight: '600',
  },

  gridItem: {
    width: (SCREEN_WIDTH - 2) / 3,
    height: (SCREEN_WIDTH - 2) / 3,
    margin: 0.5,
    position: 'relative',
  },
  gridImage: {
    width: '100%',
    height: '100%',
  },
  gridImageContainer: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  videoOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  gridPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  ratingBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#FFD700',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  ratingText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#333',
  },
  postMenuButton: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 15,
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: '#999',
  },

  navBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E8E8E8',
    backgroundColor: '#FFFFFF',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  navItem: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  centerNavItem: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginTop: -30,
  },
  centerIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  navLabel: {
    fontSize: 11,
    color: '#000',
    marginTop: 2,
    textAlign: 'center',
    fontWeight: '500',
  },

  bottomSpacer: {
    height: 20,
  },

  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
    marginTop: 15,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
  },
  bioInput: {
    height: 100,
    textAlignVertical: 'top',
  },
  saveButton: {
    backgroundColor: '#4dd0e1',
    paddingVertical: 15,
    borderRadius: 25,
    alignItems: 'center',
    marginTop: 20,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  settingsOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  settingsOptionText: {
    fontSize: 16,
    color: '#333',
    marginLeft: 16,
  },
  logoutButtonModal: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    paddingVertical: 15,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: '#FF6B6B',
    backgroundColor: '#fff',
  },
  logoutText: {
    color: '#FF6B6B',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  deleteConfirmText: {
    fontSize: 16,
    color: '#333',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 22,
  },
  deleteModalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  deleteModalButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  deleteCancelButton: {
    backgroundColor: '#f0f0f0',
  },
  deleteCancelText: {
    color: '#333',
    fontSize: 16,
    fontWeight: '600',
  },
  deleteConfirmButton: {
    backgroundColor: '#FF3B30',
  },
  deleteConfirmTextButton: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  followerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  followerInfo: {
    flex: 1,
    marginLeft: 12,
  },
  followerName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  followersListContent: {
    paddingBottom: 20,
  },
  followerFollowButton: {
    backgroundColor: '#4dd0e1',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  followerFollowingButton: {
    backgroundColor: '#28a745',
  },
  followerFollowButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  followerFollowingButtonText: {
    color: '#fff',
  },
  levelDetailsContent: {
    maxHeight: 400,
  },
  levelInfoCard: {
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 15,
    marginBottom: 20,
  },
  levelInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  levelInfoLabel: {
    fontSize: 16,
    color: '#666',
    fontWeight: '600',
  },
  levelInfoValue: {
    fontSize: 16,
    color: '#333',
    fontWeight: 'bold',
  },
  levelBadgeContainer: {
    backgroundColor: '#4dd0e1',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 18,
  },
  levelBadgeText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  progressContainer: {
    marginTop: 10,
  },
  progressLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    fontWeight: '600',
  },
  progressBar: {
    height: 8,
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 5,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#4dd0e1',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'right',
  },
  levelSystemInfo: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  levelSystemTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  levelSystemText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 22,
    marginBottom: 8,
  },
});