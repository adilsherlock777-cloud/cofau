import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Linking,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import axios from "axios";

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || "https://api.cofau.com";

interface RestaurantDetails {
  id: string;
  restaurant_name?: string;
  name?: string;
  profile_picture?: string;
  posts_count?: number;
  reviews_count?: number;
  followers_count?: number;
  rating?: number;
  user_ratings_total?: number;
  formatted_address?: string;
  place_id?: string;
}

interface OrderModalProps {
  visible: boolean;
  onClose: () => void;
  post: any;
  token: string;
  onOrderPlaced?: () => void;
}

export const OrderModal: React.FC<OrderModalProps> = ({
  visible,
  onClose,
  post,
  token,
  onOrderPlaced,
}) => {
  const [loading, setLoading] = useState(false);
  const [restaurantDetails, setRestaurantDetails] = useState<RestaurantDetails | null>(null);
  const [dishName, setDishName] = useState("");
  const [suggestions, setSuggestions] = useState("");
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [showMenuSuggestions, setShowMenuSuggestions] = useState(false);
  const [loadingMenu, setLoadingMenu] = useState(false);
  const [isGoogleMapsRestaurant, setIsGoogleMapsRestaurant] = useState(false);

  useEffect(() => {
    if (visible && post) {
      fetchRestaurantDetails();
    }
  }, [visible, post]);

  const fetchRestaurantDetails = async () => {
    setLoading(true);
    setIsGoogleMapsRestaurant(false);
    try {
      // Check if post has tagged restaurant
      if (post.tagged_restaurant_id) {
        // Fetch from our database
        const response = await axios.get(
          `${BACKEND_URL}/api/restaurant/posts/public/profile/${post.tagged_restaurant_id}`
        );
        setRestaurantDetails(response.data);
        setIsGoogleMapsRestaurant(false);

        // Fetch menu items for suggestions
        fetchMenuItems(post.tagged_restaurant_id);
      } else if (post.latitude && post.longitude) {
        // Fetch from Google Maps Places API
        const response = await axios.get(
          `${BACKEND_URL}/api/places/nearby`,
          {
            params: {
              latitude: post.latitude,
              longitude: post.longitude,
            },
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        if (response.data && response.data.results && response.data.results.length > 0) {
          const place = response.data.results[0];
          setRestaurantDetails({
            id: place.place_id,
            name: place.name,
            rating: place.rating,
            user_ratings_total: place.user_ratings_total,
            formatted_address: place.formatted_address || place.vicinity,
            place_id: place.place_id,
          });
          setIsGoogleMapsRestaurant(true);
        }
      }
    } catch (error) {
      console.error("Error fetching restaurant details:", error);
      Alert.alert("Error", "Failed to load restaurant details");
    } finally {
      setLoading(false);
    }
  };

  const fetchMenuItems = async (restaurantId: string) => {
    setLoadingMenu(true);
    try {
      const response = await axios.get(
        `${BACKEND_URL}/api/restaurant/posts/menu/${restaurantId}`
      );
      setMenuItems(response.data || []);
    } catch (error) {
      console.error("Error fetching menu items:", error);
    } finally {
      setLoadingMenu(false);
    }
  };

  const handlePlaceOrder = async () => {
    if (!dishName.trim()) {
      Alert.alert("Required", "Please enter a dish name");
      return;
    }

    try {
      setLoading(true);

      const orderData = {
        post_id: post.id,
        restaurant_id: restaurantDetails?.id,
        restaurant_name: restaurantDetails?.restaurant_name || restaurantDetails?.name,
        dish_name: dishName.trim(),
        suggestions: suggestions.trim(),
        post_location: post.location_name,
        post_media_url: post.thumbnail_url || post.media_url,
        latitude: post.latitude,
        longitude: post.longitude,
      };

      await axios.post(`${BACKEND_URL}/api/orders/create`, orderData, {
        headers: { Authorization: `Bearer ${token}` },
      });

      Alert.alert(
        "Order Placed!",
        "Your order has been placed. Check the 'In Progress' tab to track it.",
        [
          {
            text: "OK",
            onPress: () => {
              onClose();
              if (onOrderPlaced) {
                onOrderPlaced();
              }
            },
          },
        ]
      );
    } catch (error: any) {
      console.error("Error placing order:", error);
      Alert.alert(
        "Error",
        error.response?.data?.detail || "Failed to place order. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const selectMenuItem = (itemName: string) => {
    setDishName(itemName);
    setShowMenuSuggestions(false);
  };

  const openInGoogleMaps = () => {
    if (!restaurantDetails) return;

    let url = "";
    if (restaurantDetails.place_id) {
      // Open using place_id (most accurate)
      url = `https://www.google.com/maps/search/?api=1&query=Google&query_place_id=${restaurantDetails.place_id}`;
    } else if (post.latitude && post.longitude) {
      // Fallback to coordinates
      url = `https://www.google.com/maps/search/?api=1&query=${post.latitude},${post.longitude}`;
    }

    if (url) {
      Linking.openURL(url).catch((err) => {
        console.error("Error opening Google Maps:", err);
        Alert.alert("Error", "Could not open Google Maps");
      });
    }
  };

  const filteredMenuItems = menuItems.filter(item =>
    item.item_name.toLowerCase().includes(dishName.toLowerCase())
  );

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardAvoidingView}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Place Order</Text>
              <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close" size={28} color="#333" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#FF8C00" />
                <Text style={styles.loadingText}>Loading restaurant details...</Text>
              </View>
            ) : restaurantDetails ? (
              <>
                {/* Restaurant Details */}
                <View style={styles.restaurantSection}>
                  <View style={styles.restaurantHeader}>
                    {restaurantDetails.profile_picture && (
                      <Image
                        source={{ uri: `${BACKEND_URL}${restaurantDetails.profile_picture}` }}
                        style={styles.restaurantImage}
                      />
                    )}
                    <View style={styles.restaurantInfo}>
                      <Text style={styles.restaurantName}>
                        {restaurantDetails.restaurant_name || restaurantDetails.name}
                      </Text>
                      {restaurantDetails.formatted_address && (
                        <Text style={styles.restaurantAddress} numberOfLines={2}>
                          {restaurantDetails.formatted_address}
                        </Text>
                      )}
                    </View>
                  </View>

                  {/* Stats Row */}
                  <View style={styles.statsRow}>
                    {restaurantDetails.posts_count !== undefined && (
                      <View style={styles.statItem}>
                        <Ionicons name="images" size={16} color="#FF8C00" />
                        <Text style={styles.statText}>{restaurantDetails.posts_count} Posts</Text>
                      </View>
                    )}
                    {restaurantDetails.reviews_count !== undefined && (
                      <View style={styles.statItem}>
                        <Ionicons name="star" size={16} color="#FFD700" />
                        <Text style={styles.statText}>{restaurantDetails.reviews_count} Reviews</Text>
                      </View>
                    )}
                    {restaurantDetails.followers_count !== undefined && (
                      <View style={styles.statItem}>
                        <Ionicons name="people" size={16} color="#4CAF50" />
                        <Text style={styles.statText}>{restaurantDetails.followers_count} Followers</Text>
                      </View>
                    )}
                    {restaurantDetails.rating && (
                      <View style={styles.statItem}>
                        <Ionicons name="star" size={16} color="#FFD700" />
                        <Text style={styles.statText}>
                          {restaurantDetails.rating} ({restaurantDetails.user_ratings_total})
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Warning Box - Restaurant not on Cofau */}
                  {isGoogleMapsRestaurant && (
                    <View style={styles.warningBox}>
                      <Ionicons name="warning" size={20} color="#FF9800" />
                      <Text style={styles.warningText}>
                        This restaurant isn't on Cofau yet. Check the menu below and tell us what you'd like to order!
                      </Text>
                    </View>
                  )}

                  {/* View Menu on Google Maps Button */}
                  {isGoogleMapsRestaurant && (
                    <TouchableOpacity
                      style={styles.viewOnMapsButton}
                      onPress={openInGoogleMaps}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="map" size={18} color="#4285F4" />
                      <Text style={styles.viewOnMapsText}>View Menu on Google Maps</Text>
                      <Ionicons name="open-outline" size={16} color="#4285F4" />
                    </TouchableOpacity>
                  )}
                </View>

                {/* Dish Name Input */}
                <View style={styles.inputSection}>
                  <Text style={styles.inputLabel}>Dish Name *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Enter dish name"
                    value={dishName}
                    onChangeText={(text) => {
                      setDishName(text);
                      if (text.length > 1 && menuItems.length > 0) {
                        setShowMenuSuggestions(true);
                      } else {
                        setShowMenuSuggestions(false);
                      }
                    }}
                    onFocus={() => {
                      if (dishName.length > 1 && menuItems.length > 0) {
                        setShowMenuSuggestions(true);
                      }
                    }}
                  />

                  {/* Menu Suggestions */}
                  {showMenuSuggestions && filteredMenuItems.length > 0 && (
                    <View style={styles.suggestionsContainer}>
                      <Text style={styles.suggestionsTitle}>Menu Suggestions:</Text>
                      {filteredMenuItems.slice(0, 5).map((item) => (
                        <TouchableOpacity
                          key={item.id}
                          style={styles.suggestionItem}
                          onPress={() => selectMenuItem(item.item_name)}
                        >
                          {item.media_url && (
                            <Image
                              source={{ uri: `${BACKEND_URL}${item.media_url}` }}
                              style={styles.suggestionImage}
                            />
                          )}
                          <View style={styles.suggestionInfo}>
                            <Text style={styles.suggestionName}>{item.item_name}</Text>
                            {item.price && (
                              <Text style={styles.suggestionPrice}>₹{item.price}</Text>
                            )}
                          </View>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>

                {/* Suggestions/Changes Input */}
                <View style={styles.inputSection}>
                  <Text style={styles.inputLabel}>
                    Suggestions or Changes <Text style={styles.optional}>(Optional)</Text>
                  </Text>
                  <TextInput
                    style={[styles.input, styles.textArea]}
                    placeholder="Any special requests or modifications?"
                    value={suggestions}
                    onChangeText={setSuggestions}
                    multiline
                    numberOfLines={4}
                    textAlignVertical="top"
                  />
                </View>

                {/* Place Order Button */}
                <TouchableOpacity
                  style={[styles.placeOrderButton, loading && styles.placeOrderButtonDisabled]}
                  onPress={handlePlaceOrder}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <>
                      <Ionicons name="checkmark-circle" size={20} color="#FFF" />
                      <Text style={styles.placeOrderButtonText}>Place Order</Text>
                    </>
                  )}
                </TouchableOpacity>
              </>
            ) : (
              <View style={styles.emptyContainer}>
                <Ionicons name="restaurant-outline" size={64} color="#CCC" />
                <Text style={styles.emptyText}>Restaurant details not available</Text>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  keyboardAvoidingView: {
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "90%",
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1A1A1A",
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  loadingContainer: {
    paddingVertical: 60,
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#666",
  },
  restaurantSection: {
    marginTop: 20,
    marginBottom: 24,
  },
  restaurantHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  restaurantImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#F0F0F0",
    marginRight: 12,
  },
  restaurantInfo: {
    flex: 1,
  },
  restaurantName: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1A1A1A",
    marginBottom: 4,
  },
  restaurantAddress: {
    fontSize: 13,
    color: "#666",
    lineHeight: 18,
  },
  statsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  statItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8F8F8",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 6,
  },
  statText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#333",
  },
  inputSection: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    marginBottom: 8,
  },
  optional: {
    fontSize: 12,
    fontWeight: "400",
    color: "#999",
  },
  input: {
    backgroundColor: "#F8F8F8",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: "#333",
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  textArea: {
    minHeight: 100,
    paddingTop: 12,
  },
  suggestionsContainer: {
    marginTop: 8,
    backgroundColor: "#FFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    padding: 12,
  },
  suggestionsTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: "#666",
    marginBottom: 8,
  },
  suggestionItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  suggestionImage: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: "#F0F0F0",
    marginRight: 10,
  },
  suggestionInfo: {
    flex: 1,
  },
  suggestionName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
  },
  suggestionPrice: {
    fontSize: 12,
    color: "#666",
    marginTop: 2,
  },
  placeOrderButton: {
    backgroundColor: "#FF8C00",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 8,
    gap: 8,
  },
  placeOrderButtonDisabled: {
    opacity: 0.6,
  },
  placeOrderButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  emptyContainer: {
    paddingVertical: 60,
    alignItems: "center",
  },
  emptyText: {
    marginTop: 12,
    fontSize: 16,
    color: "#666",
  },
  viewOnMapsButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E8F0FE",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginTop: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: "#4285F4",
  },
  viewOnMapsText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#4285F4",
    flex: 1,
    textAlign: "center",
  },
  // Warning box style for non-Cofau restaurants
  warningBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#FFF3E0",
    padding: 14,
    borderRadius: 12,
    marginTop: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: "#FFE0B2",
  },
  warningText: {
    flex: 1,
    fontSize: 13,
    color: "#E65100",
    lineHeight: 18,
  },
});
