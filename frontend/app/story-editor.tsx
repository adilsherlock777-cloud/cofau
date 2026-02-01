// app/story-upload/editor.tsx
import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TextInput,
  TouchableOpacity,
  Alert,
  ScrollView,
  ActivityIndicator,
  Platform,
  Linking,
  KeyboardAvoidingView,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { BACKEND_URL } from '../utils/imageUrlFix';

const API_URL = `${BACKEND_URL}/api`;

export default function StoryEditorScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { token } = useAuth();

  // Get the image URI passed from the upload screen
  const [imageUri, setImageUri] = useState<string>(params.imageUri as string || '');
  const [mediaType, setMediaType] = useState<string>(params.mediaType as string || 'image');

  // Location states (optional)
  const [locationName, setLocationName] = useState('');
  const [mapsLink, setMapsLink] = useState('');
  const [showLocationInput, setShowLocationInput] = useState(false);

  // Location suggestions
  const [locationSuggestions, setLocationSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  // Loading states
  const [uploading, setUploading] = useState(false);

  // Debounce ref for location search
  const debounceTimeout = useRef<NodeJS.Timeout | null>(null);

  const [hasSubmitted, setHasSubmitted] = useState(false);
  const uploadLockRef = useRef(false);


 

  // ============================
  // LOCATION SUGGESTIONS
  // ============================
  const fetchLocationSuggestions = async (text: string) => {
    if (!text || text.trim().length < 2) {
      setLocationSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    setLoadingSuggestions(true);
    try {
      const response = await axios.get(
        `${API_URL}/locations/suggestions`,
        {
          params: { q: text.trim(), limit: 5 },
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.data && response.data.length > 0) {
        setLocationSuggestions(response.data);
        setShowSuggestions(true);
      } else {
        setLocationSuggestions([]);
        setShowSuggestions(false);
      }
    } catch (error) {
      console.log('Error fetching suggestions:', error);
      setLocationSuggestions([]);
      setShowSuggestions(false);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const selectLocationSuggestion = (suggestion: any) => {
    setLocationName(suggestion.location_name);
    if (suggestion.map_link) {
      setMapsLink(suggestion.map_link);
    }
    setShowSuggestions(false);
    setLocationSuggestions([]);
  };

  const handleLocationNameChange = (text: string) => {
    setLocationName(text);
    setMapsLink('');

    if (debounceTimeout.current) {
      clearTimeout(debounceTimeout.current);
    }

    debounceTimeout.current = setTimeout(() => {
      fetchLocationSuggestions(text);
    }, 300);
  };

  // ============================
  // GENERATE GOOGLE MAPS LINK
  // ============================
  const generateMapsLink = () => {
    if (!locationName.trim()) {
      Alert.alert('Location Required', 'Please type a location name first.');
      return;
    }

    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
      locationName.trim()
    )}`;

    setMapsLink(url);
    Alert.alert('Success', 'Google Maps link generated!');
  };

  const openMaps = () => {
    if (!mapsLink) {
      Alert.alert('No Link', 'Please generate or paste a Google Maps link first.');
      return;
    }
    Linking.openURL(mapsLink);
  };

  // ============================
  // UPLOAD STORY
  // ============================
const handlePostStory = async () => {
  if (!imageUri) {
    Alert.alert('Error', 'No image selected');
    return;
  }

  // 🔒 Hard lock (prevents all race conditions)
  if (uploadLockRef.current) {
    console.log("⚠️ Upload blocked (already in progress)");
    return;
  }

  uploadLockRef.current = true;
  setUploading(true);
  try {
    const formData = new FormData();

    // Prepare file
    const filename = imageUri.split('/').pop() || `story_${Date.now()}.jpg`;
    const match = /\.(\w+)$/.exec(filename);
    const type = mediaType === 'video'
      ? 'video/mp4'
      : match ? `image/${match[1]}` : 'image/jpeg';

    formData.append('file', {
      uri: imageUri,
      name: filename,
      type,
    } as any);

    // Build URL with query parameters for location (FastAPI Form fields)
    let uploadUrl = `${API_URL}/stories/upload`;
    const queryParams: string[] = [];
    
    if (locationName.trim()) {
      queryParams.push(`location_name=${encodeURIComponent(locationName.trim())}`);
    }
    if (mapsLink.trim()) {
      queryParams.push(`map_link=${encodeURIComponent(mapsLink.trim())}`);
    }
    
    if (queryParams.length > 0) {
      uploadUrl += `?${queryParams.join('&')}`;
    }

    console.log('📤 Uploading story to:', uploadUrl);

    const response = await axios.post(
      uploadUrl,
      formData,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
      }
    );

    console.log('✅ Story uploaded:', response.data);

    router.replace('/feed');
  } catch (error: any) {
    console.error('❌ Error uploading story:', error.response?.data || error.message);
    Alert.alert('Error', error.response?.data?.detail || 'Failed to upload story');
  } finally {
    setUploading(false);
  }
};

  // ============================
  // UI
  // ============================
return (
  <KeyboardAvoidingView 
    style={styles.container}
    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
  >
    {/* Header */}
    <View style={styles.header}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
        <Ionicons name="arrow-back" size={24} color="#333" />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>New Story</Text>
      <View style={styles.headerRight} />
    </View>

    <ScrollView 
      style={styles.scrollView} 
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
    >
      {/* Image Preview */}
      <View style={styles.imagePreviewContainer}>
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={styles.imagePreview} />
        ) : (
          <View style={styles.noImageContainer}>
            <Ionicons name="image-outline" size={60} color="#CCC" />
            <Text style={styles.noImageText}>No image selected</Text>
          </View>
        )}
      </View>

      {/* Add Location Toggle */}
      <TouchableOpacity
        style={styles.addLocationToggle}
        onPress={() => setShowLocationInput(!showLocationInput)}
      >
        <View style={styles.addLocationLeft}>
          <Ionicons
            name="location-outline"
            size={22}
            color={showLocationInput ? '#FF9A4D' : '#666'}
          />
          <Text
            style={[
              styles.addLocationText,
              showLocationInput && styles.addLocationTextActive,
            ]}
          >
            {locationName ? locationName : 'Add Location (Optional)'}
          </Text>
        </View>
        <Ionicons
          name={showLocationInput ? 'chevron-up' : 'chevron-down'}
          size={20}
          color="#666"
        />
      </TouchableOpacity>

      {/* Location Input Section */}
      {showLocationInput && (
        <View style={styles.locationSection}>
          {/* Location Name Input */}
          <View style={styles.locationInputContainer}>
            <TextInput
              style={styles.locationInput}
              placeholder="Type place name (e.g., Starbucks MG Road)"
              placeholderTextColor="#999"
              value={locationName}
              onChangeText={handleLocationNameChange}
              onFocus={() => {
                if (locationSuggestions.length > 0) {
                  setShowSuggestions(true);
                }
              }}
            />

            {loadingSuggestions && (
              <ActivityIndicator
                size="small"
                color="#FF9A4D"
                style={styles.suggestionLoader}
              />
            )}

            {/* Location Suggestions Dropdown */}
            {showSuggestions && locationSuggestions.length > 0 && (
              <View style={styles.suggestionsContainer}>
                <Text style={styles.suggestionsTitle}>Did you mean?</Text>
                {locationSuggestions.map((suggestion, index) => (
                  <TouchableOpacity
                    key={index}
                    style={styles.suggestionItem}
                    onPress={() => selectLocationSuggestion(suggestion)}
                  >
                    <View style={styles.suggestionContent}>
                      <Ionicons name="location" size={18} color="#FF9A4D" />
                      <View style={styles.suggestionTextContainer}>
                        <Text style={styles.suggestionName}>
                          {suggestion.location_name}
                        </Text>
                        <Text style={styles.suggestionMeta}>
                          {suggestion.post_count} post
                          {suggestion.post_count !== 1 ? 's' : ''} •{' '}
                          {suggestion.similarity_score}% match
                        </Text>
                      </View>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color="#CCC" />
                  </TouchableOpacity>
                ))}
                <TouchableOpacity
                  style={styles.suggestionItemNew}
                  onPress={() => {
                    setShowSuggestions(false);
                    setLocationSuggestions([]);
                  }}
                >
                  <Ionicons name="add-circle-outline" size={18} color="#666" />
                  <Text style={styles.suggestionNewText}>
                    Add "{locationName}" as new location
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Generate Maps Link Button */}
          <TouchableOpacity style={styles.mapsButton} onPress={generateMapsLink}>
            <Ionicons name="map" size={20} color="#FF9A4D" />
            <Text style={styles.mapsButtonText}>Generate Google Maps Link</Text>
          </TouchableOpacity>


          {/* Verify Location */}
<TouchableOpacity
  style={[styles.mapsButton, !mapsLink && styles.mapsButtonDisabled]}
  onPress={openMaps}
  disabled={!mapsLink}
>
  <Ionicons name="location" size={20} color={mapsLink ? "#FF9A4D" : "#CCC"} />
  <Text style={[styles.mapsButtonText, !mapsLink && styles.mapsButtonTextDisabled]}>
    Verify Location
  </Text>
  <Ionicons name="chevron-forward" size={20} color={mapsLink ? "#FF9A4D" : "#CCC"} />
</TouchableOpacity>
        </View>
      )}

      {/* Post Button */}
      <TouchableOpacity
        style={styles.postButtonContainer}
        onPress={handlePostStory}
        disabled={uploading}
      >
        <LinearGradient
          colors={['#FF2E2E', '#F2CF68', '#FF9A4D']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.postButton}
        >
          {uploading ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <Text style={styles.postButtonText}>POST STORY</Text>
          )}
        </LinearGradient>
      </TouchableOpacity>
    </ScrollView>
  </KeyboardAvoidingView>
);
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 12,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
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
    padding: 16,
  },
  imagePreviewContainer: {
    width: '100%',
    height: 400,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#000',
    marginBottom: 20,
  },
  imagePreview: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
  },
  noImageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#E5E5E5',
  },
  noImageText: {
    marginTop: 12,
    fontSize: 16,
    color: '#999',
  },
  cropButton: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 25,
    gap: 8,
  },
  cropButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  addLocationToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  addLocationLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  addLocationText: {
    fontSize: 15,
    color: '#666',
  },
  addLocationTextActive: {
    color: '#FF9A4D',
    fontWeight: '600',
  },
  locationSection: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  locationInputContainer: {
    position: 'relative',
    zIndex: 1000,
  },
  locationInput: {
    backgroundColor: '#F9F9F9',
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    fontSize: 15,
  },
  suggestionLoader: {
    position: 'absolute',
    right: 16,
    top: 18,
  },
  suggestionsContainer: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    marginTop: -8,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  suggestionsTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    backgroundColor: '#F9F9F9',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  mapsButtonDisabled: {
  backgroundColor: '#F5F5F5',
},
mapsButtonTextDisabled: {
  color: '#CCC',
},
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  suggestionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  suggestionTextContainer: {
    flex: 1,
  },
  suggestionName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  suggestionMeta: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  suggestionItemNew: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 12,
    backgroundColor: '#F9F9F9',
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
  },
  suggestionNewText: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
  },
  mapsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0F9F9',
    padding: 14,
    borderRadius: 10,
    marginBottom: 12,
    gap: 8,
  },
  mapsButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FF9A4D',
  },
  postButtonContainer: {
    marginTop: 10,
  },
  postButton: {
    paddingVertical: 18,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  postButtonText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
});