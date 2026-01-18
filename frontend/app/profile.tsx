import React, { useEffect, useState, useRef } from 'react';
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
  Animated,
  KeyboardAvoidingView,
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
import { BlurView } from 'expo-blur';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://api.cofau.com';
const API_URL = `${BACKEND_URL}/api`;
const SCREEN_WIDTH = Dimensions.get('window').width;


/* -------------------------
   Level System Helper
------------------------- */
// Level thresholds matching backend LEVEL_TABLE
const LEVEL_TABLE = [
  { level: 1, required_points: 1250 },
  { level: 2, required_points: 2500 },
  { level: 3, required_points: 3750 },
  { level: 4, required_points: 5000 },
  { level: 5, required_points: 5750 },
  { level: 6, required_points: 6500 },
  { level: 7, required_points: 7250 },
  { level: 8, required_points: 8000 },
  { level: 9, required_points: 9000 },
  { level: 10, required_points: 10000 },
  { level: 11, required_points: 11000 },
  { level: 12, required_points: 12000 },
];

/**
 * Calculate points needed from current level to next level
 * @param currentLevel - Current user level
 * @param requiredPoints - Total points required for NEXT level (from backend, after fix)
 * @returns Points needed to reach next level (the difference between next and previous level thresholds)
 */
const getPointsNeededForNextLevel = (currentLevel: number, requiredPoints: number): number => {
  // If at max level (12), return the current required points
  if (currentLevel >= 12) {
    return requiredPoints;
  }
  
  // Find the previous level's threshold
  // currentPoints is calculated as: total_points - previous_level_threshold
  // So we need to find the threshold for level (currentLevel - 1)
  const previousLevelData = LEVEL_TABLE.find(level => level.level === currentLevel - 1);
  
  if (previousLevelData) {
    // Points needed = next level threshold - previous level threshold
    // requiredPoints is now the next level's threshold (after backend fix)
    return requiredPoints - previousLevelData.required_points;
  }
  
  // For Level 1, there's no previous level (threshold is 0)
  // So points needed = requiredPoints (which is Level 2's threshold = 1250)
  if (currentLevel === 1) {
    return requiredPoints;
  }
  
  // Fallback: calculate based on level progression
  if (currentLevel === 4) return 750; // Level 4 → 5: 5750 - 5000 = 750
  if (currentLevel >= 5 && currentLevel <= 8) return 750; // Levels 5-8: 750 points per level
  if (currentLevel >= 9 && currentLevel <= 11) return 1000; // Levels 9-11: 1000 points per level
  
  return 1250; // Default: 1250 points for levels 2-3
};

const fixUrl = (url?: string | null) => {
  if (!url) return null;
  if (url.startsWith("http")) return url;
  url = url.replace(/\/+/g, "/");
  if (url.startsWith("/api/")) {
    return `${BACKEND_URL}${url}`;
  }
  return `${BACKEND_URL}${url.startsWith("/") ? url : "/" + url}`;
};


const fetchRestaurantPosts = async () => {
     if (!userData?.id) return;
     try {
       const response = await axios.get(
         `${API_URL}/restaurant/posts/public/restaurant/${userData.id}`,
         { headers: { Authorization: `Bearer ${token}` } }
       );
       setUserPosts(response.data || []);
     } catch (err) {
       console.error('Error fetching restaurant posts:', err);
       setUserPosts([]);
     }
   };


const ProfileSkeleton = () => {
  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(animatedValue, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: false,
        }),
        Animated.timing(animatedValue, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: false,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, []);

  const backgroundColor = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['#E0E0E0', '#F5F5F5'],
  });

  const SkeletonBox = ({ width, height, borderRadius = 4, style = {} }) => (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius,
          backgroundColor,
        },
        style,
      ]}
    />
  );

  return (
    <View style={styles.container}>
      <View style={styles.headerContainer}>
        <LinearGradient
          colors={["#E94A37", "#F2CF68", "#1B7C82"]}
          locations={[0, 0.5, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.gradientHeader}
        >
          <View style={styles.headerRow}>
            <View style={styles.leftSpacer} />
            <Text style={styles.cofauTitle}>Cofau</Text>
            <View style={{ width: 40 }} />
          </View>
        </LinearGradient>

        <View style={styles.profileCardWrapper}>
          <View style={[styles.profileCard, styles.profileCardAndroid]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', padding: 15 }}>
              {/* DP Skeleton */}
              <View style={{ alignItems: 'center' }}>
                <SkeletonBox width={80} height={80} borderRadius={40} />
                <SkeletonBox width={70} height={14} borderRadius={4} style={{ marginTop: 10 }} />
              </View>
              {/* Badge Skeleton */}
              <View style={{ alignItems: 'center' }}>
                <SkeletonBox width={80} height={80} borderRadius={40} />
                <SkeletonBox width={80} height={14} borderRadius={4} style={{ marginTop: 10 }} />
              </View>
            </View>
          </View>
        </View>
      </View>

     {/* Stats Section Skeleton */}
<View style={styles.statsContainer}>
  <View style={styles.statBox}>
    <SkeletonBox width={40} height={20} borderRadius={4} />
    <SkeletonBox width={50} height={12} borderRadius={4} style={{ marginTop: 5 }} />
  </View>
  
  <View style={styles.statDivider} />
  
  <View style={styles.statBox}>
    <SkeletonBox width={40} height={20} borderRadius={4} />
    <SkeletonBox width={50} height={12} borderRadius={4} style={{ marginTop: 5 }} />
  </View>
  
  <View style={styles.statDivider} />
  
  <View style={styles.statBox}>
    <SkeletonBox width={40} height={20} borderRadius={4} />
    <SkeletonBox width={70} height={12} borderRadius={4} style={{ marginTop: 5 }} />
  </View>
</View>

      {/* Action Buttons Skeleton */}
      <View style={{ flexDirection: 'row', paddingHorizontal: 20, marginBottom: 15 }}>
        <SkeletonBox width={'48%'} height={36} borderRadius={18} />
        <View style={{ width: '4%' }} />
        <SkeletonBox width={'48%'} height={36} borderRadius={18} />
      </View>

      {/* Bio Skeleton */}
      <View style={{ paddingHorizontal: 20, marginBottom: 20 }}>
        <SkeletonBox width={40} height={16} borderRadius={4} />
        <SkeletonBox width={'100%'} height={14} borderRadius={4} style={{ marginTop: 8 }} />
        <SkeletonBox width={'70%'} height={14} borderRadius={4} style={{ marginTop: 5 }} />
      </View>

      {/* Tabs Skeleton */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-around', borderBottomWidth: 1, borderBottomColor: '#e0e0e0', paddingBottom: 14, marginBottom: 10 }}>
        <SkeletonBox width={60} height={16} borderRadius={4} />
        <SkeletonBox width={60} height={16} borderRadius={4} />
        <SkeletonBox width={60} height={16} borderRadius={4} />
      </View>

      {/* Posts Skeleton */}
      <View style={{ paddingHorizontal: 16 }}>
        {/* Post Item 1 */}
        <View style={{ flexDirection: 'row', marginBottom: 15, paddingVertical: 12 }}>
          <SkeletonBox width={140} height={160} borderRadius={12} />
          <View style={{ flex: 1, justifyContent: 'center', marginLeft: 16 }}>
            <SkeletonBox width={60} height={14} borderRadius={4} />
            <SkeletonBox width={50} height={14} borderRadius={4} style={{ marginTop: 12 }} />
            <SkeletonBox width={80} height={14} borderRadius={4} style={{ marginTop: 12 }} />
            <SkeletonBox width={'90%'} height={14} borderRadius={4} style={{ marginTop: 12 }} />
          </View>
        </View>
        {/* Post Item 2 */}
        <View style={{ flexDirection: 'row', marginBottom: 15, paddingVertical: 12 }}>
          <SkeletonBox width={140} height={160} borderRadius={12} />
          <View style={{ flex: 1, justifyContent: 'center', marginLeft: 16 }}>
            <SkeletonBox width={60} height={14} borderRadius={4} />
            <SkeletonBox width={50} height={14} borderRadius={4} style={{ marginTop: 12 }} />
            <SkeletonBox width={80} height={14} borderRadius={4} style={{ marginTop: 12 }} />
            <SkeletonBox width={'90%'} height={14} borderRadius={4} style={{ marginTop: 12 }} />
          </View>
        </View>
      </View>
    </View>
  );
};
export default function ProfileScreen() {
  const router = useRouter();
  const { userId } = useLocalSearchParams();
  const auth = useAuth() as any;
  const { token, logout, user: currentUser, accountType } = auth;

  const [userData, setUserData] = useState<any>(null);
  const [userStats, setUserStats] = useState<any>(null);
  const [userPosts, setUserPosts] = useState<any[]>([]);
  const [menuItems, setMenuItems] = useState<any[]>([]); 
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [activeTab, setActiveTab] = useState<'posts' | 'videos' | 'favourite'>('posts');
  const [expandedLocations, setExpandedLocations] = useState<{ [key: string]: boolean }>({});
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
  const sidebarAnimation = useRef(new Animated.Value(0)).current;
  const [bannerImage, setBannerImage] = useState<string | null>(null);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [restaurantActiveTab, setRestaurantActiveTab] = useState<'posts' | 'reviews' | 'menu'>('posts');
  const [isRestaurantProfile, setIsRestaurantProfile] = useState(false);

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
    
    // Fetch menu items if restaurant account
    if (accountType === 'restaurant') {
      fetchMenuItems();
    }
  }
}, [userData, activeTab]);

  // Animate sidebar when modal visibility changes
  useEffect(() => {
    console.log('🔄 Sidebar visibility changed:', settingsModalVisible, 'isOwnProfile:', isOwnProfile);
    if (settingsModalVisible) {
      console.log('✅ Opening sidebar menu');
      sidebarAnimation.setValue(0); // Reset to start position
      Animated.timing(sidebarAnimation, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        console.log('✅ Sidebar animation completed');
      });
    } else {
      Animated.timing(sidebarAnimation, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [settingsModalVisible]);

  // Debug: Log when component renders (MUST be before any early returns)
  useEffect(() => {
    console.log('🔍 Profile Screen Render:', {
      isOwnProfile,
      settingsModalVisible,
      userData: userData ? 'loaded' : 'not loaded',
    });
  }, [isOwnProfile, settingsModalVisible, userData]);

  const fetchMenuItems = async () => {
     if (!userData?.id) return;
     try {
       const response = await axios.get(
         `${API_URL}/restaurant/posts/menu/${userData.id}`
       );
       setMenuItems(response.data || []);
     } catch (err) {
       console.error('Error fetching menu items:', err);
       setMenuItems([]);
     }
   };

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
  // First try regular users endpoint
  const userResponse = await axios.get(`${API_URL}/users/${userId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  user = userResponse.data;
  console.log('✅ Fetched user profile from /users endpoint:', user);
  setIsRestaurantProfile(user.account_type === 'restaurant');
  
} catch (userError: any) {
  console.log('⚠️ User endpoint failed, trying restaurant endpoint:', userError.message);
  
  // Try restaurant endpoint
 try {
    const restaurantResponse = await axios.get(
      `${API_URL}/restaurant/posts/public/profile/${userId}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    user = restaurantResponse.data;
    console.log('✅ Fetched restaurant profile:', user);
    setIsRestaurantProfile(true);
    
  } catch (restaurantError: any) {
    console.log('⚠️ Restaurant endpoint also failed, trying feed fallback:', restaurantError.message);
    
    // Fallback to feed
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
        account_type: userPost.account_type,
      };
      setIsRestaurantProfile(userPost.account_type === 'restaurant');
    } else {
      throw new Error('User not found');
    }
  }
}
      } else {
        console.log('📡 Fetching own profile, accountType:', accountType);
setIsOwnProfile(true);

// Use different endpoint based on account type
const endpoint = accountType === 'restaurant' 
  ? `${API_URL}/restaurant/auth/me` 
  : `${API_URL}/auth/me`;

console.log('📡 Fetching own profile from:', endpoint);
const response = await axios.get(endpoint, {
  headers: { Authorization: `Bearer ${token}` },
});
        user = response.data.user || response.data;
        setIsRestaurantProfile(accountType === 'restaurant');
      }

      const rawProfilePicture =
        user.profile_image_url ||
        user.profile_picture ||
        user.profile_picture_url ||
        user.user_profile_picture;
      user.profile_picture = fixUrl(rawProfilePicture);

      setUserData(user);
      setEditedBio(user.bio || '');
      setEditedName(
  accountType === 'restaurant' 
    ? (user.restaurant_name || user.full_name || '') 
    : (user.full_name || user.username || '')
);

// Fetch stats - wrap in try-catch for restaurant accounts
try {
  const statsResponse = await axios.get(`${API_URL}/users/${user.id}/stats`);
  setUserStats(statsResponse.data);
} catch (statsError) {
  console.log('⚠️ Stats fetch failed (might be restaurant account):', statsError);
  // Set default stats for restaurants
  setUserStats({
    total_posts: 0,
    followers_count: userData?.followers_count || 0,
    following_count: userData?.following_count || 0,
  });
}

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
    let endpoint;
    
    // Use different endpoint for restaurant accounts
    if (accountType === 'restaurant') {
      endpoint = `${API_URL}/restaurant/posts/public/restaurant/${userData.id}`;
    } else {
      endpoint = `${API_URL}/users/${userData.id}/posts`;
    }

      const response = await axios.get(endpoint, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const posts = response.data || [];

      const postsWithFullUrls = posts.map((post: any) => {
        const mediaUrl = post.media_url || post.full_image_url;
        const normalizedUrl = fixUrl(mediaUrl);
        const thumbnailUrl = post.thumbnail_url ? fixUrl(post.thumbnail_url) : null;
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
          thumbnail_url: thumbnailUrl,
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
      
      // ✅ Update stats for restaurant accounts
      if (accountType === 'restaurant') {
        setUserStats((prev: any) => ({
          ...prev,
          total_posts: sorted.length,
        }));
      }
      
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

    if (accountType === 'restaurant') {
      // Restaurant: Send JSON body
      const updateData: any = {};
      if (editedName) updateData.restaurant_name = editedName;
      if (editedBio !== null && editedBio !== undefined) updateData.bio = editedBio;

      const response = await axios.put(
        `${API_URL}/restaurant/auth/update`,
        updateData,  // JSON body
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      console.log('✅ Restaurant profile update response:', response.data);
    } else {
      // Regular user: Send FormData
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
    }

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

  const handleBannerPress = () => {
  if (!isOwnProfile) return;

  const options: any[] = [
    { text: 'Take Photo', onPress: () => handleTakeBannerPhoto() },
    { text: 'Choose from Library', onPress: () => handleChooseBannerPhoto() },
  ];

  if (bannerImage || userData?.cover_image) {
    options.push({
      text: 'Remove Photo',
      onPress: () => handleRemoveBanner(),
      style: 'destructive',
    });
  }

  options.push({ text: 'Cancel', style: 'cancel' });

  if (Platform.OS === 'web') {
    const action = window.confirm(
      'Choose from library to upload a banner image?'
    );
    if (action) handleChooseBannerPhoto();
  } else {
    Alert.alert('Banner Image', 'Choose an option', options);
  }
};

const handleTakeBannerPhoto = async () => {
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
      aspect: [16, 9],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      await uploadBannerImage(result.assets[0].uri);
    }
  } catch (error) {
    console.error('❌ Error taking banner photo:', error);
    Alert.alert('Error', 'Failed to take photo');
  }
};

const handleChooseBannerPhoto = async () => {
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
      aspect: [16, 9],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      await uploadBannerImage(result.assets[0].uri);
    }
  } catch (error) {
    console.error('❌ Error choosing banner photo:', error);
    Alert.alert('Error', 'Failed to choose photo');
  }
};

const uploadBannerImage = async (uri: string) => {
  setUploadingBanner(true);
  try {
    console.log('📤 Uploading banner image:', uri);

    const formData = new FormData();
    const filename = uri.split('/').pop() || 'banner.jpg';
    const match = /\.(\w+)$/.exec(filename);
    const type = match ? `image/${match[1]}` : 'image/jpeg';

    formData.append('file', {
      uri,
      name: filename,
      type,
    } as any);

    const response = await axios.post(
      `${API_URL}/users/upload-banner-image`,
      formData,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
      }
    );

    console.log('✅ Banner image uploaded:', response.data);

    const apiBannerImage =
      response.data.cover_image ||
      response.data.banner_image ||
      response.data.cover_image_url;

    const normalizedBannerImage = fixUrl(apiBannerImage);

    setBannerImage(normalizedBannerImage);
    setUserData((prev: any) => ({
      ...prev,
      cover_image: normalizedBannerImage,
    }));

    Alert.alert('Success', 'Banner image updated successfully!');
  } catch (error: any) {
    console.error(
      '❌ Error uploading banner image:',
      error.response?.data || error.message
    );
    Alert.alert('Error', 'Failed to upload banner image. Please try again.');
  } finally {
    setUploadingBanner(false);
  }
};

const handleRemoveBanner = async () => {
  if (Platform.OS === 'web') {
    const confirmRemove = window.confirm(
      'Are you sure you want to remove your banner image?'
    );
    if (!confirmRemove) return;
    await removeBannerImage();
    return;
  }

  Alert.alert(
    'Remove Banner Image',
    'Are you sure you want to remove your banner image?',
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        onPress: () => removeBannerImage(),
        style: 'destructive',
      },
    ]
  );
};

const removeBannerImage = async () => {
  setUploadingBanner(true);
  try {
    console.log('🗑️ Removing banner image');

    await axios.delete(`${API_URL}/users/banner-image`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    console.log('✅ Banner image removed');

    setBannerImage(null);
    setUserData((prev: any) => ({
      ...prev,
      cover_image: null,
    }));

    Alert.alert('Success', 'Banner image removed successfully!');
  } catch (error: any) {
    console.error(
      '❌ Error removing banner image:',
      error.response?.data || error.message
    );
    Alert.alert('Error', 'Failed to remove banner image. Please try again.');
  } finally {
    setUploadingBanner(false);
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
  
  const toggleLocation = (locationName: string) => {
  setExpandedLocations((prev) => ({
    ...prev,
    [locationName]: !prev[locationName],
  }));
};

  const renderFavouriteSection = () => {
  // Group posts by location
  const postsByLocation: { [key: string]: any[] } = {};
  
  userPosts.forEach((post) => {
    const location = post.location_name || post.location || post.place_name || 'Unknown Location';
    if (!postsByLocation[location]) {
      postsByLocation[location] = [];
    }
    postsByLocation[location].push(post);
  });

  // Sort locations by number of posts (highest first)
  const sortedLocations = Object.entries(postsByLocation).sort(
    ([, postsA], [, postsB]) => postsB.length - postsA.length
  );

  if (sortedLocations.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="location-outline" size={64} color="#ccc" />
        <Text style={styles.emptyText}>No favourite locations yet</Text>
      </View>
    );
  }


  return (
    <View style={styles.favouriteContainer}>
      {sortedLocations.map(([location, posts]) => {
        const isExpanded = expandedLocations[location] || false;
        
        return (
          <View key={location} style={styles.locationSection}>
            {/* Location Header */}
            <TouchableOpacity
              style={styles.locationHeader}
              onPress={() => toggleLocation(location)}
              activeOpacity={0.7}
            >
              <View style={styles.locationHeaderLeft}>
                <Ionicons name="location" size={20} color="#F2CF68" />
                <Text style={styles.locationName}>{location}</Text>
              </View>
              <View style={styles.locationHeaderRight}>
                <Text style={styles.locationCount}>({posts.length})</Text>
                <Ionicons 
                  name={isExpanded ? "chevron-up" : "chevron-down"} 
                  size={20} 
                  color="#666" 
                />
              </View>
            </TouchableOpacity>

            {/* Posts Grid - Show when expanded */}
            {isExpanded && (
              <View style={styles.locationPostsGrid}>
                {posts.map((post) => {
                  const mediaUrl = fixUrl(post.full_image_url || post.media_url);
                  const thumbnailUrl = post.thumbnail_url ? fixUrl(post.thumbnail_url) : null;
                  const isVideo =
                    post.media_type === 'video' ||
                    mediaUrl?.toLowerCase().endsWith('.mp4') ||
                    mediaUrl?.toLowerCase().endsWith('.mov') ||
                    mediaUrl?.toLowerCase().endsWith('.avi') ||
                    mediaUrl?.toLowerCase().endsWith('.webm');
                  
                  // For videos, use thumbnail if available, otherwise use mediaUrl
                  const displayUrl = isVideo ? (thumbnailUrl || mediaUrl) : mediaUrl;

                  return (
                    <TouchableOpacity
                      key={post.id}
                      style={styles.favouriteGridItem}
                      onPress={() => router.push(`/post-details/${post.id}`)}
                      activeOpacity={0.8}
                    >
                      {displayUrl ? (
                        <View style={styles.favouriteGridImageContainer}>
                          <Image 
                            source={{ uri: displayUrl }} 
                            style={styles.favouriteGridImage} 
                            resizeMode="cover"
                            onError={(error) => {
                              console.error("❌ Image load error in profile (favourite):", displayUrl, error);
                            }}
                            onLoadStart={() => {
                              console.log("🖼️ Loading image (favourite):", displayUrl);
                            }}
                          />
                          {isVideo && (
                            <View style={styles.videoOverlay}>
                              <Ionicons name="play-circle" size={40} color="#fff" />
                            </View>
                          )}
                        </View>
                      ) : (
                        <View style={styles.gridPlaceholder}>
                          <Ionicons
                            name={isVideo ? 'videocam-outline' : 'image-outline'}
                            size={40}
                            color="#ccc"
                          />
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
};

  // ================= RESTAURANT PROFILE UI =================
const renderRestaurantProfile = () => {
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

              <Text style={styles.cofauTitle}>Cofau</Text>

              <View style={styles.headerIcons} pointerEvents="box-none">
                {isOwnProfile && (
                  <TouchableOpacity
                    style={styles.headerIconButton}
                    onPress={() => setSettingsModalVisible(true)}
                    activeOpacity={0.7}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Ionicons name="menu" size={24} color="#fff" />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </LinearGradient>
        </View>

        {/* ================= BANNER + WHITE BOX WRAPPER ================= */}
        <View style={restaurantStyles.bannerWrapper}>
          {/* Banner Image */}
          <TouchableOpacity
            style={restaurantStyles.bannerContainer}
            onPress={() => {
              if (isOwnProfile) {
                handleBannerPress();
              }
            }}
            activeOpacity={isOwnProfile ? 0.8 : 1}
          >
            {bannerImage || userData?.cover_image ? (
              <>
                <Image
                  source={{ uri: fixUrl(bannerImage || userData?.cover_image) }}
                  style={restaurantStyles.bannerImage}
                  resizeMode="cover"
                />
                {isOwnProfile && !uploadingBanner && (
                  <View style={restaurantStyles.bannerEditPen}>
                    <Ionicons name="pencil" size={18} color="#fff" />
                  </View>
                )}
                {uploadingBanner && (
                  <View style={restaurantStyles.bannerUploadingOverlay}>
                    <ActivityIndicator size="large" color="#fff" />
                  </View>
                )}
              </>
            ) : (
              <View style={restaurantStyles.bannerPlaceholder}>
                {isOwnProfile && (
                  <View style={restaurantStyles.bannerEditIcon}>
                    <Ionicons name="camera" size={24} color="#999" />
                    <Text style={restaurantStyles.bannerEditText}>Add Cover Photo</Text>
                  </View>
                )}
              </View>
            )}
          </TouchableOpacity>

          {/* ================= WHITE INFO BOX ================= */}
          <View style={restaurantStyles.whiteInfoBox}>
            <View style={restaurantStyles.restaurantInfoContainer}>
              <Text style={restaurantStyles.restaurantName}>
                {userData?.restaurant_name || userData?.full_name || 'Restaurant'}
              </Text>
              <Text style={restaurantStyles.restaurantLabel}>RESTAURANT</Text>
            </View>

            <View style={restaurantStyles.bioSection}>
              <Text style={restaurantStyles.bioText}>
                {userData?.bio || 'No bio yet. Add one by editing your profile!'}
              </Text>
            </View>

            <View style={restaurantStyles.statsContainer}>
              <View style={restaurantStyles.statBox}>
                <Text style={restaurantStyles.statValue}>{userStats?.total_posts || 0}</Text>
                <Text style={restaurantStyles.statLabel}>Posts</Text>
              </View>

              <View style={restaurantStyles.statDivider} />

              <TouchableOpacity
                style={restaurantStyles.statBox}
                onPress={() => {
                  setFollowersModalVisible(true);
                  fetchFollowers();
                }}
                activeOpacity={0.7}
              >
                <Text style={restaurantStyles.statValue}>{userStats?.followers_count || 0}</Text>
                <Text style={restaurantStyles.statLabel}>Followers</Text>
              </TouchableOpacity>

              <View style={restaurantStyles.statDivider} />

              <View style={restaurantStyles.statBox}>
                <Text style={restaurantStyles.statValue}>{userData?.reviews_count || 0}</Text>
                <Text style={restaurantStyles.statLabel}>Reviews</Text>
              </View>
            </View>
          </View>

          {/* Profile Picture */}
          <View style={restaurantStyles.profileOnBanner}>
            <TouchableOpacity
              onPress={handleProfilePicturePress}
              disabled={!isOwnProfile || uploadingImage}
              activeOpacity={0.8}
            >
              <UserAvatar
                profilePicture={userData?.profile_picture}
                username={userData?.restaurant_name || userData?.full_name}
                size={100}
                showLevelBadge={false}
                style={{
                  ...restaurantStyles.restaurantAvatar,
                  backgroundColor: 'transparent',
                }}
              />
              {isOwnProfile && (
                <View style={restaurantStyles.dpCameraIcon}>
                  {uploadingImage ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Ionicons name="camera" size={16} color="#fff" />
                  )}
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* ================= ACTION BUTTONS ================= */}
        <View style={styles.actionButtonsContainer}>
          {isOwnProfile ? (
            <>
              {/* Own Restaurant Profile - 2 Buttons */}
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
                  <Ionicons name="create" size={18} color="#fff" />
                  <Text style={styles.actionButtonText}>Edit Profile</Text>
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionButtonWrapper}
                onPress={() => router.push('/chat')}
              >
                <LinearGradient
                  colors={['#E94A37', '#F2CF68', '#1B7C82']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  locations={[0, 0.35, 0.9]}
                  style={styles.actionButton}
                >
                  <Ionicons name="chatbubble" size={18} color="#fff" />
                  <Text style={styles.actionButtonText}>Messages</Text>
                </LinearGradient>
              </TouchableOpacity>
            </>
          ) : (
            <>
              {/* Visiting Other Restaurant - 3 Buttons */}
              <TouchableOpacity
                style={styles.actionButtonWrapper}
                onPress={handleFollowToggle}
                disabled={followLoading}
              >
                <LinearGradient
                  colors={isFollowing ? ['#1B7C82', '#1B7C82'] : ['#E94A37', '#F2CF68', '#1B7C82']}
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
                        name={isFollowing ? 'checkmark-circle' : 'person-add'} 
                        size={15} 
                        color="#fff" 
                      />
                      <Text style={styles.actionButtonText}>
                        {isFollowing ? 'Following' : 'Follow'}
                      </Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionButtonWrapper}
                onPress={() => router.push('/chat')}
              >
                <LinearGradient
                  colors={['#E94A37', '#F2CF68', '#1B7C82']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  locations={[0, 0.35, 0.9]}
                  style={styles.actionButton}
                >
                  <Ionicons name="chatbubble" size={15} color="#fff" />
                  <Text style={styles.actionButtonText}>Message</Text>
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionButtonWrapper}
                onPress={() => {
                  if (Platform.OS === 'web') {
                    // Web share - copy link to clipboard
                    const shareUrl = `${window.location.origin}/profile?userId=${userData?.id}`;
                    navigator.clipboard.writeText(shareUrl);
                    Alert.alert('Success', 'Profile link copied to clipboard!');
                  } else {
                    // Mobile share - you can integrate React Native Share here
                    Alert.alert('Share Profile', 'Share functionality coming soon!');
                  }
                }}
              >
                <LinearGradient
                  colors={['#E94A37', '#F2CF68', '#1B7C82']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  locations={[0, 0.35, 0.9]}
                  style={styles.actionButton}
                >
                  <Ionicons name="share-social" size={15} color="#fff" />
                  <Text style={styles.actionButtonText}>Share</Text>
                </LinearGradient>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* ================= RESTAURANT TABS ================= */}
        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tab, restaurantActiveTab === 'posts' && styles.activeTab]}
            onPress={() => setRestaurantActiveTab('posts')}
          >
            <Text style={[styles.tabText, restaurantActiveTab === 'posts' && styles.activeTabText]}>
              Posts
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, restaurantActiveTab === 'reviews' && styles.activeTab]}
            onPress={() => setRestaurantActiveTab('reviews')}
          >
            <Text style={[styles.tabText, restaurantActiveTab === 'reviews' && styles.activeTabText]}>
              Reviews
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, restaurantActiveTab === 'menu' && styles.activeTab]}
            onPress={() => setRestaurantActiveTab('menu')}
          >
            <Text style={[styles.tabText, restaurantActiveTab === 'menu' && styles.activeTabText]}>
              Menu
            </Text>
          </TouchableOpacity>
        </View>

        {/* ================= TAB CONTENT ================= */}
        {restaurantActiveTab === 'posts' && (
          <FlatList
            data={userPosts}
            renderItem={renderListItem}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
            ListEmptyComponent={() => (
              <View style={styles.emptyContainer}>
                <Ionicons name="images-outline" size={64} color="#ccc" />
                <Text style={styles.emptyText}>No posts yet</Text>
              </View>
            )}
          />
        )}

        {restaurantActiveTab === 'reviews' && (
          <View style={styles.emptyContainer}>
            <Ionicons name="star-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>No reviews yet</Text>
            <Text style={[styles.emptyText, { fontSize: 12, marginTop: 8 }]}>
              Reviews from customers will appear here
            </Text>
          </View>
        )}

        {restaurantActiveTab === 'menu' && (
  menuItems.length > 0 ? (
    <FlatList
      data={menuItems}
      renderItem={({ item }) => (
        <View style={styles.listItem}>
          <View style={styles.listImageContainer}>
            {item.media_url ? (
              <Image
                source={{ uri: fixUrl(item.media_url) }}
                style={styles.listImage}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.listImagePlaceholder}>
                <Ionicons name="restaurant-outline" size={40} color="#ccc" />
              </View>
            )}
          </View>
          <View style={styles.listDetails}>
            <Text style={styles.listDetailText}>{item.item_name}</Text>
            <Text style={styles.listDetailText}>₹{item.price}</Text>
            {item.description && (
              <Text style={[styles.listDetailText, { color: '#666' }]} numberOfLines={2}>
                {item.description}
              </Text>
            )}
            {item.category && (
              <View style={styles.listDetailRow}>
                <Ionicons name="pricetag" size={16} color="#F2CF68" />
                <Text style={styles.listDetailText}>{item.category}</Text>
              </View>
            )}
          </View>
        </View>
      )}
      keyExtractor={(item) => item.id}
      scrollEnabled={false}
    />
  ) : (
    <View style={styles.emptyContainer}>
      <Ionicons name="restaurant-outline" size={64} color="#ccc" />
      <Text style={styles.emptyText}>Menu coming soon</Text>
      <Text style={[styles.emptyText, { fontSize: 12, marginTop: 8 }]}>
        You'll be able to add menu items here
      </Text>
    </View>
  )
)}

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Bottom Navigation */}
      <View style={styles.navBar}>
        <TouchableOpacity style={styles.navItem} onPress={() => router.push('/feed')}>
          <Ionicons name="home-outline" size={20} color="#000" />
          <Text style={styles.navLabel}>Home</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => router.push('/explore')}>
          <Ionicons name="compass-outline" size={20} color="#000" />
          <Text style={styles.navLabel}>Explore</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.centerNavItem} onPress={() => router.push('/leaderboard')}>
          <View style={styles.centerIconCircle}>
            <Ionicons name="camera" size={22} color="#000" />
          </View>
          <Text style={styles.navLabel}>Top Posts</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => router.push('/happening')}>
          <Ionicons name="location-outline" size={20} color="#000" />
          <Text style={styles.navLabel}>Happening</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => router.push('/profile')}>
          <Ionicons name="person" size={20} color="#000" />
          <Text style={styles.navLabel}>Profile</Text>
        </TouchableOpacity>
      </View>

      {/* ================= SIDEBAR MENU (at root level) ================= */}
      <Modal
        animationType="none"
        transparent={true}
        visible={settingsModalVisible}
        onRequestClose={() => setSettingsModalVisible(false)}
      >
        <View style={styles.sidebarOverlay}>
          <TouchableOpacity
            style={styles.sidebarBackdrop}
            activeOpacity={1}
            onPress={() => setSettingsModalVisible(false)}
          />
          
          <Animated.View
            style={[
              styles.sidebarContainer,
              {
                transform: [
                  {
                    translateX: sidebarAnimation.interpolate({
                      inputRange: [0, 1],
                      outputRange: [SCREEN_WIDTH, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <View style={styles.sidebarHeader}>
              <Text style={styles.sidebarTitle}>Menu</Text>
              <TouchableOpacity
                onPress={() => setSettingsModalVisible(false)}
                style={styles.sidebarCloseButton}
              >
                <Ionicons name="close" size={28} color="#333" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.sidebarContent}>
              <TouchableOpacity
                style={styles.sidebarMenuItem}
                onPress={() => {
                  setSettingsModalVisible(false);
                  router.push('/saved-posts');
                }}
                activeOpacity={0.7}
              >
                <View style={styles.sidebarMenuIconContainer}>
                  <Ionicons name="bookmark-outline" size={24} color="#333" />
                </View>
                <Text style={styles.sidebarMenuText}>Saved Posts</Text>
                <Ionicons name="chevron-forward" size={20} color="#999" />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.sidebarMenuItem}
                onPress={() => {
                  setSettingsModalVisible(false);
                  router.push('/blocked-users');
                }}
                activeOpacity={0.7}
              >
                <View style={styles.sidebarMenuIconContainer}>
                  <Ionicons name="ban-outline" size={24} color="#FF6B6B" />
                </View>
                <Text style={styles.sidebarMenuText}>Blocked Users</Text>
                <Ionicons name="chevron-forward" size={20} color="#999" />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.sidebarMenuItem}
                onPress={() => {
                  setSettingsModalVisible(false);
                }}
                activeOpacity={0.7}
              >
                <View style={styles.sidebarMenuIconContainer}>
                  <Ionicons name="settings-outline" size={24} color="#333" />
                </View>
                <Text style={styles.sidebarMenuText}>Settings</Text>
                <Ionicons name="chevron-forward" size={20} color="#999" />
              </TouchableOpacity>

              <View style={styles.sidebarDivider} />

              <TouchableOpacity
                style={styles.sidebarMenuItem}
                onPress={() => {
                  setSettingsModalVisible(false);
                  if (Platform.OS === 'web') {
                    const confirmed = window.confirm('Are you sure you want to logout?');
                    if (confirmed) handleLogout();
                  } else {
                    Alert.alert('Logout', 'Are you sure you want to logout?', [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Logout', onPress: () => handleLogout(), style: 'destructive' },
                    ]);
                  }
                }}
                activeOpacity={0.7}
              >
                <View style={[styles.sidebarMenuIconContainer, styles.logoutIconContainer]}>
                  <Ionicons name="log-out-outline" size={24} color="#FF6B6B" />
                </View>
                <Text style={[styles.sidebarMenuText, styles.logoutMenuText]}>Logout</Text>
                <Ionicons name="chevron-forward" size={20} color="#FF6B6B" />
              </TouchableOpacity>
            </ScrollView>
          </Animated.View>
        </View>
      </Modal>


      {/* ================= EDIT PROFILE MODAL ================= */}
<Modal
  animationType="slide"
  transparent={true}
  visible={editModalVisible}
  onRequestClose={() => setEditModalVisible(false)}
>
  <KeyboardAvoidingView 
    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    style={styles.modalContainer}
  >
    <View style={styles.modalContent}>
      <View style={styles.modalHeader}>
        <Text style={styles.modalTitle}>Edit Profile</Text>
        <TouchableOpacity onPress={() => setEditModalVisible(false)}>
          <Ionicons name="close" size={28} color="#000" />
        </TouchableOpacity>
      </View>

      <Text style={styles.inputLabel}>Restaurant Name</Text>
      <TextInput
        style={styles.input}
        value={editedName}
        onChangeText={setEditedName}
        placeholder="Enter restaurant name"
      />

      <Text style={styles.inputLabel}>Bio</Text>
      <TextInput
        style={[styles.input, styles.bioInput]}
        value={editedBio}
        onChangeText={setEditedBio}
        placeholder="Tell customers about your restaurant..."
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
  </KeyboardAvoidingView>
</Modal>
    </View>
  );
};


  const renderGridItem = ({ item }: { item: any }) => {
    const mediaUrl = fixUrl(item.full_image_url || item.media_url);
    const thumbnailUrl = item.thumbnail_url ? fixUrl(item.thumbnail_url) : null;
    const isVideo =
      item.media_type === 'video' ||
      mediaUrl?.toLowerCase().endsWith('.mp4') ||
      mediaUrl?.toLowerCase().endsWith('.mov') ||
      mediaUrl?.toLowerCase().endsWith('.avi') ||
      mediaUrl?.toLowerCase().endsWith('.webm');
    
    // For videos, use thumbnail if available, otherwise use mediaUrl
    const displayUrl = isVideo ? (thumbnailUrl || mediaUrl) : mediaUrl;

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
        {displayUrl && !isVideo ? (
          <Image 
            source={{ uri: displayUrl }} 
            style={styles.gridImage} 
            resizeMode="cover"
            onError={(error) => {
              console.error("❌ Image load error in profile (grid):", displayUrl, error);
            }}
            onLoadStart={() => {
              console.log("🖼️ Loading image (grid):", displayUrl);
            }}
          />
        ) : displayUrl && isVideo ? (
          <View style={styles.gridImageContainer}>
            <Image
              source={{ uri: displayUrl }}
              style={styles.gridImage}
              resizeMode="cover"
              onError={(error) => {
                console.error("❌ Video thumbnail load error in profile (grid):", displayUrl, error);
              }}
              onLoadStart={() => {
                console.log("🖼️ Loading video thumbnail (grid):", displayUrl);
              }}
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
  <View style={styles.listItemWrapper}>
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

    {/* Three Dots Menu - Top Right Corner */}
    {isOwnProfile && (
      <TouchableOpacity
        style={styles.listMenuButtonTopRight}
        onPress={handleMenuPress}
        activeOpacity={0.7}
      >
        <Ionicons name="ellipsis-horizontal" size={14} color="#666" />
      </TouchableOpacity>
    )}
  </View>
);
};

  const renderVideoListItem = ({ item }: { item: any }) => {
  // Use thumbnail_url if available, otherwise fall back to media_url
  const thumbnailUrl = item.thumbnail_url ? fixUrl(item.thumbnail_url) : null;
  const mediaUrl = fixUrl(item.full_image_url || item.media_url);
  const displayUrl = thumbnailUrl || mediaUrl;

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
    <View style={styles.listItemWrapper}>
      <TouchableOpacity
        style={styles.listItem}
        onPress={handlePostPress}
        activeOpacity={0.8}
      >
        {/* Left Side - Video Thumbnail */}
        <View style={styles.listImageContainer}>
          {displayUrl ? (
            <View style={styles.videoThumbnailContainer}>
              <Image 
                source={{ uri: displayUrl }} 
                style={styles.listImage} 
                resizeMode="cover"
                onError={(error) => {
                  console.error("❌ Video thumbnail load error in profile (video list):", displayUrl, error);
                }}
                onLoadStart={() => {
                  console.log("🖼️ Loading video thumbnail (video list):", displayUrl);
                }}
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

      {/* Three Dots Menu - Top Right Corner */}
      {isOwnProfile && (
        <TouchableOpacity
          style={styles.listMenuButtonTopRight}
          onPress={handleMenuPress}
          activeOpacity={0.7}
        >
          <Ionicons name="ellipsis-horizontal" size={18} color="#666" />
        </TouchableOpacity>
      )}
    </View>
  );
};
   

if (loading) {
  return <ProfileSkeleton />;
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

  // Check if restaurant account - show restaurant UI
if (isRestaurantProfile) {
  return renderRestaurantProfile();
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

              <Text style={styles.cofauTitle}>Cofau</Text>

              <View style={styles.headerIcons} pointerEvents="box-none">
                {isOwnProfile ? (
                  <TouchableOpacity
                    style={styles.headerIconButton}
                    onPress={() => {
                      console.log('✅ Menu button pressed!');
                      console.log('✅ isOwnProfile:', isOwnProfile);
                      console.log('✅ Current settingsModalVisible:', settingsModalVisible);
                      setSettingsModalVisible(true);
                      console.log('✅ Called setSettingsModalVisible(true)');
                    }}
                    activeOpacity={0.7}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Ionicons name="menu" size={24} color="#fff" />
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
          </LinearGradient>

          <View style={styles.profileCardWrapper}>
  {Platform.OS === 'ios' ? (
    <BlurView intensity={60} tint="light" style={styles.profileCard}>
      {/* Profile Picture */}
      <View style={styles.profilePictureContainer}>
           <ProfileBadge
  profilePicture={userData.profile_picture}
  username={userData.full_name || userData.username}
  level={userData.level || 1}
  dpSize={78}
  isOwnProfile={isOwnProfile}
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

    </BlurView>
  ) : (
    <View style={[styles.profileCard, styles.profileCardAndroid]}>
      {/* Profile Picture */}
      <View style={styles.profilePictureContainer}>
       <ProfileBadge
  profilePicture={userData.profile_picture}
  username={userData.full_name || userData.username}
  level={userData.level || 1}
  dpSize={78}
  isOwnProfile={isOwnProfile}
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

      
    </View>
  )}
</View>
        </View>
        {/* Stats Section */}
<View style={styles.statsContainer}>
  <View style={styles.statBox}>
    <Text style={styles.statValue}>
      {userStats?.total_posts || 0}
    </Text>
    <Text style={styles.statLabel}>Posts</Text>
  </View>
  
  <View style={styles.statDivider} />
  
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
  
  <View style={styles.statDivider} />
  
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
    {/* Edit Profile Button */}
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
        <Ionicons name="create" size={18} color="#fff" />
        <Text style={styles.actionButtonText}>Edit Profile</Text>
      </LinearGradient>
    </TouchableOpacity>

    {/* Message Button */}
    <TouchableOpacity
      style={styles.actionButtonWrapper}
      onPress={() => router.push('/chat')}
    >
      <LinearGradient
        colors={['#E94A37', '#F2CF68', '#1B7C82']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        locations={[0, 0.35, 0.9]}
        style={styles.actionButton}
      >
        <Ionicons name="chatbubble" size={18} color="#fff" />
        <Text style={styles.actionButtonText}>Messages</Text>
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
                  colors={isFollowing ? ['#1B7C82', '#1B7C82', '#1B7C82'] : ['#E94A37', '#F2CF68', '#1B7C82']}
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
                        size={15} 
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
                onPress={() => router.push('/chat')}
              >
                <LinearGradient
                  colors={['#E94A37', '#F2CF68', '#1B7C82']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  locations={[0, 0.35, 0.9]}
                  style={styles.actionButton}
                >
                  <Ionicons name="chatbubble" size={15} color="#fff" />
                  <Text style={styles.actionButtonText}>Message</Text>
                </LinearGradient>
              </TouchableOpacity>

              {/* Compliment Button */}
              <TouchableOpacity
                style={styles.actionButtonWrapper}
                onPress={() => {
  console.log('🎁 Compliment button pressed!');
  console.log('Current complimentModalVisible:', complimentModalVisible);
  setComplimentModalVisible(true);
}}
                disabled={hasComplimented}
              >
                <LinearGradient
                  colors={hasComplimented ? ['#1B7C82', '#1B7C82', '#1B7C82'] : ['#E94A37', '#F2CF68', '#1B7C82']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  locations={[0, 0.35, 0.9]}
                  style={[styles.actionButton, hasComplimented && { opacity: 0.7 }]}
                >
                  <Ionicons 
                    name={hasComplimented ? "heart" : "heart"} 
                    size={15} 
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
  <TouchableOpacity
    style={[styles.tab, activeTab === 'favourite' && styles.activeTab]}
    onPress={() => setActiveTab('favourite')}
  >
    <Text
      style={[
        styles.tabText,
        activeTab === 'favourite' && styles.activeTabText,
      ]}
    >
      Favourite
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
) : activeTab === 'favourite' ? (
  renderFavouriteSection()
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
          <Ionicons name="home-outline" size={20} color="#000" />
          <Text style={styles.navLabel}>Home</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => router.push('/explore')}>
          <Ionicons name="compass-outline" size={20} color="#000" />
          <Text style={styles.navLabel}>Explore</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.centerNavItem} onPress={() => router.push('/leaderboard')}>
          <View style={styles.centerIconCircle}>
            <Ionicons name="camera" size={22} color="#000" />
          </View>
          <Text style={styles.navLabel}>Top Posts</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => router.push('/happening')}>
          <Ionicons name="location-outline" size={20} color="#000" />
          <Text style={styles.navLabel}>Happening</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => router.push('/profile')}>
          <Ionicons name="person" size={20} color="#000" />
          <Text style={styles.navLabel}>Profile</Text>
        </TouchableOpacity>
      </View>


      {/* ================= SIDEBAR MENU MODAL ================= */}
      <Modal
        animationType="none"
        transparent={true}
        visible={settingsModalVisible}
        onRequestClose={() => setSettingsModalVisible(false)}
      >
        <View style={styles.sidebarOverlay}>
          <TouchableOpacity
            style={styles.sidebarBackdrop}
            activeOpacity={1}
            onPress={() => setSettingsModalVisible(false)}
          />
          
          <Animated.View
            style={[
              styles.sidebarContainer,
              {
                transform: [
                  {
                    translateX: sidebarAnimation.interpolate({
                      inputRange: [0, 1],
                      outputRange: [SCREEN_WIDTH, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <View style={styles.sidebarHeader}>
              <Text style={styles.sidebarTitle}>Menu</Text>
              <TouchableOpacity
                onPress={() => setSettingsModalVisible(false)}
                style={styles.sidebarCloseButton}
              >
                <Ionicons name="close" size={28} color="#333" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.sidebarContent}>
              <TouchableOpacity
                style={styles.sidebarMenuItem}
                onPress={() => {
                  setSettingsModalVisible(false);
                  router.push('/saved-posts');
                }}
                activeOpacity={0.7}
              >
                <View style={styles.sidebarMenuIconContainer}>
                  <Ionicons name="bookmark-outline" size={24} color="#333" />
                </View>
                <Text style={styles.sidebarMenuText}>Saved Posts</Text>
                <Ionicons name="chevron-forward" size={20} color="#999" />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.sidebarMenuItem}
                onPress={() => {
                  setSettingsModalVisible(false);
                  router.push('/blocked-users');
                }}
                activeOpacity={0.7}
              >
                <View style={styles.sidebarMenuIconContainer}>
                  <Ionicons name="ban-outline" size={24} color="#FF6B6B" />
                </View>
                <Text style={styles.sidebarMenuText}>Blocked Users</Text>
                <Ionicons name="chevron-forward" size={20} color="#999" />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.sidebarMenuItem}
                onPress={() => {
                  setSettingsModalVisible(false);
                  setLevelDetailsModalVisible(true);
                }}
                activeOpacity={0.7}
              >
                <View style={styles.sidebarMenuIconContainer}>
                  <Ionicons name="settings-outline" size={24} color="#333" />
                </View>
                <Text style={styles.sidebarMenuText}>Settings</Text>
                <Ionicons name="chevron-forward" size={20} color="#999" />
              </TouchableOpacity>

              <View style={styles.sidebarDivider} />

              <TouchableOpacity
                style={styles.sidebarMenuItem}
                onPress={() => {
                  setSettingsModalVisible(false);
                  if (Platform.OS === 'web') {
                    const confirmed = window.confirm('Are you sure you want to logout?');
                    if (confirmed) handleLogout();
                  } else {
                    Alert.alert('Logout', 'Are you sure you want to logout?', [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Logout', onPress: () => handleLogout(), style: 'destructive' },
                    ]);
                  }
                }}
                activeOpacity={0.7}
              >
                <View style={[styles.sidebarMenuIconContainer, styles.logoutIconContainer]}>
                  <Ionicons name="log-out-outline" size={24} color="#FF6B6B" />
                </View>
                <Text style={[styles.sidebarMenuText, styles.logoutMenuText]}>Logout</Text>
                <Ionicons name="chevron-forward" size={20} color="#FF6B6B" />
              </TouchableOpacity>
            </ScrollView>
          </Animated.View>
        </View>
      </Modal>

      {/* ================= EDIT PROFILE MODAL ================= */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={editModalVisible}
        onRequestClose={() => setEditModalVisible(false)}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalContainer}
        >
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
        </KeyboardAvoidingView>
      </Modal>

      {/* ================= COMPLIMENT MODAL ================= */}
      <ComplimentModal
        visible={complimentModalVisible}
        onClose={() => setComplimentModalVisible(false)}
        onSend={async (complimentType: string, customMessage?: string) => {
          if (!userData?.id || !token) return;

          setSendingCompliment(true);
          try {
            await sendCompliment(userData.id, complimentType, customMessage);
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

      {/* ================= DELETE POST MODAL ================= */}
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

      {/* ================= FOLLOWERS MODAL ================= */}
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

      {/* ================= LEVEL DETAILS MODAL ================= */}
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

                {userData?.requiredPoints !== undefined && userData?.level !== undefined && (
                  <View style={styles.levelInfoRow}>
                    <Text style={styles.levelInfoLabel}>Points for Next Level:</Text>
                    <Text style={styles.levelInfoValue}>
                      {(() => {
                        const currentLevel = userData.level || 1;
                        const currentRequiredPoints = userData.requiredPoints || 1250;
                        return getPointsNeededForNextLevel(currentLevel, currentRequiredPoints);
                      })()}
                    </Text>
                  </View>
                )}

                {userData?.requiredPoints !== undefined && userData?.currentPoints !== undefined && (
                  <View style={styles.progressContainer}>
                    <Text style={styles.progressLabel}>Progress to Next Level</Text>
                    <View style={styles.progressBar}>
                      {(() => {
                        const currentLevel = userData?.level || 1;
                        const currentRequiredPoints = userData.requiredPoints || 1250;
                        const currentPoints = userData.currentPoints || 0;
                        const pointsNeeded = getPointsNeededForNextLevel(currentLevel, currentRequiredPoints);
                        const progressPercent = Math.min((currentPoints / pointsNeeded) * 100, 100);
                        
                        return (
                          <LinearGradient
                            colors={['#E94A37', '#F2CF68', '#1B7C82']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={[
                              styles.progressFill,
                              {
                                width: `${progressPercent}%`
                              }
                            ]}
                          />
                        );
                      })()}
                    </View>
                    {(() => {
                      const currentLevel = userData?.level || 1;
                      const currentRequiredPoints = userData.requiredPoints || 1250;
                      const currentPoints = userData.currentPoints || 0;
                      const pointsNeeded = getPointsNeededForNextLevel(currentLevel, currentRequiredPoints);
                      
                      return (
                        <Text style={styles.progressText}>
                          {currentPoints} / {pointsNeeded} points
                        </Text>
                      );
                    })()}
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

const restaurantStyles = StyleSheet.create({
  bannerWrapper: {
    marginHorizontal: 16,
    marginTop: -50,
    marginBottom: 0,    
    position: 'relative',           // ✅ ADD THIS
    zIndex: 0,             // ✅ Changed from 20 to 0
  },
  bannerContainer: {
    height: 200,
    borderTopLeftRadius: 20,      // ✅ Top corners rounded
    borderTopRightRadius: 20,     // ✅ Top corners rounded
    backgroundColor: '#E0E0E0',
    position: 'relative',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  bannerImage: {
    width: '100%',
    height: '100%',
  },
  bannerEditPen: {
  position: 'absolute',
  bottom: 10,
  right: 10,
  backgroundColor: 'rgba(0, 0, 0, 0.6)',
  borderRadius: 20,
  width: 40,
  height: 40,
  justifyContent: 'center',
  alignItems: 'center',
},
bannerUploadingOverlay: {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: 'rgba(0, 0, 0, 0.5)',
  justifyContent: 'center',
  alignItems: 'center',
},
  bannerPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#E0E0E0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bannerEditIcon: {
    alignItems: 'center',
  },
  bannerEditText: {
    color: '#999',
    fontSize: 14,
    marginTop: 8,
    fontWeight: '600',
  },
  bannerEditOverlay: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
profileOnBanner: {
  position: 'absolute',
  bottom: 180,
  left: 20,
  elevation: 100,              // ✅ Very high elevation for Android
  zIndex: 100, 
  backgroundColor: 'transparent',                // ✅ High z-index for iOS
},
  
  dpCameraIcon: {
    position: 'absolute',
    right: 0,
    bottom: 5,
    backgroundColor: '#4dd0e1',
    borderRadius: 15,
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  whiteInfoBox: {
    backgroundColor: '#fff',
    borderRadius: 20,              // ✅ ALL corners rounded
    paddingTop: 60,                // ✅ More top padding for DP overlap
    paddingHorizontal: 20,
    paddingBottom: 20,
    marginTop: -10,  
    marginBottom: 16,               // ✅ Slight overlap with banner
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    zIndex: 1,
  },
 restaurantInfoContainer: {
  flexDirection: 'column',            // ✅ ADD THIS - horizontal layout
  alignItems: 'center',            // ✅ ADD THIS
  marginLeft: 120,    
  marginTop: -5,             // ✅ ADD THIS - space for DP (100px DP + 20px gap)
  marginBottom: 12,
},
  restaurantName: {
    fontSize: 24,
    marginTop: -25, 
    fontWeight: 'bold',
    color: '#333',
  },
  restaurantLabel: {
    fontSize: 12,
    color: '#E94A37',
    fontWeight: '600',
    marginTop: 4,
    letterSpacing: 2,
  },
  bioSection: {
    marginBottom: 16,
  },
  bioText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  statsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#D0D0D0',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
  },
});
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
listItemWrapper: {
  position: 'relative',
  marginBottom: 8,
},
listItem: {
  flexDirection: 'row',
  paddingVertical: 12,
  paddingHorizontal: 16,
  borderBottomWidth: 1,
  borderBottomColor: '#f0f0f0',
  backgroundColor: '#fff',
},
listImageContainer: {
  width: 140,
  height: 160,
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
  top: 12,
  right: 8,
  backgroundColor: 'rgba(0, 0, 0, 0.6)',
  borderRadius: 12,
  width: 25,
  height: 30,
  justifyContent: 'center',
  alignItems: 'center',
},

listMenuButtonTopRight: {
  position: 'absolute',
  top: 12,                    
  right: 8,                   
  backgroundColor: '#fff',
  borderRadius: 12,
  width: 20,
  height: 20,
  justifyContent: 'center',
  alignItems: 'center',
  zIndex: 10,
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

// Favourite Tab Styles
favouriteContainer: {
  paddingBottom: 20,
},
locationSection: {
  marginBottom: 2,
  borderBottomWidth: 1,
  borderBottomColor: '#f0f0f0',
},
locationHeader: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
  paddingVertical: 16,
  paddingHorizontal: 20,
  backgroundColor: '#fff',
},
locationHeaderLeft: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 10,
  flex: 1,
},
locationHeaderRight: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 8,
},
locationName: {
  fontSize: 16,
  fontWeight: '600',
  color: '#333',
  flex: 1,
},
locationCount: {
  fontSize: 14,
  color: '#666',
  fontWeight: '500',
},
locationPostsGrid: {
  flexDirection: 'row',
  flexWrap: 'wrap',
  paddingHorizontal: 16,
  paddingBottom: 16,
  gap: 2,
},
favouriteGridItem: {
  width: (SCREEN_WIDTH - 38) / 3,
  height: (SCREEN_WIDTH - 38) / 3,
  position: 'relative',
  borderRadius: 8, 
  overflow: 'hidden', 
},
favouriteGridImageContainer: {
  width: '100%',
  height: '100%',
  position: 'relative',
},
favouriteGridImage: {
  width: '100%',
  height: '100%',
},

  // Sidebar Styles
  sidebarOverlay: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  sidebarBackdrop: {
    flex: 1,
  },
  sidebarContainer: {
    width: SCREEN_WIDTH * 0.75,
    maxWidth: 320,
    height: '100%',
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: -2, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 10,
  },
  sidebarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 20,
    paddingTop: 60,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  sidebarTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  sidebarCloseButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sidebarContent: {
    flex: 1,
  },
  sidebarMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  sidebarMenuIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  logoutIconContainer: {
    backgroundColor: '#fff5f5',
  },
  sidebarMenuText: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  logoutMenuText: {
    color: '#FF6B6B',
  },
  sidebarDivider: {
    height: 1,
    backgroundColor: '#f0f0f0',
    marginVertical: 8,
  },
  reviewerBadgeContainer: {
    position: 'absolute',
    right: 16,
    top: '100%',
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
    zIndex: 1,
    pointerEvents: 'none', // Allow clicks to pass through
    textShadowColor: 'rgba(0, 0, 0, 0.15)',
    textShadowOffset: { width: 4, height: 6 },
    textShadowRadius: 4,
  },
  headerIcons: {
    flexDirection: 'row',
    gap: 12,
    zIndex: 10,
  },
  headerIconButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 11,
    elevation: 5,
  },

 profileCardWrapper: {
  marginHorizontal: 55,       // Change from 60 to 40
  marginTop: -40,
  marginBottom: 2,
  borderRadius: 25,
  overflow: 'hidden',
  borderWidth: 1,
  borderColor: "#fff",
  shadowColor: "#000",
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.15,
  shadowRadius: 8,
  elevation: 8,
},
 profileCard: {
  borderRadius: 20,
  paddingVertical: 10,        // Change from 65 to 50
  paddingHorizontal: 10,      // Change from 30 to 20
  paddingLeft: 30,            // Change from 60 to 20
  paddingRight: 30,           // Change from -100 to 20
  justifyContent: 'center',
  alignItems: 'center',       // Add this
  position: 'relative',
  backgroundColor: 'rgba(255, 255, 255, 0.9)',
  borderWidth: 1,
  borderColor: 'rgba(200, 200, 200, 0.2)',
},

profileCardAndroid: {
  backgroundColor: 'rgba(255, 255, 255, 1)',
},
profilePictureContainer: {
  top: '8%',
  alignItems: 'center',
  justifyContent: 'center',
},
  cameraIcon: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    backgroundColor: '#4dd0e1',
    borderRadius: 10,
    width: 22,
    height: 22,
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
    fontSize: 12,
    fontWeight: '600',
    color: '#444',
    marginBottom: 2,
    marginTop: -10,
  },

statsContainer: {
  flexDirection: 'row',
  backgroundColor: '#fff',
  marginHorizontal: 16,
  marginVertical: 16,
  borderRadius: 16,
  paddingVertical: 16,
  paddingHorizontal: 8,
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.1,
  shadowRadius: 8,
  elevation: 4,
  alignItems: 'center',
  justifyContent: 'space-evenly',  
},
statBox: {
  flex: 1,
  alignItems: 'center',
  justifyContent: 'center',
  paddingHorizontal: 0, 
},
statDivider: {
  width: 1,
  height: 40,
  backgroundColor: '#D0D0D0',  
  alignSelf: 'center',
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
    paddingHorizontal: 20,
    gap: 16,
    marginBottom: 8,
  },
  actionButtonWrapper: {
    flex: 1,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    borderRadius: 18,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 10,
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
    borderBottomColor: '#F2CF68',
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
    paddingTop: 6,
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
