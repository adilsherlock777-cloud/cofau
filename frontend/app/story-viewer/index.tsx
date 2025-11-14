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
const API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || 'https://backend.cofau.com/api';

export default function StoryViewerScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { user, token } = useAuth();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [stories, setStories] = useState([]);
  const [storyUser, setStoryUser] = useState(null);
  const [paused, setPaused] = useState(false);
  
  const progressAnims = useRef([]).current;
  const autoAdvanceTimer = useRef(null);

  useEffect(() => {
    // Parse params
    try {
      const parsedStories = JSON.parse(params.stories);
      const parsedUser = JSON.parse(params.user);
      setStories(parsedStories);
      setStoryUser(parsedUser);

      // Initialize progress animations
      parsedStories.forEach(() => {
        progressAnims.push(new Animated.Value(0));
      });
    } catch (error) {
      console.error('❌ Error parsing story data:', error);
      router.back();
    }
  }, []);

  useEffect(() => {
    if (stories.length > 0 && !paused) {
      startProgress();
    }

    return () => {
      if (autoAdvanceTimer.current) {
        clearTimeout(autoAdvanceTimer.current);
      }
    };
  }, [currentIndex, stories, paused]);

  const startProgress = () => {
    const currentStory = stories[currentIndex];
    if (!currentStory) return;

    const duration = currentStory.media_type === 'video' ? 30000 : 5000; // 30s for video, 5s for image

    // Animate progress bar
    Animated.timing(progressAnims[currentIndex], {
      toValue: 1,
      duration,
      useNativeDriver: false,
    }).start();

    // Auto-advance timer
    autoAdvanceTimer.current = setTimeout(() => {
      handleNext();
    }, duration);
  };

  const handleNext = () => {
    if (autoAdvanceTimer.current) {
      clearTimeout(autoAdvanceTimer.current);
    }

    if (currentIndex < stories.length - 1) {
      setCurrentIndex(currentIndex + 1);
      // Reset current progress
      progressAnims[currentIndex].setValue(1);
    } else {
      // End of stories
      router.back();
    }
  };

  const handlePrevious = () => {
    if (autoAdvanceTimer.current) {
      clearTimeout(autoAdvanceTimer.current);
    }

    if (currentIndex > 0) {
      // Reset current progress
      progressAnims[currentIndex].setValue(0);
      setCurrentIndex(currentIndex - 1);
      // Reset previous progress
      progressAnims[currentIndex - 1].setValue(0);
    } else {
      router.back();
    }
  };

  const handleDelete = async () => {
    const currentStory = stories[currentIndex];
    
    Alert.alert(
      'Delete Story',
      'Are you sure you want to delete this story?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await axios.delete(`${API_URL}/stories/${currentStory.id}`, {
                headers: { Authorization: `Bearer ${token}` },
              });

              // Remove from local array
              const updatedStories = stories.filter((_, idx) => idx !== currentIndex);
              
              if (updatedStories.length === 0) {
                // No more stories, go back
                Alert.alert('Success', 'Story deleted', [{ text: 'OK', onPress: () => router.back() }]);
              } else {
                setStories(updatedStories);
                if (currentIndex >= updatedStories.length) {
                  setCurrentIndex(updatedStories.length - 1);
                }
              }
            } catch (error) {
              console.error('❌ Error deleting story:', error);
              Alert.alert('Error', 'Failed to delete story');
            }
          },
        },
      ]
    );
  };

  const handleTapLeft = () => {
    handlePrevious();
  };

  const handleTapRight = () => {
    handleNext();
  };

  if (!stories.length || !storyUser) {
    return null;
  }

  const currentStory = stories[currentIndex];
  const isOwner = storyUser.id === user?._id;

  return (
    <SafeAreaView style={styles.container}>
      {/* Progress Bars */}
      <View style={styles.progressContainer}>
        {stories.map((story, index) => (
          <View key={story.id} style={styles.progressBarBackground}>
            <Animated.View
              style={[
                styles.progressBarFill,
                {
                  width: progressAnims[index]?.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0%', '100%'],
                  }),
                },
              ]}
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
            <TouchableOpacity onPress={handleDelete} style={styles.deleteButton}>
              <Ionicons name="trash-outline" size={24} color="#FFF" />
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={() => router.back()} style={styles.closeButton}>
            <Ionicons name="close" size={28} color="#FFF" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Story Content */}
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
            resizeMode="contain"
            shouldPlay={!paused}
            isLooping={false}
            onPlaybackStatusUpdate={(status) => {
              if (status.didJustFinish) {
                handleNext();
              }
            }}
          />
        )}
      </View>

      {/* Tap Areas */}
      <TouchableOpacity
        style={styles.tapAreaLeft}
        activeOpacity={1}
        onPress={handleTapLeft}
      />
      <TouchableOpacity
        style={styles.tapAreaRight}
        activeOpacity={1}
        onPress={handleTapRight}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  progressContainer: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingTop: 8,
    gap: 4,
  },
  progressBarBackground: {
    flex: 1,
    height: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 1.5,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#FFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  username: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 16,
  },
  deleteButton: {
    padding: 4,
  },
  closeButton: {
    padding: 4,
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  storyImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT - 150,
  },
  storyVideo: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT - 150,
  },
  tapAreaLeft: {
    position: 'absolute',
    left: 0,
    top: 150,
    bottom: 0,
    width: SCREEN_WIDTH * 0.3,
  },
  tapAreaRight: {
    position: 'absolute',
    right: 0,
    top: 150,
    bottom: 0,
    width: SCREEN_WIDTH * 0.7,
  },
});
