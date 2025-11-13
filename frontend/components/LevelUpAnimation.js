import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
  Modal,
} from 'react-native';
import { Video } from 'expo-av';
import { useLevelAnimation } from '../context/LevelContext';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function LevelUpAnimation() {
  const { showAnimation, currentLevel, hideLevelUpAnimation } = useLevelAnimation();
  const videoRef = useRef(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const textFadeAnim = useRef(new Animated.Value(0)).current;
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    if (showAnimation) {
      console.log('🎬 Starting level-up animation for Level', currentLevel);
      setIsPlaying(true);

      // Fade in animation
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();

      // Text fade in with delay
      setTimeout(() => {
        Animated.timing(textFadeAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }).start();
      }, 300);

      // Auto-hide after 3 seconds
      setTimeout(() => {
        handleAnimationEnd();
      }, 3000);
    } else {
      // Reset animations when hidden
      fadeAnim.setValue(0);
      textFadeAnim.setValue(0);
      setIsPlaying(false);
    }
  }, [showAnimation, currentLevel]);

  const handleAnimationEnd = () => {
    console.log('✅ Animation completed, fading out');

    // Fade out text first
    Animated.timing(textFadeAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start();

    // Fade out entire modal
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 500,
      useNativeDriver: true,
    }).start(() => {
      hideLevelUpAnimation();
    });
  };

  const handleVideoEnd = (status) => {
    if (status.didJustFinish) {
      console.log('🎥 Video playback finished');
      handleAnimationEnd();
    }
  };

  if (!showAnimation) {
    return null;
  }

  return (
    <Modal
      visible={showAnimation}
      transparent={true}
      animationType="none"
      onRequestClose={handleAnimationEnd}
    >
      <Animated.View
        style={[
          styles.overlay,
          {
            opacity: fadeAnim,
          },
        ]}
      >
        {/* Dimmed Background */}
        <View style={styles.dimmedBackground} />

        {/* Video Animation */}
        <View style={styles.videoContainer}>
          <Video
            ref={videoRef}
            source={require('../assets/animations/levelup.mp4')}
            style={styles.video}
            resizeMode="contain"
            shouldPlay={isPlaying}
            isLooping={false}
            volume={1.0}
            onPlaybackStatusUpdate={handleVideoEnd}
          />
        </View>

        {/* Level Up Text */}
        <Animated.View
          style={[
            styles.textContainer,
            {
              opacity: textFadeAnim,
              transform: [
                {
                  translateY: textFadeAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [20, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <Text style={styles.emojiText}>🎉</Text>
          <Text style={styles.levelUpText}>Level Up!</Text>
          <Text style={styles.levelNumberText}>
            You reached Level {currentLevel}
          </Text>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },

  dimmedBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },

  videoContainer: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },

  video: {
    width: SCREEN_WIDTH * 0.9,
    height: SCREEN_HEIGHT * 0.6,
  },

  textContainer: {
    position: 'absolute',
    top: SCREEN_HEIGHT * 0.25,
    alignItems: 'center',
    width: '100%',
  },

  emojiText: {
    fontSize: 64,
    marginBottom: 16,
  },

  levelUpText: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#fff',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
    marginBottom: 12,
  },

  levelNumberText: {
    fontSize: 24,
    fontWeight: '600',
    color: '#fff',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
});
