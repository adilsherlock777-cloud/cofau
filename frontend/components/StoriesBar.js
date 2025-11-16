import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import axios from 'axios';
import Constants from 'expo-constants';
import { useAuth } from '../context/AuthContext';
import UserAvatar from './UserAvatar';

// Correct backend base URL (no /api at end)
const BACKEND_URL =
  Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL ||
  'https://backend.cofau.com';

const API_URL = `${BACKEND_URL}/api`;

// Normalize any DP path to absolute URL
const fixUrl = (url) => {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  if (!url.startsWith('/')) return `${BACKEND_URL}/${url}`;
  return `${BACKEND_URL}${url}`;
};

export default function StoriesBar() {
  const router = useRouter();
  const { user, token } = useAuth();
  const [stories, setStories] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) fetchStories();
  }, [token]);

  const fetchStories = async () => {
    try {
      setLoading(true);

      const response = await axios.get(`${API_URL}/stories/feed`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      // Fix DP URLs for ALL returned users
      const fixed = response.data.map((u) => ({
        ...u,
        user: {
          ...u.user,
          profile_picture: fixUrl(u.user.profile_picture),
        },
      }));

      setStories(fixed);
    } catch (error) {
      console.error('❌ Error fetching stories:', error.response?.data || error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleStoryPress = (userStories) => {
    router.push({
      pathname: '/story-viewer',
      params: {
        userId: userStories.user.id,
        stories: JSON.stringify(userStories.stories),
        user: JSON.stringify(userStories.user),
      },
    });
  };

  const handleAddStory = () => {
    router.push('/story-upload');
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color="#4dd0e1" />
      </View>
    );
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
    >
      {/* Your Story - Always First */}
      {user && (
        <TouchableOpacity style={styles.storyItem} onPress={handleAddStory}>
          <View style={styles.yourStoryContainer}>
            <UserAvatar
              profilePicture={fixUrl(user.profile_picture)}
              username={user.full_name || user.username}
              size={60}
              showLevelBadge={false}
            />
            <View style={styles.addIconContainer}>
              <Ionicons name="add" size={20} color="#fff" />
            </View>
          </View>

          <Text style={styles.storyUsername} numberOfLines={1}>
            Your Story
          </Text>
        </TouchableOpacity>
      )}

      {/* Other Users' Stories */}
      {stories.map((userStories) => {
        const isOwnStory = userStories.user.id === user?.id;

        // Skip if it's our own story and empty
        if (isOwnStory && userStories.stories.length === 0) return null;

        return (
          <TouchableOpacity
            key={userStories.user.id}
            style={styles.storyItem}
            onPress={() => handleStoryPress(userStories)}
          >
            <LinearGradient
              colors={['#feda75', '#fa7e1e', '#d62976', '#962fbf', '#4f5bd5']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.gradientRing}
            >
              <View style={styles.storyInnerWhiteRing}>
                <UserAvatar
                  profilePicture={fixUrl(userStories.user.profile_picture)}
                  username={userStories.user.username}
                  size={58}
                  showLevelBadge={false}
                />
              </View>
            </LinearGradient>

            <Text style={styles.storyUsername} numberOfLines={1}>
              {userStories.user.username}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
  },
  contentContainer: {
    paddingHorizontal: 12,
    paddingVertical: 16,
  },
  storyItem: {
    alignItems: 'center',
    marginRight: 16,
    width: 70,
  },
  yourStoryContainer: {
    position: 'relative',
  },
  addIconContainer: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#4dd0e1',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFF',
  },
  gradientRing: {
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 3,
  },
  storyInnerWhiteRing: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 3,
  },
  storyUsername: {
    marginTop: 6,
    fontSize: 12,
    color: '#333',
    textAlign: 'center',
  },
});
