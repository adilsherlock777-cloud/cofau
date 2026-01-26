import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Image,
  StyleSheet,
  Dimensions,
  PanResponder,
  TouchableOpacity,
  Text,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { Ionicons } from '@expo/vector-icons';
import * as ImageManipulator from 'expo-image-manipulator';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function ImageCropper({ imageUri, onCropDone, onCancel }) {
  const [imageLayout, setImageLayout] = useState({ width: 0, height: 0 });
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [cropBox, setCropBox] = useState({ x: 20, y: 20, width: 200, height: 200 });
  const [cropping, setCropping] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  const cropBoxRef = useRef(cropBox);
  const imageLayoutRef = useRef(imageLayout);
  const startPos = useRef({ x: 0, y: 0 });

  cropBoxRef.current = cropBox;
  imageLayoutRef.current = imageLayout;

  // Get original image dimensions
  useEffect(() => {
    Image.getSize(
      imageUri,
      (width, height) => setImageSize({ width, height }),
      (error) => console.error('Failed to get image size:', error)
    );
  }, [imageUri]);

  // Handle image layout
  const onImageLayout = (event) => {
    const { width, height } = event.nativeEvent.layout;
    setImageLayout({ width, height });

    const boxSize = Math.min(width, height) * 0.7;
    setCropBox({
      x: (width - boxSize) / 2,
      y: (height - boxSize) / 2,
      width: boxSize,
      height: boxSize,
    });
    setImageLoaded(true);
  };

  

const panResponder = useRef(
  PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: () => {
      // Save starting position when touch begins
      startPos.current = { x: cropBoxRef.current.x, y: cropBoxRef.current.y };
    },
    onPanResponderMove: (_, { dx, dy }) => {
      const layout = imageLayoutRef.current;
      const prev = cropBoxRef.current;

      let newX = startPos.current.x + dx;
      let newY = startPos.current.y + dy;

      // Clamp to bounds
      newX = Math.max(0, Math.min(newX, layout.width - prev.width));
      newY = Math.max(0, Math.min(newY, layout.height - prev.height));

      setCropBox({ ...prev, x: newX, y: newY });
    },
  })
).current;


  // Handle width slider
  const handleWidthChange = (value) => {
    const newWidth = value * imageLayout.width;
    setCropBox((prev) => {
      let newX = prev.x;
      if (newX + newWidth > imageLayout.width) {
        newX = imageLayout.width - newWidth;
      }
      return { ...prev, width: newWidth, x: Math.max(0, newX) };
    });
  };

  // Handle height slider
  const handleHeightChange = (value) => {
    const newHeight = value * imageLayout.height;
    setCropBox((prev) => {
      let newY = prev.y;
      if (newY + newHeight > imageLayout.height) {
        newY = imageLayout.height - newHeight;
      }
      return { ...prev, height: newHeight, y: Math.max(0, newY) };
    });
  };

  

  // Handle crop
  const handleCrop = async () => {
    if (!imageSize.width || !imageLayout.width) return;

    setCropping(true);
    try {
      const scaleX = imageSize.width / imageLayout.width;
      const scaleY = imageSize.height / imageLayout.height;

      const cropData = {
        originX: Math.max(0, Math.round(cropBox.x * scaleX)),
        originY: Math.max(0, Math.round(cropBox.y * scaleY)),
        width: Math.round(cropBox.width * scaleX),
        height: Math.round(cropBox.height * scaleY),
      };

      const result = await ImageManipulator.manipulateAsync(
        imageUri,
        [{ crop: cropData }],
        { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
      );

      onCropDone(result.uri);
    } catch (error) {
      console.error('Crop error:', error);
    } finally {
      setCropping(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onCancel} style={styles.headerButton}>
          <Ionicons name="close" size={28} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Crop Image</Text>
        <TouchableOpacity onPress={handleCrop} style={styles.headerButton} disabled={cropping}>
          {cropping ? (
            <ActivityIndicator size="small" color="#4ECDC4" />
          ) : (
            <Ionicons name="checkmark" size={28} color="#4ECDC4" />
          )}
        </TouchableOpacity>
      </View>

      {/* Image Area */}
      <View style={styles.imageWrapper}>
        <Image
          source={{ uri: imageUri }}
          style={styles.image}
          resizeMode="contain"
          onLayout={onImageLayout}
        />

        {imageLoaded && (
          <View
            style={[styles.cropOverlay, { width: imageLayout.width, height: imageLayout.height }]}
            pointerEvents="box-none"
          >
            {/* Dark overlays */}
            <View style={[styles.darkOverlay, { top: 0, left: 0, right: 0, height: cropBox.y }]} />
            <View style={[styles.darkOverlay, { top: cropBox.y + cropBox.height, left: 0, right: 0, bottom: 0 }]} />
            <View style={[styles.darkOverlay, { top: cropBox.y, left: 0, width: cropBox.x, height: cropBox.height }]} />
            <View style={[styles.darkOverlay, { top: cropBox.y, left: cropBox.x + cropBox.width, right: 0, height: cropBox.height }]} />

            {/* Crop Box */}
            <View
              style={[
                styles.cropBox,
                {
                  left: cropBox.x,
                  top: cropBox.y,
                  width: cropBox.width,
                  height: cropBox.height,
                },
              ]}
              {...panResponder.panHandlers}
            >
              {/* Grid */}
              <View style={[styles.gridLine, { top: '33.33%', left: 0, right: 0, height: 1 }]} />
              <View style={[styles.gridLine, { top: '66.66%', left: 0, right: 0, height: 1 }]} />
              <View style={[styles.gridLine, { left: '33.33%', top: 0, bottom: 0, width: 1 }]} />
              <View style={[styles.gridLine, { left: '66.66%', top: 0, bottom: 0, width: 1 }]} />

              {/* Corner indicators */}
              <View style={[styles.corner, styles.cornerTL]} />
              <View style={[styles.corner, styles.cornerTR]} />
              <View style={[styles.corner, styles.cornerBL]} />
              <View style={[styles.corner, styles.cornerBR]} />
            </View>
          </View>
        )}
      </View>

      {/* Sliders */}
      <View style={styles.slidersContainer}>
        <View style={styles.sliderRow}>
          <Ionicons name="swap-horizontal" size={20} color="#FFF" />
          <Text style={styles.sliderLabel}>Width</Text>
          <Slider
            style={styles.slider}
            minimumValue={0.2}
            maximumValue={1}
            value={imageLayout.width ? cropBox.width / imageLayout.width : 0.7}
            onValueChange={handleWidthChange}
            minimumTrackTintColor="#4ECDC4"
            maximumTrackTintColor="#555"
            thumbTintColor="#4ECDC4"
          />
        </View>

        <View style={styles.sliderRow}>
          <Ionicons name="swap-vertical" size={20} color="#FFF" />
          <Text style={styles.sliderLabel}>Height</Text>
          <Slider
            style={styles.slider}
            minimumValue={0.2}
            maximumValue={1}
            value={imageLayout.height ? cropBox.height / imageLayout.height : 0.7}
            onValueChange={handleHeightChange}
            minimumTrackTintColor="#4ECDC4"
            maximumTrackTintColor="#555"
            thumbTintColor="#4ECDC4"
          />
        </View>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>Drag box to move • Use sliders to resize</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
  },
  headerButton: {
    padding: 8,
    width: 50,
    alignItems: 'center',
  },
  headerTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '600',
  },
  imageWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.55,
  },
  cropOverlay: {
    position: 'absolute',
  },
  darkOverlay: {
    position: 'absolute',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  cropBox: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: '#FFF',
  },
  gridLine: {
    position: 'absolute',
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  corner: {
    position: 'absolute',
    width: 20,
    height: 20,
  },
  cornerTL: {
    top: -2,
    left: -2,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderColor: '#FFF',
  },
  cornerTR: {
    top: -2,
    right: -2,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderColor: '#FFF',
  },
  cornerBL: {
    bottom: -2,
    left: -2,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderColor: '#FFF',
  },
  cornerBR: {
    bottom: -2,
    right: -2,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderColor: '#FFF',
  },
  slidersContainer: {
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#111',
  },
  sliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  sliderLabel: {
    color: '#FFF',
    fontSize: 14,
    marginLeft: 8,
    width: 50,
  },
  slider: {
    flex: 1,
    height: 40,
  },
  footer: {
    padding: 15,
    alignItems: 'center',
  },
  footerText: {
    color: '#888',
    fontSize: 13,
  },
});