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
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { createPost } from '../utils/api';

export default function AddPostScreen() {
  const router = useRouter();
  const [mediaUri, setMediaUri] = useState(null);
  const [mediaType, setMediaType] = useState(null); // 'image' or 'video'
  const [rating, setRating] = useState('');
  const [review, setReview] = useState('');
  const [mapsLink, setMapsLink] = useState('');
  const [loading, setLoading] = useState(false);

  // Request permissions and pick image
  const pickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (permissionResult.granted === false) {
      Alert.alert('Permission Required', 'Permission to access gallery is required!');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled) {
      setMediaUri(result.assets[0].uri);
      setMediaType('image');
    }
  };

  // Request permissions and take photo
  const takePhoto = async () => {
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
    
    if (permissionResult.granted === false) {
      Alert.alert('Permission Required', 'Permission to access camera is required!');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled) {
      setMediaUri(result.assets[0].uri);
      setMediaType('image');
    }
  };

  // Pick video
  const pickVideo = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (permissionResult.granted === false) {
      Alert.alert('Permission Required', 'Permission to access gallery is required!');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      allowsEditing: true,
      quality: 0.8,
      videoMaxDuration: 15, // Max 15 seconds
    });

    if (!result.canceled) {
      setMediaUri(result.assets[0].uri);
      setMediaType('video');
    }
  };

  // Show media upload options
  const showMediaOptions = () => {
    Alert.alert(
      'Add Media',
      'Choose an option',
      [
        { text: 'Take Photo', onPress: takePhoto },
        { text: 'Choose Photo', onPress: pickImage },
        { text: 'Choose Video (max 15s)', onPress: pickVideo },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  // Open Google Maps link
  const openMapsLink = () => {
    if (mapsLink) {
      Linking.openURL(mapsLink);
    } else {
      Alert.alert('No Link', 'Please paste a Google Maps link first');
    }
  };

  // Handle post submission
  const handlePost = async () => {
    // Validation
    if (!mediaUri) {
      if (Platform.OS === 'web') {
        window.alert('Please add a photo or video');
      } else {
        Alert.alert('Media Required', 'Please add a photo or video');
      }
      return;
    }
    if (!rating || rating < 1 || rating > 10) {
      if (Platform.OS === 'web') {
        window.alert('Please add a rating between 1-10');
      } else {
        Alert.alert('Rating Required', 'Please add a rating between 1-10');
      }
      return;
    }
    if (!review.trim()) {
      if (Platform.OS === 'web') {
        window.alert('Please write a review');
      } else {
        Alert.alert('Review Required', 'Please write a review');
      }
      return;
    }

    setLoading(true);

    try {
      console.log('📝 Preparing to create post...');
      
      // Prepare file object for upload
      let fileToUpload;
      
      if (Platform.OS === 'web') {
        // On web, we need to fetch the image and convert to blob
        const response = await fetch(mediaUri);
        const blob = await response.blob();
        const filename = `image_${Date.now()}.jpg`;
        fileToUpload = new File([blob], filename, { type: blob.type });
      } else {
        // On native, pass the URI with metadata
        const filename = mediaUri.split('/').pop() || `image_${Date.now()}.jpg`;
        fileToUpload = {
          uri: mediaUri,
          name: filename,
          type: mediaType === 'video' ? 'video/mp4' : 'image/jpeg',
        };
      }

      const postData = {
        rating: parseInt(rating),
        review_text: review,
        map_link: mapsLink || null,
        file: fileToUpload,
      };

      console.log('📤 Submitting post to backend...');
      const result = await createPost(postData);
      console.log('✅ Post created successfully!', result);

      setLoading(false);

      // Show success message and redirect
      if (Platform.OS === 'web') {
        window.alert('Post Submitted Successfully! 🎉');
        router.push('/feed');
            },
          ]
        );
      }
    } catch (error) {
      console.error('❌ Error creating post:', error);
      setLoading(false);
      
      const errorMessage = error.response?.data?.detail || error.message || 'Failed to create post';
      
      if (Platform.OS === 'web') {
        window.alert(`Error: ${errorMessage}`);
      } else {
        Alert.alert('Error', errorMessage);
      }
    }
  };

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

      <ScrollView 
        style={styles.scrollView} 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Media Upload Section */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Photo / Video</Text>
          <TouchableOpacity 
            style={styles.mediaBox} 
            onPress={showMediaOptions}
            activeOpacity={0.8}
          >
            {mediaUri ? (
              <View style={styles.mediaPreview}>
                {mediaType === 'image' ? (
                  <Image source={{ uri: mediaUri }} style={styles.mediaImage} />
                ) : (
                  <View style={styles.videoPreview}>
                    <LinearGradient
                      colors={['#66D9E8', '#F093FB', '#F5576C']}
                      style={styles.videoGradient}
                    >
                      <Ionicons name="play-circle" size={60} color="#FFF" />
                      <Text style={styles.videoText}>Video Selected</Text>
                    </LinearGradient>
                  </View>
                )}
                <TouchableOpacity 
                  style={styles.changeMediaButton}
                  onPress={showMediaOptions}
                >
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

        {/* Rating Section */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Rating</Text>
          <View style={styles.ratingContainer}>
            <Text style={styles.ratingNumber}>{rating || 0}/10</Text>
            <View style={styles.starsContainer}>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((starIndex) => (
                <TouchableOpacity
                  key={starIndex}
                  onPress={() => setRating(starIndex.toString())}
                  activeOpacity={0.7}
                  style={styles.starButton}
                >
                  <Ionicons
                    name="star"
                    size={28}
                    color={starIndex <= parseInt(rating || '0') ? '#FFD700' : '#E0E0E0'}
                  />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* Review Section */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Review</Text>
          <TextInput
            style={styles.reviewInput}
            placeholder="Write your review here..."
            placeholderTextColor="#999"
            value={review}
            onChangeText={setReview}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        {/* Google Maps Link Section */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Location (Google Maps)</Text>
          <TextInput
            style={styles.linkInput}
            placeholder="Paste Google Maps link here"
            placeholderTextColor="#999"
            value={mapsLink}
            onChangeText={setMapsLink}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity 
            style={styles.mapsButton}
            onPress={openMapsLink}
            disabled={!mapsLink}
          >
            <Ionicons name="location" size={20} color={mapsLink ? '#4ECDC4' : '#CCC'} />
            <Text style={[styles.mapsButtonText, !mapsLink && styles.mapsButtonTextDisabled]}>
              Open in Maps
            </Text>
            <Ionicons name="chevron-forward" size={20} color={mapsLink ? '#4ECDC4' : '#CCC'} />
          </TouchableOpacity>
        </View>

        {/* POST Button */}
        <TouchableOpacity 
          style={styles.postButtonContainer}
          onPress={handlePost}
          activeOpacity={0.8}
          disabled={loading}
        >
          <LinearGradient
            colors={['#66D9E8', '#F093FB', '#F5576C']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.postButton}
          >
            {loading ? (
              <ActivityIndicator color="#FFF" size="small" />
            ) : (
              <Text style={styles.postButtonText}>POST</Text>
            )}
          </LinearGradient>
        </TouchableOpacity>

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Bottom Navigation */}
      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.navButton} onPress={() => router.push('/feed')}>
          <Ionicons name="home-outline" size={26} color="#4dd0e1" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.navButton} onPress={() => router.push('/explore')}>
          <Ionicons name="compass-outline" size={26} color="#4dd0e1" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.navButton} onPress={() => router.push('/add-post')}>
          <Ionicons name="add-circle-outline" size={34} color="#4dd0e1" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.navButton} onPress={() => router.push('/happening')}>
          <Ionicons name="flame-outline" size={26} color="#4dd0e1" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.navButton} onPress={() => router.push('/profile')}>
          <Ionicons name="person-outline" size={26} color="#4dd0e1" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
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
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  headerRight: {
    width: 32,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  mediaBox: {
    width: '100%',
    height: 280,
    backgroundColor: '#FFF',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#E5E5E5',
    borderStyle: 'dashed',
  },
  uploadPrompt: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadText: {
    fontSize: 16,
    color: '#666',
    marginTop: 12,
    fontWeight: '500',
  },
  uploadSubText: {
    fontSize: 13,
    color: '#999',
    marginTop: 4,
  },
  mediaPreview: {
    flex: 1,
    position: 'relative',
  },
  mediaImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  videoPreview: {
    flex: 1,
  },
  videoGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFF',
    marginTop: 8,
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
  changeMediaText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  ratingContainer: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  ratingNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  starsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  starButton: {
    padding: 2,
  },
  reviewInput: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    fontSize: 15,
    color: '#333',
    minHeight: 120,
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  linkInput: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    fontSize: 15,
    color: '#333',
    borderWidth: 1,
    borderColor: '#E5E5E5',
    marginBottom: 12,
  },
  mapsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    gap: 8,
  },
  mapsButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#4ECDC4',
  },
  mapsButtonTextDisabled: {
    color: '#CCC',
  },
  postButtonContainer: {
    marginTop: 12,
  },
  postButton: {
    paddingVertical: 18,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  postButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFF',
    letterSpacing: 1,
  },
  bottomSpacer: {
    height: 20,
  },
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  navButton: {
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
});