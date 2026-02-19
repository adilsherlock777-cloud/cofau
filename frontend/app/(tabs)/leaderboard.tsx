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
  Modal,
  TextInput,
  Linking,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { LocationSelector } from "../../components/LocationSelector";
import { WalletBalanceModal } from "../../components/WalletBalanceModal";
import { OrderModal } from "../../components/OrderModal";
import { ReviewModal } from "../../components/ReviewModal";
import { useAuth } from "../../context/AuthContext";
import axios from "axios";
import * as Location from "expo-location";

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || "https://api.cofau.com";
const API_URL = BACKEND_URL;

// Fix URL helper function
const fixUrl = (url: string | null | undefined): string => {
  if (!url) return "";
  if (url.startsWith("http")) return url;
  let cleaned = url.trim().replace(/([^:]\/)\/+/g, "$1");
  if (!cleaned.startsWith("/")) cleaned = "/" + cleaned;
  return `${BACKEND_URL}${cleaned}`;
};

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
const RESTAURANT_TABS = ["Your Orders", "In Progress", "Reviews/Complaints"];

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
  const { token, user, accountType } = useAuth();
  const isRestaurant = accountType === 'restaurant';
  const [activeTab, setActiveTab] = useState(isRestaurant ? "Your Orders" : "Near Me");
  const [refreshing, setRefreshing] = useState(false);
  const [favorites, setFavorites] = useState<{ [key: string]: boolean }>({
    "1": true,
  });
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [userAddress, setUserAddress] = useState<any>(null);
  const [loadingAddress, setLoadingAddress] = useState(true);
  const [deliveryRewardProgress, setDeliveryRewardProgress] = useState(0); // 0-10 deliveries
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [nearbyPosts, setNearbyPosts] = useState<any[]>([]);
  const [nearbyRestaurants, setNearbyRestaurants] = useState<any[]>([]);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [loadingRestaurants, setLoadingRestaurants] = useState(false);
  const cachedNearbyPosts = useRef<any[]>([]);
  const cachedNearbyRestaurants = useRef<any[]>([]);
  const [postFilter, setPostFilter] = useState<string | null>(null);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [filterCounts, setFilterCounts] = useState({
    topRated: 0,
    mostLoved: 0,
    newest: 0,
    disliked: 0,
  });
  const [fullImageModal, setFullImageModal] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [selectedPost, setSelectedPost] = useState<any>(null);
  const [activeOrders, setActiveOrders] = useState<any[]>([]); // pending, accepted, preparing, out_for_delivery
  const [completedOrders, setCompletedOrders] = useState<any[]>([]); // completed, cancelled
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [restaurantProfiles, setRestaurantProfiles] = useState<{ [key: string]: any }>({});
  const requestedRestaurantProfiles = useRef<Set<string>>(new Set());
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [selectedOrderForReview, setSelectedOrderForReview] = useState<any>(null);
  const [restaurantReviews, setRestaurantReviews] = useState<any[]>([]);
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [restaurantProfile, setRestaurantProfile] = useState<any>(null);
  const [showRestaurantPhoneModal, setShowRestaurantPhoneModal] = useState(false);
  const [restaurantPhone, setRestaurantPhone] = useState("");
  const [rewardsHistory, setRewardsHistory] = useState<any[]>([]);
  const [loadingRewardsHistory, setLoadingRewardsHistory] = useState(false);
  const [walletBalance, setWalletBalance] = useState(0);

  // When accountType loads async, ensure restaurant users default to "Your Orders"
  useEffect(() => {
    if (isRestaurant && activeTab === "Near Me") {
      setActiveTab("Your Orders");
    }
  }, [isRestaurant]);

  useEffect(() => {
    if (token) {
      if (isRestaurant) {
        fetchRestaurantProfile();
      } else {
        fetchUserAddress();
      };
      // Always fetch orders so activeOrders is populated for the in-progress check
      fetchOrders();
      if (activeTab === "Near Me") {
        getCurrentLocation();
      } else if (activeTab === "Reviews/Complaints" && isRestaurant) {
        fetchRestaurantReviews();
      } else if (activeTab === "Rewards" && !isRestaurant) {
        fetchRewardsHistory();
      }
    }
  }, [token, activeTab]);

  const fetchOrders = async () => {
    if (!token) return;

    setLoadingOrders(true);

    // For restaurant users, fetch latest profile to check phone number
    if (isRestaurant) {
      try {
        const profileResponse = await axios.get(
          `${BACKEND_URL}/api/restaurant/auth/me`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        const profile = profileResponse.data;

        // Check if phone number exists
        if (!profile.phone && !profile.phone_number) {
          setLoadingOrders(false);
          Alert.alert(
            "Phone Number Required",
            "Please add your phone number before receiving orders. This helps customers contact you for delivery coordination.",
            [
              {
                text: "Add Phone Number",
                onPress: () => setShowRestaurantPhoneModal(true),
              },
            ]
          );
          return;
        }
      } catch (error) {
        console.error("Error fetching restaurant profile:", error);
      }
    }
    try {
      // Use different endpoint based on account type
      const endpoint = isRestaurant
        ? `${BACKEND_URL}/api/orders/restaurant-orders`
        : `${BACKEND_URL}/api/orders/my-orders`;

      const response = await axios.get(endpoint, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const allOrders = response.data || [];

      // Separate active and completed orders
      const active = allOrders.filter((order: any) =>
        ['pending', 'accepted', 'preparing', 'out_for_delivery'].includes(order.status)
      );
      const completed = allOrders.filter((order: any) =>
        ['completed', 'cancelled'].includes(order.status)
      );

      setActiveOrders(active);
      setCompletedOrders(completed);

      // Fetch restaurant profiles for orders with restaurant_id (only for regular users)
      if (!isRestaurant) {
        // Filter out invalid restaurant IDs (e.g., Google Place IDs that start with "ChIJ")
        // Only fetch profiles for valid MongoDB ObjectIds (24 character hex strings)
        const isValidObjectId = (id: string) => /^[0-9a-fA-F]{24}$/.test(id);

        const restaurantIds = [...new Set(allOrders
          .filter((order: any) => order.restaurant_id && isValidObjectId(order.restaurant_id))
          .map((order: any) => order.restaurant_id))];

        const profiles: { [key: string]: any } = {};
        for (const restaurantId of restaurantIds) {
          try {
            const profileResponse = await axios.get(
              `${BACKEND_URL}/api/restaurant/posts/public/profile/${restaurantId}`
            );
            profiles[restaurantId] = profileResponse.data;
          } catch (error) {
            console.log(`Failed to fetch profile for restaurant ${restaurantId}`);
          }
        }
        setRestaurantProfiles(profiles);
      }
    } catch (error) {
      console.error("Error fetching orders:", error);
    } finally {
      setLoadingOrders(false);
    }
  };

  const fetchRestaurantReviews = async () => {
    if (!token || !isRestaurant || !user?.id) return;

    setLoadingReviews(true);
    try {
      // Use the correct endpoint that reads from the reviews collection
      const response = await axios.get(
        `${BACKEND_URL}/api/orders/restaurant-reviews/${user.id}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setRestaurantReviews(response.data || []);
      console.log(`✅ Fetched ${response.data?.length || 0} reviews for restaurant`);
    } catch (error) {
      console.error("Error fetching reviews:", error);
    } finally {
      setLoadingReviews(false);
    }
  };

  const fetchDeliveryRewardProgress = async () => {
    if (!token || !user?.id) return;

    try {
      const response = await axios.get(
        `${BACKEND_URL}/api/users/me`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      const completedDeliveries = response.data?.completed_deliveries_count || 0;
      setDeliveryRewardProgress(completedDeliveries);
      console.log(`📦 User has completed ${completedDeliveries}/10 deliveries`);
    } catch (error) {
      console.error("Error fetching delivery reward progress:", error);
    }
  };

  const fetchRewardsHistory = async () => {
    if (!token) return;

    setLoadingRewardsHistory(true);
    try {
      // Use the same endpoint as CofauWallet modal for consistency
      const response = await axios.get(
        `${BACKEND_URL}/api/wallet/balance`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setRewardsHistory(response.data.recent_transactions || []);
      setWalletBalance(response.data.balance || 0);
      setDeliveryRewardProgress(response.data.completed_deliveries || 0);
      console.log(`💰 Fetched ${response.data.recent_transactions?.length || 0} reward transactions`);
      console.log(`💰 Wallet balance: ₹${response.data.balance}, Deliveries: ${response.data.completed_deliveries}/10`);
    } catch (error) {
      console.error("Error fetching rewards history:", error);
    } finally {
      setLoadingRewardsHistory(false);
    }
  };

  const handleOrderClick = (post: any) => {
    // Check if user has added their delivery location and phone number (only for regular users)
    if (!isRestaurant && (!userAddress || !userAddress.phone_number)) {
      Alert.alert(
        "Delivery Details Required",
        !userAddress
          ? "Please add your delivery address and phone number before placing an order."
          : "Please add your phone number to your delivery address before placing an order.",
        [
          {
            text: "Cancel",
            style: "cancel",
          },
          {
            text: userAddress ? "Update Address" : "Add Address",
            onPress: () => setShowLocationModal(true),
          },
        ]
      );
      return;
    }

    // Check if user already has an active order in progress (only for regular users)
    if (!isRestaurant && activeOrders.length > 0) {
      Alert.alert(
        "Order In Progress",
        "You already have an order in progress. Please wait for your current order to be completed before placing a new one.",
        [
          {
            text: "OK",
            style: "cancel",
          },
          {
            text: "View Order",
            onPress: () => setActiveTab("In Progress"),
          },
        ]
      );
      return;
    }

    setSelectedPost(post);
    setShowOrderModal(true);
  };

  const handleOrderPlaced = () => {
    // Refresh orders when a new order is placed
    fetchOrders();
  };

  const handleReviewAdded = () => {
    // Refresh orders and close modal
    fetchOrders();
    if (isRestaurant) {
      fetchRestaurantReviews();
    }
  };

  const handleAddReview = (order: any) => {
    setSelectedOrderForReview(order);
    setShowReviewModal(true);
  };

  // Auto-refresh delivery rewards when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      if (!isRestaurant && activeTab === "Rewards") {
        fetchRewardsHistory();
      }
    }, [isRestaurant, activeTab])
  );

  // Silent background update function that doesn't cause UI refresh
  const updateOrdersInBackground = async () => {
    if (!token) return;

    try {
      const endpoint = isRestaurant
        ? `${BACKEND_URL}/api/orders/restaurant-orders`
        : `${BACKEND_URL}/api/orders/my-orders`;

      const response = await axios.get(endpoint, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const allOrders = response.data || [];

      // Separate active and completed orders
      const active = allOrders.filter((order: any) =>
        ['pending', 'accepted', 'preparing', 'out_for_delivery'].includes(order.status)
      );
      const completed = allOrders.filter((order: any) =>
        ['completed', 'cancelled'].includes(order.status)
      );

      // Only update if there are actual changes to prevent unnecessary re-renders
      setActiveOrders((prev: any[]) => {
        const hasChanges = JSON.stringify(prev.map(o => ({ id: o.id, status: o.status }))) !==
                          JSON.stringify(active.map(o => ({ id: o.id, status: o.status })));
        return hasChanges ? active : prev;
      });

      setCompletedOrders((prev: any[]) => {
        const hasChanges = prev.length !== completed.length;
        // Check if a new order was just completed (length increased)
        if (hasChanges && completed.length > prev.length && !isRestaurant) {
          console.log('💰 New completed order detected - refreshing rewards history');
          fetchRewardsHistory();
        }
        return hasChanges ? completed : prev;
      });
    } catch (error) {
      console.error('Error updating orders in background:', error);
    }
  };

  // WebSocket connection for real-time order updates with fallback polling
  useEffect(() => {
    // Only set up updates if there are active orders
    if (!token || activeOrders.length === 0) return;

    let ws: WebSocket | null = null;
    let reconnectTimeout: NodeJS.Timeout | null = null;
    let pollingInterval: NodeJS.Timeout | null = null;
    let shouldReconnect = true;
    let wsConnected = false;

    // Fallback: Poll for updates every 15 seconds if WebSocket fails
    const startPolling = () => {
      if (pollingInterval) return; // Already polling

      console.log('📊 Starting fallback polling for order updates (every 15s)');
      pollingInterval = setInterval(() => {
        if (activeTab === "In Progress" || activeTab === "Your Orders") {
          updateOrdersInBackground(); // Use silent update instead of full fetchOrders
        }
      }, 15000); // Poll every 15 seconds
    };

    const stopPolling = () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
        pollingInterval = null;
        console.log('⏹️ Stopped fallback polling');
      }
    };

    const connectWebSocket = () => {
      if (!shouldReconnect) return;

      try {
        const wsUrl = BACKEND_URL.replace('https://', 'wss://').replace('http://', 'ws://');
        ws = new WebSocket(`${wsUrl}/api/orders/ws?token=${token}`);

        ws.onopen = () => {
          console.log('📡 Connected to order updates WebSocket');
          wsConnected = true;
          stopPolling(); // Stop polling since WebSocket is connected
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            console.log('📨 Received WebSocket message:', data);

            if (data.type === 'order_status_update') {
              const newStatus = data.status;
              const isCompleted = ['completed', 'cancelled'].includes(newStatus);

              if (isCompleted) {
                // Move order from active to completed
                setActiveOrders((prevActive: any[]) => {
                  const orderToMove = prevActive.find((order: any) => order.id === data.order_id);
                  if (orderToMove) {
                    const updatedOrder = { ...orderToMove, status: newStatus, updated_at: data.updated_at };
                    // Add to completed orders
                    setCompletedOrders((prevCompleted: any[]) => [updatedOrder, ...prevCompleted]);
                  }
                  // Remove from active orders
                  return prevActive.filter((order: any) => order.id !== data.order_id);
                });

                // Refresh rewards history when an order is completed (for delivery rewards)
                if (newStatus === 'completed' && !isRestaurant) {
                  console.log('💰 Order completed - refreshing rewards history');
                  fetchRewardsHistory();
                }
              } else {
                // Update status within active orders
                setActiveOrders((prevOrders: any[]) =>
                  prevOrders.map((order: any) =>
                    order.id === data.order_id
                      ? { ...order, status: newStatus, updated_at: data.updated_at }
                      : order
                  )
                );
              }

              console.log(`✅ Updated order ${data.order_id} to status: ${newStatus}`);
            }
          } catch (error) {
            console.error('Error parsing WebSocket message:', error);
          }
        };

        ws.onerror = (error) => {
          console.log('⚠️ WebSocket connection failed, using polling fallback');
          wsConnected = false;
          shouldReconnect = false; // Don't retry WebSocket
          startPolling(); // Fall back to polling
        };

        ws.onclose = (event) => {
          wsConnected = false;
          console.log('🔌 WebSocket disconnected, using polling fallback');
          startPolling(); // Always fall back to polling when disconnected
        };
      } catch (error) {
        console.error('Failed to connect WebSocket:', error);
        startPolling(); // Fall back to polling
      }
    };

    // Try WebSocket first, fall back to polling if it fails
    connectWebSocket();

    // If WebSocket doesn't connect within 3 seconds, start polling as backup
    const wsTimeout = setTimeout(() => {
      if (!wsConnected) {
        console.log('⏱️ WebSocket connection timeout, starting polling');
        startPolling();
      }
    }, 3000);

    // Cleanup on unmount or when active orders become empty
    return () => {
      shouldReconnect = false;
      clearTimeout(wsTimeout);
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
      if (ws) {
        ws.close();
      }
      stopPolling();
    };
  }, [token, activeOrders.length, activeTab]);

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
          phone_number: locationData.phone_number,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setUserAddress(response.data);
      Alert.alert("Success", "Address and phone number saved successfully!");
    } catch (error) {
      console.error("Error saving address:", error);
      Alert.alert("Error", "Failed to save address. Please try again.");
    }
  };

  const fetchRestaurantProfile = async () => {
    try {
      setLoadingAddress(true);
      const response = await axios.get(`${BACKEND_URL}/api/restaurant/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.data) {
        setRestaurantProfile(response.data);
        // Check if phone number is missing
        if (!response.data.phone && !response.data.phone_number) {
          setShowRestaurantPhoneModal(true);
        }
      }
    } catch (error: any) {
      console.error("Error fetching restaurant profile:", error);
    } finally {
      setLoadingAddress(false);
    }
  };

  const saveRestaurantPhone = async () => {
    if (!restaurantPhone.trim() || restaurantPhone.length !== 10) {
      Alert.alert("Invalid Phone Number", "Please enter a valid 10-digit phone number");
      return;
    }

    try {
      await axios.put(
        `${BACKEND_URL}/api/restaurant/auth/update`,
        { phone: restaurantPhone.trim() },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setShowRestaurantPhoneModal(false);
      Alert.alert("Success", "Phone number saved successfully!");
      fetchRestaurantProfile();
    } catch (error) {
      console.error("Error saving phone:", error);
      Alert.alert("Error", "Failed to save phone number. Please try again.");
    }
  };

  const getDisplayAddress = () => {
    if (loadingAddress) {
      return "Loading...";
    }
    if (isRestaurant) {
      if (!restaurantProfile || (!restaurantProfile.phone && !restaurantProfile.phone_number)) {
        return "Add phone number";
      }
      return restaurantProfile.phone || restaurantProfile.phone_number || "Add phone number";
    }
    if (!userAddress) {
      return "Add delivery address & phone";
    }
    if (!userAddress.phone_number) {
      return `${userAddress.house_number}, ${userAddress.street_address} (No phone)`;
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
      fetchNearbyPosts(coords); // Fetch nearby posts with tagged restaurants
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
      // Use 3km radius for nearby posts
      const url = `${API_URL}/api/map/pins?lat=${coords.latitude}&lng=${coords.longitude}&radius_km=3`;

      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${token || ""}` },
      });

      const allPosts = response.data.posts || [];
      // Get restaurants from the same API response (like explore.tsx does)
      const restaurants = response.data.restaurants || [];

      // Show posts that are orderable: tagged restaurant or posted by a restaurant account
      const orderablePosts = allPosts.filter(
        (post: any) =>
          post.tagged_restaurant_id ||
          post.account_type === 'restaurant' ||
          post.restaurant_id
      );

      console.log(
        `📍 Found ${allPosts.length} total posts, ${orderablePosts.length} orderable (tagged or restaurant), ${restaurants.length} restaurants within 3km`
      );

      // Cache both posts and restaurants
      cachedNearbyPosts.current = orderablePosts;
      cachedNearbyRestaurants.current = restaurants;

      setNearbyPosts(orderablePosts);
      setNearbyRestaurants(mergeNearbyRestaurants(orderablePosts, restaurants));
      calculateFilterCounts(orderablePosts);

      // Fetch restaurant's own posts for each restaurant and merge them
      if (restaurants.length > 0) {
        fetchRestaurantOwnPosts(restaurants, orderablePosts);
      }
    } catch (error) {
      console.log("Fetch nearby posts error:", error);
      Alert.alert("Error", "Failed to load nearby posts. Please try again.");
    } finally {
      setLoadingPosts(false);
    }
  };

  // Fetch restaurant's own posts (from their POSTS tab) and merge with customer reviews
  const fetchRestaurantOwnPosts = async (restaurants: any[], existingPosts: any[]) => {
    try {
      const restaurantPostsPromises = restaurants.map(async (restaurant: any) => {
        try {
          const response = await axios.get(
            `${API_URL}/api/restaurant/posts/public/restaurant/${restaurant.id}?limit=10`,
            { headers: { Authorization: `Bearer ${token || ""}` } }
          );
          const posts = response.data.posts || response.data || [];
          // Add restaurant info to each post
          return posts.map((post: any) => ({
            ...post,
            restaurant_id: restaurant.id,
            restaurant_name: restaurant.name || restaurant.restaurant_name,
            account_type: 'restaurant',
          }));
        } catch (err) {
          console.log(`Failed to fetch posts for restaurant ${restaurant.id}`);
          return [];
        }
      });

      const allRestaurantPosts = await Promise.all(restaurantPostsPromises);
      const flattenedPosts = allRestaurantPosts.flat();

      if (flattenedPosts.length > 0) {
        // Merge with existing posts, avoiding duplicates
        const existingPostIds = new Set(existingPosts.map((p: any) => p.id));
        const newPosts = flattenedPosts.filter((p: any) => !existingPostIds.has(p.id));

        if (newPosts.length > 0) {
          const mergedPosts = [...existingPosts, ...newPosts];
          cachedNearbyPosts.current = mergedPosts;
          setNearbyPosts(mergedPosts);
          setNearbyRestaurants(mergeNearbyRestaurants(mergedPosts, restaurants));
          console.log(`📍 Added ${newPosts.length} restaurant posts to nearby posts`);
        }
      }
    } catch (error) {
      console.log("Error fetching restaurant own posts:", error);
    }
  };

  // Fetch only onboarded restaurants (from Cofau database)
  // Uses same endpoint as map to ensure consistency
  const fetchNearbyRestaurants = async (location?: { latitude: number; longitude: number }) => {
    const coords = location || userLocation;
    if (!coords) return;

    setLoadingRestaurants(true);
    try {
      // Use same endpoint as map - /api/map/pins with 3km radius
      const url = `${API_URL}/api/map/pins?lat=${coords.latitude}&lng=${coords.longitude}&radius_km=3`;

      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${token || ""}` },
      });

      // Extract restaurants from the pins response (same as map view)
      const restaurants = response.data.restaurants || [];
      cachedNearbyRestaurants.current = restaurants;
      setNearbyRestaurants(mergeNearbyRestaurants(cachedNearbyPosts.current, restaurants));
      if (restaurants.length > 0) {
        const profiles: { [key: string]: any } = {};
        await Promise.all(
          restaurants.map(async (restaurant: any) => {
            if (!restaurant?.id) return;
            try {
              const profileResponse = await axios.get(
                `${BACKEND_URL}/api/restaurant/posts/public/profile/${restaurant.id}`
              );
              profiles[String(restaurant.id)] = profileResponse.data;
            } catch (error) {
              console.log(`Failed to fetch profile for restaurant ${restaurant.id}`);
            }
          })
        );
        setRestaurantProfiles((prev) => ({ ...prev, ...profiles }));
      }
      console.log(`📍 Found ${restaurants.length} onboarded restaurants within 3km (from pins endpoint)`);
    } catch (error) {
      console.log("Fetch nearby restaurants error:", error);
      Alert.alert("Error", "Failed to load nearby restaurants. Please try again.");
    } finally {
      setLoadingRestaurants(false);
    }
  };

  const calculateFilterCounts = (posts: any[]) => {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const counts = {
      topRated: posts.filter((p) => p.rating && p.rating >= 9).length,
      mostLoved: posts.filter((p) => (p.likes_count || 0) > 0).length,
      newest: posts.filter((p) => {
        const createdAt = p.created_at ? new Date(p.created_at) : null;
        return createdAt && createdAt >= oneWeekAgo;
      }).length,
      disliked: posts.filter((p) => p.rating && p.rating < 6).length,
    };

    setFilterCounts(counts);
  };

  const getFilteredPosts = () => {
    if (!postFilter) return nearbyPosts;

    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    switch (postFilter) {
      case 'topRated':
        return nearbyPosts
          .filter((p) => p.rating && p.rating >= 9)
          .sort((a, b) => (b.rating || 0) - (a.rating || 0));
      case 'mostLoved':
        return nearbyPosts
          .filter((p) => (p.likes_count || 0) > 0)
          .sort((a, b) => (b.likes_count || 0) - (a.likes_count || 0));
      case 'newest':
        return nearbyPosts
          .filter((p) => {
            const createdAt = p.created_at ? new Date(p.created_at) : null;
            return createdAt && createdAt >= oneWeekAgo;
          })
          .sort((a, b) => {
            const aDate = a.created_at ? new Date(a.created_at).getTime() : 0;
            const bDate = b.created_at ? new Date(b.created_at).getTime() : 0;
            return bDate - aDate;
          });
      case 'disliked':
        return nearbyPosts
          .filter((p) => p.rating && p.rating < 6)
          .sort((a, b) => (a.rating || 0) - (b.rating || 0));
      default:
        return nearbyPosts;
    }
  };

  // Extract location name from post
  const getLocationName = (post: any): string => {
    // Try direct location fields first
    if (post.location_name) return post.location_name;
    if (post.location) return post.location;
    if (post.place_name) return post.place_name;

    // Try to extract from map_link
    if (post.map_link) {
      try {
        const url = new URL(post.map_link);
        const queryParam = url.searchParams.get('query');
        if (queryParam) {
          return decodeURIComponent(queryParam);
        }
      } catch (e) {
        const match = post.map_link.match(/query=([^&]+)/);
        if (match) {
          return decodeURIComponent(match[1]);
        }
      }
    }

    return "Unknown Location";
  };

  const getRestaurantIdFromPost = (post: any) => {
    if (post.tagged_restaurant_id) return post.tagged_restaurant_id;
    if (post.restaurant_id) return post.restaurant_id;
    if (post.account_type === 'restaurant') return post.user_id;
    return null;
  };

  useEffect(() => {
    if (nearbyRestaurants.length === 0 && nearbyPosts.length === 0) return;

    const restaurantIds = new Set<string>();
    nearbyRestaurants.forEach((restaurant: any) => {
      if (restaurant?.id) restaurantIds.add(String(restaurant.id));
    });
    nearbyPosts.forEach((post: any) => {
      const restaurantId = getRestaurantIdFromPost(post);
      if (restaurantId) restaurantIds.add(String(restaurantId));
    });

    const idsToFetch = Array.from(restaurantIds).filter(
      (id) => !restaurantProfiles[id] && !requestedRestaurantProfiles.current.has(id)
    );

    if (idsToFetch.length === 0) return;

    idsToFetch.forEach((id) => requestedRestaurantProfiles.current.add(id));

    const fetchProfiles = async () => {
      const profiles: { [key: string]: any } = {};
      await Promise.all(
        idsToFetch.map(async (restaurantId) => {
          try {
            const profileResponse = await axios.get(
              `${BACKEND_URL}/api/restaurant/posts/public/profile/${restaurantId}`
            );
            profiles[restaurantId] = profileResponse.data;
          } catch (error) {
            console.log(`Failed to fetch profile for restaurant ${restaurantId}`);
          }
        })
      );
      if (Object.keys(profiles).length > 0) {
        setRestaurantProfiles((prev) => ({ ...prev, ...profiles }));
      }
    };

    fetchProfiles();
  }, [nearbyRestaurants, nearbyPosts, restaurantProfiles]);

  const getNearbyRestaurantCards = () => {
    const filteredPosts = getFilteredPosts();
    const restaurantsSource =
      nearbyRestaurants.length > 0
        ? nearbyRestaurants
        : mergeNearbyRestaurants(filteredPosts, []);

    return restaurantsSource
      .map((restaurant: any) => {
        const restaurantId = String(restaurant.id);
        const posts = filteredPosts.filter(
          (post: any) => String(getRestaurantIdFromPost(post)) === restaurantId
        );

        // Show all restaurants (like map does), not just ones with posts
        const ratings = posts.filter((post: any) => post.rating).map((post: any) => post.rating);
        const avgRating = ratings.length > 0
          ? ratings.reduce((a: number, b: number) => a + b, 0) / ratings.length
          : (restaurant.average_rating ?? 0);
        const reviewCount = ratings.length > 0 ? ratings.length : (restaurant.review_count ?? 0);

        let closestPost = posts[0] || null;
        let distanceKm = restaurant.distance_km ?? Infinity;

        // Calculate distance from user location
        if (userLocation && restaurant.latitude && restaurant.longitude) {
          distanceKm = calculateDistanceKm(
            userLocation.latitude,
            userLocation.longitude,
            restaurant.latitude,
            restaurant.longitude
          );
        }

        // Also check post distances if available
        if (userLocation && posts.length > 0) {
          posts.forEach((post: any) => {
            if (!post.latitude || !post.longitude) return;
            const dist = calculateDistanceKm(
              userLocation.latitude,
              userLocation.longitude,
              post.latitude,
              post.longitude
            );
            if (dist < distanceKm) {
              distanceKm = dist;
              closestPost = post;
            }
          });
        }

        // Get restaurant profile data if available
        const profile = restaurantProfiles[restaurantId];

        return {
          ...restaurant,
          // Use profile data for restaurant name if available
          restaurant_name: profile?.restaurant_name || profile?.full_name || restaurant.restaurant_name || restaurant.name || restaurant.full_name,
          name: profile?.restaurant_name || profile?.full_name || restaurant.name || restaurant.full_name,
          profile_picture: profile?.profile_picture || restaurant.profile_picture,
          food_type: profile?.food_type || restaurant.food_type,
          distance_km: distanceKm,
          distanceKm,
          posts,
          closestPost,
          avgRating,
          reviewCount,
          hasMenu: posts.length > 0,
        };
      })
      .filter(Boolean)
      .sort((a: any, b: any) => (a.distance_km ?? Infinity) - (b.distance_km ?? Infinity));
  };

  const mergeNearbyRestaurants = (posts: any[], restaurants: any[]) => {
    const restaurantMap = new Map<string, any>();

    restaurants.forEach((restaurant: any) => {
      if (!restaurant?.id) return;
      restaurantMap.set(String(restaurant.id), { ...restaurant });
    });

    posts.forEach((post: any) => {
      const restaurantId =
        post.tagged_restaurant_id ||
        post.restaurant_id ||
        (post.account_type === 'restaurant' ? post.user_id : null);

      if (!restaurantId) return;

      const key = String(restaurantId);
      const existing = restaurantMap.get(key);

      let distanceKm = existing?.distance_km ?? Infinity;
      if (
        userLocation &&
        post.latitude &&
        post.longitude
      ) {
        const postDistance = calculateDistanceKm(
          userLocation.latitude,
          userLocation.longitude,
          post.latitude,
          post.longitude
        );
        distanceKm = Math.min(distanceKm, postDistance);
      }

      // Look up fetched restaurant profile for accurate name
      const profile = restaurantProfiles[String(restaurantId)];
      const restaurantName =
        profile?.restaurant_name ||
        profile?.full_name ||
        existing?.restaurant_name ||
        existing?.name ||
        existing?.full_name ||
        post.restaurant_name ||
        post.tagged_restaurant_name ||
        post.full_name ||
        post.username ||
        post.user_name ||
        post.name ||
        'Restaurant';

      const mergedRestaurant = {
        id: restaurantId,
        restaurant_name: restaurantName,
        name: restaurantName,
        profile_picture:
          existing?.profile_picture ||
          post.restaurant_profile_picture ||
          post.user_profile_picture ||
          post.profile_picture ||
          post.profile_picture_url ||
          null,
        food_type: profile?.food_type ?? existing?.food_type ?? post.food_type ?? null,
        latitude: existing?.latitude ?? post.latitude ?? null,
        longitude: existing?.longitude ?? post.longitude ?? null,
        distance_km: distanceKm,
        average_rating: existing?.average_rating ?? post.average_rating ?? null,
        review_count: existing?.review_count ?? post.review_count ?? 0,
        is_verified: existing?.is_verified ?? post.is_verified ?? false,
        bio: existing?.bio ?? post.bio ?? post.restaurant_bio ?? null,
      };

      restaurantMap.set(key, mergedRestaurant);
    });

    return Array.from(restaurantMap.values()).sort(
      (a, b) => (a.distance_km ?? Infinity) - (b.distance_km ?? Infinity)
    );
  };

  // Calculate distance in km (raw number for sorting)
  const calculateDistanceKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  // Format distance for display
  const formatDistance = (distanceKm: number) => {
    if (distanceKm === Infinity) return "";
    return distanceKm < 1 ? `${(distanceKm * 1000).toFixed(0)}m` : `${distanceKm.toFixed(1)}km`;
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
      fetchNearbyPosts(); // Fetch nearby posts with tagged restaurants
    } else if (activeTab === "Rewards" && !isRestaurant) {
      fetchRewardsHistory();
    } else if (activeTab === "In Progress" || activeTab === "Your Orders") {
      fetchOrders();
    }
    setTimeout(() => setRefreshing(false), 1000);
  };

  const toggleFavorite = (id: string) => {
    setFavorites((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  // Get status step information
  const getStatusStep = (status: string) => {
    const steps = [
      {
        key: 'pending',
        label: 'Checking',
        message: 'Sit back and relax! We are checking your order with the restaurant.',
        icon: 'hourglass-outline',
        color: '#FF9800',
      },
      {
        key: 'accepted',
        label: 'Accepted',
        message: 'Restaurant confirms your order. We are assigning a runner.',
        icon: 'checkmark-circle-outline',
        color: '#4CAF50',
      },
      {
        key: 'preparing',
        label: 'Preparing',
        message: 'Restaurant is preparing your delicious meal.',
        icon: 'restaurant-outline',
        color: '#2196F3',
      },
      {
        key: 'out_for_delivery',
        label: 'Out for Delivery',
        message: 'Our runner is on the way to your doorstep!',
        icon: 'bicycle-outline',
        color: '#9C27B0',
      },
    ];

    const currentIndex = steps.findIndex((step) => step.key === status);
    return { steps, currentIndex };
  };

  // Parse dish items from dish_name string (format: "Item1 x2, Item2 x1")
  const parseDishItems = (dishName: string) => {
    if (!dishName) return [];
    const items = dishName.split(',').map((item) => item.trim());
    return items.map((item) => {
      const match = item.match(/^(.+?)\s+x(\d+)$/);
      if (match) {
        return { name: match[1].trim(), quantity: parseInt(match[2]) };
      }
      return { name: item, quantity: 1 };
    });
  };

  // Get status message for restaurant view
  const getRestaurantStatusMessage = (status: string) => {
    switch (status) {
      case 'pending':
        return 'New order! Please accept or reject this order.';
      case 'accepted':
        return 'You accepted this order. Start preparing when ready.';
      case 'preparing':
        return 'Order is being prepared. Mark ready when done.';
      case 'out_for_delivery':
        return 'Order is out for delivery. Partner will mark as delivered.';
      default:
        return '';
    }
  };

  // Update order status (for restaurant accounts)
  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    if (!token) return;

    try {
      const response = await axios.patch(
        `${BACKEND_URL}/api/orders/restaurant-orders/${orderId}/status?status=${newStatus}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        // Update local state
        if (['completed', 'cancelled'].includes(newStatus)) {
          // Move to completed orders
          setActiveOrders((prev) => {
            const order = prev.find((o) => o.id === orderId);
            if (order) {
              setCompletedOrders((completed) => [{ ...order, status: newStatus }, ...completed]);
            }
            return prev.filter((o) => o.id !== orderId);
          });
        } else {
          // Update status in active orders
          setActiveOrders((prev) =>
            prev.map((order) =>
              order.id === orderId ? { ...order, status: newStatus } : order
            )
          );
        }
        Alert.alert("Success", `Order ${newStatus === 'cancelled' ? 'rejected' : 'updated'} successfully`);
      }
    } catch (error) {
      console.error("Error updating order status:", error);
      Alert.alert("Error", "Failed to update order status. Please try again.");
    }
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

  // Render restaurant card for onboarded Cofau restaurants
  const renderRestaurantCard = (restaurant: any) => {
    const isFav = favorites[restaurant.id];
    const displayRating = restaurant.average_rating ? (restaurant.average_rating / 2).toFixed(1) : null;
    const distanceText = restaurant.distance_km < 1
      ? `${(restaurant.distance_km * 1000).toFixed(0)}m`
      : `${restaurant.distance_km.toFixed(1)}km`;

    return (
      <TouchableOpacity
        key={restaurant.id}
        style={styles.restaurantCard}
        onPress={() => router.push(`/profile?userId=${restaurant.id}`)}
        activeOpacity={0.9}
      >
        {/* Restaurant Profile Image */}
        {restaurant.profile_picture ? (
          <Image
            source={{
              uri: fixUrl(restaurant.profile_picture),
              cache: 'force-cache'
            }}
            style={styles.restaurantImage}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.restaurantImage, { backgroundColor: '#E94A37', justifyContent: 'center', alignItems: 'center' }]}>
            <Ionicons name="restaurant" size={40} color="#fff" />
          </View>
        )}

        <View style={styles.restaurantInfo}>
          <View style={styles.restaurantHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              <Text style={styles.restaurantName} numberOfLines={1}>
                {restaurant.restaurant_name || restaurant.name || restaurant.full_name}
              </Text>
              {restaurant.is_verified && (
                <Ionicons name="checkmark-circle" size={16} color="#E94A37" style={{ marginLeft: 6 }} />
              )}
            </View>
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

          {/* Bio */}
          {restaurant.bio && (
            <Text style={styles.cuisineText} numberOfLines={2}>{restaurant.bio}</Text>
          )}

          {/* Rating and Reviews Row */}
          <View style={styles.ratingRow}>
            {displayRating && (
              <>
                <Ionicons name="star" size={14} color="#FFD700" />
                <Text style={styles.ratingText}>{displayRating}</Text>
              </>
            )}
            <Text style={styles.reviewsText}>
              {restaurant.review_count > 0 ? `${restaurant.review_count} Reviews` : 'No reviews yet'}
            </Text>
          </View>

          {/* Distance Row */}
          <View style={styles.distanceRow}>
            <Ionicons name="location" size={14} color="#E94A37" />
            <Text style={styles.distanceText}>{distanceText} away</Text>
          </View>

          {/* Place Order Button */}
          <View style={styles.deliveryRow}>
            <TouchableOpacity
              style={styles.acceptOrderButton}
              onPress={() => {
                // Create a post-like object for the OrderModal
                const restaurantPost = {
                  tagged_restaurant_id: restaurant.id,
                  latitude: restaurant.latitude,
                  longitude: restaurant.longitude,
                  location_name: restaurant.name,
                };
                handleOrderClick(restaurantPost);
              }}
            >
              <Text style={styles.acceptOrderText}>PLACE ORDER</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderVendorCard = (vendor: any) => {
    const sortedPosts = [...(vendor.posts || [])].sort((a, b) => {
      const aDate = a.created_at ? new Date(a.created_at).getTime() : 0;
      const bDate = b.created_at ? new Date(b.created_at).getTime() : 0;
      return bDate - aDate;
    });
    const displayImages = sortedPosts.slice(0, 5);
    const extraCount = sortedPosts.length - 5;
    const hasPosts = sortedPosts.length > 0;
    const vendorId = vendor?.id || vendor?.user_id || vendor?.restaurant_id;
    const profile = vendorId ? restaurantProfiles[String(vendorId)] : null;
    const avgRating = vendor.avgRating || profile?.average_rating || 0;
    const hasRating = avgRating > 0;
    const totalOrders = profile?.total_orders || 0;
    const goToVendorProfile = () => {
      if (vendorId) {
        router.push(`/profile?userId=${vendorId}`);
      }
    };

    return (
      <View key={vendor.id} style={styles.vendorCardOuter}>
      <LinearGradient
        colors={['rgba(255, 122, 24, 0.08)', 'rgba(255, 122, 24, 0.08)']}
        locations={[0, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.vendorCard}
      >
        {/* Vendor Header */}
        <TouchableOpacity
          style={styles.vendorHeader}
          onPress={goToVendorProfile}
          activeOpacity={0.7}
        >
          <View style={styles.vendorNameRow}>
            <Text style={styles.vendorName} numberOfLines={1}>
              {vendor.restaurant_name || vendor.name || vendor.full_name}
            </Text>
            {vendor.food_type && (
              <View style={styles.foodTypeBadgeContainer}>
                {(vendor.food_type === 'veg' || vendor.food_type === 'veg_and_non_veg') && (
                  <View style={[styles.foodTypeBadge, styles.vegBadge]}>
                    <View style={styles.vegDot} />
                  </View>
                )}
                {(vendor.food_type === 'non_veg' || vendor.food_type === 'veg_and_non_veg') && (
                  <View style={[styles.foodTypeBadge, styles.nonVegBadge]}>
                    <View style={styles.nonVegTriangle} />
                  </View>
                )}
              </View>
            )}
            {vendor.is_verified && (
              <Ionicons name="checkmark-circle" size={16} color="#1DA1F2" style={{ marginLeft: 4 }} />
            )}
          </View>
        </TouchableOpacity>

        {/* Distance, Ratings, Orders - all in one row */}
        <TouchableOpacity
          style={styles.vendorMetaRow}
          onPress={goToVendorProfile}
          activeOpacity={0.7}
        >
          {vendor.distanceKm !== Infinity && (
            <View style={styles.vendorMetaItem}>
              <Text style={styles.vendorMetaIcon}>📍</Text>
              <Text style={styles.vendorMetaValue}>{formatDistance(vendor.distanceKm)}</Text>
            </View>
          )}
          {vendor.distanceKm !== Infinity && hasRating && (
            <Text style={styles.vendorMetaDot}>•</Text>
          )}
          {hasRating && (
            <View style={styles.vendorMetaItem}>
              <Ionicons name="star" size={13} color="#FFD700" style={{ marginRight: 3 }} />
              <Text style={styles.vendorMetaText}>Ratings</Text>
              <Text style={styles.vendorMetaValue}>{avgRating % 1 === 0 ? avgRating : avgRating.toFixed(1)}/10</Text>
            </View>
          )}
          {totalOrders > 0 && (hasRating || vendor.distanceKm !== Infinity) && (
            <Text style={styles.vendorMetaDot}>•</Text>
          )}
          {totalOrders > 0 && (
            <View style={styles.vendorMetaItem}>
              <Text style={styles.vendorMetaText}>Orders</Text>
              <Text style={styles.vendorMetaValue}>{totalOrders}</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Image Section - Show posts/reviews if available, otherwise show profile picture */}
        {hasPosts ? (
          <View style={{ marginTop: 8 }}>
            {/* First row - 3 images */}
            <View style={{ flexDirection: 'row', gap: 3, marginBottom: 3 }}>
              {displayImages.slice(0, 3).map((post: any, index: number) => (
                <TouchableOpacity
                  key={post.id || index}
                  onPress={() => {
                    setSelectedImage(fixUrl(post.thumbnail_url || post.media_url || post.image_url));
                    setFullImageModal(true);
                  }}
                  activeOpacity={0.9}
                  style={{ flex: 1, height: 110, borderRadius: 10, overflow: 'hidden', position: 'relative', borderWidth: 0.5, borderColor: '#000' }}
                >
                  <Image
                    source={{
                      uri: fixUrl(post.thumbnail_url || post.media_url || post.image_url),
                      cache: 'force-cache'
                    }}
                    style={{ width: '100%', height: '100%', borderRadius: 10 }}
                    resizeMode="cover"
                  />
                  {(post.dish_name || post.caption) && (
                    <View style={styles.dishNameOverlay}>
                      <Text style={styles.dishNameText} numberOfLines={1}>{(post.dish_name || post.caption).toUpperCase()}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>
            {/* Second row - 2 images + extra count if needed */}
            {displayImages.length > 3 && (
              <View style={{ flexDirection: 'row', gap: 3 }}>
                {displayImages.slice(3, 5).map((post: any, index: number) => (
                  <TouchableOpacity
                    key={post.id || `row2-${index}`}
                    onPress={() => {
                      setSelectedImage(fixUrl(post.thumbnail_url || post.media_url || post.image_url));
                      setFullImageModal(true);
                    }}
                    activeOpacity={0.9}
                    style={{ flex: 1, height: 110, borderRadius: 10, overflow: 'hidden', position: 'relative', borderWidth: 0.5, borderColor: '#000' }}
                  >
                    <Image
                      source={{
                        uri: fixUrl(post.thumbnail_url || post.media_url || post.image_url),
                        cache: 'force-cache'
                      }}
                      style={{ width: '100%', height: '100%', borderRadius: 10 }}
                      resizeMode="cover"
                    />
                    {(post.dish_name || post.caption) && (
                      <View style={styles.dishNameOverlay}>
                        <Text style={styles.dishNameText} numberOfLines={1}>{(post.dish_name || post.caption).toUpperCase()}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
                {extraCount > 0 && (
                  <TouchableOpacity
                    onPress={() => {
                      router.push({
                        pathname: "/location-posts",
                        params: {
                          posts: JSON.stringify(vendor.posts),
                          locationName: vendor.restaurant_name || vendor.name,
                        },
                      });
                    }}
                    activeOpacity={0.9}
                    style={{ flex: 1, height: 110, borderRadius: 10, overflow: 'hidden', position: 'relative', borderWidth: 0.5, borderColor: '#000' }}
                  >
                    <Image
                      source={{
                        uri: fixUrl(
                          sortedPosts[5]?.thumbnail_url ||
                          sortedPosts[5]?.media_url ||
                          sortedPosts[5]?.image_url
                        ),
                        cache: 'force-cache'
                      }}
                      style={{ width: '100%', height: '100%' }}
                      resizeMode="cover"
                      blurRadius={8}
                    />
                    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center', borderRadius: 10 }}>
                      <LinearGradient
                        colors={['#FF2E2E', '#FF7A18']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={{ width: 55, height: 30, borderRadius: 20, justifyContent: 'center', alignItems: 'center' }}
                      >
                        <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>+{extraCount}</Text>
                      </LinearGradient>
                    </View>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        ) : (
          /* Restaurant without posts - show profile picture or placeholder */
          <View style={{ flexDirection: 'row', alignItems: 'center', padding: 12, marginTop: 8 }}>
            {vendor.profile_picture ? (
              <Image
                source={{ uri: fixUrl(vendor.profile_picture) }}
                style={{ width: 60, height: 60, borderRadius: 30, marginRight: 12 }}
                resizeMode="cover"
              />
            ) : (
              <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: '#E94A37', justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                <Ionicons name="restaurant" size={30} color="#fff" />
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, color: '#666' }}>
                {vendor.bio || 'Visit this restaurant to see their menu'}
              </Text>
            </View>
          </View>
        )}

        {/* Place Order Button */}
        <TouchableOpacity
          style={[styles.vendorOrderButton, { marginTop: 12 }]}
          onPress={() => {
            const orderPost = vendor.closestPost
              ? (vendor.closestPost.tagged_restaurant_id
                  ? vendor.closestPost
                  : { ...vendor.closestPost, tagged_restaurant_id: vendor.id })
              : {
                  tagged_restaurant_id: vendor.id,
                  latitude: vendor.latitude,
                  longitude: vendor.longitude,
                  location_name: vendor.restaurant_name || vendor.name,
                };
            handleOrderClick(orderPost);
          }}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={['#FF2E2E', '#FF7A18']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.vendorOrderGradient}
          >
            <Ionicons name="cart" size={14} color="#FFFFFF" style={{ marginRight: 6 }} />
            <Text style={styles.vendorOrderText}>ORDER NOW</Text>
            <Ionicons name="arrow-forward" size={13} color="#FFFFFF" style={{ marginLeft: 6 }} />
          </LinearGradient>
        </TouchableOpacity>
      </LinearGradient>
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
          onPress={() => {
            if (isRestaurant) {
              setShowRestaurantPhoneModal(true);
            } else {
              setShowLocationModal(true);
            }
          }}
        >
          <Ionicons
            name={isRestaurant ? "call" : (userAddress ? "location" : "add-circle-outline")}
            size={20}
            color={
              isRestaurant
                ? (restaurantProfile?.phone || restaurantProfile?.phone_number ? "#4CAF50" : "#FF7A18")
                : (userAddress ? "#4CAF50" : "#FF7A18")
            }
          />
          <View style={styles.locationTextContainer}>
            <Text
              style={[
                styles.locationText,
                (!userAddress && !isRestaurant) && styles.addLocationText,
                (isRestaurant && !restaurantProfile?.phone && !restaurantProfile?.phone_number) && styles.addLocationText,
              ]}
              numberOfLines={1}
            >
              {getDisplayAddress()}
            </Text>
            {!isRestaurant && userAddress && userAddress.address && (
              <Text style={styles.locationSubtext} numberOfLines={1}>
                {userAddress.address}
              </Text>
            )}
          </View>
          <Ionicons name="chevron-down" size={18} color="#333" />
        </TouchableOpacity>

{!isRestaurant && (
          <TouchableOpacity
            style={styles.walletButton}
            onPress={() => setShowWalletModal(true)}
          >
            <Ionicons name="wallet-outline" size={24} color="#333" />
          </TouchableOpacity>
        )}
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
        bounces={false}
      >
        {(isRestaurant ? RESTAURANT_TABS : TABS).map((tab, index) => {
          const tabsArray = isRestaurant ? RESTAURANT_TABS : TABS;
          const isInProgressTab = tab === "In Progress";
          const orderCount = isInProgressTab ? activeOrders.length : 0;
          const showBadge = isInProgressTab && orderCount > 0;

          return (
            <TouchableOpacity
              key={tab}
              style={[
                styles.tab,
                index === tabsArray.length - 1 && styles.lastTab,
              ]}
              onPress={() => setActiveTab(tab)}
            >
              {activeTab === tab ? (
                <LinearGradient
                  colors={["#FF6B35", "#FF8C00"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.tabInner}
                >
                  <Text style={styles.activeTabText}>{tab}</Text>
                  {showBadge && (
                    <View style={styles.tabBadgeActive}>
                      <Text style={styles.tabBadgeTextActive}>{orderCount}</Text>
                    </View>
                  )}
                </LinearGradient>
              ) : (
                <View style={[styles.tabInner, styles.tabInnerInactive]}>
                  <Text style={styles.tabText}>{tab}</Text>
                  {showBadge && (
                    <View style={styles.tabBadge}>
                      <Text style={styles.tabBadgeText}>{orderCount}</Text>
                    </View>
                  )}
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

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
            {/* Section Title */}
            <View style={styles.filterRow}>
              <Text style={styles.sectionTitle}>Order from nearby</Text>
              <View style={{ backgroundColor: '#FFF3E0', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 }}>
                <Text style={{ fontSize: 12, color: '#FF8C00', fontWeight: '600' }}>Within 3km</Text>
              </View>
            </View>

            {loadingPosts ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#FF8C00" />
                <Text style={styles.loadingText}>Finding nearby food...</Text>
              </View>
            ) : nearbyPosts.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="restaurant-outline" size={64} color="#CCC" />
                <Text style={styles.emptyText}>No restaurants found nearby</Text>
                <Text style={styles.emptySubtext}>
                  No posts from Cofau partner restaurants within 3km
                </Text>
                <TouchableOpacity
                  style={styles.retryButton}
                  onPress={getCurrentLocation}
                >
                  <Text style={styles.retryButtonText}>Retry</Text>
                </TouchableOpacity>
              </View>
            ) : (
              getNearbyRestaurantCards().map((restaurant) => renderVendorCard(restaurant))
            )}
          </>
        ) : activeTab === "In Progress" ? (
          <>
            <Text style={styles.sectionTitle}>
              {isRestaurant ? "Incoming Orders" : "Orders In Progress"}
            </Text>
            {loadingOrders ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#FF8C00" />
                <Text style={styles.loadingText}>Loading orders...</Text>
              </View>
            ) : activeOrders.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="receipt-outline" size={64} color="#CCC" />
                <Text style={styles.emptyText}>
                  {isRestaurant ? "No incoming orders" : "No active orders"}
                </Text>
                <Text style={styles.emptySubtext}>
                  {isRestaurant
                    ? "Orders from customers will appear here"
                    : "Order from nearby posts to see them here"}
                </Text>
              </View>
            ) : (
              activeOrders.map((order, orderIdx) => {
                const { steps, currentIndex } = getStatusStep(order.status);
                const currentStep = steps[currentIndex];
                const dishItems = parseDishItems(order.dish_name);
                const restaurantProfile = order.restaurant_id ? restaurantProfiles[order.restaurant_id] : null;

                return (
                  <View style={styles.newOrderCard} key={`order-${order.id}-${orderIdx}`}>
                    {/* For Restaurant: Show Customer Info (without contact details) */}
                    {isRestaurant && (
                      <View style={styles.customerInfoSection}>
                        <View style={styles.customerHeader}>
                          {order.customer_profile_picture ? (
                            <Image
                              source={{ uri: fixUrl(order.customer_profile_picture) }}
                              style={styles.customerAvatar}
                              resizeMode="cover"
                            />
                          ) : (
                            <View style={styles.customerAvatar}>
                              <Ionicons name="person" size={24} color="#FFF" />
                            </View>
                          )}
                          <View style={styles.customerDetails}>
                            <Text style={styles.customerName}>{order.customer_name || "Customer"}</Text>
                          </View>
                        </View>
                      </View>
                    )}

                    {/* For Regular User: Show Restaurant Profile Picture */}
                    {!isRestaurant && (
                      order.restaurant_profile_picture ? (
                        <Image
                          source={{ uri: fixUrl(order.restaurant_profile_picture) }}
                          style={styles.restaurantProfilePic}
                          resizeMode="cover"
                        />
                      ) : (
                        <View style={styles.restaurantProfilePic}>
                          <Ionicons name="restaurant" size={30} color="#999" />
                        </View>
                      )
                    )}

                    {/* Order Items */}
                    <View style={styles.orderItemsSection}>
                      <Text style={styles.orderItemsTitle}>Items:</Text>
                      {dishItems.map((item, index) => (
                        <View style={styles.orderItemRow} key={`item-${orderIdx}-${index}`}>
                          <Text style={styles.orderItemName}>• {item.name}</Text>
                          <Text style={styles.orderItemQuantity}>Qty: {item.quantity}</Text>
                        </View>
                      ))}
                    </View>

                    {/* Total Amount */}
                    {order.price && (
                      <View style={styles.orderTotalRow}>
                        <Text style={styles.orderTotalLabel}>Total Amount:</Text>
                        <Text style={styles.orderTotalAmount}>₹{order.price}</Text>
                      </View>
                    )}

                    {/* Suggestions/Notes */}
                    {order.suggestions && (
                      <View style={styles.orderNotesRow}>
                        <Ionicons name="chatbubble-outline" size={14} color="#666" />
                        <Text style={styles.orderNotesText}>Note: {order.suggestions}</Text>
                      </View>
                    )}

                    {/* Restaurant Name (for regular users) */}
                    {!isRestaurant && order.restaurant_name && (
                      <View style={styles.newOrderRestaurantRow}>
                        <Ionicons name="restaurant" size={16} color="#FF8C00" />
                        <Text style={styles.newOrderRestaurantName}>{order.restaurant_name}</Text>
                      </View>
                    )}

                    {/* Status Progress Bar */}
                    <View style={styles.statusProgressContainer}>
                      <View style={styles.statusStepsRow}>
                        {steps.map((step, index) => (
                          <View style={styles.statusStepItem} key={`step-${step.key}`}>
                            <View
                              style={[
                                styles.statusStepCircle,
                                index <= currentIndex && styles.statusStepCircleActive,
                                { borderColor: index <= currentIndex ? step.color : '#E0E0E0' },
                              ]}
                            >
                              {index < currentIndex ? (
                                <Ionicons name="checkmark" size={16} color={steps[index].color} />
                              ) : index === currentIndex ? (
                                <Ionicons name={step.icon as any} size={16} color={step.color} />
                              ) : (
                                <View style={styles.statusStepDot} />
                              )}
                            </View>
                            {index < steps.length - 1 && (
                              <View
                                style={[
                                  styles.statusStepLine,
                                  index < currentIndex && styles.statusStepLineActive,
                                ]}
                              />
                            )}
                          </View>
                        ))}
                      </View>

                      {/* Current Status Message */}
                      {currentStep && (
                        <View style={[styles.currentStatusBox, { backgroundColor: currentStep.color + '15' }]}>
                          <Ionicons name={currentStep.icon as any} size={20} color={currentStep.color} />
                          <View style={styles.currentStatusTextContainer}>
                            <Text style={[styles.currentStatusLabel, { color: currentStep.color }]}>
                              {currentStep.label}
                            </Text>
                            <Text style={styles.currentStatusMessage}>
                              {isRestaurant
                                ? getRestaurantStatusMessage(order.status)
                                : currentStep.message}
                            </Text>
                          </View>
                        </View>
                      )}
                    </View>

                    {/* Support Button for Regular Users */}
                    {!isRestaurant && (
                      <TouchableOpacity
                        style={styles.supportButton}
                        onPress={() => Linking.openURL('tel:9964704777')}
                      >
                        <Ionicons name="call" size={18} color="#FFF" />
                        <Text style={styles.supportButtonText}>Contact Support</Text>
                      </TouchableOpacity>
                    )}

                    {/* Restaurant Action Buttons */}
                    {isRestaurant && (
                      <View style={styles.restaurantActionButtons}>
                        {order.status === 'pending' && (
                          <>
                            <TouchableOpacity
                              style={styles.acceptButton}
                              onPress={() => updateOrderStatus(order.id, 'accepted')}
                            >
                              <Ionicons name="checkmark-circle" size={18} color="#FFF" />
                              <Text style={styles.acceptButtonText}>Accept</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={styles.rejectButton}
                              onPress={() => updateOrderStatus(order.id, 'cancelled')}
                            >
                              <Ionicons name="close-circle" size={18} color="#FFF" />
                              <Text style={styles.rejectButtonText}>Reject</Text>
                            </TouchableOpacity>
                          </>
                        )}
                        {order.status === 'accepted' && (
                          <TouchableOpacity
                            style={styles.nextStatusButton}
                            onPress={() => updateOrderStatus(order.id, 'preparing')}
                          >
                            <Ionicons name="restaurant" size={18} color="#FFF" />
                            <Text style={styles.nextStatusButtonText}>Start Preparing</Text>
                          </TouchableOpacity>
                        )}
                        {order.status === 'preparing' && (
                          <TouchableOpacity
                            style={styles.nextStatusButton}
                            onPress={() => updateOrderStatus(order.id, 'out_for_delivery')}
                          >
                            <Ionicons name="bicycle" size={18} color="#FFF" />
                            <Text style={styles.nextStatusButtonText}>Ready for Pickup</Text>
                          </TouchableOpacity>
                        )}
                        {order.status === 'out_for_delivery' && (
                          <View style={[styles.orderStatusBadge, { backgroundColor: '#9C27B0', paddingHorizontal: 16, paddingVertical: 8 }]}>
                            <Ionicons name="bicycle" size={18} color="#FFF" style={{ marginRight: 6 }} />
                            <Text style={[styles.orderStatusText, { color: '#FFF', fontSize: 14 }]}>Out for Delivery</Text>
                          </View>
                        )}
                      </View>
                    )}

                    {/* Order Time */}
                    <Text style={styles.orderTimeText}>
                      Ordered: {new Date(order.created_at).toLocaleDateString()} at{" "}
                      {new Date(order.created_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </Text>
                  </View>
                );
              })
            )}
          </>
        ) : activeTab === "Your Orders" ? (
          <>
            <Text style={styles.sectionTitle}>
              {isRestaurant ? "Completed Orders" : "Order History"}
            </Text>
            {loadingOrders ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#FF8C00" />
                <Text style={styles.loadingText}>Loading orders...</Text>
              </View>
            ) : completedOrders.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="checkmark-done-circle-outline" size={64} color="#CCC" />
                <Text style={styles.emptyText}>No completed orders</Text>
                <Text style={styles.emptySubtext}>
                  Completed and cancelled orders will appear here
                </Text>
              </View>
            ) : (
              completedOrders.map((order) => (
                <View key={order.id} style={styles.orderCard}>
                  {/* For restaurants: show customer avatar instead of post image */}
                  {isRestaurant ? (
                    order.customer_profile_picture ? (
                      <Image
                        source={{ uri: fixUrl(order.customer_profile_picture) }}
                        style={styles.customerAvatarSmall}
                        resizeMode="cover"
                      />
                    ) : (
                      <View style={styles.customerAvatarSmall}>
                        <Ionicons name="person" size={20} color="#FFF" />
                      </View>
                    )
                  ) : (
                    order.restaurant_profile_picture ? (
                      <Image
                        source={{ uri: fixUrl(order.restaurant_profile_picture) }}
                        style={styles.orderImage}
                        resizeMode="cover"
                      />
                    ) : (
                      <View style={styles.orderImage}>
                        <Ionicons name="restaurant" size={30} color="#999" />
                      </View>
                    )
                  )}
                  <View style={styles.orderInfo}>
                    <View style={styles.orderHeader}>
                      <Text style={styles.orderDishName}>{order.dish_name}</Text>
                      <View style={[
                        styles.orderStatusBadge,
                        order.status === "completed" && styles.orderStatusCompleted,
                        order.status === "cancelled" && styles.orderStatusCancelled,
                      ]}>
                        <Text style={styles.orderStatusText}>
                          {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                        </Text>
                      </View>
                    </View>

                    {/* For restaurants: show customer info */}
                    {isRestaurant && (
                      <View style={styles.customerInfoSmall}>
                        <Text style={styles.customerNameSmall}>
                          {order.customer_name || "Customer"}
                        </Text>
                      </View>
                    )}

                    {/* Total Amount */}
                    {order.price && (
                      <View style={styles.orderTotalRowSmall}>
                        <Text style={styles.orderTotalLabelSmall}>Total:</Text>
                        <Text style={styles.orderTotalAmountSmall}>₹{order.price}</Text>
                      </View>
                    )}

                    {/* Cancellation Message */}
                    {order.status === "cancelled" && !isRestaurant && (
                      <View style={styles.cancellationBox}>
                        <Ionicons name="close-circle" size={20} color="#FF3B30" />
                        <View style={styles.cancellationTextContainer}>
                          <Text style={styles.cancellationTitle}>Order Cancelled</Text>
                          <Text style={styles.cancellationMessage}>
                            We are so sorry. Your order has been cancelled. If you have any questions, please contact support.
                          </Text>
                        </View>
                      </View>
                    )}

                    {/* For regular users: show restaurant name */}
                    {!isRestaurant && order.restaurant_name && (
                      <View style={styles.orderRestaurantRow}>
                        <Ionicons name="restaurant" size={14} color="#666" />
                        <Text style={styles.orderRestaurantName}>
                          {order.restaurant_name}
                        </Text>
                      </View>
                    )}

                    {order.post_location && !isRestaurant && (
                      <View style={styles.orderLocationRow}>
                        <Ionicons name="location" size={14} color="#FF3B30" />
                        <Text style={styles.orderLocationText}>{order.post_location}</Text>
                      </View>
                    )}

                    {order.suggestions && (
                      <Text style={styles.orderSuggestions} numberOfLines={2}>
                        Note: {order.suggestions}
                      </Text>
                    )}

                    {/* Add Review Button for Regular Users on Completed Orders */}
                    {!isRestaurant && order.status === "completed" && !order.has_review && (
                      <TouchableOpacity
                        style={styles.addReviewButton}
                        onPress={() => handleAddReview(order)}
                      >
                        <Ionicons name="star-outline" size={16} color="#FF8C00" />
                        <Text style={styles.addReviewButtonText}>Add Review</Text>
                      </TouchableOpacity>
                    )}

                    <Text style={styles.orderTime}>
                      {new Date(order.created_at).toLocaleDateString()} at{" "}
                      {new Date(order.created_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </>
        ) : activeTab === "Reviews/Complaints" && isRestaurant ? (
          <>
            <Text style={styles.sectionTitle}>Customer Reviews & Complaints</Text>
            {loadingReviews ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#FF8C00" />
                <Text style={styles.loadingText}>Loading reviews...</Text>
              </View>
            ) : restaurantReviews.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="chatbubbles-outline" size={64} color="#CCC" />
                <Text style={styles.emptyText}>No reviews yet</Text>
                <Text style={styles.emptySubtext}>
                  Customer reviews and complaints will appear here
                </Text>
              </View>
            ) : (
              restaurantReviews.map((review) => (
                <View key={review.id} style={styles.reviewCard}>
                  <View style={styles.reviewHeader}>
                    {/* Customer Avatar */}
                    {review.customer_profile_picture ? (
                      <Image
                        source={{ uri: fixUrl(review.customer_profile_picture) }}
                        style={styles.reviewCustomerAvatar}
                        resizeMode="cover"
                      />
                    ) : (
                      <View style={styles.reviewCustomerAvatar}>
                        <Ionicons name="person" size={20} color="#FFF" />
                      </View>
                    )}

                    <View style={styles.reviewOrderInfo}>
                      <Text style={styles.reviewOrderDish}>{review.dish_name}</Text>
                      <Text style={styles.reviewCustomerName}>
                        {review.customer_name || "Customer"}
                      </Text>
                    </View>
                    <View style={styles.reviewRatingContainer}>
                      <Ionicons name="star" size={16} color="#FFD700" />
                      <Text style={styles.postRatingText}>{review.rating}</Text>
                    </View>
                  </View>

                  {review.is_complaint && (
                    <View style={[styles.reviewTypeBadge, styles.reviewTypeBadgeComplaint]}>
                      <Text style={styles.reviewTypeBadgeText}>COMPLAINT</Text>
                    </View>
                  )}

                  <Text style={styles.reviewTextContent}>{review.review_text}</Text>

                  {review.order_id && (
                    <Text style={styles.reviewTimeText}>
                      Order #{review.order_id.slice(0, 8)} • {new Date(review.created_at).toLocaleDateString()}
                    </Text>
                  )}

                  {/* Message Button */}
                  {review.user_id && (
                    <TouchableOpacity
                      style={styles.reviewMessageButton}
                      onPress={() => {
                        router.push({
                          pathname: `/chat/${review.user_id}`,
                          params: {
                            fullName: review.customer_name || "Customer",
                            profilePicture: review.customer_profile_picture || "",
                            autoSendOrderCard: "true",
                            orderDetails: JSON.stringify({
                              dish_name: review.dish_name,
                              rating: review.rating,
                              order_id: review.order_id,
                              review_text: review.review_text,
                              is_complaint: review.is_complaint,
                              created_at: review.created_at
                            })
                          }
                        });
                      }}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="chatbubble-outline" size={16} color="#FF8C00" />
                      <Text style={styles.reviewMessageButtonText}>Send Message</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))
            )}
          </>
        ) : activeTab === "Rewards" && !isRestaurant ? (
          <>
            {/* Info Note */}
            <View style={styles.rewardsInfoNote}>
              <Ionicons name="information-circle" size={20} color="#FF8C00" />
              <Text style={styles.rewardsInfoNoteText}>
                ₹10/- for every delivery completed. Earn ₹50/- Bonus for completing 10 delivery orders!
              </Text>
            </View>

            {/* Wallet Balance */}
            <View style={styles.walletBalanceCard}>
              <View style={styles.walletBalanceHeader}>
                <Ionicons name="wallet" size={24} color="#4CAF50" />
                <Text style={styles.walletBalanceTitle}>Cofau Wallet</Text>
              </View>
              <Text style={styles.walletBalanceAmount}>₹{walletBalance.toFixed(2)}</Text>
              <Text style={styles.walletBalanceSubtext}>Available Balance</Text>
            </View>

            {/* Rewards History */}
            <Text style={styles.rewardsHistoryTitle}>Rewards History</Text>

            {loadingRewardsHistory ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#FF8C00" />
                <Text style={styles.loadingText}>Loading history...</Text>
              </View>
            ) : rewardsHistory.length === 0 ? (
              <View style={styles.emptyHistoryContainer}>
                <Ionicons name="receipt-outline" size={48} color="#CCC" />
                <Text style={styles.emptyHistoryText}>No rewards yet</Text>
                <Text style={styles.emptyHistorySubtext}>
                  Complete deliveries to start earning rewards!
                </Text>
              </View>
            ) : (
              rewardsHistory.map((transaction) => (
                <View key={transaction.id} style={styles.rewardHistoryItem}>
                    <View style={styles.rewardHistoryIcon}>
                      <Ionicons
                        name={transaction.amount >= 50 ? "gift" : "checkmark-circle"}
                        size={24}
                        color={transaction.amount >= 50 ? "#4CAF50" : "#FF8C00"}
                      />
                    </View>
                    <View style={styles.rewardHistoryContent}>
                      <Text style={styles.rewardHistoryDescription}>
                        {transaction.description}
                      </Text>
                      {transaction.order_details && (
                        <View style={styles.rewardOrderDetails}>
                          <Text style={styles.rewardOrderDish}>
                            {transaction.order_details.dish_name}
                          </Text>
                          {transaction.order_details.restaurant_name && (
                            <Text style={styles.rewardOrderRestaurant}>
                              {transaction.order_details.restaurant_name}
                            </Text>
                          )}
                        </View>
                      )}
                      <Text style={styles.rewardHistoryDate}>
                        {transaction.date || (transaction.created_at ? new Date(transaction.created_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        }) : 'Unknown')}
                      </Text>
                    </View>
                    <View style={styles.rewardHistoryAmount}>
                      <Text style={[
                        styles.rewardHistoryAmountText,
                        transaction.amount >= 50 && styles.rewardHistoryBigAmount
                      ]}>
                        +₹{transaction.amount}
                      </Text>
                    </View>
                  </View>
                ))
            )}
          </>
        ) : (
          <>
            <Text style={styles.sectionTitle}>Restaurants near you (within 3km)</Text>
            {loadingRestaurants ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#FF8C00" />
                <Text style={styles.loadingText}>Finding nearby restaurants...</Text>
              </View>
            ) : nearbyRestaurants.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="restaurant-outline" size={64} color="#CCC" />
                <Text style={styles.emptyText}>No restaurants found nearby</Text>
                <Text style={styles.emptySubtext}>
                  No Cofau restaurants within 3km of your location
                </Text>
                <TouchableOpacity
                  style={styles.retryButton}
                  onPress={() => {
                    if (userLocation) {
                      fetchNearbyRestaurants(userLocation);
                    } else {
                      getCurrentLocation();
                    }
                  }}
                >
                  <Text style={styles.retryButtonText}>Retry</Text>
                </TouchableOpacity>
              </View>
            ) : (
              nearbyRestaurants.map((restaurant) => renderRestaurantCard(restaurant))
            )}
          </>
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Full Image Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={fullImageModal}
        onRequestClose={() => setFullImageModal(false)}
      >
        <View style={styles.fullImageModalOverlay}>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => setFullImageModal(false)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="close-circle" size={36} color="#FFF" />
          </TouchableOpacity>
          <Image
            source={{
              uri: selectedImage || "",
              cache: 'force-cache'
            }}
            style={styles.fullImage}
            resizeMode="contain"
          />
        </View>
      </Modal>

      {/* Filter Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={filterModalVisible}
        onRequestClose={() => setFilterModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.filterModalOverlay}
          activeOpacity={1}
          onPress={() => setFilterModalVisible(false)}
        >
          <View style={styles.filterModalContent}>
            <View style={styles.filterModalHeader}>
              <Text style={styles.filterModalTitle}>Filter Posts</Text>
              <TouchableOpacity onPress={() => setFilterModalVisible(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            {/* Top Rated */}
            <TouchableOpacity
              style={[
                styles.filterOption,
                postFilter === 'topRated' && styles.filterOptionSelected,
              ]}
              onPress={() => {
                setPostFilter('topRated');
                setFilterModalVisible(false);
              }}
              activeOpacity={0.7}
            >
              <View style={styles.filterOptionLeft}>
                <View style={[styles.filterOptionIcon, { backgroundColor: '#FFF9E6' }]}>
                  <Ionicons name="star" size={20} color="#F2CF68" />
                </View>
                <View>
                  <Text style={styles.filterOptionText}>Top Rated</Text>
                  <Text style={styles.filterOptionSubtext}>9+ stars</Text>
                </View>
              </View>
              <Text
                style={[
                  styles.filterOptionCount,
                  postFilter === 'topRated' && styles.filterOptionCountSelected,
                ]}
              >
                {filterCounts.topRated}
              </Text>
            </TouchableOpacity>

            {/* Most Loved */}
            <TouchableOpacity
              style={[
                styles.filterOption,
                postFilter === 'mostLoved' && styles.filterOptionSelected,
              ]}
              onPress={() => {
                setPostFilter('mostLoved');
                setFilterModalVisible(false);
              }}
              activeOpacity={0.7}
            >
              <View style={styles.filterOptionLeft}>
                <View style={[styles.filterOptionIcon, { backgroundColor: '#FFEEEE' }]}>
                  <Ionicons name="heart" size={20} color="#E94A37" />
                </View>
                <View>
                  <Text style={styles.filterOptionText}>Most Loved</Text>
                  <Text style={styles.filterOptionSubtext}>Highest likes</Text>
                </View>
              </View>
              <Text
                style={[
                  styles.filterOptionCount,
                  postFilter === 'mostLoved' && styles.filterOptionCountSelected,
                ]}
              >
                {filterCounts.mostLoved}
              </Text>
            </TouchableOpacity>

            {/* Newest */}
            <TouchableOpacity
              style={[
                styles.filterOption,
                postFilter === 'newest' && styles.filterOptionSelected,
              ]}
              onPress={() => {
                setPostFilter('newest');
                setFilterModalVisible(false);
              }}
              activeOpacity={0.7}
            >
              <View style={styles.filterOptionLeft}>
                <View style={[styles.filterOptionIcon, { backgroundColor: '#E8F5E9' }]}>
                  <Ionicons name="time" size={20} color="#4CAF50" />
                </View>
                <View>
                  <Text style={styles.filterOptionText}>Newest</Text>
                  <Text style={styles.filterOptionSubtext}>Last 7 days</Text>
                </View>
              </View>
              <Text
                style={[
                  styles.filterOptionCount,
                  postFilter === 'newest' && styles.filterOptionCountSelected,
                ]}
              >
                {filterCounts.newest}
              </Text>
            </TouchableOpacity>

            {/* Disliked */}
            <TouchableOpacity
              style={[
                styles.filterOption,
                postFilter === 'disliked' && styles.filterOptionSelected,
              ]}
              onPress={() => {
                setPostFilter('disliked');
                setFilterModalVisible(false);
              }}
              activeOpacity={0.7}
            >
              <View style={styles.filterOptionLeft}>
                <View style={[styles.filterOptionIcon, { backgroundColor: '#FFF3E0' }]}>
                  <Ionicons name="thumbs-down" size={20} color="#FF9800" />
                </View>
                <View>
                  <Text style={styles.filterOptionText}>Disliked</Text>
                  <Text style={styles.filterOptionSubtext}>Below 6 stars</Text>
                </View>
              </View>
              <Text
                style={[
                  styles.filterOptionCount,
                  postFilter === 'disliked' && styles.filterOptionCountSelected,
                ]}
              >
                {filterCounts.disliked}
              </Text>
            </TouchableOpacity>

            {/* Clear Filter Button */}
            {postFilter && (
              <TouchableOpacity
                style={styles.clearFilterButton}
                onPress={() => {
                  setPostFilter(null);
                  setFilterModalVisible(false);
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.clearFilterText}>Clear Filter</Text>
              </TouchableOpacity>
            )}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Order Modal */}
      <OrderModal
        visible={showOrderModal}
        onClose={() => setShowOrderModal(false)}
        post={selectedPost}
        token={token || ""}
        onOrderPlaced={handleOrderPlaced}
        userLocation={userLocation}
      />

      {/* Review Modal */}
      <ReviewModal
        visible={showReviewModal}
        onClose={() => setShowReviewModal(false)}
        order={selectedOrderForReview}
        token={token || ""}
        onReviewAdded={handleReviewAdded}
      />

      {/* Restaurant Phone Number Modal */}
      {isRestaurant && (
        <Modal
          visible={showRestaurantPhoneModal}
          transparent
          animationType="slide"
          onRequestClose={() => {
            if (restaurantProfile?.phone || restaurantProfile?.phone_number) {
              setShowRestaurantPhoneModal(false);
            }
          }}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.phoneModal}>
              <View style={styles.phoneModalHeader}>
                <Text style={styles.phoneModalTitle}>Add Phone Number</Text>
                {(restaurantProfile?.phone || restaurantProfile?.phone_number) && (
                  <TouchableOpacity onPress={() => setShowRestaurantPhoneModal(false)}>
                    <Ionicons name="close" size={24} color="#333" />
                  </TouchableOpacity>
                )}
              </View>

              <Text style={styles.phoneModalDescription}>
                Please add your phone number to receive orders. Customers need this to contact you for delivery coordination.
              </Text>

              <View style={styles.phoneInputContainer}>
                <Ionicons name="call" size={20} color="#FF7A18" style={{ marginRight: 12 }} />
                <TextInput
                  style={styles.phoneInput}
                  placeholder="Enter 10-digit phone number"
                  placeholderTextColor="#999"
                  value={restaurantPhone}
                  onChangeText={setRestaurantPhone}
                  keyboardType="phone-pad"
                  maxLength={10}
                />
              </View>

              <TouchableOpacity
                style={[
                  styles.savePhoneButton,
                  (!restaurantPhone.trim() || restaurantPhone.length !== 10) && styles.savePhoneButtonDisabled
                ]}
                onPress={saveRestaurantPhone}
                disabled={!restaurantPhone.trim() || restaurantPhone.length !== 10}
              >
                <Text style={styles.savePhoneButtonText}>Save Phone Number</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

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
    maxHeight: 48,
    backgroundColor: "#FFFFFF",
    flexGrow: 0,
  },
  tabsContainer: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
  },
  tab: {
    marginRight: 6,
    flexShrink: 0,
  },
  tabInner: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  tabInnerInactive: {
    backgroundColor: '#F5F5F5',
    borderWidth: 0,
  },
  tabText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#000",
  },
  activeTabText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  tabBadge: {
    backgroundColor: "#FF8C00",
    borderRadius: 10,
    minWidth: 16,
    height: 16,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 4,
  },
  tabBadgeText: {
    fontSize: 9,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  tabBadgeActive: {
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    minWidth: 16,
    height: 16,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 4,
  },
  tabBadgeTextActive: {
    fontSize: 9,
    fontWeight: "700",
    color: "#FF8C00",
  },
  lastTab: {
    marginRight: 16, // Extra padding for the last item
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
    fontSize: 11,
    fontWeight: "600",
    color: "#FFFFFF",
    marginRight: 2,
  },
  reviewsText: {
    fontSize: 13,
    color: "#888",
  },
  distanceRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
    gap: 4,
  },
  distanceText: {
    fontSize: 12,
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
  centerIconGradient: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 2,
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  centerIconGradientFilled: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 2,
    elevation: 8,
    shadowColor: "#E94A37",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
  },
  centerIconCircleActive: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
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
    flexGrow: 0, // Prevent unnecessary growth
  },
  categoryContainer: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: 'row', // Ensure horizontal layout
    alignItems: 'center',
  },
  categoryChipOuter: {
    marginRight: 8,
    flexShrink: 0,
  },
  categoryChipInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F5F5F5",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    minHeight: 40,
  },
  categoryChipInnerActive: {
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
  lastCategory: {
    marginRight: 16,
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
  userInfoContainer: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 8,
    gap: 10,
  },
  username: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1A1A1A",
    flex: 1,
  },
  postRatingContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  postRatingText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#000",
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
  filterRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  filterButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F5F5F5",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  filterButtonActive: {
    backgroundColor: "#FF8C00",
    borderColor: "#FF8C00",
  },
  filterButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#666",
  },
  filterButtonTextActive: {
    color: "#FFFFFF",
  },
  filterModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  filterModalContent: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: "70%",
  },
  filterModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  filterModalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#222",
  },
  filterOption: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 12,
    backgroundColor: "#F8F8F8",
    borderWidth: 2,
    borderColor: "transparent",
  },
  filterOptionSelected: {
    backgroundColor: "#FFF9E6",
    borderColor: "#FF8C00",
  },
  filterOptionLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  filterOptionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  filterOptionText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#222",
  },
  filterOptionSubtext: {
    fontSize: 12,
    color: "#999",
    marginTop: 2,
  },
  filterOptionCount: {
    fontSize: 16,
    fontWeight: "700",
    color: "#999",
  },
  filterOptionCountSelected: {
    color: "#FF8C00",
  },
  clearFilterButton: {
    backgroundColor: "#FF8C00",
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 8,
  },
  clearFilterText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
    textAlign: "center",
  },
  fullImageModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.95)",
    justifyContent: "center",
    alignItems: "center",
  },
  closeButton: {
    position: "absolute",
    top: Platform.OS === "ios" ? 50 : StatusBar.currentHeight! + 10,
    right: 20,
    zIndex: 10,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    borderRadius: 18,
  },
  fullImage: {
    width: Dimensions.get("window").width,
    height: Dimensions.get("window").height,
  },
  emptySubtext: {
    fontSize: 14,
    color: "#999",
    textAlign: "center",
    marginTop: 8,
  },
  orderCard: {
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
  orderImage: {
    width: 80,
    height: 80,
    borderRadius: 10,
    backgroundColor: "#F0F0F0",
    justifyContent: "center",
    alignItems: "center",
  },
  orderInfo: {
    flex: 1,
    marginLeft: 12,
  },
  orderHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  orderDishName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1A1A1A",
    flex: 1,
    marginRight: 8,
  },
  orderStatusBadge: {
    backgroundColor: "#FF8C00",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  orderStatusCompleted: {
    backgroundColor: "#4CAF50",
  },
  orderStatusCancelled: {
    backgroundColor: "#999",
  },
  orderStatusText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  orderRestaurantRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  orderRestaurantName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    marginLeft: 6,
  },
  orderLocationRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  orderLocationText: {
    fontSize: 13,
    color: "#666",
    marginLeft: 6,
  },
  orderSuggestions: {
    fontSize: 12,
    color: "#666",
    fontStyle: "italic",
    marginBottom: 6,
  },
  orderTime: {
    fontSize: 11,
    color: "#999",
    marginTop: 4,
  },
  cancellationBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#FFF0F0",
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
    marginBottom: 8,
    gap: 10,
    borderWidth: 1,
    borderColor: "#FFCCCC",
  },
  cancellationTextContainer: {
    flex: 1,
  },
  cancellationTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FF3B30",
    marginBottom: 4,
  },
  cancellationMessage: {
    fontSize: 13,
    color: "#666",
    lineHeight: 18,
  },
  // New Order Card Styles with Status Steps
  newOrderCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    marginBottom: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: "#F0F0F0",
  },
  restaurantProfilePic: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#F0F0F0",
    marginBottom: 12,
    alignSelf: "center",
    justifyContent: "center",
    alignItems: "center",
  },
  orderItemsSection: {
    marginBottom: 12,
  },
  orderItemsTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#333",
    marginBottom: 8,
  },
  orderItemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
  },
  orderItemName: {
    fontSize: 14,
    color: "#555",
    flex: 1,
  },
  orderItemQuantity: {
    fontSize: 13,
    fontWeight: "600",
    color: "#FF8C00",
  },
  newOrderRestaurantRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  newOrderRestaurantName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#333",
    marginLeft: 6,
  },
  statusProgressContainer: {
    marginBottom: 12,
  },
  statusStepsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  statusStepItem: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  statusStepCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FFF",
  },
  statusStepCircleActive: {
    backgroundColor: "#FFF",
  },
  statusStepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#E0E0E0",
  },
  statusStepLine: {
    flex: 1,
    height: 2,
    backgroundColor: "#E0E0E0",
    marginLeft: 4,
  },
  statusStepLineActive: {
    backgroundColor: "#4CAF50",
  },
  currentStatusBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 12,
    borderRadius: 12,
    gap: 10,
  },
  currentStatusTextContainer: {
    flex: 1,
  },
  currentStatusLabel: {
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 4,
  },
  currentStatusMessage: {
    fontSize: 13,
    color: "#666",
    lineHeight: 18,
  },
  orderTimeText: {
    fontSize: 11,
    color: "#999",
    textAlign: "center",
    marginTop: 8,
  },
  // Vendor Card Styles
  dishNameOverlay: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    backgroundColor: 'rgba(233, 74, 55, 0.85)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    maxWidth: '85%',
    zIndex: 20,
  },
  dishNameText: {
    color: '#FFF',
    fontSize: 8,
    fontWeight: '600',
  },
  vendorCardOuter: {
    marginHorizontal: 8,
    marginBottom: 14,
    borderRadius: 15,
    backgroundColor: '#fff',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: Platform.OS === 'android' ? 1 : 0,
    borderColor: "#E8E8E8",
  },
  vendorCard: {
    borderRadius: 15,
    padding: 12,
    overflow: 'hidden',
  },
  vendorHeader: {
    marginBottom: 8,
  },
  vendorNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  vendorName: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1A1A1A",
  },
  vendorMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  vendorMetaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  vendorMetaIcon: {
    fontSize: 14,
  },
  vendorMetaText: {
    fontSize: 14,
    color: "#666",
    fontWeight: "500",
  },
  vendorMetaValue: {
    fontSize: 14,
    color: "#333",
    fontWeight: "700",
    marginLeft: 2,
  },
  vendorMetaDot: {
    fontSize: 14,
    color: "#999",
    marginHorizontal: 8,
  },
  menuBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E8F5E9",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: "flex-start",
    marginBottom: 12,
    gap: 6,
  },
  menuBadgeText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#4CAF50",
  },
  vendorImageGrid: {
    gap: 4,
    marginBottom: 14,
  },
  vendorImageRow: {
    flexDirection: "row",
    gap: 4,
  },
  vendorThumbnail: {
    width: 85,
    height: 85,
    borderRadius: 12,
    backgroundColor: "#F0F0F0",
  },
  extraCountContainer: {
    width: 85,
    height: 85,
    borderRadius: 12,
    overflow: "hidden",
    position: "relative",
  },
  extraCountImage: {
    width: "100%",
    height: "100%",
  },
  extraCountOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  extraCountText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  foodTypeBadgeContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  foodTypeBadge: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 2,
    justifyContent: "center",
    alignItems: "center",
  },
  vegBadge: {
    borderColor: "#4CAF50",
  },
  nonVegBadge: {
    borderColor: "#D32F2F",
  },
  vegDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: "#4CAF50",
  },
  nonVegTriangle: {
    width: 0,
    height: 0,
    borderLeftWidth: 4,
    borderRightWidth: 4,
    borderBottomWidth: 7,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderBottomColor: "#D32F2F",
  },
  vendorOrderButton: {
    borderRadius: 20,
    overflow: 'hidden',
    alignSelf: 'center',
    shadowColor: '#FF6B35',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  vendorOrderGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
  },
  vendorOrderText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 1.2,
  },
  // Restaurant Order Styles
  customerInfoSection: {
    backgroundColor: "#F8F9FA",
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  customerHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  customerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#FF8C00",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  customerDetails: {
    flex: 1,
  },
  customerName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1A1A1A",
  },
  customerPhone: {
    fontSize: 14,
    color: "#666",
    marginTop: 2,
  },
  deliveryAddressRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#E0E0E0",
    gap: 6,
  },
  deliveryAddressText: {
    fontSize: 13,
    color: "#555",
    flex: 1,
    lineHeight: 18,
  },
  orderNotesRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#FFF9E6",
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
    gap: 8,
  },
  orderNotesText: {
    fontSize: 13,
    color: "#666",
    flex: 1,
    fontStyle: "italic",
  },
  restaurantActionButtons: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
    marginBottom: 8,
  },
  acceptButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#4CAF50",
    paddingVertical: 12,
    borderRadius: 10,
    gap: 6,
  },
  acceptButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  rejectButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FF3B30",
    paddingVertical: 12,
    borderRadius: 10,
    gap: 6,
  },
  rejectButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  nextStatusButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2196F3",
    paddingVertical: 12,
    borderRadius: 10,
    gap: 6,
  },
  nextStatusButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  // Support button for regular users
  supportButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FF8C00",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    marginTop: 12,
    marginBottom: 8,
    gap: 8,
  },
  supportButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  // Small customer info for completed orders
  customerAvatarSmall: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#FF8C00",
    justifyContent: "center",
    alignItems: "center",
  },
  customerInfoSmall: {
    marginBottom: 6,
  },
  customerNameSmall: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
  },
  deliveryAddressSmall: {
    fontSize: 12,
    color: "#666",
    marginTop: 2,
  },
  orderTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: "#F0FFF0",
    borderRadius: 8,
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#4CAF50",
  },
  orderTotalLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },
  orderTotalAmount: {
    fontSize: 18,
    fontWeight: "700",
    color: "#4CAF50",
  },
  orderTotalRowSmall: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#E0E0E0",
  },
  orderTotalLabelSmall: {
    fontSize: 14,
    fontWeight: "500",
    color: "#666",
  },
  orderTotalAmountSmall: {
    fontSize: 16,
    fontWeight: "700",
    color: "#4CAF50",
  },
  addReviewButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFF9E6",
    borderWidth: 1,
    borderColor: "#FF8C00",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginTop: 12,
    gap: 6,
  },
  addReviewButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FF8C00",
  },
  reviewCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    marginBottom: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: "#F0F0F0",
  },
  reviewHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  reviewCustomerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FF8C00",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  reviewOrderInfo: {
    flex: 1,
    marginRight: 12,
  },
  reviewOrderDish: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1A1A1A",
    marginBottom: 4,
  },
  reviewCustomerName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#666",
  },
  reviewRatingContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  reviewTypeBadge: {
    backgroundColor: "#FF8C00",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 8,
  },
  reviewTypeBadgeComplaint: {
    backgroundColor: "#FF3B30",
  },
  reviewTypeBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  reviewTextContent: {
    fontSize: 14,
    color: "#333",
    lineHeight: 20,
    marginTop: 12,
    marginBottom: 8,
  },
  reviewTimeText: {
    fontSize: 12,
    color: "#999",
    marginTop: 8,
  },
  reviewMessageButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFF9E6",
    borderWidth: 1,
    borderColor: "#FF8C00",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginTop: 12,
    gap: 6,
  },
  reviewMessageButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FF8C00",
  },
  // Rewards Tab Styles
  rewardsCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: "#F0F0F0",
  },
  rewardsHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  rewardsTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1A1A1A",
  },
  rewardsSubtitle: {
    fontSize: 14,
    color: "#666",
    lineHeight: 20,
    marginBottom: 20,
  },
  rewardsProgressContainer: {
    backgroundColor: "#F8F9FA",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  rewardsProgressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  rewardsProgressLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
  },
  rewardsProgressText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FF8C00",
  },
  rewardsProgressBar: {
    height: 12,
    backgroundColor: "#E0E0E0",
    borderRadius: 6,
    overflow: "hidden",
    marginBottom: 16,
  },
  rewardsProgressFill: {
    height: "100%",
    borderRadius: 6,
  },
  rewardsAmountContainer: {
    flexDirection: "row",
    gap: 12,
  },
  rewardsAmountBox: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    padding: 12,
    alignItems: "center",
  },
  rewardsAmountLabel: {
    fontSize: 12,
    color: "#666",
    marginBottom: 4,
  },
  rewardsAmountValue: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FF8C00",
  },
  rewardsInfoBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#FFF9E6",
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  rewardsInfoText: {
    flex: 1,
    fontSize: 13,
    color: "#666",
    lineHeight: 18,
  },
  rewardsInfoNote: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF9E6",
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    gap: 12,
  },
  rewardsInfoNoteText: {
    flex: 1,
    fontSize: 14,
    color: "#333",
    fontWeight: "600",
    lineHeight: 20,
  },

  // Wallet Balance Card
  walletBalanceCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: "#E8F5E9",
    alignItems: "center",
  },
  walletBalanceHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  walletBalanceTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },
  walletBalanceAmount: {
    fontSize: 36,
    fontWeight: "700",
    color: "#4CAF50",
    marginBottom: 4,
  },
  walletBalanceSubtext: {
    fontSize: 13,
    color: "#666",
  },

  // Rewards History
  rewardsHistorySection: {
    marginBottom: 16,
  },
  rewardsHistoryTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1A1A1A",
    marginBottom: 12,
  },
  emptyHistoryContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 32,
    alignItems: "center",
    marginBottom: 16,
  },
  emptyHistoryText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#999",
    marginTop: 12,
  },
  emptyHistorySubtext: {
    fontSize: 14,
    color: "#CCC",
    marginTop: 4,
    textAlign: "center",
  },
  rewardHistoryItem: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: "#F0F0F0",
  },
  rewardHistoryIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FFF9E6",
    alignItems: "center",
    justifyContent: "center",
  },
  rewardHistoryContent: {
    flex: 1,
  },
  rewardHistoryDescription: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    marginBottom: 4,
  },
  rewardOrderDetails: {
    marginTop: 4,
    marginBottom: 6,
  },
  rewardOrderDish: {
    fontSize: 13,
    color: "#666",
    marginBottom: 2,
  },
  rewardOrderRestaurant: {
    fontSize: 12,
    color: "#999",
  },
  rewardHistoryDate: {
    fontSize: 12,
    color: "#999",
  },
  rewardHistoryAmount: {
    alignItems: "flex-end",
  },
  rewardHistoryAmountText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#4CAF50",
  },
  rewardHistoryBigAmount: {
    fontSize: 18,
    color: "#FF8C00",
  },

  // Phone Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  phoneModal: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 24,
    width: "85%",
    maxWidth: 400,
  },
  phoneModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  phoneModalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#000",
  },
  phoneModalDescription: {
    fontSize: 14,
    color: "#666",
    lineHeight: 20,
    marginBottom: 24,
  },
  phoneInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F5F5F5",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  phoneInput: {
    flex: 1,
    fontSize: 16,
    color: "#333",
  },
  savePhoneButton: {
    backgroundColor: "#FF7A18",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    shadowColor: "#FF7A18",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  savePhoneButtonDisabled: {
    backgroundColor: "#CCC",
    shadowOpacity: 0,
    elevation: 0,
  },
  savePhoneButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFF",
  },
});
