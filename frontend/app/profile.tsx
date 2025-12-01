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
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import axios from 'axios';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import LevelBadge from '../components/LevelBadge';
import UserAvatar from '../components/UserAvatar';
import ProfileBadge from '../components/ProfileBadge';
import ComplimentModal from '../components/ComplimentModal';
import { sendCompliment } from '../utils/api';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://backend.cofau.com';
const API_URL = `${BACKEND_URL}/api`;
const SCREEN_WIDTH = Dimensions.get('window').width;

const fixUrl = (url?: string | null) => {
  if (!url) return null;

  // Already absolute
  if (url.startsWith("http")) return url;

  // Normalize slashes
  url = url.replace(/\/+/g, "/");

  // ✅ Keep /api/static/... as is - backend serves static files at /api/static/
  // If URL starts with /api/, prepend BACKEND_URL
  if (url.startsWith("/api/")) {
    return `${BACKEND_URL}${url}`;
  }

  // For other relative URLs, prepend BACKEND_URL
  return `${BACKEND_URL}${url.startsWith("/") ? url : "/" + url}`;
};

export default function ProfileScreen() {
  const router = useRouter();
  const { userId } = useLocalSearchParams(); // Get userId from query params
  const { token, logout, user: currentUser } = useAuth();

  const [userData, setUserData] = useState<any>(null);

  console.log("userDataProfile", userData);
  const [userStats, setUserStats] = useState<any>(null);
  const [userPosts, setUserPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [activeTab, setActiveTab] = useState<'photo' | 'video' | 'collabs' | 'saved'>('photo');
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

  useEffect(() => {
    if (!token) {
      setLoading(false);
      setError(true);
      return;
    }
    fetchProfileData();
  }, [token, userId]); // Re-fetch when userId changes

  useEffect(() => {
    // Fetch follow status when viewing another user's profile
    if (!isOwnProfile && userData?.id && token) {
      fetchFollowStatus();
    }
  }, [isOwnProfile, userData?.id, token]);

  useEffect(() => {
    if (userData) {
      fetchUserPosts();
    }
  }, [userData, activeTab]);

  const fetchProfileData = async () => {
    try {
      let user: any;

      // Determine the final user ID and ownership
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
        // Viewing another user's profile
        console.log('📡 Fetching other user profile:', userId);

        const meResponse = await axios.get(`${API_URL}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (userId === (meResponse.data.user?.id || meResponse.data.id)) {
          user = meResponse.data.user || meResponse.data;
          setIsOwnProfile(true);
        } else {
          // Use the proper user profile endpoint to get complete user data including profile_picture
          try {
            const userResponse = await axios.get(`${API_URL}/users/${userId}`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            user = userResponse.data;
            console.log('✅ Fetched user profile from /users endpoint:', user);
          } catch (userError: any) {
            console.log('⚠️ User endpoint failed, trying feed fallback:', userError.message);
            // Fallback to feed if user endpoint fails
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
                // some feeds may send user_profile_picture or profile_picture_url
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
        // Viewing own profile
        console.log('📡 Fetching own profile from:', `${API_URL}/auth/me`);
        setIsOwnProfile(true);
        const response = await axios.get(`${API_URL}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        user = response.data.user || response.data;
      }

      // ✅ Always normalize profile picture URL from any possible backend field
      const rawProfilePicture =
        user.profile_image_url ||
        user.profile_picture ||
        user.profile_picture_url ||
        user.user_profile_picture;
      user.profile_picture = fixUrl(rawProfilePicture);

      setUserData(user);
      setEditedBio(user.bio || '');
      setEditedName(user.full_name || user.username || '');

      // Fetch user stats
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
      let endpoint = `${API_URL}/users/${userData.id}/posts?limit=50`;

      if (activeTab === 'photo') {
        endpoint += '&media_type=photo';
      } else if (activeTab === 'video') {
        endpoint += '&media_type=video';
      } else if (activeTab === 'collabs') {
        endpoint = `${API_URL}/users/${userData.id}/collaborations?limit=50`;
      } else if (activeTab === 'saved') {
        endpoint = `${API_URL}/users/${userData.id}/saved-posts?limit=50`;
      }

      const response = await axios.get(endpoint, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const posts = response.data || [];

      // ✅ Normalize URLs for all posts
      const postsWithFullUrls = posts.map((post: any) => ({
        ...post,
        full_image_url: fixUrl(post.media_url || post.full_image_url),
      }));

      setUserPosts(postsWithFullUrls);
    } catch (err) {
      console.error('❌ Error fetching user posts:', err);
      setUserPosts([]);
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

    // Optimistic UI update
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
      // Revert optimistic update on error
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
      
      console.log('🖼️ Normalized profile picture URL:', normalizedProfilePicture);

      // ✅ Update state immediately for instant UI feedback
      setUserData((prev: any) => ({
        ...prev,
        profile_picture: normalizedProfilePicture,
        profile_picture_url: normalizedProfilePicture,
      }));

      // Refresh profile data from server to ensure consistency and get fresh data
      // This ensures the old image is deleted and new one is properly loaded
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

  const getBadgeInfo = () => {
    if (!userData) return null;

    if (userData.points >= 100) {
      return { name: 'TOP REVIEWER', icon: '🔥', color: '#FF6B6B' };
    } else if (userData.level >= 5) {
      return { name: 'EXPERT', icon: '⭐', color: '#FFD700' };
    } else if (userData.level >= 3) {
      return { name: 'RISING STAR', icon: '🌟', color: '#4dd0e1' };
    }
    return null;
  };

  // ✅ Grid item for both PHOTOS and VIDEOS - navigates to post details
  const renderGridItem = ({ item }: { item: any }) => {
    const mediaUrl = fixUrl(item.full_image_url || item.media_url);
    // Check for video using media_type field or file extension
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
          <TouchableOpacity onPress={() => router.push('/feed')}>
            <Ionicons name="home-outline" size={28} color="#000" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/explore')}>
            <Ionicons name="compass-outline" size={28} color="#000" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/add-post')}>
            <Ionicons name="add-circle-outline" size={28} color="#000" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/happening')}>
            <Ionicons name="flame-outline" size={28} color="#000" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/profile')}>
            <Ionicons name="person" size={28} color="#4dd0e1" />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const badge = getBadgeInfo();

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.username}>
            {userData.full_name || userData.username || 'User'}
          </Text>
          <View style={styles.headerButtons}>
            <TouchableOpacity 
              style={styles.infoButton}
              onPress={() => setLevelDetailsModalVisible(true)}
            >
              <Ionicons
                name="information-circle-outline"
                size={24}
                color="#FF6B6B"
              />
            </TouchableOpacity>
            {isOwnProfile && (
              <TouchableOpacity 
                style={styles.settingsButton}
                onPress={() => setSettingsModalVisible(true)}
              >
                <Ionicons
                  name="settings-outline"
                  size={24}
                  color="#666"
                />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Profile Identity Section */}
        <View style={styles.identitySection}>
          <View style={styles.profilePictureContainer}>
            <ProfileBadge
              profilePicture={userData.profile_picture}
              username={userData.full_name || userData.username}
              level={userData.level || 1}
              dpSize={110}
            />
            {isOwnProfile && (
              <TouchableOpacity
                style={styles.cameraIcon}
                onPress={handleProfilePicturePress}
                disabled={uploadingImage}
              >
                {uploadingImage ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Ionicons name="camera" size={20} color="#fff" />
                )}
              </TouchableOpacity>
            )}
          </View>

          {badge && (
            <View style={styles.badgeContainer}>
              <Text style={styles.badgeIcon}>{badge.icon}</Text>
              <Text style={styles.badgeLabel}>{badge.name}</Text>
            </View>
          )}
        </View>

        {/* Stats Section */}
        <View style={styles.statsSection}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>
              {userStats?.total_posts || 0}
            </Text>
            <Text style={styles.statLabel}>Posts</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>
              {userStats?.photos_count || 0}
            </Text>
            <Text style={styles.statLabel}>Photos</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>
              {userStats?.followers_count || 0}
            </Text>
            <Text style={styles.statLabel}>People</Text>
          </View>
        </View>

        {/* Edit Profile / Follow Button */}
        {isOwnProfile ? (
          <TouchableOpacity
            style={styles.editButton}
            onPress={() => setEditModalVisible(true)}
          >
            <Ionicons name="pencil" size={20} color="#fff" />
            <Text style={styles.editButtonText}>Edit Profile</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: "100%", alignItems: "center" }}>
            {/* Follow / Unfollow Button */}
            <TouchableOpacity
              style={[
                styles.editButton,
                isFollowing ? styles.followingButton : styles.followButton,
              ]}
              onPress={handleFollowToggle}
              disabled={followLoading}
            >
              {followLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons
                    name={isFollowing ? "checkmark" : "person-add"}
                    size={20}
                    color="#fff"
                  />
                  <Text style={styles.editButtonText}>
                    {isFollowing ? "Following" : "Follow"}
                  </Text>
                </>
              )}
            </TouchableOpacity>

            {/* Message Button */}
            <TouchableOpacity
              style={[styles.editButton, { backgroundColor: "#4dd0e1", marginTop: 10 }]}
              onPress={() => router.push(`/chat/${userData.id}`)}
            >
              <Ionicons name="chatbubbles-outline" size={20} color="#fff" />
              <Text style={styles.editButtonText}>Message</Text>
            </TouchableOpacity>

            {/* Compliment Button */}
            <TouchableOpacity
              style={[styles.editButton, { backgroundColor: "#FF6B6B", marginTop: 10 }]}
              onPress={() => setComplimentModalVisible(true)}
            >
              <Ionicons name="heart-outline" size={20} color="#fff" />
              <Text style={styles.editButtonText}>Compliment</Text>
            </TouchableOpacity>
          </View>
        )}

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
            style={[styles.tab, activeTab === 'photo' && styles.activeTab]}
            onPress={() => setActiveTab('photo')}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === 'photo' && styles.activeTabText,
              ]}
            >
              Photo
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'video' && styles.activeTab]}
            onPress={() => setActiveTab('video')}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === 'video' && styles.activeTabText,
              ]}
            >
              Video
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'collabs' && styles.activeTab]}
            onPress={() => setActiveTab('collabs')}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === 'collabs' && styles.activeTabText,
              ]}
            >
              Collabs
            </Text>
          </TouchableOpacity>
          {isOwnProfile && (
            <TouchableOpacity
              style={[styles.tab, activeTab === 'saved' && styles.activeTab]}
              onPress={() => setActiveTab('saved')}
            >
              <Text
                style={[
                  styles.tabText,
                  activeTab === 'saved' && styles.activeTabText,
                ]}
              >
                Saved
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Content Grid */}
        <FlatList
          data={userPosts}
          renderItem={renderGridItem}
          keyExtractor={(item: any) => item.id}
          numColumns={3}
          scrollEnabled={false}
          ListEmptyComponent={() => (
            <View style={styles.emptyContainer}>
              <Ionicons name="images-outline" size={64} color="#ccc" />
              <Text style={styles.emptyText}>
                {activeTab === 'photo' && 'No photos yet'}
                {activeTab === 'video' && 'No videos yet'}
                {activeTab === 'collabs' && 'No collaborations yet'}
                {activeTab === 'saved' && 'No saved posts yet'}
              </Text>
            </View>
          )}
        />

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Bottom Navigation */}
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => router.push('/feed')}>
          <Ionicons name="home-outline" size={28} color="#000" />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.push('/explore')}>
          <Ionicons name="compass-outline" size={28} color="#000" />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.push('/add-post')}>
          <Ionicons name="add-circle-outline" size={28} color="#000" />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.push('/happening')}>
          <Ionicons name="flame-outline" size={28} color="#000" />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.push('/profile')}>
          <Ionicons name="person" size={28} color="#4dd0e1" />
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

      {/* Settings Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={settingsModalVisible}
        onRequestClose={() => setSettingsModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Settings</Text>
              <TouchableOpacity onPress={() => setSettingsModalVisible(false)}>
                <Ionicons name="close" size={28} color="#000" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.logoutButtonModal}
              activeOpacity={0.7}
              onPress={() => {
                setSettingsModalVisible(false);
                if (Platform.OS === 'web') {
                  const confirmed = window.confirm(
                    'Are you sure you want to logout?'
                  );
                  if (confirmed) {
                    console.log('✅ User confirmed logout (web)');
                    handleLogout();
                  } else {
                    console.log('❌ Logout cancelled (web)');
                  }
                } else {
                  Alert.alert('Logout', 'Are you sure you want to logout?', [
                    {
                      text: 'Cancel',
                      style: 'cancel',
                      onPress: () => console.log('❌ Logout cancelled'),
                    },
                    {
                      text: 'Logout',
                      onPress: () => {
                        console.log('✅ User confirmed logout');
                        handleLogout();
                      },
                      style: 'destructive',
                    },
                  ]);
                }
              }}
            >
              <Ionicons name="log-out-outline" size={20} color="#FF6B6B" />
              <Text style={styles.logoutText}>Logout</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Compliment Modal */}
      <ComplimentModal
        visible={complimentModalVisible}
        onClose={() => setComplimentModalVisible(false)}
        onSend={async (complimentType: string) => {
          if (!userData?.id || !token) return;
          
          setSendingCompliment(true);
          try {
            await sendCompliment(userData.id, complimentType);
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

      {/* Level Details Modal */}
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 20,
  },
  username: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  infoButton: {
    padding: 5,
  },
  settingsButton: {
    padding: 5,
  },
  identitySection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  profilePictureContainer: {
    position: 'relative',
    marginRight: 20,
  },
  cameraIcon: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    backgroundColor: '#4dd0e1',
    borderRadius: 15,
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeContainer: {
    alignItems: 'center',
  },
  badgeIcon: {
    fontSize: 40,
    marginBottom: 5,
  },
  badgeLabel: {
    fontSize: 12,
    color: '#666',
    fontWeight: '600',
  },
  statsSection: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  statBox: {
    backgroundColor: '#f5f5f5',
    paddingVertical: 15,
    paddingHorizontal: 25,
    borderRadius: 10,
    alignItems: 'center',
    minWidth: 90,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF6B6B',
    marginHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    marginBottom: 20,
  },
  followButton: {
    backgroundColor: '#4dd0e1',
  },
  followingButton: {
    backgroundColor: '#28a745',
  },
  editButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  bioSection: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  bioLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  bioText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    marginBottom: 10,
  },
  tab: {
    flex: 1,
    paddingVertical: 15,
    alignItems: 'center',
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#4dd0e1',
  },
  tabText: {
    fontSize: 16,
    color: '#999',
  },
  activeTabText: {
    color: '#333',
    fontWeight: 'bold',
  },
  gridItem: {
    width: (SCREEN_WIDTH - 6) / 3,
    height: (SCREEN_WIDTH - 6) / 3,
    margin: 1,
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
    top: 5,
    right: 5,
    backgroundColor: '#FFD700',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  ratingText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#333',
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
  levelDetailsContent: {
    maxHeight: 400,
  },
  levelInfoCard: {
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 20,
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
    borderRadius: 15,
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
  bottomSpacer: {
    height: 40,
  },
  navBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderColor: '#ccc',
    backgroundColor: '#fff',
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
});
