import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';

export default function StoryUploadScreen() {
  const router = useRouter();
  const { token } = useAuth();

  const handleTakePhoto = async () => {
  try {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Camera permission is required to take photos.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      ...(Platform.OS === 'android' ? { aspect: [4, 5] } : {}),
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      // Navigate to editor screen with the image
      router.push({
        pathname: '/story-editor',
        params: {
          imageUri: result.assets[0].uri,
          mediaType: 'image',
        },
      });
    }
  } catch (error) {
    console.error('❌ Error taking photo:', error);
    Alert.alert('Error', 'Failed to take photo');
  }
};

  const handlePickImage = async () => {
  try {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Photo library permission is required.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      ...(Platform.OS === 'android' ? { aspect: [4, 5] } : {}),
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      router.push({
        pathname: '/story-editor',
        params: {
          imageUri: result.assets[0].uri,
          mediaType: 'image',
        },
      });
    }
  } catch (error) {
    console.error('❌ Error picking image:', error);
    Alert.alert('Error', 'Failed to pick image');
  }
};

  const handlePickVideo = async () => {
  try {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Photo library permission is required.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      allowsEditing: true,
      quality: 0.8,
      videoMaxDuration: 30,
    });

    if (!result.canceled && result.assets[0]) {
      router.push({
        pathname: '/story-editor',
        params: {
          imageUri: result.assets[0].uri,
          mediaType: 'video',
        },
      });
    }
  } catch (error) {
    console.error('❌ Error picking video:', error);
    Alert.alert('Error', 'Failed to pick video');
  }
};


  return (
    <View style={styles.modalContainer}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => router.back()} />
      <View style={styles.modalContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Add to Your Story</Text>
          <TouchableOpacity onPress={() => router.back()} style={styles.closeButton}>
            <Ionicons name="close" size={28} color="#333" />
          </TouchableOpacity>
        </View>

        {/* Options */}
        <View style={styles.optionsContainer}>
          <TouchableOpacity
            style={styles.optionButton}
            onPress={handleTakePhoto}
          >
            <View style={styles.optionIconContainer}>
              <Ionicons name="camera" size={32} color="#4dd0e1" />
            </View>
            <Text style={styles.optionText}>Take Photo</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.optionButton}
            onPress={handlePickImage}
          >
            <View style={styles.optionIconContainer}>
              <Ionicons name="images" size={32} color="#4dd0e1" />
            </View>
            <Text style={styles.optionText}>Choose Photo</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.optionButton}
            onPress={handlePickVideo}
          >
            <View style={styles.optionIconContainer}>
              <Ionicons name="videocam" size={32} color="#4dd0e1" />
            </View>
            <Text style={styles.optionText}>Choose Video</Text>
          </TouchableOpacity>
        </View>

      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  overlay: {
    flex: 1,
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 40,
    minHeight: 300,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    position: 'absolute',
    right: 20,
    top: 15,
  },
  optionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 40,
    paddingVertical: 40,
  },
  optionButton: {
    alignItems: 'center',
  },
  optionIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#E3F2FD',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  optionText: {
    fontSize: 14,
    color: '#333',
    textAlign: 'center',
  },
  loadingContainer: {
    alignItems: 'center',
    marginTop: 20,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
  },
});
