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
  Modal,
  KeyboardAvoidingView,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Video, ResizeMode } from 'expo-av';
import { createPost, createRestaurantPost, createMenuItem } from '../utils/api';
import { useLevelAnimation } from '../context/LevelContext';
import { useAuth } from '../context/AuthContext';
import PointsEarnedAnimation from '../components/PointsEarnedAnimation';
import axios from 'axios';

export default function AddPostScreen() {
  const router = useRouter();
  const { mode } = useLocalSearchParams();  // Get mode from params
  const { showLevelUpAnimation } = useLevelAnimation();
  const auth = useAuth() as any;
  const { refreshUser, accountType } = auth;
  
  // Post mode (for restaurants only)
  const [postMode, setPostMode] = useState<'post' | 'menu'>(
    mode === 'menu' ? 'menu' : 'post'
  );
  const [itemName, setItemName] = useState('');
  const [price, setPrice] = useState('');

  const [mediaUri, setMediaUri] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'image' | 'video' | null>(null);
  const [rating, setRating] = useState('');
  const [review, setReview] = useState('');

  const [locationName, setLocationName] = useState('');
  const [mapsLink, setMapsLink] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const [showCategoryModal, setShowCategoryModal] = useState(false);

  const [loading, setLoading] = useState(false);
  const [showPointsAnimation, setShowPointsAnimation] = useState(false);
  const [pointsEarned, setPointsEarned] = useState(0);

  // Tag Restaurant - Only for regular users
  const [taggedRestaurant, setTaggedRestaurant] = useState<any>(null);
  const [restaurantSearchQuery, setRestaurantSearchQuery] = useState('');
  const [restaurantSuggestions, setRestaurantSuggestions] = useState<any[]>([]);
  const [showRestaurantSuggestions, setShowRestaurantSuggestions] = useState(false);
  const [loadingRestaurants, setLoadingRestaurants] = useState(false);

  const [locationSuggestions, setLocationSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);


  // Categories list
  const CATEGORIES = [
    'Vegetarian/Vegan',
    'Non vegetarian',
    'Biryani',
    'Desserts',
    'SeaFood',
    'Chinese',
    'Chaats',
    'Arabic',
    'BBQ/Tandoor',
    'Fast Food',
    'Tea/Coffee',
    'Salad',
    'Karnataka Style',
    'Hyderabadi Style',
    'Kerala Style',
    'Andhra Style',
    'North Indian Style',
    'South Indian Style',
    'Punjabi Style',
    'Bengali Style',
    'Odia Style',
    'Gujurati Style',
    'Rajasthani Style',
    'Mangaluru Style',
    'Goan',
    'Kashmiri',
    'Continental',
    'Italian',
    'Japanese',
    'Korean',
    'Mexican',
    'Persian',
    'Drinks / sodas',
  ];

  // ------------------------------ MEDIA PICKERS ------------------------------

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission Required', 'Enable gallery permissions to continue.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      aspect: [4, 5],
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
      aspect: [4, 5],
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
    if (Platform.OS === 'web') {
      pickImageOrVideo();
    } else {
      Alert.alert('Add Media', 'Choose an option:', [
        { text: 'Take Photo', onPress: takePhoto },
        { text: 'Choose Photo', onPress: pickImage },
        { text: 'Choose Video (max 15s)', onPress: pickVideo },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  };

  const pickImageOrVideo = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        allowsEditing: true,
        aspect: [4, 5],
        quality: 0.8,
        videoMaxDuration: 15,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        
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

  // ------------------------------ CATEGORY TOGGLE ------------------------------

  const toggleCategory = (item: string) => {
    setCategories(prev => 
      prev.includes(item) 
        ? prev.filter(c => c !== item)  // Remove if already selected
        : [...prev, item]               // Add if not selected
    );
  };

  // ------------------------------ POST SUBMISSION ------------------------------

const handlePost = async () => {
  if (!mediaUri || !mediaType) {
    Alert.alert('Media Required', 'Please add a photo or video.');
    return;
  }

  // ========== MENU ITEM MODE ==========
  if (accountType === 'restaurant' && postMode === 'menu') {
    if (!itemName.trim()) {
      Alert.alert('Item Name Required', 'Please enter the item name.');
      return;
    }
    if (!price.trim()) {
      Alert.alert('Price Required', 'Please enter a price.');
      return;
    }

    setLoading(true);

    try {
      let fileToUpload;

      if (Platform.OS === 'web') {
        const response = await fetch(mediaUri);
        const blob = await response.blob();
        const ext = mediaType === 'video' ? 'mp4' : 'jpg';
        const filename = `menu_${Date.now()}.${ext}`;
        fileToUpload = new File([blob], filename, {
          type: mediaType === 'video' ? 'video/mp4' : 'image/jpeg',
        });
      } else {
        const name = mediaUri.split('/').pop() || `menu_${Date.now()}`;
        fileToUpload = {
          uri: mediaUri,
          name,
          type: mediaType === 'video' ? 'video/mp4' : 'image/jpeg',
        };
      }

      const menuData = {
        item_name: itemName.trim(),
        price: price.trim(),
        description: review.trim() || undefined,
        category: categories.length > 0 ? categories.join(', ') : undefined,
        media_type: mediaType,
        file: fileToUpload,
      };

      console.log('📤 Creating menu item:', menuData);
      await createMenuItem(menuData);

      setLoading(false);
      Alert.alert('Success', 'Menu item added successfully!', [
        { text: 'OK', onPress: () => router.replace('/profile') }
      ]);
      return;

    } catch (error: any) {
      console.error('❌ Error creating menu item:', error);
      setLoading(false);
      Alert.alert('Error', error?.message || 'Failed to create menu item.');
      return;
    }
  }

  // ========== REGULAR POST MODE ==========
  let numericRating = 0;
  
  if (accountType !== 'restaurant') {
    numericRating = parseInt(rating, 10);
    if (!numericRating || numericRating < 1 || numericRating > 10) {
      Alert.alert('Rating Required', 'Please add a rating between 1-10.');
      return;
    }
  }

  if (accountType === 'restaurant') {
    if (!price.trim()) {
      Alert.alert('Price Required', 'Please enter a price.');
      return;
    }
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

    let result;

    if (accountType === 'restaurant') {
      const postData = {
        price: price.trim(),
        about: review.trim(),
        map_link: mapsLink.trim(),
        location_name: locationName.trim(),
        category: categories.length > 0 ? categories.join(', ') : undefined,
        file: fileToUpload,
        media_type: mediaType,
      };

      console.log('📤 Sending restaurant post:', postData);
      result = await createRestaurantPost(postData);
      
      setLoading(false);
      Alert.alert('Success', 'Post created successfully!', [
        { text: 'OK', onPress: () => router.replace('/feed') }
      ]);
      return;

    } else {
      const postData = {
        rating: numericRating,
        review_text: review.trim(),
        map_link: mapsLink.trim(),
        location_name: locationName.trim(),
        category: categories.length > 0 ? categories.join(', ') : undefined,
        tagged_restaurant_id: taggedRestaurant?.id || undefined, 
        file: fileToUpload,
        media_type: mediaType,
      };

      console.log('📤 Sending user post with categories:', categories);
      result = await createPost(postData);
    }

    setLoading(false);
    await refreshUser();

    const oldLevel = auth?.user?.level || 1;
    await new Promise(resolve => setTimeout(resolve, 100));

    const userResponse = await axios.get(
      `${process.env.EXPO_PUBLIC_BACKEND_URL || 'https://api.cofau.com'}/api/auth/me`,
      { headers: { Authorization: `Bearer ${auth?.token}` } }
    );
    const updatedUser = userResponse.data;
    const newLevel = updatedUser?.level || oldLevel;

    let earnedPoints = 25;
    if (oldLevel >= 5 && oldLevel <= 8) {
      earnedPoints = 15;
    } else if (oldLevel >= 9 && oldLevel <= 12) {
      earnedPoints = 5;
    }

    const leveledUp = newLevel > oldLevel;

    if (leveledUp) {
      showLevelUpAnimation(newLevel);
      setTimeout(() => router.replace('/feed'), 3000);
      return;
    }

    if (earnedPoints > 0) {
      setPointsEarned(earnedPoints);
      setShowPointsAnimation(true);
      setTimeout(() => {
        setShowPointsAnimation(false);
        router.replace('/feed');
      }, 3000);
    } else {
      setTimeout(() => router.replace('/feed'), 500);
    }

  } catch (error: any) {
    console.error('❌ Error creating post:', error);
    setLoading(false);
    Alert.alert('Error', error?.response?.data?.detail || 'Failed to create post.');
  }
};

  // ------------------------------ LOCATION SUGGESTIONS ------------------------------

const fetchLocationSuggestions = async (text: string) => {
  if (!text || text.trim().length < 2) {
    setLocationSuggestions([]);
    setShowSuggestions(false);
    return;
  }

  setLoadingSuggestions(true);
  try {
    const response = await axios.get(
      `${process.env.EXPO_PUBLIC_BACKEND_URL || 'https://api.cofau.com'}/api/locations/suggestions`,
      {
        params: { q: text.trim(), limit: 5 },
        headers: { Authorization: `Bearer ${auth?.token}` },
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

// Debounce function for location search
const debounceTimeout = React.useRef<NodeJS.Timeout | null>(null);

const handleLocationNameChange = (text: string) => {
  setLocationName(text);
  setMapsLink(''); // Clear map link when typing new location

  // Debounce API call
  if (debounceTimeout.current) {
    clearTimeout(debounceTimeout.current);
  }

  debounceTimeout.current = setTimeout(() => {
    fetchLocationSuggestions(text);
  }, 300); // 300ms debounce
};

// ------------------------------ RESTAURANT SEARCH ------------------------------

const restaurantDebounceTimeout = React.useRef<NodeJS.Timeout | null>(null);

const fetchRestaurantSuggestions = async (text: string) => {
  if (!text || text.trim().length < 2) {
    setRestaurantSuggestions([]);
    setShowRestaurantSuggestions(false);
    return;
  }

  setLoadingRestaurants(true);
  try {
    const response = await axios.get(
      `${process.env.EXPO_PUBLIC_BACKEND_URL || 'https://api.cofau.com'}/api/restaurants/search`,
      {
        params: { q: text.trim(), limit: 5 },
        headers: { Authorization: `Bearer ${auth?.token}` },
      }
    );

    if (response.data && response.data.length > 0) {
      setRestaurantSuggestions(response.data);
      setShowRestaurantSuggestions(true);
    } else {
      setRestaurantSuggestions([]);
      setShowRestaurantSuggestions(false);
    }
  } catch (error) {
    console.log('Error fetching restaurant suggestions:', error);
    setRestaurantSuggestions([]);
    setShowRestaurantSuggestions(false);
  } finally {
    setLoadingRestaurants(false);
  }
};

const handleRestaurantSearchChange = (text: string) => {
  setRestaurantSearchQuery(text);

  if (restaurantDebounceTimeout.current) {
    clearTimeout(restaurantDebounceTimeout.current);
  }

  restaurantDebounceTimeout.current = setTimeout(() => {
    fetchRestaurantSuggestions(text);
  }, 300);
};

const selectRestaurant = (restaurant: any) => {
  setTaggedRestaurant(restaurant);
  setRestaurantSearchQuery('');
  setShowRestaurantSuggestions(false);
  setRestaurantSuggestions([]);
};

const removeTaggedRestaurant = () => {
  setTaggedRestaurant(null);
};

  // ------------------------------ UI ------------------------------

return (
  <View style={styles.container}>
    {/* Header */}
    <View style={styles.header}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
        <Ionicons name="arrow-back" size={24} color="#333" />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>
  {accountType === 'restaurant' && postMode === 'menu' ? 'Add Menu Item' : 'Add Post'}
</Text>
      <View style={styles.headerRight} />
    </View>

    <KeyboardAvoidingView 
      style={{ flex: 1 }} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >

      {/* Post Type Toggle - Only for Restaurants */}
{accountType === 'restaurant' && (
  <View style={styles.postTypeToggle}>
    <TouchableOpacity
      style={[
        styles.postTypeButton,
        postMode === 'post' && styles.postTypeButtonActive
      ]}
      onPress={() => setPostMode('post')}
    >
      <Ionicons 
        name="image-outline" 
        size={20} 
        color={postMode === 'post' ? '#FFF' : '#666'} 
      />
      <Text style={[
        styles.postTypeText,
        postMode === 'post' && styles.postTypeTextActive
      ]}>
        Post
      </Text>
    </TouchableOpacity>
    
    <TouchableOpacity
      style={[
        styles.postTypeButton,
        postMode === 'menu' && styles.postTypeButtonActive
      ]}
      onPress={() => setPostMode('menu')}
    >
      <Ionicons 
        name="restaurant-outline" 
        size={20} 
        color={postMode === 'menu' ? '#FFF' : '#666'} 
      />
      <Text style={[
        styles.postTypeText,
        postMode === 'menu' && styles.postTypeTextActive
      ]}>
        Menu Item
      </Text>
    </TouchableOpacity>
  </View>
)}
      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >

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


        {/* Item Name - Only for Menu Mode */}
{accountType === 'restaurant' && postMode === 'menu' && (
  <View style={styles.section}>
    <Text style={styles.sectionLabel}>Item Name *</Text>
    <TextInput
      style={styles.linkInput}
      placeholder="e.g., Margherita Pizza, Chicken Biryani"
      placeholderTextColor="#999"
      value={itemName}
      onChangeText={setItemName}
    />
  </View>
)}

        {/* Rating - Only for Users */}
{accountType !== 'restaurant' && (
  <View style={styles.section}>
    <Text style={styles.sectionLabel}>Rating</Text>
    <View style={styles.ratingContainer}>
      <Text style={styles.ratingNumber}>{rating || '0'} / 10</Text>
      <View style={styles.starsContainer}>
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
          <TouchableOpacity key={num} onPress={() => setRating(num.toString())}>
            <Ionicons
              name={parseInt(rating) >= num ? 'star' : 'star-outline'}
              size={28}
              color={parseInt(rating) >= num ? '#F2CF68' : '#CCC'}
              style={{ marginRight: 4, marginBottom: 4 }}
            />
          </TouchableOpacity>
        ))}
      </View>
    </View>
  </View>
)}

{/* Price - Only for Restaurants */}
{accountType === 'restaurant' && (
  <View style={styles.section}>
    <Text style={styles.sectionLabel}>Price</Text>
    <TextInput
      style={styles.linkInput}
      placeholder="Enter price (e.g., ₹250, Free, $15-20)"
      placeholderTextColor="#999"
      value={price}
      onChangeText={setPrice}
    />
  </View>
)}

        {/* Review */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>
  {accountType === 'restaurant' && postMode === 'menu' 
    ? 'Description (Optional)' 
    : accountType === 'restaurant' 
      ? 'About' 
      : 'Review'}
</Text>
          <TextInput
            style={styles.reviewInput}
            placeholder={
  accountType === 'restaurant' && postMode === 'menu'
    ? 'Describe this dish (ingredients, taste, etc.)'
    : accountType === 'restaurant' 
      ? 'Write about this dish...' 
      : 'Write your review...'
}
            placeholderTextColor="#999"
            value={review}
            onChangeText={setReview}
            multiline
          />
        </View>

        {/* CATEGORY (OPTIONAL) - MULTI-SELECT */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Categories (Optional)</Text>
          <TouchableOpacity 
            style={styles.categoryButton}
            onPress={() => setShowCategoryModal(true)}
          >
            <View style={styles.categoryButtonContent}>
              <Ionicons name="fast-food-outline" size={20} color="#666" />
              <Text 
                style={[
                  styles.categoryButtonText, 
                  categories.length > 0 && styles.categoryButtonTextSelected
                ]}
                numberOfLines={2}
              >
                {categories.length > 0 ? categories.join(', ') : 'Select Categories'}
              </Text>
              <Ionicons name="chevron-down" size={20} color="#666" />
            </View>
          </TouchableOpacity>
          
          {/* Selected Categories Tags */}
          {categories.length > 0 && (
            <View style={styles.selectedTagsContainer}>
              {categories.map((cat) => (
                <View key={cat} style={styles.selectedTag}>
                  <Text style={styles.selectedTagText}>{cat}</Text>
                  <TouchableOpacity onPress={() => toggleCategory(cat)}>
                    <Ionicons name="close-circle" size={18} color="#666" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
          
          {categories.length > 0 && (
            <TouchableOpacity 
              style={styles.clearCategoryButton}
              onPress={() => setCategories([])}
            >
              <Text style={styles.clearCategoryText}>Clear All Categories</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* TAG A RESTAURANT - Only for Regular Users */}
{accountType !== 'restaurant' && (
  <View style={styles.section}>
    <Text style={styles.sectionLabel}>Tag a Restaurant (Optional)</Text>
    
    {taggedRestaurant ? (
      <View style={styles.taggedRestaurantContainer}>
        <View style={styles.taggedRestaurantInfo}>
          <Ionicons name="restaurant" size={20} color="#1B7C82" />
          <Text style={styles.taggedRestaurantName}>
            {taggedRestaurant.restaurant_name}
          </Text>
        </View>
        <TouchableOpacity onPress={removeTaggedRestaurant}>
          <Ionicons name="close-circle" size={24} color="#E94A37" />
        </TouchableOpacity>
      </View>
    ) : (
      <View style={styles.restaurantSearchContainer}>
        <TextInput
          style={styles.linkInput}
          placeholder="Search restaurant to tag..."
          placeholderTextColor="#999"
          value={restaurantSearchQuery}
          onChangeText={handleRestaurantSearchChange}
        />
        
        {loadingRestaurants && (
          <ActivityIndicator 
            size="small" 
            color="#4ECDC4" 
            style={styles.restaurantLoader} 
          />
        )}

        {showRestaurantSuggestions && restaurantSuggestions.length > 0 && (
          <View style={styles.restaurantSuggestionsContainer}>
            {restaurantSuggestions.map((restaurant, index) => (
              <TouchableOpacity
                key={restaurant.id || index}
                style={styles.restaurantSuggestionItem}
                onPress={() => selectRestaurant(restaurant)}
              >
                <View style={styles.restaurantSuggestionContent}>
                  <Ionicons name="restaurant" size={18} color="#1B7C82" />
                  <View style={styles.restaurantSuggestionTextContainer}>
                    <Text style={styles.restaurantSuggestionName}>
                      {restaurant.restaurant_name}
                    </Text>
                    {restaurant.bio && (
                      <Text style={styles.restaurantSuggestionBio} numberOfLines={1}>
                        {restaurant.bio}
                      </Text>
                    )}
                  </View>
                </View>
                <Ionicons name="add-circle" size={22} color="#4ECDC4" />
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    )}
  </View>
)}

        {/* FREE GOOGLE MAPS LOCATION */}
        {!(accountType === 'restaurant' && postMode === 'menu') && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Location (Google Maps)</Text>

          <View style={styles.locationInputContainer}>
            <TextInput
              style={styles.linkInput}
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
                color="#4ECDC4" 
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
                      <Ionicons name="location" size={18} color="#4ECDC4" />
                      <View style={styles.suggestionTextContainer}>
                        <Text style={styles.suggestionName}>{suggestion.location_name}</Text>
                        <Text style={styles.suggestionMeta}>
                          {suggestion.post_count} post{suggestion.post_count !== 1 ? 's' : ''} • {suggestion.similarity_score}% match
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
                  <Text style={styles.suggestionNewText}>Add "{locationName}" as new location</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          <TouchableOpacity style={styles.mapsButton} onPress={generateMapsLink}>
            <Ionicons name="map" size={20} color="#4ECDC4" />
            <Text style={styles.mapsButtonText}>Generate Google Maps Link</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.mapsButton, !mapsLink && styles.mapsButtonDisabled]} 
            onPress={openMaps}
            disabled={!mapsLink}
          >
            <Ionicons name="location" size={20} color={mapsLink ? "#4ECDC4" : "#CCC"} />
            <Text style={[styles.mapsButtonText, !mapsLink && styles.mapsButtonTextDisabled]}>
              Verify Location
            </Text>
            <Ionicons name="chevron-forward" size={20} color={mapsLink ? "#4ECDC4" : "#CCC"} />
          </TouchableOpacity>
        </View>
        )}

        {/* POST BUTTON */}
        <TouchableOpacity
          style={styles.postButtonContainer}
          onPress={handlePost}
          disabled={loading}
        >
          <LinearGradient
            colors={['#E94A37', '#F2CF68', '#1B7C82']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
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
    </KeyboardAvoidingView>

    {/* Points Earned Animation */}
    <PointsEarnedAnimation
      visible={showPointsAnimation}
      pointsEarned={pointsEarned}
      onClose={() => {
        setShowPointsAnimation(false);
        router.push('/feed');
      }}
    />

    {/* Category Selection Modal - MULTI-SELECT */}
    <Modal
      visible={showCategoryModal}
      transparent={true}
      animationType="slide"
      onRequestClose={() => setShowCategoryModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.categoryModal}>
          <View style={styles.categoryModalHeader}>
            <Text style={styles.categoryModalTitle}>Select Categories</Text>
            <TouchableOpacity onPress={() => setShowCategoryModal(false)}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>
          
          {/* Selected Count */}
          {categories.length > 0 && (
            <View style={styles.selectedCountContainer}>
              <Text style={styles.selectedCountText}>
                {categories.length} selected
              </Text>
            </View>
          )}
          
          <FlatList
            data={CATEGORIES}
            keyExtractor={(item) => item}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.categoryItem,
                  categories.includes(item) && styles.categoryItemSelected
                ]}
                onPress={() => toggleCategory(item)}
              >
                <Text style={[
                  styles.categoryItemText,
                  categories.includes(item) && styles.categoryItemTextSelected
                ]}>
                  {item}
                </Text>
                {categories.includes(item) ? (
                  <Ionicons name="checkmark-circle" size={24} color="#4ECDC4" />
                ) : (
                  <Ionicons name="ellipse-outline" size={24} color="#CCC" />
                )}
              </TouchableOpacity>
            )}
            contentContainerStyle={styles.categoryList}
          />
          
          {/* Done Button */}
          <View style={styles.modalFooter}>
            <TouchableOpacity 
              style={styles.doneButton}
              onPress={() => setShowCategoryModal(false)}
            >
              <Text style={styles.doneButtonText}>
                Done {categories.length > 0 ? `(${categories.length})` : ''}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  </View>
);
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },

  header: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  paddingHorizontal: 16,
  paddingTop: 50,      // ⬅️ ADD THIS (adjust value: 40-60 depending on your device)
  paddingBottom: 12,   // ⬅️ CHANGE paddingVertical to paddingBottom
  backgroundColor: '#FFF',
  borderBottomWidth: 1,
  borderBottomColor: '#E0E0E0',
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

  // Post Type Toggle Styles
postTypeToggle: {
  flexDirection: 'row',
  backgroundColor: '#F0F0F0',
  borderRadius: 12,
  padding: 4,
  marginHorizontal: 16,
  marginTop: 12,
  marginBottom: 8,
},
postTypeButton: {
  flex: 1,
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  paddingVertical: 12,
  borderRadius: 10,
  gap: 8,
},
postTypeButtonActive: {
  backgroundColor: '#1B7C82',
},
postTypeText: {
  fontSize: 15,
  fontWeight: '600',
  color: '#666',
},
postTypeTextActive: {
  color: '#FFF',
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
    color: '#1B7C82',
  },

  postButtonContainer: { marginTop: 10 },
  postButton: {
    paddingVertical: 18,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  postButtonText: { color: '#FFF', fontSize: 18, fontWeight: 'bold' },

  // Category Styles
  categoryButton: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  categoryButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  categoryButtonText: {
    flex: 1,
    fontSize: 15,
    color: '#999',
  },
  categoryButtonTextSelected: {
    color: '#333',
    fontWeight: '600',
  },
  
  // Selected Tags
  selectedTagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 12,
    gap: 8,
  },
  // Tag Restaurant Styles
taggedRestaurantContainer: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  backgroundColor: '#F0F9F9',
  borderRadius: 12,
  padding: 14,
  borderWidth: 1,
  borderColor: '#1B7C82',
},
taggedRestaurantInfo: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 10,
  flex: 1,
},
taggedRestaurantName: {
  fontSize: 15,
  fontWeight: '600',
  color: '#1B7C82',
},
restaurantSearchContainer: {
  position: 'relative',
  zIndex: 999,
},
restaurantLoader: {
  position: 'absolute',
  right: 16,
  top: 18,
},
restaurantSuggestionsContainer: {
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
restaurantSuggestionItem: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  paddingVertical: 12,
  paddingHorizontal: 16,
  borderBottomWidth: 1,
  borderBottomColor: '#F0F0F0',
},
restaurantSuggestionContent: {
  flexDirection: 'row',
  alignItems: 'center',
  flex: 1,
  gap: 12,
},
restaurantSuggestionTextContainer: {
  flex: 1,
},
restaurantSuggestionName: {
  fontSize: 15,
  fontWeight: '600',
  color: '#333',
},
restaurantSuggestionBio: {
  fontSize: 12,
  color: '#999',
  marginTop: 2,
},
  selectedTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF5E6',
    borderRadius: 20,
    paddingVertical: 6,
    paddingLeft: 12,
    paddingRight: 8,
    gap: 6,
    borderWidth: 1,
    borderColor: '#F2CF68',
  },
  selectedTagText: {
    fontSize: 13,
    color: '#333',
    fontWeight: '500',
  },
  
  clearCategoryButton: {
    marginTop: 12,
    alignSelf: 'flex-start',
  },
  clearCategoryText: {
    fontSize: 14,
    color: '#E94A37',
    fontWeight: '600',
  },

  // Location Suggestions Styles
locationInputContainer: {
  position: 'relative',
  zIndex: 1000,
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

  // Category Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  categoryModal: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  categoryModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  categoryModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  mapsButtonDisabled: {
  backgroundColor: '#F5F5F5',
  borderColor: '#E0E0E0',
},

mapsButtonTextDisabled: {
  color: '#CCC',
},
  selectedCountContainer: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#F0F9F9',
  },
  selectedCountText: {
    fontSize: 14,
    color: '#4ECDC4',
    fontWeight: '600',
  },
  categoryList: {
    padding: 12,
  },
  categoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: '#F9F9F9',
  },
  categoryItemSelected: {
    backgroundColor: '#F9F9F9',
    borderWidth: 2,
    borderColor: '#F2CF68',
  },
  categoryItemText: {
    fontSize: 16,
    color: '#333',
  },
  categoryItemTextSelected: {
    fontWeight: '600',
    color: '#4ECDC4',
  },
  
  // Modal Footer
  modalFooter: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
  },
  doneButton: {
    backgroundColor: '#1B7C82',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  doneButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});