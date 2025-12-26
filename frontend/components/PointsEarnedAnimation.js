import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, Dimensions, View, Modal } from 'react-native';


export default function PointsEarnedAnimation({ visible, pointsEarned, onClose }) {
  const [showGif, setShowGif] = useState(false);

  useEffect(() => {
    if (visible) {
      setShowGif(true);
      // Hide after GIF finishes (approximately 2500ms for better visibility)
      const timer = setTimeout(() => {
        setShowGif(false);
        if (onClose) {
          onClose();
        }
      }, 2500);
      
      return () => clearTimeout(timer);
    } else {
      setShowGif(false);
    }
  }, [visible, onClose]);

  // Get the appropriate GIF based on points earned
  const getGifSource = () => {
    if (pointsEarned === 25) {
      return require('../assets/animations/25.gif');
    } else if (pointsEarned === 15) {
      return require('../assets/animations/15.gif');
    } else if (pointsEarned === 5) {
      // For 5 points (Influencer level), use 15.gif as fallback or create a 5.gif later
      return require('../assets/animations/15.gif');
    }
    // Default fallback - use 25 points GIF
    return require('../assets/animations/25.gif');
  };

  if (!visible || !showGif) {
    return null;
  }

  return (
    <Modal
      visible={visible && showGif}
      transparent={true}
      animationType="none"
      onRequestClose={onClose}
    >
      <View style={styles.container} pointerEvents="none">
        <Image
          source={getGifSource()}
          style={styles.gif}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  gif: {
    width: '100%',
    height: '100%',
    position: 'absolute',
    top: 0,
    left: 0,
    resizeMode: 'cover',
    zIndex: 999,
  },
});
