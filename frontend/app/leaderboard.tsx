import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  RefreshControl,
  Platform,
  StatusBar,
  Alert,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { LocationSelector } from "../components/LocationSelector";
import { WalletBalanceModal } from "../components/WalletBalanceModal";
import { useAuth } from "../context/AuthContext";
import axios from "axios";
import * as Location from "expo-location";

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || "https://api.cofau.com";
const API_URL = BACKEND_URL;

// Dummy data for UI preview
const DUMMY_RESTAURANTS = [
  {
    id: "1",
    name: "Italian Bistro",
    image: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=400",
    rating: 4.8,
    reviews: 120,
    distance: "0.4 km",
    deliveries: "1,220+",
    cuisine: "Italian, Pasta, Pizza",
    deliveryTime: "25-35 mins",
    isFavorite: true,
    isAcceptingOrders: true,
  },
  {
    id: "2",
    name: "Spice Junction",
    image: "https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=400",
    rating: 4.7,
    reviews: 800,
    distance: "0.5 km",
    deliveries: "1,100+",
    cuisine: "North Indian, Biryani",
    deliveryTime: "30-40 mins",
    isFavorite: false,
    isAcceptingOrders: false,
  },
  {
    id: "3",
    name: "Burger Factory",
    image: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400",
    rating: 4.6,
    reviews: 950,
    distance: "0.3 km",
    deliveries: "980+",
    cuisine: "Burgers, American",
    deliveryTime: "20-30 mins",
    isFavorite: false,
    isAcceptingOrders: false,
  },
  {
    id: "4",
    name: "Sunrise Cafe",
    image: "https://images.unsplash.com/photo-1567521464027-f127ff144326?w=400",
    rating: 4.7,
    reviews: 890,
    distance: "0.6 km",
    deliveries: "880+",
    cuisine: "Cafe, Breakfast, Desserts",
    deliveryTime: "25-35 mins",
    isFavorite: false,
    isAcceptingOrders: false,
  },
  {
    id: "5",
    name: "Dragon Palace",
    image: "https://images.unsplash.com/photo-1552566626-52f8b828add9?w=400",
    rating: 4.5,
    reviews: 650,
    distance: "0.8 km",
    deliveries: "750+",
    cuisine: "Chinese, Asian",
    deliveryTime: "35-45 mins",
    isFavorite: false,
    isAcceptingOrders: false,
  },
];

const TABS = ["Near Me", "Your Orders", "In Progress", "Rewards"];

const CATEGORIES = [
  { id: 'all', name: 'Nearby Food', emoji: '🍽️' },
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
  { id: 'karnataka-style', name: 'Karnataka', emoji: '🍃' },
  { id: 'hyderabadi-style', name: 'Hyderabadi', emoji: '🌶️' },
  { id: 'kerala-style', name: 'Kerala', emoji: '🥥' },
  { id: 'andhra-style', name: 'Andhra', emoji: '🔥' },
  { id: 'north-indian-style', name: 'North Indian', emoji: '🫓' },
  { id: 'south-indian-style', name: 'South Indian', emoji: '🥞' },
  { id: 'punjabi-style', name: 'Punjabi', emoji: '🧈' },
  { id: 'bengali-style', name: 'Bengali', emoji: '🐟' },
  { id: 'odia-style', name: 'Odia', emoji: '🍚' },
  { id: 'gujarati-style', name: 'Gujurati', emoji: '🥣' },
  { id: 'rajasthani-style', name: 'Rajasthani', emoji: '🏜️' },
  { id: 'mangaluru-style', name: 'Mangaluru', emoji: '🦀' },
  { id: 'goan', name: 'Goan', emoji: '🏖️' },
  { id: 'kashmiri', name: 'Kashmiri', emoji: '🏔️' },
  { id: 'continental', name: 'Continental', emoji: '🌍' },
  { id: 'asian', name: 'Asian', emoji: '🥢' },
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

export default function LeaderboardScreen() {
  const router = useRouter();
  const { token, user } = useAuth();
  const [activeTab, setActiveTab] = useState("Near Me");
  const [refreshing, setRefreshing] = useState(false);
  const [favorites, setFavorites] = useState<{ [key: string]: boolean }>({
    "1": true,
  });
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [userAddress, setUserAddress] = useState<any>(null);
  const [loadingAddress, setLoadingAddress] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [nearbyPosts, setNearbyPosts] = useState<any[]>([]);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const cachedNearbyPosts = useRef<any[]>([]);

  useEffect(() => {
    if (token) {
      fetchUserAddress();
      if (activeTab === "Near Me") {
        getCurrentLocation();
      }
    }
  }, [token, activeTab]);

  const fetchUserAddress = async () => {
    try {
      setLoadingAddress(true);
      const response = await axios.get(`${BACKEND_URL}/api/user/address`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.data) {
        setUserAddress(response.data);
      }
    } catch (error: any) {
      if (error.response?.status !== 404) {
        console.error("Error fetching address:", error);
      }
    } finally {
      setLoadingAddress(false);
    }
  };

  const saveUserAddress = async (locationData: any) => {
    try {
      const response = await axios.post(
        `${BACKEND_URL}/api/user/address`,
        {
          latitude: locationData.latitude,
          longitude: locationData.longitude,
          address: locationData.address,
          house_number: locationData.house_number,
          street_address: locationData.street_address,
          pincode: locationData.pincode,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setUserAddress(response.data);
      Alert.alert("Success", "Address saved successfully!");
    } catch (error) {
      console.error("Error saving address:", error);
      Alert.alert("Error", "Failed to save address. Please try again.");
    }
  };

  const getDisplayAddress = () => {
    if (loadingAddress) {
      return "Loading...";
    }
    if (!userAddress) {
      return "Add location";
    }
    return `${userAddress.house_number}, ${userAddress.street_address}`;
  };

  const getCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Location Permission Required",
          "Please enable location access to see nearby food posts.",
          [{ text: "OK" }]
        );
        return null;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const coords = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };

      setUserLocation(coords);
      fetchNearbyPosts(coords);
      return coords;
    } catch (error) {
      console.log("Get location error:", error);
      Alert.alert("Location Error", "Could not get your current location. Please try again.");
      return null;
    }
  };

  const fetchNearbyPosts = async (location?: { latitude: number; longitude: number }) => {
    const coords = location || userLocation;
    if (!coords) return;

    setLoadingPosts(true);
    try {
      const url = `${API_URL}/map/pins?lat=${coords.latitude}&lng=${coords.longitude}&radius_km=10`;

      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${token || ""}` },
      });

      const posts = response.data.posts || [];
      cachedNearbyPosts.current = posts;
      setNearbyPosts(posts);
    } catch (error) {
      console.log("Fetch nearby posts error:", error);
      Alert.alert("Error", "Failed to load nearby posts. Please try again.");
    } finally {
      setLoadingPosts(false);
    }
  };

  const handleCategoryChange = (categoryId: string) => {
    setSelectedCategory(categoryId);

    if (categoryId === "all") {
      setNearbyPosts(cachedNearbyPosts.current);
    } else {
      const category = CATEGORIES.find(c => c.id === categoryId);
      if (category) {
        const filteredPosts = cachedNearbyPosts.current.filter((post: any) => {
          const postCategory = post.category?.toLowerCase().trim();
          const selectedCategoryName = category.name.toLowerCase().trim();
          return postCategory === selectedCategoryName;
        });
        setNearbyPosts(filteredPosts);
      }
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    if (activeTab === "Near Me" && userLocation) {
      fetchNearbyPosts();
    }
    setTimeout(() => setRefreshing(false), 1000);
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c;
    return distance < 1 ? `${(distance * 1000).toFixed(0)}m` : `${distance.toFixed(1)}km`;
  };

  const toggleFavorite = (id: string) => {
    setFavorites((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const renderStars = (rating: number) => {
    const stars = [];
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;

    for (let i = 0; i < 5; i++) {
      if (i < fullStars) {
        stars.push(
          <Ionicons key={i} name="star" size={14} color="#FF8C00" />
        );
      } else if (i === fullStars && hasHalfStar) {
        stars.push(
          <Ionicons key={i} name="star-half" size={14} color="#FF8C00" />
        );
      } else {
        stars.push(
          <Ionicons key={i} name="star-outline" size={14} color="#FF8C00" />
        );
      }
    }
    return stars;
  };

  const renderDeliveryDots = () => {
    return (
      <View style={styles.deliveryDots}>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={styles.deliveryDot} />
        ))}
      </View>
    );
  };

  const renderRestaurantCard = (restaurant: typeof DUMMY_RESTAURANTS[0]) => {
    const isFav = favorites[restaurant.id];

    return (
      <View key={restaurant.id} style={styles.restaurantCard}>
        <Image
          source={{ uri: restaurant.image }}
          style={styles.restaurantImage}
          resizeMode="cover"
        />

        <View style={styles.restaurantInfo}>
          <View style={styles.restaurantHeader}>
            <Text style={styles.restaurantName}>{restaurant.name}</Text>
            <TouchableOpacity
              onPress={() => toggleFavorite(restaurant.id)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons
                name={isFav ? "heart" : "heart-outline"}
                size={22}
                color={isFav ? "#FF6B6B" : "#CCCCCC"}
              />
            </TouchableOpacity>
          </View>

          <View style={styles.ratingRow}>
            <View style={styles.starsContainer}>{renderStars(restaurant.rating)}</View>
            <Text style={styles.ratingText}>{restaurant.rating}</Text>
            <Text style={styles.reviewsText}>| {restaurant.reviews}+ Reviews</Text>
          </View>

          <View style={styles.distanceRow}>
            <Text style={styles.distanceText}>{restaurant.distance}</Text>
            <Text style={styles.dotSeparator}>·</Text>
            <Text style={styles.deliveriesText}>{restaurant.deliveries} Deliveries</Text>
          </View>

          <View style={styles.cuisineRow}>
            <Ionicons name="location" size={14} color="#4CAF50" />
            <Text style={styles.cuisineText}>{restaurant.cuisine}</Text>
          </View>

          <View style={styles.deliveryRow}>
            <View style={styles.deliveryTimeLeft}>
              <Ionicons name="time-outline" size={16} color="#4CAF50" />
              <Text style={styles.deliveryLabel}>Delivery Time:</Text>
              {renderDeliveryDots()}
            </View>

            {restaurant.isAcceptingOrders ? (
              <TouchableOpacity style={styles.acceptOrderButton}>
                <Text style={styles.acceptOrderText}>ACCEPT ORDER</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.deliveryTimeButton}>
                <Text style={styles.deliveryTimeText}>{restaurant.deliveryTime}</Text>
                <Ionicons name="chevron-forward" size={16} color="#666" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.locationContainer}
          onPress={() => setShowLocationModal(true)}
        >
          <Ionicons
            name={userAddress ? "location" : "add-circle-outline"}
            size={20}
            color={userAddress ? "#4CAF50" : "#FF7A18"}
          />
          <View style={styles.locationTextContainer}>
            <Text
              style={[
                styles.locationText,
                !userAddress && styles.addLocationText,
              ]}
              numberOfLines={1}
            >
              {getDisplayAddress()}
            </Text>
            {userAddress && userAddress.address && (
              <Text style={styles.locationSubtext} numberOfLines={1}>
                {userAddress.address}
              </Text>
            )}
          </View>
          <Ionicons name="chevron-down" size={18} color="#333" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.walletButton}
          onPress={() => setShowWalletModal(true)}
        >
          <Ionicons name="wallet-outline" size={24} color="#333" />
        </TouchableOpacity>
      </View>

      {/* Location Selector Modal */}
      <LocationSelector
        visible={showLocationModal}
        onClose={() => setShowLocationModal(false)}
        onSave={saveUserAddress}
        initialLocation={userAddress}
      />

      {/* Wallet Balance Modal */}
      <WalletBalanceModal
        visible={showWalletModal}
        onClose={() => setShowWalletModal(false)}
        token={token || ""}
      />

      {/* Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabsScrollView}
        contentContainerStyle={styles.tabsContainer}
      >
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[
              styles.tab,
              activeTab === tab && styles.activeTab,
            ]}
            onPress={() => setActiveTab(tab)}
          >
            {activeTab === tab ? (
              <LinearGradient
                colors={["#FF6B35", "#FF8C00"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.activeTabGradient}
              >
                <Text style={styles.activeTabText}>{tab}</Text>
              </LinearGradient>
            ) : (
              <Text style={styles.tabText}>{tab}</Text>
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Categories - Only show when Near Me is selected */}
      {activeTab === "Near Me" && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.categoryScrollView}
          contentContainerStyle={styles.categoryContainer}
        >
          {CATEGORIES.map((category) => (
            <TouchableOpacity
              key={category.id}
              style={[
                styles.categoryChip,
                selectedCategory === category.id && styles.categoryChipActive,
              ]}
              onPress={() => handleCategoryChange(category.id)}
              activeOpacity={0.7}
            >
              <Text style={styles.categoryEmoji}>{category.emoji}</Text>
              <Text
                style={[
                  styles.categoryName,
                  selectedCategory === category.id && styles.categoryNameActive,
                ]}
              >
                {category.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Content */}
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {activeTab === "Near Me" ? (
          <>
            <Text style={styles.sectionTitle}>
              {selectedCategory === "all" ? "Nearby Food Posts" : CATEGORIES.find(c => c.id === selectedCategory)?.name}
            </Text>

            {loadingPosts ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#FF8C00" />
                <Text style={styles.loadingText}>Finding nearby food...</Text>
              </View>
            ) : nearbyPosts.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="location-outline" size={64} color="#CCC" />
                <Text style={styles.emptyText}>No posts found nearby</Text>
                <TouchableOpacity
                  style={styles.retryButton}
                  onPress={getCurrentLocation}
                >
                  <Text style={styles.retryButtonText}>Retry</Text>
                </TouchableOpacity>
              </View>
            ) : (
              nearbyPosts.map((post) => (
                <TouchableOpacity
                  key={post.id}
                  style={styles.postCard}
                  onPress={() => router.push(`/post/${post.id}`)}
                >
                  <Image
                    source={{ uri: post.thumbnail_url || post.media_url }}
                    style={styles.postImage}
                    resizeMode="cover"
                  />

                  <View style={styles.postInfo}>
                    <View style={styles.postHeader}>
                      <Text style={styles.username} numberOfLines={1}>
                        {post.username || "Anonymous"}
                      </Text>
                      {post.rating && (
                        <View style={styles.postRatingContainer}>
                          <Ionicons name="star" size={14} color="#FFD700" />
                          <Text style={styles.ratingText}>{post.rating}/10</Text>
                        </View>
                      )}
                    </View>

                    {userLocation && post.latitude && post.longitude && (
                      <View style={styles.distanceRow}>
                        <Ionicons name="location" size={14} color="#4CAF50" />
                        <Text style={styles.distanceText}>
                          {calculateDistance(
                            userLocation.latitude,
                            userLocation.longitude,
                            post.latitude,
                            post.longitude
                          )}
                        </Text>
                      </View>
                    )}

                    {post.review_text && (
                      <Text style={styles.reviewText} numberOfLines={2}>
                        {post.review_text}
                      </Text>
                    )}

                    <TouchableOpacity
                      style={styles.orderButton}
                      onPress={() => {
                        if (post.restaurant_name) {
                          Alert.alert("Order", `Order from ${post.restaurant_name}?`);
                        }
                      }}
                    >
                      <Text style={styles.orderButtonText}>Order</Text>
                      <Ionicons name="chevron-forward" size={16} color="#FFF" />
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              ))
            )}
          </>
        ) : (
          <>
            <Text style={styles.sectionTitle}>Popular nearby restaurants</Text>
            {DUMMY_RESTAURANTS.map((restaurant) => renderRestaurantCard(restaurant))}
          </>
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Bottom Navigation */}
      <View style={styles.navBar}>
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => router.push("/feed")}
        >
          <Ionicons name="home-outline" size={20} color="#000" />
          <Text style={styles.navLabel}>Home</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => router.push("/explore")}
        >
          <Ionicons name="compass-outline" size={20} color="#000" />
          <Text style={styles.navLabel}>Explore</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.centerNavItem}
          onPress={() => router.push("/leaderboard")}
        >
          <View style={styles.centerIconCircle}>
            <Ionicons name="camera" size={20} color="#000" />
          </View>
          <Text style={styles.navLabelActive}>Top Posts</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => router.push("/happening")}
        >
          <Ionicons name="location-outline" size={20} color="#000" />
          <Text style={styles.navLabel}>Happening</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => router.push("/profile")}
        >
          <Ionicons name="person-outline" size={20} color="#000" />
          <Text style={styles.navLabel}>Profile</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "ios" ? 50 : StatusBar.currentHeight! + 10,
    paddingBottom: 12,
    backgroundColor: "#FFFFFF",
  },
  locationContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F5F5F5",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 25,
    flex: 1,
    marginRight: 12,
    maxWidth: "80%",
  },
  locationTextContainer: {
    flex: 1,
    marginLeft: 8,
    marginRight: 4,
  },
  locationText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#333",
  },
  addLocationText: {
    color: "#FF7A18",
    fontWeight: "600",
  },
  locationSubtext: {
    fontSize: 12,
    color: "#666",
    marginTop: 2,
  },
  walletButton: {
    padding: 8,
  },
  tabsScrollView: {
    maxHeight: 50,
    backgroundColor: "#FFFFFF",
  },
  tabsContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 10,
  },
  tab: {
    paddingHorizontal: 4,
    paddingVertical: 4,
    borderRadius: 20,
    marginRight: 8,
  },
  activeTab: {
    overflow: "hidden",
  },
  activeTabGradient: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 20,
  },
  tabText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#666",
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  activeTabText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1A1A1A",
    marginBottom: 16,
    marginTop: 8,
  },
  restaurantCard: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    marginBottom: 16,
    padding: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: "#F0F0F0",
  },
  restaurantImage: {
    width: 100,
    height: 100,
    borderRadius: 10,
    backgroundColor: "#F0F0F0",
  },
  restaurantInfo: {
    flex: 1,
    marginLeft: 12,
  },
  restaurantHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  restaurantName: {
    fontSize: 17,
    fontWeight: "700",
    color: "#1A1A1A",
    flex: 1,
    marginRight: 8,
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  starsContainer: {
    flexDirection: "row",
    marginRight: 6,
  },
  ratingText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FF8C00",
    marginRight: 4,
  },
  reviewsText: {
    fontSize: 13,
    color: "#888",
  },
  distanceRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
  },
  distanceText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
  },
  dotSeparator: {
    fontSize: 14,
    color: "#999",
    marginHorizontal: 6,
  },
  deliveriesText: {
    fontSize: 13,
    color: "#666",
  },
  cuisineRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  cuisineText: {
    fontSize: 13,
    color: "#666",
    marginLeft: 4,
  },
  deliveryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#F0F0F0",
  },
  deliveryTimeLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  deliveryLabel: {
    fontSize: 13,
    color: "#666",
    marginLeft: 6,
    marginRight: 8,
  },
  deliveryDots: {
    flexDirection: "row",
    gap: 4,
  },
  deliveryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#E0E0E0",
  },
  acceptOrderButton: {
    backgroundColor: "#2E7D32",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  acceptOrderText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  deliveryTimeButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F5F5F5",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  deliveryTimeText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#333",
    marginRight: 4,
  },
  bottomSpacer: {
    height: 100,
  },
  navBar: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingVertical: 4,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: "#E8E8E8",
    backgroundColor: "#FFFFFF",
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  navItem: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  centerNavItem: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 4,
    paddingHorizontal: 12,
    marginTop: -20,
  },
  centerIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    borderWidth: 2,
    borderColor: "#000",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 2,
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  navLabel: {
    fontSize: 11,
    color: "#000",
    marginTop: 2,
    textAlign: "center",
    fontWeight: "500",
  },
  navLabelActive: {
    fontSize: 11,
    color: "#000",
    marginTop: 2,
    textAlign: "center",
    fontWeight: "700",
  },
  categoryScrollView: {
    maxHeight: 50,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  categoryContainer: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  categoryChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F5F5F5",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  categoryChipActive: {
    backgroundColor: "#FF8C00",
    borderColor: "#FF8C00",
  },
  categoryEmoji: {
    fontSize: 16,
    marginRight: 6,
  },
  categoryName: {
    fontSize: 13,
    fontWeight: "500",
    color: "#333",
  },
  categoryNameActive: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#666",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 16,
    color: "#666",
    textAlign: "center",
  },
  retryButton: {
    marginTop: 16,
    backgroundColor: "#FF8C00",
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 20,
  },
  retryButtonText: {
    color: "#FFF",
    fontWeight: "600",
    fontSize: 14,
  },
  postCard: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    marginBottom: 16,
    padding: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: "#F0F0F0",
  },
  postImage: {
    width: 100,
    height: 120,
    borderRadius: 10,
    backgroundColor: "#F0F0F0",
  },
  postInfo: {
    flex: 1,
    marginLeft: 12,
    justifyContent: "space-between",
  },
  postHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  username: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1A1A1A",
    flex: 1,
    marginRight: 8,
  },
  postRatingContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF9E6",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  reviewText: {
    fontSize: 13,
    color: "#555",
    lineHeight: 18,
    marginBottom: 8,
  },
  orderButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FF8C00",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    alignSelf: "flex-end",
    gap: 4,
  },
  orderButtonText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});