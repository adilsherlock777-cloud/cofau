import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
  Modal,
  Image,
} from 'react-native';
import { useLevelAnimation } from '../context/LevelContext';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Confetti particle component
const ConfettiParticle = ({ delay, index }) => {
  const translateY = useRef(new Animated.Value(0)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const rotate = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const randomX = (Math.random() - 0.5) * SCREEN_WIDTH;
    const randomRotation = Math.random() * 720;

    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -SCREEN_HEIGHT * 0.8,
        duration: 2500,
        delay,
        useNativeDriver: true,
      }),
      Animated.timing(translateX, {
        toValue: randomX,
        duration: 2500,
        delay,
        useNativeDriver: true,
      }),
      Animated.timing(rotate, {
        toValue: randomRotation,
        duration: 2500,
        delay,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 2500,
        delay,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const colors = ['#FF6B6B', '#4ECDC4', '#FFE66D', '#95E1D3', '#F38181', '#A8E6CF'];
  const color = colors[index % colors.length];

  return (
    <Animated.View
      style={[
        styles.confetti,
        {
          backgroundColor: color,
          transform: [
            { translateX },
            { translateY },
            {
              rotate: rotate.interpolate({
                inputRange: [0, 360],
                outputRange: ['0deg', '360deg'],
              }),
            },
          ],
          opacity,
        },
      ]}
    />
  );
};

export default function LevelUpAnimation() {
  const { showAnimation, currentLevel, hideLevelUpAnimation } = useLevelAnimation();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const trophyScale = useRef(new Animated.Value(0)).current;
  const trophyRotate = useRef(new Animated.Value(0)).current;
  const textSlideUp = useRef(new Animated.Value(50)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (showAnimation) {
      console.log('🎬 Starting level-up animation for Level', currentLevel);

      // Fade in background
      fadeAnim.setValue(0);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();

      // Auto-hide after 3 seconds (GIF duration)
      const timer = setTimeout(() => {
        handleAnimationEnd();
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [showAnimation, currentLevel]);

  const handleAnimationEnd = () => {
    console.log('✅ Animation completed, fading out');

    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start(() => {
      hideLevelUpAnimation();
    });
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

        {/* Level Up GIF Animation */}
        <View style={styles.gifContainer}>
          <Image
            source={require('../assets/animations/LEVEL_UP.gif')}
            style={styles.levelUpGif}
            resizeMode="cover"
          />
        </View>
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
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
  },

  confetti: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
    bottom: SCREEN_HEIGHT * 0.5,
    left: SCREEN_WIDTH * 0.5,
  },

  trophyContainer: {
    position: 'relative',
    marginBottom: 40,
  },

  glowCircle: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: '#FFD700',
    top: '50%',
    left: '50%',
    marginLeft: -90,
    marginTop: -90,
  },

  trophyEmoji: {
    fontSize: 120,
    textAlign: 'center',
    zIndex: 2,
  },

  textContainer: {
    alignItems: 'center',
  },

  celebrationEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },

  levelUpText: {
    fontSize: 52,
    fontWeight: 'bold',
    color: '#fff',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 3 },
    textShadowRadius: 6,
    marginBottom: 20,
    letterSpacing: 2,
  },

  levelBadge: {
    backgroundColor: '#FFD700',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 30,
    borderWidth: 3,
    borderColor: '#FFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
    marginBottom: 16,
  },

  levelNumberText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#333',
  },

  gifContainer: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    top: 0,
    left: 0,
    zIndex: 10,
  },
  levelUpGif: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  subText: {
    fontSize: 18,
    color: '#FFD700',
    fontWeight: '600',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
});
