import React, { useEffect, useState } from 'react';
import { 
  View, Text, StyleSheet, Image, TouchableOpacity, ScrollView, 
  ActivityIndicator, TextInput, Modal, Alert, FlatList, Dimensions, Platform 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import LevelBadge from '../components/LevelBadge';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://cofau-app.preview.emergentagent.com/api';
const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://cofau-app.preview.emergentagent.com';
const SCREEN_WIDTH = Dimensions.get('window').width;

export default function ProfileScreen() {
  const router = useRouter();
  const { userId } = useLocalSearchParams(); // Get userId from query params
  const { token, logout, user: currentUser } = useAuth();
  const [userData, setUserData] = useState(null);
  const [userStats, setUserStats] = useState(null);
  const [userPosts, setUserPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [activeTab, setActiveTab] = useState('photo'); // 'photo', 'video', 'collabs'
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editedBio, setEditedBio] = useState('');
  const [editedName, setEditedName] = useState('');
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [isOwnProfile, setIsOwnProfile] = useState(true);

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
      let user;
      
      // Determine the final user ID and ownership
      const finalUserId = userId ?? currentUser?.id;
      const isOwn = !userId || (finalUserId === currentUser?.id);
      setIsOwnProfile(isOwn);
      
      console.log('👤 Profile Detection:', { userId, currentUserId: currentUser?.id, finalUserId, isOwn });
      
      // Check if viewing another user's profile or own profile
      if (userId && userId !== currentUser?.id) {
        // Viewing another user's profile
        console.log('📡 Fetching other user profile:', userId);
        
        // Get user data from the users endpoint (need to create this or use existing feed data)
        // For now, fetch from /auth/me and then get the specific user data
        const meResponse = await axios.get(`${API_URL}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        
        // If the userId matches current user, show own profile
        if (userId === (meResponse.data.user?.id || meResponse.data.id)) {
          user = meResponse.data.user || meResponse.data;
          setIsOwnProfile(true);
        } else {
          // TODO: Need to fetch other user's public profile
          // For now, use feed data approach
          const feedResponse = await axios.get(`${API_URL}/feed`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          
          // Find user from feed posts
          const userPost = feedResponse.data.find(post => post.user_id === userId);
          if (userPost) {
            user = {
              id: userPost.user_id,
              full_name: userPost.username,
              profile_picture: userPost.user_profile_picture,
              level: userPost.user_level,
              title: userPost.user_title,
            };
          } else {
            throw new Error('User not found');
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
      
      // Convert relative avatar URL to full URL
      if (user.profile_picture && user.profile_picture.startsWith('/api/static/uploads')) {
        user.profile_picture = `${BACKEND_URL}${user.profile_picture}`;
      }
      
      setUserData(user);
      setEditedBio(user.bio || '');
      setEditedName(user.full_name || user.username || '');
      
      // Fetch user stats
      const statsResponse = await axios.get(`${API_URL}/users/${user.id}/stats`);
      setUserStats(statsResponse.data);
      
      setError(false);
    } catch (err) {
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
      }
      
      const response = await axios.get(endpoint);
      const posts = response.data || [];
      
      // Convert relative URLs to full URLs
      const postsWithFullUrls = posts.map(post => ({
        ...post,
        full_image_url: post.media_url && !post.media_url.startsWith('http') 
          ? `${BACKEND_URL}${post.media_url}` 
          : post.media_url
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
      const response = await axios.get(`${API_URL}/users/${userData.id}/follow-status`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setIsFollowing(response.data.is_following);
    } catch (err) {
      console.error('❌ Error fetching follow status:', err);
      setIsFollowing(false);
    }
  };

  const handleFollowToggle = async () => {
    if (!userData?.id || !token || followLoading) return;
    
    setFollowLoading(true);
    const previousFollowState = isFollowing;
    
    // Optimistic UI update
    setIsFollowing(!isFollowing);
    
    try {
      if (isFollowing) {
        // Unfollow
        await axios.delete(`${API_URL}/users/${userData.id}/follow`, {
          headers: { Authorization: `Bearer ${token}` },
        });
      } else {
        // Follow
        await axios.post(`${API_URL}/users/${userData.id}/follow`, {}, {
          headers: { Authorization: `Bearer ${token}` },
        });
      }
      
      // Refresh follow status to ensure consistency
      await fetchFollowStatus();
    } catch (err) {
      console.error('❌ Error toggling follow:', err);
      // Revert optimistic update on error
      setIsFollowing(previousFollowState);
      Alert.alert('Error', 'Failed to update follow status. Please try again.');
    } finally {
      setFollowLoading(false);
    }
  };

  const handleUpdateProfile = async () => {
    try {
      console.log('📝 Updating profile with:', { name: editedName, bio: editedBio });
      
      // Create FormData for the update
      const formData = new FormData();
      if (editedName) formData.append('full_name', editedName);
      if (editedBio !== null && editedBio !== undefined) formData.append('bio', editedBio);
      
      const response = await axios.put(
        `${API_URL}/users/update`,
        formData,
        { 
          headers: { 
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          } 
        }
      );
      
      console.log('✅ Profile update response:', response.data);
      Alert.alert('Success', 'Profile updated successfully!');
      setEditModalVisible(false);
      
      // Refresh profile data after a short delay to ensure DB is updated
      setTimeout(() => {
        fetchProfileData();
      }, 500);
    } catch (err) {
      console.error('❌ Error updating profile:', err.response?.data || err.message);
      Alert.alert('Error', 'Failed to update profile. Please try again.');
    }
  };

  const handleLogout = async () => {
    try {
      console.log('🚪 Starting logout process...');
      
      // Call logout endpoint
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
      
      // Clear token from AuthContext (this clears storage and state)
      await logout();
      
      console.log('🔄 Navigating to login screen...');
      
      // Use push instead of replace to ensure navigation happens
      router.push('/auth/login');
      
      console.log('✅ Logout complete!');
    }
  };

  const getBadgeInfo = () => {
    if (!userData) return null;
    
    // Determine badge based on level or points
    if (userData.points >= 100) {
      return { name: 'TOP REVIEWER', icon: '🔥', color: '#FF6B6B' };
    } else if (userData.level >= 5) {
      return { name: 'EXPERT', icon: '⭐', color: '#FFD700' };
    } else if (userData.level >= 3) {
      return { name: 'RISING STAR', icon: '🌟', color: '#4dd0e1' };
    }
    return null;
  };

  const renderGridItem = ({ item }) => (
    <TouchableOpacity 
      style={styles.gridItem}
      onPress={() => {
        // Navigate to post detail if needed
        console.log('Post clicked:', item.id);
      }}
    >
      {item.full_image_url ? (
        <Image 
          source={{ uri: item.full_image_url }}
          style={styles.gridImage}
          resizeMode="cover"
        />
      ) : (
        <View style={styles.gridPlaceholder}>
          <Ionicons name="image-outline" size={40} color="#ccc" />
        </View>
      )}
      {item.rating && (
        <View style={styles.ratingBadge}>
          <Text style={styles.ratingText}>{item.rating}</Text>
        </View>
      )}
    </TouchableOpacity>
  );

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
          <Text style={styles.username}>{userData.full_name || userData.username || 'User'}</Text>
          <TouchableOpacity style={styles.infoButton}>
            <Ionicons name="information-circle-outline" size={24} color="#FF6B6B" />
          </TouchableOpacity>
        </View>

        {/* Profile Identity Section */}
        <View style={styles.identitySection}>
          <View style={styles.profilePictureContainer}>
            <Image 
              source={{ 
                uri: userData.profile_picture || 'https://placehold.co/120x120/4dd0e1/white?text=' + (userData.full_name?.[0] || 'U')
              }}
              style={styles.profilePicture}
            />
            {/* Level Badge on Profile Picture */}
            {userData.level && (
              <LevelBadge level={userData.level} size="large" />
            )}
            <TouchableOpacity style={styles.cameraIcon}>
              <Ionicons name="camera" size={20} color="#fff" />
            </TouchableOpacity>
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
            <Text style={styles.statValue}>{userStats?.total_posts || 0}</Text>
            <Text style={styles.statLabel}>Posts</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{userStats?.photos_count || 0}</Text>
            <Text style={styles.statLabel}>Photos</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{userStats?.followers_count || 0}</Text>
            <Text style={styles.statLabel}>People</Text>
          </View>
        </View>

        {/* Edit Profile Button */}
        <TouchableOpacity 
          style={styles.editButton}
          onPress={() => setEditModalVisible(true)}
        >
          <Ionicons name="pencil" size={20} color="#fff" />
          <Text style={styles.editButtonText}>Edit Profile</Text>
        </TouchableOpacity>

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
            <Text style={[styles.tabText, activeTab === 'photo' && styles.activeTabText]}>
              Photo
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'video' && styles.activeTab]}
            onPress={() => setActiveTab('video')}
          >
            <Text style={[styles.tabText, activeTab === 'video' && styles.activeTabText]}>
              Video
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'collabs' && styles.activeTab]}
            onPress={() => setActiveTab('collabs')}
          >
            <Text style={[styles.tabText, activeTab === 'collabs' && styles.activeTabText]}>
              Collabs
            </Text>
          </TouchableOpacity>
        </View>

        {/* Content Grid */}
        <FlatList
          data={userPosts}
          renderItem={renderGridItem}
          keyExtractor={(item) => item.id}
          numColumns={3}
          scrollEnabled={false}
          ListEmptyComponent={() => (
            <View style={styles.emptyContainer}>
              <Ionicons name="images-outline" size={64} color="#ccc" />
              <Text style={styles.emptyText}>
                {activeTab === 'photo' && 'No photos yet'}
                {activeTab === 'video' && 'No videos yet'}
                {activeTab === 'collabs' && 'No collaborations yet'}
              </Text>
            </View>
          )}
        />

        {/* Logout Button */}
        <TouchableOpacity 
          style={styles.logoutButton}
          activeOpacity={0.7}
          onPress={() => {
            console.log('🔴 Logout button pressed!');
            
            // Use window.confirm on web, Alert.alert on native
            if (Platform.OS === 'web') {
              const confirmed = window.confirm('Are you sure you want to logout?');
              if (confirmed) {
                console.log('✅ User confirmed logout (web)');
                handleLogout();
              } else {
                console.log('❌ Logout cancelled (web)');
              }
            } else {
              Alert.alert(
                'Logout',
                'Are you sure you want to logout?',
                [
                  { 
                    text: 'Cancel', 
                    style: 'cancel',
                    onPress: () => console.log('❌ Logout cancelled')
                  },
                  { 
                    text: 'Logout', 
                    onPress: () => {
                      console.log('✅ User confirmed logout');
                      handleLogout();
                    },
                    style: 'destructive' 
                  }
                ]
              );
            }
          }}
        >
          <Ionicons name="log-out-outline" size={20} color="#FF6B6B" />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>

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

  infoButton: {
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

  profilePicture: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: '#4dd0e1',
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

  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 20,
    marginTop: 20,
    paddingVertical: 12,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: '#FF6B6B',
  },

  logoutText: {
    color: '#FF6B6B',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
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

  // Modal Styles
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
