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

interface CartItem {
  id: string;
  item_name: string;
  price?: number;
  quantity: number;
  media_url?: string;
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
  const [suggestions, setSuggestions] = useState("");
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [loadingMenu, setLoadingMenu] = useState(false);
  const [isGoogleMapsRestaurant, setIsGoogleMapsRestaurant] = useState(false);
  const [showMenuDropdown, setShowMenuDropdown] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCart, setShowCart] = useState(false);
  const [customDishName, setCustomDishName] = useState("");

  // Reset state when modal opens
  useEffect(() => {
    if (visible && post) {
      setCart([]);
      setShowCart(false);
      setSuggestions("");
      setCustomDishName("");
      setExpandedCategories(new Set());
      setShowMenuDropdown(false);
      fetchRestaurantDetails();
    }
  }, [visible, post]);

  // Auto-expand all categories when menu is shown and items are loaded
  useEffect(() => {
    if (showMenuDropdown && menuItems.length > 0) {
      const categories = getMenuByCategory().map(([category]) => category);
      setExpandedCategories(new Set(categories));
    }
  }, [showMenuDropdown, menuItems.length]);

  const fetchRestaurantDetails = async () => {
    setLoading(true);
    setIsGoogleMapsRestaurant(false);
    try {
      if (post.tagged_restaurant_id) {
        const response = await axios.get(
          `${BACKEND_URL}/api/restaurant/posts/public/profile/${post.tagged_restaurant_id}`
        );
        setRestaurantDetails(response.data);
        setIsGoogleMapsRestaurant(false);
        fetchMenuItems(post.tagged_restaurant_id);
      } else if (post.latitude && post.longitude) {
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
      let allMenuItems: any[] = [];

      try {
        const menuResponse = await axios.get(
          `${BACKEND_URL}/api/restaurant/menu/${restaurantId}/public`
        );
        if (menuResponse.data?.items && menuResponse.data.items.length > 0) {
          const extractedItems = menuResponse.data.items.map((item: any) => ({
            id: item.id,
            item_name: item.name,
            price: item.price,
            category: item.category || "Other",
            media_url: item.image_url,
            description: item.description,
          }));
          allMenuItems = [...allMenuItems, ...extractedItems];
        }
      } catch (err) {
        console.log("Restaurant menu fetch failed, trying manual menu");
      }

      try {
        const manualResponse = await axios.get(
          `${BACKEND_URL}/api/restaurant/posts/menu/${restaurantId}`
        );
        if (manualResponse.data && manualResponse.data.length > 0) {
          const manualItems = manualResponse.data.map((item: any) => ({
            ...item,
            category: item.category || "Other",
          }));
          allMenuItems = [...allMenuItems, ...manualItems];
        }
      } catch (err) {
        console.log("Manual menu fetch failed");
      }

      setMenuItems(allMenuItems);
    } catch (error) {
      console.error("Error fetching menu items:", error);
    } finally {
      setLoadingMenu(false);
    }
  };

  // Group menu items by category
  const getMenuByCategory = () => {
    const categoryMap = new Map<string, any[]>();

    menuItems.forEach((item) => {
      const category = item.category || "Other";
      if (!categoryMap.has(category)) {
        categoryMap.set(category, []);
      }
      categoryMap.get(category)!.push(item);
    });

    return Array.from(categoryMap.entries()).sort((a, b) => {
      if (a[0] === "Other") return 1;
      if (b[0] === "Other") return -1;
      return a[0].localeCompare(b[0]);
    });
  };

  const toggleCategory = (category: string) => {
    setExpandedCategories((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(category)) {
        newSet.delete(category);
      } else {
        newSet.add(category);
      }
      return newSet;
    });
  };

  const addToCart = (item: any) => {
    setCart((prev) => {
      const existingIndex = prev.findIndex((cartItem) => cartItem.id === item.id);
      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex].quantity += 1;
        return updated;
      }
      return [...prev, {
        id: item.id,
        item_name: item.item_name,
        price: item.price,
        quantity: 1,
        media_url: item.media_url,
      }];
    });
  };

  const addCustomDish = () => {
    if (!customDishName.trim()) return;

    const customId = `custom_${Date.now()}`;
    setCart((prev) => [...prev, {
      id: customId,
      item_name: customDishName.trim(),
      quantity: 1,
    }]);
    setCustomDishName("");
  };

  const updateCartQuantity = (itemId: string, delta: number) => {
    setCart((prev) => {
      return prev.map((item) => {
        if (item.id === itemId) {
          const newQuantity = item.quantity + delta;
          return { ...item, quantity: Math.max(0, newQuantity) };
        }
        return item;
      }).filter((item) => item.quantity > 0);
    });
  };

  const removeFromCart = (itemId: string) => {
    setCart((prev) => prev.filter((item) => item.id !== itemId));
  };

  const getCartTotal = () => {
    return cart.reduce((total, item) => {
      return total + (item.price || 0) * item.quantity;
    }, 0);
  };

  const getTotalItems = () => {
    return cart.reduce((total, item) => total + item.quantity, 0);
  };

  const handlePlaceOrder = async () => {
    if (cart.length === 0) {
      Alert.alert("Empty Cart", "Please add at least one item to your order");
      return;
    }

    try {
      setLoading(true);

      // Format cart items for the order
      const dishNames = cart.map((item) =>
        `${item.item_name} x${item.quantity}`
      ).join(", ");

      const orderData = {
        post_id: post.id,
        restaurant_id: restaurantDetails?.id,
        restaurant_name: restaurantDetails?.restaurant_name || restaurantDetails?.name,
        dish_name: dishNames,
        quantity: getTotalItems(),
        total_price: getCartTotal() > 0 ? getCartTotal() : null,
        suggestions: suggestions.trim(),
        post_location: post.location_name,
        post_media_url: post.thumbnail_url || post.media_url,
        latitude: post.latitude,
        longitude: post.longitude,
        cart_items: cart,
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

  const openInGoogleMaps = () => {
    if (!restaurantDetails) return;

    let url = "";
    if (restaurantDetails.place_id) {
      url = `https://www.google.com/maps/search/?api=1&query=Google&query_place_id=${restaurantDetails.place_id}`;
    } else if (post.latitude && post.longitude) {
      url = `https://www.google.com/maps/search/?api=1&query=${post.latitude},${post.longitude}`;
    }

    if (url) {
      Linking.openURL(url).catch((err) => {
        console.error("Error opening Google Maps:", err);
        Alert.alert("Error", "Could not open Google Maps");
      });
    }
  };

  const getItemQuantityInCart = (itemId: string) => {
    const cartItem = cart.find((item) => item.id === itemId);
    return cartItem ? cartItem.quantity : 0;
  };

  // Render Cart/Summary View
  const renderCartView = () => (
    <View style={styles.cartContainer}>
      <View style={styles.cartHeader}>
        <TouchableOpacity onPress={() => setShowCart(false)} style={styles.cartBackButton}>
          <Ionicons name="arrow-back" size={20} color="#333" />
          <Text style={styles.cartBackText}>Back to Menu</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.cartTitle}>Order Summary</Text>

      <ScrollView style={styles.cartList} showsVerticalScrollIndicator={false}>
        {cart.map((item) => (
          <View key={item.id} style={styles.cartItem}>
            <View style={styles.cartItemInfo}>
              <Text style={styles.cartItemName}>{item.item_name}</Text>
              {item.price && (
                <Text style={styles.cartItemPrice}>₹{item.price} each</Text>
              )}
            </View>
            <View style={styles.cartItemControls}>
              <TouchableOpacity
                style={styles.cartQuantityButton}
                onPress={() => updateCartQuantity(item.id, -1)}
              >
                <Ionicons name="remove" size={18} color="#FF8C00" />
              </TouchableOpacity>
              <Text style={styles.cartQuantityText}>{item.quantity}</Text>
              <TouchableOpacity
                style={styles.cartQuantityButton}
                onPress={() => updateCartQuantity(item.id, 1)}
              >
                <Ionicons name="add" size={18} color="#FF8C00" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.cartRemoveButton}
                onPress={() => removeFromCart(item.id)}
              >
                <Ionicons name="trash-outline" size={18} color="#FF3B30" />
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Suggestions Input in Cart View */}
      <View style={styles.cartSuggestionsSection}>
        <Text style={styles.inputLabel}>
          Special Instructions <Text style={styles.optional}>(Optional)</Text>
        </Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Any special requests or modifications?"
          value={suggestions}
          onChangeText={setSuggestions}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
        />
      </View>

      {/* Order Total */}
      <View style={styles.cartTotal}>
        <View style={styles.cartTotalRow}>
          <Text style={styles.cartTotalLabel}>Total Items</Text>
          <Text style={styles.cartTotalValue}>{getTotalItems()}</Text>
        </View>
        {getCartTotal() > 0 && (
          <View style={styles.cartTotalRow}>
            <Text style={styles.cartTotalLabel}>Estimated Total</Text>
            <Text style={styles.cartTotalPrice}>₹{getCartTotal()}</Text>
          </View>
        )}
        <Text style={styles.cartNote}>
          Final price may vary. Delivery charges will be added.
        </Text>
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
    </View>
  );

  return (
    <Modal
      animationType="slide"
      transparent={false}
      visible={visible}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardAvoidingView}
      >
        <View style={styles.fullScreenContainer}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={onClose} style={styles.backButton} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="arrow-back" size={24} color="#333" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{showCart ? "Review Order" : "Place Order"}</Text>
            <View style={styles.headerSpacer} />
          </View>

          {showCart ? (
            renderCartView()
          ) : (
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
                      {!isGoogleMapsRestaurant && (
                        <TouchableOpacity
                          style={[styles.statItem, styles.menuStatItem, showMenuDropdown && styles.menuStatItemActive]}
                          onPress={() => setShowMenuDropdown(!showMenuDropdown)}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="list" size={16} color={showMenuDropdown ? "#FFF" : "#FF8C00"} />
                          <Text style={[styles.statText, showMenuDropdown && styles.statTextActive]}>
                            Menu {menuItems.length > 0 ? `(${menuItems.length})` : ""}
                          </Text>
                          <Ionicons
                            name={showMenuDropdown ? "chevron-up" : "chevron-down"}
                            size={14}
                            color={showMenuDropdown ? "#FFF" : "#666"}
                          />
                        </TouchableOpacity>
                      )}
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

                    {/* Category-wise Menu Dropdown */}
                    {!isGoogleMapsRestaurant && showMenuDropdown && (
                      <View style={styles.menuDropdown}>
                        {loadingMenu ? (
                          <View style={styles.menuLoadingContainer}>
                            <ActivityIndicator size="small" color="#FF8C00" />
                            <Text style={styles.menuLoadingText}>Loading menu...</Text>
                          </View>
                        ) : menuItems.length === 0 ? (
                          <View style={styles.menuEmptyContainer}>
                            <Ionicons name="restaurant-outline" size={32} color="#CCC" />
                            <Text style={styles.menuEmptyText}>No menu items available</Text>
                          </View>
                        ) : (
                          <ScrollView style={styles.menuList} nestedScrollEnabled={true}>
                            {getMenuByCategory().map(([category, items]) => (
                              <View key={category} style={styles.categorySection}>
                                {/* Category Header */}
                                <TouchableOpacity
                                  style={styles.categoryHeader}
                                  onPress={() => toggleCategory(category)}
                                  activeOpacity={0.7}
                                >
                                  <Text style={styles.categoryTitle}>{category}</Text>
                                  <View style={styles.categoryHeaderRight}>
                                    <Text style={styles.categoryCount}>{items.length} items</Text>
                                    <Ionicons
                                      name={expandedCategories.has(category) ? "chevron-up" : "chevron-down"}
                                      size={18}
                                      color="#666"
                                    />
                                  </View>
                                </TouchableOpacity>

                                {/* Category Items */}
                                {expandedCategories.has(category) && (
                                  <View style={styles.categoryItems}>
                                    {items.map((item: any) => {
                                      const qtyInCart = getItemQuantityInCart(item.id);
                                      return (
                                        <View key={item.id} style={styles.menuItem}>
                                          {item.media_url && (
                                            <Image
                                              source={{ uri: item.media_url.startsWith('http') ? item.media_url : `${BACKEND_URL}${item.media_url}` }}
                                              style={styles.menuItemImage}
                                            />
                                          )}
                                          <View style={styles.menuItemInfo}>
                                            <Text style={styles.menuItemName}>{item.item_name}</Text>
                                            {item.price && (
                                              <Text style={styles.menuItemPrice}>₹{item.price}</Text>
                                            )}
                                          </View>
                                          {qtyInCart > 0 ? (
                                            <View style={styles.menuItemQuantityControls}>
                                              <TouchableOpacity
                                                style={styles.menuQuantityBtn}
                                                onPress={() => updateCartQuantity(item.id, -1)}
                                              >
                                                <Ionicons name="remove" size={16} color="#FF8C00" />
                                              </TouchableOpacity>
                                              <Text style={styles.menuQuantityText}>{qtyInCart}</Text>
                                              <TouchableOpacity
                                                style={styles.menuQuantityBtn}
                                                onPress={() => updateCartQuantity(item.id, 1)}
                                              >
                                                <Ionicons name="add" size={16} color="#FF8C00" />
                                              </TouchableOpacity>
                                            </View>
                                          ) : (
                                            <TouchableOpacity
                                              style={styles.addButton}
                                              onPress={() => addToCart(item)}
                                            >
                                              <Ionicons name="add" size={20} color="#FFF" />
                                            </TouchableOpacity>
                                          )}
                                        </View>
                                      );
                                    })}
                                  </View>
                                )}
                              </View>
                            ))}
                          </ScrollView>
                        )}
                      </View>
                    )}

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

                  {/* Delivery Highlight Box */}
                  <View style={styles.deliveryHighlightBox}>
                    <View style={styles.deliveryHighlightIcon}>
                      <Ionicons name="bicycle" size={24} color="#FF8C00" />
                    </View>
                    <View style={styles.deliveryHighlightContent}>
                      <Text style={styles.deliveryHighlightTitle}>We'll bring it to you!</Text>
                      <Text style={styles.deliveryHighlightText}>
                        Our runners will pick up your order and deliver it fresh to your doorstep. You only pay for the food + delivery.
                      </Text>
                    </View>
                  </View>

                  {/* Cart Items Preview - Shows items added to cart */}
                  {cart.length > 0 && (
                    <View style={styles.cartPreview}>
                      <View style={styles.cartPreviewHeader}>
                        <View style={styles.cartPreviewTitleRow}>
                          <Ionicons name="cart" size={20} color="#FF8C00" />
                          <Text style={styles.cartPreviewTitle}>Your Cart ({getTotalItems()} items)</Text>
                        </View>
                        <TouchableOpacity
                          style={styles.viewCartButton}
                          onPress={() => setShowCart(true)}
                        >
                          <Text style={styles.viewCartButtonText}>View Cart</Text>
                          <Ionicons name="chevron-forward" size={16} color="#FF8C00" />
                        </TouchableOpacity>
                      </View>
                      {cart.map((item, index) => (
                        <View key={item.id} style={styles.cartPreviewItem}>
                          <View style={styles.cartPreviewItemLeft}>
                            <Text style={styles.cartPreviewItemNumber}>{index + 1}.</Text>
                            <View style={styles.cartPreviewItemInfo}>
                              <Text style={styles.cartPreviewItemName}>{item.item_name}</Text>
                              {item.price && (
                                <Text style={styles.cartPreviewItemPrice}>₹{item.price} × {item.quantity} = ₹{item.price * item.quantity}</Text>
                              )}
                            </View>
                          </View>
                          <View style={styles.cartPreviewQuantity}>
                            <TouchableOpacity
                              style={styles.cartPreviewQtyBtn}
                              onPress={() => updateCartQuantity(item.id, -1)}
                            >
                              <Ionicons name="remove" size={16} color="#FF8C00" />
                            </TouchableOpacity>
                            <Text style={styles.cartPreviewQtyText}>{item.quantity}</Text>
                            <TouchableOpacity
                              style={styles.cartPreviewQtyBtn}
                              onPress={() => updateCartQuantity(item.id, 1)}
                            >
                              <Ionicons name="add" size={16} color="#FF8C00" />
                            </TouchableOpacity>
                          </View>
                        </View>
                      ))}
                      {getCartTotal() > 0 && (
                        <View style={styles.cartPreviewTotal}>
                          <Text style={styles.cartPreviewTotalLabel}>Subtotal</Text>
                          <Text style={styles.cartPreviewTotalValue}>₹{getCartTotal()}</Text>
                        </View>
                      )}
                    </View>
                  )}

                  {/* Custom Dish Input */}
                  <View style={styles.inputSection}>
                    <Text style={styles.inputLabel}>Add Custom Item</Text>
                    <View style={styles.customDishRow}>
                      <TextInput
                        style={[styles.input, styles.customDishInput]}
                        placeholder="Enter dish name not in menu"
                        value={customDishName}
                        onChangeText={setCustomDishName}
                      />
                      <TouchableOpacity
                        style={[styles.addCustomButton, !customDishName.trim() && styles.addCustomButtonDisabled]}
                        onPress={addCustomDish}
                        disabled={!customDishName.trim()}
                      >
                        <Ionicons name="add" size={24} color="#FFF" />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Proceed to Cart Button */}
                  {cart.length > 0 && (
                    <TouchableOpacity
                      style={styles.proceedButton}
                      onPress={() => setShowCart(true)}
                    >
                      <View style={styles.proceedButtonContent}>
                        <View style={styles.proceedButtonLeft}>
                          <Text style={styles.proceedButtonItems}>{getTotalItems()} items</Text>
                          {getCartTotal() > 0 && (
                            <Text style={styles.proceedButtonTotal}>₹{getCartTotal()}</Text>
                          )}
                        </View>
                        <View style={styles.proceedButtonRight}>
                          <Text style={styles.proceedButtonText}>Review Order</Text>
                          <Ionicons name="arrow-forward" size={20} color="#FFF" />
                        </View>
                      </View>
                    </TouchableOpacity>
                  )}
                </>
              ) : (
                <View style={styles.emptyContainer}>
                  <Ionicons name="restaurant-outline" size={64} color="#CCC" />
                  <Text style={styles.emptyText}>Restaurant details not available</Text>
                </View>
              )}
            </ScrollView>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  keyboardAvoidingView: {
    flex: 1,
  },
  fullScreenContainer: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    paddingTop: Platform.OS === "ios" ? 50 : 10,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  backButton: {
    padding: 4,
  },
  headerSpacer: {
    width: 32,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1A1A1A",
  },
  scrollContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingBottom: 40,
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
    minHeight: 80,
    paddingTop: 12,
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
  menuStatItem: {
    borderWidth: 1,
    borderColor: "#FF8C00",
  },
  menuStatItemActive: {
    backgroundColor: "#FF8C00",
  },
  statTextActive: {
    color: "#FFF",
  },
  menuDropdown: {
    marginTop: 12,
    backgroundColor: "#FFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    overflow: "hidden",
  },
  menuLoadingContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    gap: 10,
  },
  menuLoadingText: {
    fontSize: 13,
    color: "#666",
  },
  menuEmptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  menuEmptyText: {
    marginTop: 8,
    fontSize: 13,
    color: "#999",
  },
  menuList: {
    maxHeight: 350,
  },
  // Category styles
  categorySection: {
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  categoryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 14,
    backgroundColor: "#FAFAFA",
  },
  categoryTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#333",
  },
  categoryHeaderRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  categoryCount: {
    fontSize: 12,
    color: "#888",
  },
  categoryItems: {
    paddingHorizontal: 12,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F5F5F5",
  },
  menuItemImage: {
    width: 50,
    height: 50,
    borderRadius: 8,
    backgroundColor: "#F0F0F0",
    marginRight: 12,
  },
  menuItemInfo: {
    flex: 1,
  },
  menuItemName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
  },
  menuItemPrice: {
    fontSize: 13,
    color: "#FF8C00",
    fontWeight: "600",
    marginTop: 2,
  },
  addButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#FF8C00",
    justifyContent: "center",
    alignItems: "center",
  },
  menuItemQuantityControls: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF8F0",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#FF8C00",
    paddingHorizontal: 4,
  },
  menuQuantityBtn: {
    width: 28,
    height: 28,
    justifyContent: "center",
    alignItems: "center",
  },
  menuQuantityText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FF8C00",
    minWidth: 24,
    textAlign: "center",
  },
  // Delivery Highlight Box
  deliveryHighlightBox: {
    flexDirection: "row",
    backgroundColor: "#FFF8F0",
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    borderWidth: 2,
    borderColor: "#FFE0B2",
    alignItems: "flex-start",
  },
  deliveryHighlightIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#FFF",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
    shadowColor: "#FF8C00",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  deliveryHighlightContent: {
    flex: 1,
  },
  deliveryHighlightTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#E65100",
    marginBottom: 4,
  },
  deliveryHighlightText: {
    fontSize: 14,
    color: "#795548",
    lineHeight: 20,
  },
  // Cart Preview
  cartPreview: {
    backgroundColor: "#FFF8F0",
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 2,
    borderColor: "#FFE0B2",
  },
  cartPreviewHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  cartPreviewTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  cartPreviewTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#333",
  },
  viewCartButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
    borderWidth: 1,
    borderColor: "#FF8C00",
  },
  viewCartButtonText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#FF8C00",
  },
  cartPreviewItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#E8E8E8",
  },
  cartPreviewItemLeft: {
    flexDirection: "row",
    alignItems: "flex-start",
    flex: 1,
    gap: 8,
  },
  cartPreviewItemNumber: {
    fontSize: 14,
    fontWeight: "600",
    color: "#666",
    marginTop: 2,
  },
  cartPreviewItemInfo: {
    flex: 1,
  },
  cartPreviewItemName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
  },
  cartPreviewItemPrice: {
    fontSize: 12,
    color: "#666",
    marginTop: 4,
  },
  cartPreviewQuantity: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  cartPreviewQtyBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: "#FF8C00",
    justifyContent: "center",
    alignItems: "center",
  },
  cartPreviewQtyText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#333",
    minWidth: 20,
    textAlign: "center",
  },
  cartPreviewTotal: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 12,
    marginTop: 8,
    borderTopWidth: 2,
    borderTopColor: "#FFD699",
  },
  cartPreviewTotalLabel: {
    fontSize: 15,
    fontWeight: "700",
    color: "#333",
  },
  cartPreviewTotalValue: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FF8C00",
  },
  // Custom Dish Input
  customDishRow: {
    flexDirection: "row",
    gap: 10,
  },
  customDishInput: {
    flex: 1,
  },
  addCustomButton: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: "#FF8C00",
    justifyContent: "center",
    alignItems: "center",
  },
  addCustomButtonDisabled: {
    backgroundColor: "#CCC",
  },
  // Proceed Button
  proceedButton: {
    backgroundColor: "#FF8C00",
    borderRadius: 12,
    marginTop: 8,
    marginBottom: 30,
  },
  proceedButtonContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
  },
  proceedButtonLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  proceedButtonItems: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFF",
  },
  proceedButtonTotal: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFF",
  },
  proceedButtonRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  proceedButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFF",
  },
  // Cart View Styles
  cartContainer: {
    flex: 1,
    paddingHorizontal: 20,
  },
  cartHeader: {
    paddingVertical: 12,
  },
  cartBackButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  cartBackText: {
    fontSize: 14,
    color: "#666",
  },
  cartTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#1A1A1A",
    marginBottom: 16,
  },
  cartList: {
    maxHeight: 250,
  },
  cartItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  cartItemInfo: {
    flex: 1,
  },
  cartItemName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#333",
  },
  cartItemPrice: {
    fontSize: 13,
    color: "#888",
    marginTop: 2,
  },
  cartItemControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  cartQuantityButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#FFF8F0",
    borderWidth: 1,
    borderColor: "#FF8C00",
    justifyContent: "center",
    alignItems: "center",
  },
  cartQuantityText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#333",
    minWidth: 24,
    textAlign: "center",
  },
  cartRemoveButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#FFF0F0",
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 8,
  },
  cartSuggestionsSection: {
    marginTop: 20,
  },
  cartTotal: {
    backgroundColor: "#F8F8F8",
    borderRadius: 12,
    padding: 16,
    marginTop: 20,
  },
  cartTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  cartTotalLabel: {
    fontSize: 14,
    color: "#666",
  },
  cartTotalValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
  },
  cartTotalPrice: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FF8C00",
  },
  cartNote: {
    fontSize: 12,
    color: "#999",
    marginTop: 8,
    fontStyle: "italic",
  },
});
