import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Image,
  Linking,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Video, ResizeMode } from 'expo-av';
import { createPost } from '../utils/api';
import { useLevelAnimation } from '../context/LevelContext';
import { useAuth } from '../context/AuthContext';
import PointsEarnedAnimation from '../components/PointsEarnedAnimation';

export default function AddPostScreen() {
  const router = useRouter();
  const { showLevelUpAnimation } = useLevelAnimation();
  const auth = useAuth() as any;
  const { refreshUser } = auth;

  const [mediaUri, setMediaUri] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'image' | 'video' | null>(null);
  const [rating, setRating] = useState('');
  const [review, setReview] = useState('');

  const [locationName, setLocationName] = useState('');  // NEW
  const [mapsLink, setMapsLink] = useState('');          // UPDATED

  const [loading, setLoading] = useState(false);
  const [showPointsAnimation, setShowPointsAnimation] = useState(false);
  const [pointsEarned, setPointsEarned] = useState(0);

  // ------------------------------ MEDIA PICKERS ------------------------------

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission Required', 'Enable gallery permissions to continue.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setMediaUri(result.assets[0].uri);
      setMediaType('image');
    }
  };

  const takePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission Required', 'Enable camera permissions to continue.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setMediaUri(result.assets[0].uri);
      setMediaType('image');
    }
  };

  const pickVideo = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission Required', 'Enable gallery permissions to continue.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      allowsEditing: true,
      quality: 0.8,
      videoMaxDuration: 15,
    });

    if (!result.canceled && result.assets[0]) {
      setMediaUri(result.assets[0].uri);
      setMediaType('video');
    }
  };

  const showMediaOptions = () => {
    // On web, directly open file picker
    if (Platform.OS === 'web') {
      pickImageOrVideo();
    } else {
      // On mobile, show options
      Alert.alert('Add Media', 'Choose an option:', [
        { text: 'Take Photo', onPress: takePhoto },
        { text: 'Choose Photo', onPress: pickImage },
        { text: 'Choose Video (max 15s)', onPress: pickVideo },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  };

  // Universal picker for web (supports both images and videos)
  const pickImageOrVideo = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All, // Both images and videos
        allowsEditing: true,
        quality: 0.8,
        videoMaxDuration: 15,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        
        // Detect if it's video or image
        if (asset.type === 'video' || asset.uri.includes('.mp4') || asset.uri.includes('.mov')) {
          setMediaType('video');
        } else {
          setMediaType('image');
        }
        
        setMediaUri(asset.uri);
      }
    } catch (error) {
      console.error('Error picking media:', error);
      Alert.alert('Error', 'Failed to pick media. Please try again.');
    }
  };

  // ------------------------------ GOOGLE MAPS (FREE) ------------------------------

  const generateMapsLink = () => {
    if (!locationName.trim()) {
      Alert.alert('Location Required', 'Please type a location name.');
      return;
    }

    const url =
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        locationName.trim()
      )}`;

    setMapsLink(url);
    Alert.alert('Location Added', 'Google Maps link generated!');
  };

  const openMaps = () => {
    if (!mapsLink) {
      Alert.alert('No Link', 'Please generate or paste a Google Maps link first.');
      return;
    }
    Linking.openURL(mapsLink);
  };

  // ------------------------------ POST SUBMISSION ------------------------------

  const handlePost = async () => {
    if (!mediaUri || !mediaType) {
      Alert.alert('Media Required', 'Please add a photo or video.');
      return;
    }

    const numericRating = parseInt(rating, 10);
    if (!numericRating || numericRating < 1 || numericRating > 10) {
      Alert.alert('Rating Required', 'Please add a rating between 1-10.');
      return;
    }

    if (!review.trim()) {
      Alert.alert('Review Required', 'Please write a review.');
      return;
    }

    if (!mapsLink.trim()) {
      Alert.alert('Location Required', 'Please generate or paste a Google Maps link.');
      return;
    }

    setLoading(true);

    try {
      let fileToUpload;

      if (Platform.OS === 'web') {
        const response = await fetch(mediaUri);
        const blob = await response.blob();
        const ext = mediaType === 'video' ? 'mp4' : 'jpg';
        const filename = `${mediaType}_${Date.now()}.${ext}`;

        fileToUpload = new File([blob], filename, {
          type: mediaType === 'video' ? 'video/mp4' : 'image/jpeg',
        });
      } else {
        const name = mediaUri.split('/').pop() || `media_${Date.now()}`;
        fileToUpload = {
          uri: mediaUri,
          name,
          type: mediaType === 'video' ? 'video/mp4' : 'image/jpeg',
        };
      }

      const postData = {
        rating: numericRating,
        review_text: review.trim(),
        map_link: mapsLink.trim(),         // FINAL MAP LINK
        location_name: locationName.trim(), // LOCATION NAME
        file: fileToUpload,
        media_type: mediaType,
      };

      const result = await createPost(postData);

      setLoading(false);

      // Refresh user data immediately to show updated points
      await refreshUser();

      // Check for level up in the level_update object
      const levelUpdate = result.level_update;
      if (levelUpdate && levelUpdate.leveledUp) {
        showLevelUpAnimation(levelUpdate.level);
        setTimeout(() => router.push('/feed'), 3000);
        return;
      }

      // Show points earned animation based on points earned
      const earnedPoints = levelUpdate?.pointsEarned || 0;
      if (earnedPoints > 0) {
        setPointsEarned(earnedPoints);
        setShowPointsAnimation(true);
        // Navigate to feed after animation (3 seconds)
        setTimeout(() => {
          setShowPointsAnimation(false);
          router.push('/feed');
        }, 3000);
      } else {
        // Fallback if no points (shouldn't happen, but just in case)
        Alert.alert('Success!', 'Post submitted successfully!', [
          { text: 'OK', onPress: () => router.push('/feed') },
        ]);
      }

    } catch (error: any) {
      console.error('❌ Error creating post:', error);
      setLoading(false);
      Alert.alert('Error', error?.response?.data?.detail || 'Failed to create post.');
    }
  };

  // ------------------------------ UI ------------------------------

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add Post</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>

        {/* Media Upload */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Photo / Video</Text>
          <TouchableOpacity style={styles.mediaBox} onPress={showMediaOptions}>
            {mediaUri ? (
              <View style={styles.mediaPreview}>
                {mediaType === 'image' ? (
                  <Image source={{ uri: mediaUri }} style={styles.mediaImage} />
                ) : (
                  <View style={styles.videoPreview}>
                    <Video
                      source={{ uri: mediaUri }}
                      style={styles.videoPlayer}
                      resizeMode={ResizeMode.COVER}
                      shouldPlay={false}
                      useNativeControls={true}
                      isLooping={false}
                      isMuted={false}
                    />
                  </View>
                )}

                <TouchableOpacity style={styles.changeMediaButton} onPress={showMediaOptions}>
                  <Text style={styles.changeMediaText}>Change</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.uploadPrompt}>
                <Ionicons name="camera" size={50} color="#CCC" />
                <Text style={styles.uploadText}>Tap to add photo or video</Text>
                <Text style={styles.uploadSubText}>Videos max 15 seconds</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Rating */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Rating</Text>
          <View style={styles.ratingContainer}>
            <Text style={styles.ratingNumber}>{rating || 0}/10</Text>
            <View style={styles.starsContainer}>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                <TouchableOpacity key={n} onPress={() => setRating(n.toString())}>
                  <Ionicons
                    name="star"
                    size={28}
                    color={n <= Number(rating) ? '#FFD700' : '#E0E0E0'}
                  />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* Review */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Review</Text>
          <TextInput
            style={styles.reviewInput}
            placeholder="Write your review..."
            placeholderTextColor="#999"
            value={review}
            onChangeText={setReview}
            multiline
          />
        </View>

        {/* FREE GOOGLE MAPS LOCATION */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Location (Google Maps)</Text>

          <TextInput
            style={styles.linkInput}
            placeholder="Type place name (e.g., Starbucks MG Road)"
            placeholderTextColor="#999"
            value={locationName}
            onChangeText={(t) => {
              setLocationName(t);
              setMapsLink('');
            }}
          />

          <TouchableOpacity style={styles.mapsButton} onPress={generateMapsLink}>
            <Ionicons name="map" size={20} color="#4ECDC4" />
            <Text style={styles.mapsButtonText}>Generate Google Maps Link</Text>
          </TouchableOpacity>

          <TextInput
            style={styles.linkInput}
            placeholder="Or paste existing Google Maps link"
            placeholderTextColor="#999"
            value={mapsLink}
            onChangeText={(t) => {
              setMapsLink(t);
              setLocationName('');
            }}
            autoCapitalize="none"
            autoCorrect={false}
          />

          <TouchableOpacity style={styles.mapsButton} onPress={openMaps}>
            <Ionicons name="location" size={20} color="#4ECDC4" />
            <Text style={styles.mapsButtonText}>Open Location in Maps</Text>
            <Ionicons name="chevron-forward" size={20} color="#4ECDC4" />
          </TouchableOpacity>
        </View>

        {/* POST BUTTON */}
        <TouchableOpacity
          style={styles.postButtonContainer}
          onPress={handlePost}
          disabled={loading}
        >
          <LinearGradient
            colors={['#66D9E8', '#F093FB', '#F5576C']}
            style={styles.postButton}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <Text style={styles.postButtonText}>POST</Text>
            )}
          </LinearGradient>
        </TouchableOpacity>

        <View style={{ height: 20 }} />

      </ScrollView>

      {/* Points Earned Animation */}
      <PointsEarnedAnimation
        visible={showPointsAnimation}
        pointsEarned={pointsEarned}
        onClose={() => {
          setShowPointsAnimation(false);
          router.push('/feed');
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },

  header: {
    backgroundColor: '#FFF',
    paddingVertical: 16,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },

  backButton: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  headerRight: { width: 32 },

  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingVertical: 20 },

  section: { marginBottom: 22 },
  sectionLabel: { fontSize: 16, fontWeight: 'bold', marginBottom: 10 },

  mediaBox: {
    height: 280,
    backgroundColor: '#FFF',
    borderRadius: 16,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#E5E5E5',
    overflow: 'hidden',
  },

  uploadPrompt: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  uploadText: { fontSize: 16, color: '#666', marginTop: 12 },
  uploadSubText: { fontSize: 13, color: '#999', marginTop: 4 },

  mediaPreview: { flex: 1 },
  mediaImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  videoPreview: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: '#000',
  },
  videoPlayer: {
    width: '100%',
    height: '100%',
  },

  changeMediaButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  changeMediaText: { color: '#FFF', fontSize: 14 },

  ratingContainer: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },

  ratingNumber: { fontSize: 22, fontWeight: 'bold', marginBottom: 12 },
  starsContainer: { flexDirection: 'row', flexWrap: 'wrap' },

  reviewInput: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    minHeight: 120,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },

  linkInput: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },

  mapsButton: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 10,
  },

  mapsButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#4ECDC4',
  },

  postButtonContainer: { marginTop: 10 },
  postButton: {
    paddingVertical: 18,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  postButtonText: { color: '#FFF', fontSize: 18, fontWeight: 'bold' },
});
