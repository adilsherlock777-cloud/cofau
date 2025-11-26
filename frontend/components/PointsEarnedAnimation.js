import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Modal,
  Image,
  Dimensions,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function PointsEarnedAnimation({ visible, pointsEarned, onClose }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const textSlideUp = useRef(new Animated.Value(30)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;

  // Get the appropriate GIF based on points earned
  const getGifSource = () => {
    if (pointsEarned === 25) {
      return require('../assets/animations/Gif-25.gif');
    } else if (pointsEarned === 15) {
      return require('../assets/animations/Gif-15.gif');
    } else if (pointsEarned === 5) {
      return require('../assets/animations/GIF-5.gif');
    }
    // Default fallback - use 25 points GIF
    return require('../assets/animations/Gif-25.gif');
  };

  useEffect(() => {
    if (visible) {
      // Reset animations
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.8);
      textSlideUp.setValue(30);
      textOpacity.setValue(0);

      // Animate in
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
      ]).start();

      // Text animation with delay
      setTimeout(() => {
        Animated.parallel([
          Animated.spring(textSlideUp, {
            toValue: 0,
            tension: 50,
            friction: 7,
            useNativeDriver: true,
          }),
          Animated.timing(textOpacity, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          }),
        ]).start();
      }, 300);

      // Auto-close after 3 seconds
      const timer = setTimeout(() => {
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(scaleAnim, {
            toValue: 0.8,
            duration: 300,
            useNativeDriver: true,
          }),
        ]).start(() => {
          onClose();
        });
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [visible, onClose]);

  const handleClose = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 0.8,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onClose();
    });
  };

  if (!visible) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="none"
      onRequestClose={handleClose}
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

        {/* Close Button */}
        <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
          <Ionicons name="close" size={28} color="#fff" />
        </TouchableOpacity>

        {/* GIF Animation Container */}
        <Animated.View
          style={[
            styles.gifContainer,
            {
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          <Image
            source={getGifSource()}
            style={styles.gifImage}
            resizeMode="contain"
          />
        </Animated.View>

        {/* Points Earned Text */}
        <Animated.View
          style={[
            styles.textContainer,
            {
              opacity: textOpacity,
              transform: [{ translateY: textSlideUp }],
            },
          ]}
        >
          <Text style={styles.pointsText}>+{pointsEarned} Points!</Text>
          <Text style={styles.subText}>Great job! 🎉</Text>
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
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
  },
  closeButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    padding: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 20,
  },
  gifContainer: {
    width: SCREEN_WIDTH * 0.8,
    height: SCREEN_WIDTH * 0.8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 30,
  },
  gifImage: {
    width: '100%',
    height: '100%',
  },
  textContainer: {
    alignItems: 'center',
    marginTop: 20,
  },
  pointsText: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#FFD700',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 3 },
    textShadowRadius: 6,
    marginBottom: 10,
    letterSpacing: 2,
  },
  subText: {
    fontSize: 24,
    color: '#fff',
    fontWeight: '600',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
});

