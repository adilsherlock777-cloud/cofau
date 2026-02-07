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
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { Video, ResizeMode } from 'expo-av';
import { createPost, createRestaurantPost } from '../utils/api';
import { useLevelAnimation } from '../context/LevelContext';
import { useAuth } from '../context/AuthContext';
import PointsEarnedAnimation from '../components/PointsEarnedAnimation';
import PostRewardModal from '../components/PostRewardModal';
import axios from 'axios';

export default function AddPostScreen() {
  const router = useRouter();
  const { showLevelUpAnimation } = useLevelAnimation();
  const auth = useAuth() as any;
  const { refreshUser, accountType } = auth;
  const [price, setPrice] = useState('');
  const [dishName, setDishName] = useState('');  // NEW: Dish name for all posts

  const [mediaUri, setMediaUri] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'image' | 'video' | null>(null);
  const [pendingMedia, setPendingMedia] = useState<{ uri: string; type: 'image' | 'video' } | null>(null);
  const [showMediaConfirm, setShowMediaConfirm] = useState(false);
  const [tasteRating, setTasteRating] = useState(0);
  const [valueRating, setValueRating] = useState(0);
  const [portionRating, setPortionRating] = useState(0);
  const [review, setReview] = useState('');

  const [locationName, setLocationName] = useState('');
  const [mapsLink, setMapsLink] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const [showCategoryModal, setShowCategoryModal] = useState(false);

  const [loading, setLoading] = useState(false);
  const [showPointsAnimation, setShowPointsAnimation] = useState(false);
  const [pointsEarned, setPointsEarned] = useState(0);
  const [showRewardModal, setShowRewardModal] = useState(false);
  const [rewardData, setRewardData] = useState(null);

  // User location state
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);

  // Tag Restaurant - Only for regular users
  const [taggedRestaurant, setTaggedRestaurant] = useState<any>(null);
  const [restaurantSearchQuery, setRestaurantSearchQuery] = useState('');
  const [restaurantSuggestions, setRestaurantSuggestions] = useState<any[]>([]);
  const [showRestaurantSuggestions, setShowRestaurantSuggestions] = useState(false);
  const [loadingRestaurants, setLoadingRestaurants] = useState(false);

  const [locationSuggestions, setLocationSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  // Grammar correction states
  const [showGrammarModal, setShowGrammarModal] = useState(false);
  const [originalReview, setOriginalReview] = useState('');
  const [correctedReview, setCorrectedReview] = useState('');
  const [grammarLoading, setGrammarLoading] = useState(false);


// Categories list with emojis
const CATEGORIES = [
  { id: 'vegetarian-vegan', name: 'Vegetarian/Vegan', emoji: '🥬' },
  { id: 'non-vegetarian', name: 'Non vegetarian', emoji: '🍖' },
  { id: 'biryani', name: 'Biryani', emoji: '🍛' },
  { id: 'desserts', name: 'Desserts', emoji: '🍰' },
  { id: 'seafood', name: 'SeaFood', emoji: '🦐' },
  { id: 'chinese', name: 'Chinese', emoji: '🍜' },
  { id: 'chaats', name: 'Chaats', emoji: '🥘' },
  { id: 'arabic', name: 'Arabic', emoji: '🧆' },
  { id: 'bbq-tandoor', name: 'BBQ/Tandoor', emoji: '🍗' },
  { id: 'fast-food', name: 'Fast Food', emoji: '🍔' },
  { id: 'tea-coffee', name: 'Tea/Coffee', emoji: '☕' },
  { id: 'salad', name: 'Salad', emoji: '🥗' },
  { id: 'karnataka-style', name: 'Karnataka Style', emoji: '🍃' },
  { id: 'hyderabadi-style', name: 'Hyderabadi Style', emoji: '🌶️' },
  { id: 'kerala-style', name: 'Kerala Style', emoji: '🥥' },
  { id: 'andhra-style', name: 'Andhra Style', emoji: '🔥' },
  { id: 'north-indian-style', name: 'North Indian Style', emoji: '🫓' },
  { id: 'south-indian-style', name: 'South Indian Style', emoji: '🥞' },
  { id: 'punjabi-style', name: 'Punjabi Style', emoji: '🧈' },
  { id: 'bengali-style', name: 'Bengali Style', emoji: '🐟' },
  { id: 'odia-style', name: 'Odia Style', emoji: '🍚' },
  { id: 'gujarati-style', name: 'Gujurati Style', emoji: '🥣' },
  { id: 'rajasthani-style', name: 'Rajasthani Style', emoji: '🏜️' },
  { id: 'mangaluru-style', name: 'Mangaluru Style', emoji: '🦀' },
  { id: 'goan', name: 'Goan', emoji: '🏖️' },
  { id: 'kashmiri', name: 'Kashmiri', emoji: '🏔️' },
  { id: 'continental', name: 'Continental', emoji: '🌍' },
  { id: 'italian', name: 'Italian', emoji: '🍝' },
  { id: 'japanese', name: 'Japanese', emoji: '🍣' },
  { id: 'korean', name: 'Korean', emoji: '🍱' },
  { id: 'mexican', name: 'Mexican', emoji: '🌮' },
  { id: 'persian', name: 'Persian', emoji: '🫖' },
  { id: 'drinks', name: 'Drinks / sodas', emoji: '🥤' },
  { id: 'pizza', name: 'Pizza', emoji: '🍕' },
  { id: 'dosa', name: 'Dosa', emoji: '🫕' },
  { id: 'cafe', name: 'Cafe', emoji: '🧁' },
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
    allowsEditing: true,  // Use native free-form crop editor
    ...(Platform.OS === 'android' ? { aspect: [4, 5] } : {}),
    quality: 0.8,
  });

  if (!result.canceled && result.assets[0]) {
    setPendingMedia({ uri: result.assets[0].uri, type: 'image' });
    setShowMediaConfirm(true);
  }
};

const getAverageRating = () => {
  const total = tasteRating + valueRating + portionRating;
  if (total === 0) return 0;
  return Math.round((total / 3) * 10) / 10; // Round to 1 decimal
};

  const takePhoto = async () => {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) {
    Alert.alert('Permission Required', 'Enable camera permissions to continue.');
    return;
  }

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,  // Use native free-form crop editor
    ...(Platform.OS === 'android' ? { aspect: [4, 5] } : {}),
    quality: 0.8,
  });

  if (!result.canceled && result.assets[0]) {
    setPendingMedia({ uri: result.assets[0].uri, type: 'image' });
    setShowMediaConfirm(true);
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
      videoMaxDuration: 90,
    });

    if (!result.canceled && result.assets[0]) {
      setPendingMedia({ uri: result.assets[0].uri, type: 'video' });
      setShowMediaConfirm(true);
    }
  };

  const showMediaOptions = () => {
    if (Platform.OS === 'web') {
      pickImageOrVideo();
    } else {
      Alert.alert('Add Media', 'Choose an option:', [
        { text: 'Open Camera', onPress: takePhoto },
        { text: 'Choose from gallery', onPress: pickImage },
        { text: 'Post a Video', onPress: pickVideo },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  };

  const pickImageOrVideo = async () => {
    try {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsEditing: true,
      ...(Platform.OS === 'android' ? { aspect: [4, 5] } : {}),
      quality: 0.8,
      videoMaxDuration: 90,
    });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        const inferredType =
          asset.type === 'video' || asset.uri.includes('.mp4') || asset.uri.includes('.mov')
            ? 'video'
            : 'image';
        setPendingMedia({ uri: asset.uri, type: inferredType });
        setShowMediaConfirm(true);
      }
    } catch (error) {
      console.error('Error picking media:', error);
      Alert.alert('Error', 'Failed to pick media. Please try again.');
    }
  };

  const handleConfirmMedia = () => {
    if (!pendingMedia) return;
    setMediaUri(pendingMedia.uri);
    setMediaType(pendingMedia.type);
    setPendingMedia(null);
    setShowMediaConfirm(false);
  };

  const handleCancelMedia = () => {
    setPendingMedia(null);
    setShowMediaConfirm(false);
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

const toggleCategory = (itemName: string) => {
  setCategories(prev => 
    prev.includes(itemName) 
      ? prev.filter(c => c !== itemName)
      : [...prev, itemName]
  );
};

const checkGrammar = async (text: string) => {
  try {
    setGrammarLoading(true);
    const response = await axios.post(
      `${process.env.EXPO_PUBLIC_BACKEND_URL || 'https://api.cofau.com'}/api/utils/correct-grammar`,
      { text },
      { headers: { Authorization: `Bearer ${auth?.token}` } }
    );
    return response.data;
  } catch (error) {
    console.log('Grammar check failed:', error);
    return { original: text, corrected: text, was_changed: false };
  } finally {
    setGrammarLoading(false);
  }
};

const handleGrammarConfirm = (useCorrected: boolean) => {
  if (useCorrected) {
    setReview(correctedReview);
  }
  setShowGrammarModal(false);

};

// ------------------------------ GET USER LOCATION ------------------------------

React.useEffect(() => {
  (async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        setUserLocation({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });
        console.log('📍 User location:', location.coords);
      }
    } catch (error) {
      console.log('Location error:', error);
    }
  })();
}, []);

  // ------------------------------ POST SUBMISSION ------------------------------

const handlePost = async () => {
  if (!mediaUri || !mediaType) {
    Alert.alert('Media Required', 'Please add a photo or video.');
    return;
  }

  // ========== REGULAR POST MODE ==========
  let numericRating = 0;
  
  if (accountType !== 'restaurant') {
  if (tasteRating === 0 || valueRating === 0 || portionRating === 0) {
    Alert.alert('Rating Required', 'Please rate all three categories (Taste, Value, Portion).');
    return;
  }
  numericRating = getAverageRating();
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

  // Validate dish name - mandatory for all posts
  if (!dishName.trim()) {
    Alert.alert('Dish Name Required', 'Please enter the dish name.');
    return;
  }

  // Validate categories - mandatory for all posts
  if (categories.length === 0) {
    Alert.alert('Category Required', 'Please select at least one category.');
    return;
  }

  // Grammar check - only for regular users (not restaurants)
if (accountType !== 'restaurant') {
  const grammarResult = await checkGrammar(review.trim());
  
  if (grammarResult.was_changed) {
    setOriginalReview(review.trim());
    setCorrectedReview(grammarResult.corrected);
    setShowGrammarModal(true);
    return; // Stop here, wait for user confirmation
  }
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
        dish_name: dishName.trim(),  // NEW: Add dish name
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
      console.log('🏷️ Tagged restaurant object:', JSON.stringify(taggedRestaurant, null, 2));
      console.log('🏷️ Tagged restaurant ID being sent:', taggedRestaurant?.id);
      const postData = {
        rating: numericRating,
        review_text: review.trim(),
        map_link: mapsLink.trim(),
        location_name: locationName.trim(),
        category: categories.length > 0 ? categories.join(', ') : undefined,
        dish_name: dishName.trim(),  // NEW: Add dish name
        tagged_restaurant_id: taggedRestaurant?.id || undefined,
        file: fileToUpload,
        media_type: mediaType,
        // User's current location for wallet validation
        user_latitude: userLocation?.latitude || null,
        user_longitude: userLocation?.longitude || null,
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

    const leveledUp = newLevel > oldLevel;

    // Check if wallet reward exists in response
    if (result?.wallet_reward) {
      // Show wallet reward modal
      setRewardData(result.wallet_reward);
      setShowRewardModal(true);
      // Navigation happens when modal closes (see PostRewardModal onClose)
      return;
    }

    // Fallback to old behavior if no wallet_reward in response
    if (leveledUp) {
      showLevelUpAnimation(newLevel);
      setTimeout(() => router.replace('/feed'), 3000);
      return;
    }

    let earnedPoints = 25;
    if (oldLevel >= 5 && oldLevel <= 8) {
      earnedPoints = 15;
    } else if (oldLevel >= 9 && oldLevel <= 12) {
      earnedPoints = 5;
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
  console.log('🏷️ FULL restaurant object:', JSON.stringify(restaurant, null, 2));
  console.log('🏷️ Restaurant ID being saved:', restaurant.id);
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
        {accountType === 'restaurant' ? 'Add Post' : 'Post a Bite'}
      </Text>
      <View style={styles.headerRight} />
    </View>

    <KeyboardAvoidingView 
      style={{ flex: 1 }} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >

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
                <Text style={styles.uploadSubText}>Videos max 90 seconds</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>


        {/* Rating - Only for Users */}
{accountType !== 'restaurant' && (
  <View style={styles.section}>
    <Text style={styles.sectionLabel}>Rating</Text>
    
    {/* Average Rating Display */}
    <View style={styles.avgRatingContainer}>
      <Text style={styles.avgRatingLabel}>Average Rating</Text>
      <Text style={styles.avgRatingNumber}>{getAverageRating()} / 10</Text>
    </View>

    {/* Taste Rating */}
    <View style={styles.ratingContainer}>
      <View style={styles.ratingHeader}>
        <Text style={{ fontSize: 20 }}>😋</Text>
        <Text style={styles.ratingTitle}>Taste</Text>
        <Text style={styles.ratingValue}>{tasteRating}/10</Text>
      </View>
      <View style={styles.starsContainer}>
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
          <TouchableOpacity key={num} onPress={() => setTasteRating(num)}>
            <Ionicons
              name={tasteRating >= num ? 'star' : 'star-outline'}
              size={24}
              color={tasteRating >= num ? '#E94A37' : '#CCC'}
              style={{ marginRight: 2 }}
            />
          </TouchableOpacity>
        ))}
      </View>
    </View>

    {/* Value for Money Rating */}
    <View style={styles.ratingContainer}>
      <View style={styles.ratingHeader}>
       <Text style={{ fontSize: 20 }}>💰</Text>
        <Text style={styles.ratingTitle}>Value for Money</Text>
        <Text style={styles.ratingValue}>{valueRating}/10</Text>
      </View>
      <View style={styles.starsContainer}>
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
          <TouchableOpacity key={num} onPress={() => setValueRating(num)}>
            <Ionicons
              name={tasteRating >= num ? 'star' : 'star-outline'}
              size={24}
              color={valueRating >= num ? '#4ECDC4' : '#CCC'}
              style={{ marginRight: 2 }}
            />
          </TouchableOpacity>
        ))}
      </View>
    </View>

    {/* Portion Rating */}
    <View style={styles.ratingContainer}>
      <View style={styles.ratingHeader}>
        <Text style={{ fontSize: 20 }}>🍽️</Text>
        <Text style={styles.ratingTitle}>Portion Size</Text>
        <Text style={styles.ratingValue}>{portionRating}/10</Text>
      </View>
      <View style={styles.starsContainer}>
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
          <TouchableOpacity key={num} onPress={() => setPortionRating(num)}>
            <Ionicons
              name={portionRating >= num ? 'star' : 'star-outline'}
              size={24}
              color={portionRating >= num ? '#F2CF68' : '#CCC'}
              style={{ marginRight: 2 }}
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
          {accountType === 'restaurant' ? 'About' : 'Review'}
        </Text>
          <TextInput
            style={styles.reviewInput}
            placeholder={
              accountType === 'restaurant'
                ? 'Write about this dish...'
                : 'Write your review...'
}
            placeholderTextColor="#999"
            value={review}
            onChangeText={setReview}
            multiline
          />
        </View>

        {/* Dish Name - Mandatory for all posts */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Dish Name *</Text>
          <TextInput
            style={styles.linkInput}
            placeholder="e.g., Butter Chicken, Margherita Pizza"
            placeholderTextColor="#999"
            value={dishName}
            onChangeText={setDishName}
          />
        </View>

        {/* CATEGORY - MULTI-SELECT (MANDATORY) */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Select from Categories *</Text>
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
{/* LOCATION SECTION */}
  <View style={styles.section}>
    <Text style={styles.sectionLabel}>Location</Text>

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
          color="#FF9A4D"
          style={styles.suggestionLoader}
        />
      )}

      {/* Location Suggestions Dropdown - FROM YOUR DATABASE (FREE!) */}
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

    {/* Generate Google Maps Link */}
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
  

        {/* POST BUTTON */}
        <TouchableOpacity
          style={styles.postButtonContainer}
          onPress={handlePost}
          disabled={loading}
        >
          <LinearGradient
            colors={['#FF2E2E', '#F2CF68', '#FF9A4D']}
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

    {/* Media Confirm Modal */}
    <Modal
      visible={showMediaConfirm}
      transparent
      animationType="fade"
      onRequestClose={handleCancelMedia}
    >
      <View style={styles.mediaConfirmOverlay}>
        <View style={styles.mediaConfirmCard}>
          <View style={styles.mediaConfirmPreview}>
            {pendingMedia?.type === 'video' ? (
              <Video
                source={{ uri: pendingMedia.uri }}
                style={styles.mediaConfirmVideo}
                resizeMode={ResizeMode.COVER}
                shouldPlay={false}
                useNativeControls={true}
                isLooping={false}
                isMuted={false}
              />
            ) : (
              <Image source={{ uri: pendingMedia?.uri }} style={styles.mediaConfirmImage} />
            )}
          </View>

          <View style={styles.mediaConfirmActions}>
            <TouchableOpacity
              style={[styles.mediaConfirmButton, styles.mediaConfirmButtonSecondary]}
              onPress={handleCancelMedia}
            >
              <Text style={styles.mediaConfirmButtonSecondaryText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.mediaConfirmButton, styles.mediaConfirmButtonPrimary]}
              onPress={handleConfirmMedia}
            >
              <Text style={styles.mediaConfirmButtonPrimaryText}>Next</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>

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
          <TouchableOpacity onPress={() => setCategories([])}>
            <Text style={styles.clearAllText}>Clear All</Text>
          </TouchableOpacity>
        </View>
      )}
      
      <FlatList
        data={CATEGORIES}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[
              styles.categoryItem,
              categories.includes(item.name) && styles.categoryItemSelected
            ]}
            onPress={() => toggleCategory(item.name)}
          >
            <View style={styles.categoryItemContent}>
              <Text style={styles.categoryEmoji}>{item.emoji}</Text>
              <Text style={[
                styles.categoryItemText,
                categories.includes(item.name) && styles.categoryItemTextSelected
              ]}>
                {item.name}
              </Text>
            </View>
            {categories.includes(item.name) ? (
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

{/* Grammar Correction Modal */}
<Modal
  visible={showGrammarModal}
  transparent={true}
  animationType="fade"
  onRequestClose={() => setShowGrammarModal(false)}
>
  <View style={styles.grammarModalOverlay}>
    <View style={styles.grammarModal}>
      <Text style={styles.grammarModalTitle}>✨ We cleaned up some typos</Text>

      <Text style={styles.grammarLabel}>Original:</Text>
      <Text style={styles.grammarOriginal}>{originalReview}</Text>

      <Text style={styles.grammarLabel}>Corrected:</Text>
      <Text style={styles.grammarCorrected}>{correctedReview}</Text>

      <View style={styles.grammarButtonRow}>
        <TouchableOpacity
          style={styles.grammarButtonSecondary}
          onPress={() => handleGrammarConfirm(false)}
        >
          <Text style={styles.grammarButtonSecondaryText}>Keep Original</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.grammarButtonPrimary}
          onPress={() => handleGrammarConfirm(true)}
        >
          <Text style={styles.grammarButtonPrimaryText}>Use Corrected</Text>
        </TouchableOpacity>
      </View>
    </View>
  </View>
</Modal>

{/* Post Reward Modal */}
<PostRewardModal
  visible={showRewardModal}
  onClose={() => {
    setShowRewardModal(false);
    setRewardData(null);
    router.replace('/feed');
  }}
  rewardData={rewardData}
/>

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
    minHeight: 60,  // Reduced from 120 - will expand with content
    maxHeight: 200,  // Max height to prevent too large
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
    color: '#FF9A4D',
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
  avgRatingContainer: {
  backgroundColor: '#1B7C82',
  borderRadius: 12,
  padding: 16,
  marginBottom: 12,
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
},
avgRatingLabel: {
  fontSize: 16,
  fontWeight: '600',
  color: '#FFF',
},
avgRatingNumber: {
  fontSize: 24,
  fontWeight: 'bold',
  color: '#FFF',
},
ratingHeader: {
  flexDirection: 'row',
  alignItems: 'center',
  marginBottom: 10,
  gap: 8,
},
ratingTitle: {
  fontSize: 15,
  fontWeight: '600',
  color: '#333',
  flex: 1,
},
ratingValue: {
  fontSize: 14,
  fontWeight: 'bold',
  color: '#666',
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
// Grammar Modal Styles
grammarModalOverlay: {
  flex: 1,
  backgroundColor: 'rgba(0, 0, 0, 0.5)',
  justifyContent: 'center',
  alignItems: 'center',
  padding: 20,
},
grammarModal: {
  backgroundColor: '#FFF',
  borderRadius: 16,
  padding: 20,
  width: '100%',
  maxWidth: 400,
},
grammarModalTitle: {
  fontSize: 18,
  fontWeight: 'bold',
  color: '#333',
  marginBottom: 16,
  textAlign: 'center',
},
grammarLabel: {
  fontSize: 13,
  fontWeight: '600',
  color: '#666',
  marginBottom: 4,
},
grammarOriginal: {
  fontSize: 15,
  color: '#999',
  backgroundColor: '#F5F5F5',
  padding: 12,
  borderRadius: 8,
  marginBottom: 12,
  textDecorationLine: 'line-through',
},
grammarCorrected: {
  fontSize: 15,
  color: '#1B7C82',
  backgroundColor: '#F0F9F9',
  padding: 12,
  borderRadius: 8,
  marginBottom: 20,
},
grammarButtonRow: {
  flexDirection: 'row',
  gap: 12,
},
grammarButtonSecondary: {
  flex: 1,
  paddingVertical: 12,
  borderRadius: 8,
  borderWidth: 1,
  borderColor: '#DDD',
  alignItems: 'center',
},
grammarButtonSecondaryText: {
  color: '#666',
  fontWeight: '600',
},
grammarButtonPrimary: {
  flex: 1,
  paddingVertical: 12,
  borderRadius: 8,
  backgroundColor: '#1B7C82',
  alignItems: 'center',
},
  grammarButtonPrimaryText: {
    color: '#FFF',
    fontWeight: '600',
  },
  mediaConfirmOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  mediaConfirmCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    width: '100%',
    maxWidth: 420,
  },
  mediaConfirmPreview: {
    width: '100%',
    height: 320,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  mediaConfirmImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  mediaConfirmVideo: {
    width: '100%',
    height: '100%',
  },
  mediaConfirmActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  mediaConfirmButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  mediaConfirmButtonSecondary: {
    backgroundColor: '#F0F0F0',
  },
  mediaConfirmButtonSecondaryText: {
    color: '#666',
    fontWeight: '600',
  },
  mediaConfirmButtonPrimary: {
    backgroundColor: '#1B7C82',
  },
  mediaConfirmButtonPrimaryText: {
    color: '#FFF',
    fontWeight: '700',
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

// Add these styles
categoryItemContent: {
  flexDirection: 'row',
  alignItems: 'center',
  flex: 1,
},
categoryEmoji: {
  fontSize: 24,
  marginRight: 12,
},
clearAllText: {
  fontSize: 14,
  color: '#E94A37',
  fontWeight: '600',
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
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
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
