import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Dimensions,
  SafeAreaView,
  Alert,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Video } from 'expo-av';
import axios from 'axios';
import Constants from 'expo-constants';
import { useAuth } from '../../context/AuthContext';
import UserAvatar from '../../components/UserAvatar';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Backend root (NO /api)
const BACKEND_URL =
  Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL ||
  'https://backend.cofau.com';

// For API calls
const API_URL = `${BACKEND_URL}/api`;

// ✅ UNIVERSAL URL FIXER (same as StoriesBar)
const fixUrl = (url?: string | null) => {
  if (!url) return null;

  if (url.startsWith('http')) return url;

  // Remove duplicate /api
  if (url.startsWith('/api/')) {
    return `${BACKEND_URL}${url.replace('/api', '')}`;
  }

  if (!url.startsWith('/')) return `${BACKEND_URL}/${url}`;

  return `${BACKEND_URL}${url}`;
};

export default function StoryViewerScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { user, token } = useAuth();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [stories, setStories] = useState<any[]>([]);
  const [storyUser, setStoryUser] = useState<any>(null);
  const [paused, setPaused] = useState(false);

  const progressAnims = useRef<Animated.Value[]>([]);
  const autoAdvanceTimer = useRef<any>(null);

  useEffect(() => {
    try {
      const parsedStories = JSON.parse(params.stories as string);
      const parsedUser = JSON.parse(params.user as string);

      // ⭐ FIX ALL STORY MEDIA URLS
      const fixedStories = parsedStories.map((s: any) => ({
        ...s,
        media_url: fixUrl(s.media_url),
      }));

      // ⭐ FIX STORY USER DP
      const fixedUser = {
        ...parsedUser,
        profile_picture: fixUrl(parsedUser.profile_picture),
      };

      setStories(fixedStories);
      setStoryUser(fixedUser);

      // Init progress animations
      fixedStories.forEach(() => {
        progressAnims.current.push(new Animated.Value(0));
      });

    } catch (error) {
      console.error('❌ Error parsing story data:', error);
      router.back();
    }
  }, []);

  // Auto-advance logic
  useEffect(() => {
    if (stories.length > 0 && !paused) startProgress();

    return () => {
      if (autoAdvanceTimer.current) clearTimeout(autoAdvanceTimer.current);
    };
  }, [currentIndex, stories, paused]);

  const startProgress = () => {
    const currentStory = stories[currentIndex];
    if (!currentStory) return;

    const duration =
      currentStory.media_type === 'video'
        ? 30000 // 30 sec for videos
        : 5000;  // 5 sec for images

    Animated.timing(progressAnims.current[currentIndex], {
      toValue: 1,
      duration,
      useNativeDriver: false,
    }).start();

    autoAdvanceTimer.current = setTimeout(() => handleNext(), duration);
  };

  const handleNext = () => {
    if (autoAdvanceTimer.current) clearTimeout(autoAdvanceTimer.current);

    if (currentIndex < stories.length - 1) {
      progressAnims.current[currentIndex].setValue(1);
      setCurrentIndex(currentIndex + 1);
    } else {
      router.back();
    }
  };

  const handlePrevious = () => {
    if (autoAdvanceTimer.current) clearTimeout(autoAdvanceTimer.current);

    if (currentIndex > 0) {
      progressAnims.current[currentIndex].setValue(0);
      setCurrentIndex(currentIndex - 1);
    } else {
      router.back();
    }
  };

  // Delete story
  const handleDelete = async () => {
    const currentStory = stories[currentIndex];

    Alert.alert('Delete Story', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await axios.delete(`${API_URL}/stories/${currentStory.id}`, {
              headers: { Authorization: `Bearer ${token}` },
            });

            const updatedStories = stories.filter((_, idx) => idx !== currentIndex);

            if (updatedStories.length === 0) {
              Alert.alert('Deleted', 'Story removed', [
                { text: 'OK', onPress: () => router.back() },
              ]);
            } else {
              setStories(updatedStories);
              if (currentIndex >= updatedStories.length) {
                setCurrentIndex(updatedStories.length - 1);
              }
            }
          } catch (err) {
            console.error('❌ Delete story error:', err);
            Alert.alert('Error', 'Failed to delete');
          }
        },
      },
    ]);
  };

  if (!stories.length || !storyUser) return null;

  const currentStory = stories[currentIndex];
  const isOwner = storyUser?.id === user?._id;

  return (
    <SafeAreaView style={styles.container}>
      {/* Progress bars */}
      <View style={styles.progressContainer}>
        {stories.map((_, index) => (
          <View key={index} style={styles.progressBarBackground}>
            <Animated.View
              style={{
                ...styles.progressBarFill,
                width: progressAnims.current[index]?.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0%', '100%'],
                }),
              }}
            />
          </View>
        ))}
      </View>

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.userInfo}>
          <UserAvatar
            profilePicture={storyUser.profile_picture}
            username={storyUser.username}
            size={36}
            showLevelBadge={false}
          />
          <Text style={styles.username}>{storyUser.username}</Text>
        </View>

        <View style={styles.headerActions}>
          {isOwner && (
            <TouchableOpacity onPress={handleDelete}>
              <Ionicons name="trash-outline" size={24} color="#FFF" />
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="close" size={28} color="#FFF" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Story Media */}
      <View style={styles.contentContainer}>
        {currentStory.media_type === 'image' ? (
          <Image
            source={{ uri: currentStory.media_url }}
            style={styles.storyImage}
            resizeMode="contain"
          />
        ) : (
          <Video
            source={{ uri: currentStory.media_url }}
            style={styles.storyVideo}
            shouldPlay={!paused}
            resizeMode="contain"
            isLooping={false}
            onPlaybackStatusUpdate={(status) => {
              if (status.didJustFinish) handleNext();
            }}
          />
        )}
      </View>

      {/* Tap areas */}
      <TouchableOpacity style={styles.tapLeft} onPress={handlePrevious} />
      <TouchableOpacity style={styles.tapRight} onPress={handleNext} />
    </SafeAreaView>
  );
}

/* ---------------- STYLES ---------------- */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  progressContainer: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingTop: 8,
    gap: 4,
  },
  progressBarBackground: {
    flex: 1,
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#FFF',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
  },
  userInfo: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  username: { color: '#FFF', fontSize: 16, fontWeight: '600' },
  headerActions: { flexDirection: 'row', gap: 16 },
  contentContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  storyImage: { width: SCREEN_WIDTH, height: SCREEN_HEIGHT - 150 },
  storyVideo: { width: SCREEN_WIDTH, height: SCREEN_HEIGHT - 150 },
  tapLeft: {
    position: 'absolute',
    left: 0,
    top: 150,
    bottom: 0,
    width: SCREEN_WIDTH * 0.3,
  },
  tapRight: {
    position: 'absolute',
    right: 0,
    top: 150,
    bottom: 0,
    width: SCREEN_WIDTH * 0.7,
  },
});
