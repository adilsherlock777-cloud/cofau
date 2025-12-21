import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  TextInput,
  Modal,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useAuth } from "../context/AuthContext";
import axios from "axios";
import { Image } from "expo-image";

// =======================
//  CONFIG
// =======================
const API_BASE_URL =
  process.env.EXPO_PUBLIC_BACKEND_URL || "https://api.cofau.com";
const API_URL = `${API_BASE_URL}/api`;

const SCREEN_WIDTH = Dimensions.get("window").width;
const NUM_COLUMNS = 3;
const SPACING = 2;
const TILE_SIZE = (SCREEN_WIDTH - SPACING * (NUM_COLUMNS + 1)) / NUM_COLUMNS;

const BLUR_HASH = "L5H2EC=PM+yV0g-mq.wG9c010J}I";

const CATEGORIES = [
  'All',
  'Vegetarian/Vegan',
  'Non vegetarian',
  'Biryani',
  'Desserts',
  'SeaFood',
  'Chinese',
  'Arabic',
  'BBQ/Tandoor',
  'Fast Food',
  'Salad',
  'Karnataka Style',
  'Kerala Style',
  'Andhra Style',
  'North Indian Style',
  'Mangaluru Style',
  'Italian',
  'Japanese',
  'Korean',
  'Mexican',
  'Drinks / sodas',
];

// ------------------------------------------------------------
// 🔥 UNIVERSAL URL FIXER
// ------------------------------------------------------------
const fixUrl = (url: string | null) => {
  if (!url) return null;
  if (url.startsWith("http")) return url;

  let cleaned = url.trim();
  cleaned = cleaned.replace(/([^:]\/)\/+/g, "$1");
  if (!cleaned.startsWith("/")) cleaned = "/" + cleaned;

  return `${API_BASE_URL}${cleaned}`;
};

// ------------------------------------------------------------
// 🔥 UNIVERSAL VIDEO CHECKER
// ------------------------------------------------------------
const isVideoFile = (url: string, media_type: string) => {
  if (media_type === "video") return true;

  if (!url) return false;
  const lower = url.toLowerCase();

  return (
    lower.includes(".mp4") ||
    lower.includes(".mov") ||
    lower.includes(".mkv") ||
    lower.includes(".webm")
  );
};

// Helper function to get icons for categories
function getCategoryIcon(category: string): any {
  const icons: { [key: string]: string } = {
    'All': 'grid-outline',
    'Vegetarian/Vegan': 'leaf-outline',
    'Non vegetarian': 'restaurant-outline',
    'Biryani': 'restaurant',
    'Desserts': 'ice-cream-outline',
    'SeaFood': 'fish-outline',
    'Chinese': 'restaurant-outline',
    'Arabic': 'restaurant-outline',
    'BBQ/Tandoor': 'flame-outline',
    'Fast Food': 'fast-food-outline',
    'Salad': 'nutrition-outline',
    'Karnataka Style': 'location-outline',
    'Kerala Style': 'location-outline',
    'Andhra Style': 'location-outline',
    'North Indian Style': 'location-outline',
    'Mangaluru Style': 'location-outline',
    'Italian': 'pizza-outline',
    'Japanese': 'restaurant-outline',
    'Korean': 'restaurant-outline',
    'Mexican': 'restaurant-outline',
    'Drinks / sodas': 'wine-outline',
  };
  return icons[category] || 'restaurant-outline';
}

// =======================
//  MAIN COMPONENT
// =======================
export default function LocationDetailsScreen() {
  const router = useRouter();
  const { locationName } = useLocalSearchParams();
  const { user, token } = useAuth();

  const [loading, setLoading] = useState(true);
  const [posts, setPosts] = useState<any[]>([]);
  const [locationInfo, setLocationInfo] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [showCategoryModal, setShowCategoryModal] = useState(false);

  const decodedLocationName = locationName
    ? decodeURIComponent(locationName as string)
    : "";

  useEffect(() => {
    if (user && token && decodedLocationName) {
      fetchLocationPosts();
    }
  }, [user, token, decodedLocationName]);

  // Refetch posts when category changes
  useEffect(() => {
    if (user && token && decodedLocationName) {
      console.log('🔄 Category changed, refetching posts:', selectedCategory);
      fetchLocationPosts();
    }
  }, [selectedCategory]);

  // ================================
  // 🔥 Fetch Location Posts
  // ================================
  const fetchLocationPosts = async () => {
    try {
      setLoading(true);

      // Build URL with category filter if selected
      let detailsUrl = `${API_URL}/locations/details/${encodeURIComponent(decodedLocationName)}`;
      if (selectedCategory && selectedCategory !== 'All') {
        detailsUrl += `?category=${encodeURIComponent(selectedCategory)}`;
      }

      const res = await axios.get(detailsUrl, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const locationData = res.data;
      setLocationInfo({
        name: locationData.location,
        uploads: locationData.uploads,
      });

      const formattedPosts = locationData.posts.map((post: any) => {
        const rawUrl = post.media_url || post.image_url;
        const fullUrl = fixUrl(rawUrl);

        return {
          ...post,
          full_image_url: fullUrl,
          is_liked: false,
          _isVideo: isVideoFile(fullUrl, post.media_type),
          category: post.category ? post.category.trim() : null,
        };
      });

      setPosts(formattedPosts);
    } catch (err) {
      console.error("❌ Location details fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  // ================================
  // 🔥 Filter posts based on search
  // ================================
    const filteredPosts = posts.filter((post) => {
  // First filter by search query
  if (searchQuery) {
    const caption = (post.caption || "").toLowerCase();
    if (!caption.includes(searchQuery.toLowerCase())) {
      return false;
    }
  }
  
  // Then filter by category (client-side filtering as backup)
  // Backend already filters, but this ensures UI consistency
  if (selectedCategory && selectedCategory !== 'All') {
    const postCategory = post.category ? post.category.trim() : '';
    return postCategory === selectedCategory;
  }
  
  return true;
});
  // ==================================
  // 🔳 Render Grid Tile
  // ==================================
  const renderGridItem = ({ item }: any) => {
    const displayImg = item._isVideo
      ? item.full_thumbnail_url || item.full_image_url
      : item.full_image_url;

    return (
      <TouchableOpacity
        style={styles.tile}
        activeOpacity={0.85}
        onPress={() => router.push(`/post-details/${item.id}`)}
      >
        <Image
          source={displayImg}
          style={styles.gridImage}
          placeholder={{ blurhash: BLUR_HASH }}
          cachePolicy="memory-disk"
          contentFit="cover"
          transition={300}
        />

        {item._isVideo && (
          <View style={styles.playIcon}>
            <Ionicons name="play-circle" size={28} color="#fff" />
          </View>
        )}
      </TouchableOpacity>
    );
  };

  // ==================================
  // ⏳ Loading States
  // ==================================
  if (!user || !token)
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#4dd0e1" />
        <Text>Authenticating…</Text>
      </View>
    );

  if (loading)
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#4dd0e1" />
        <Text>Loading posts…</Text>
      </View>
    );

  // ==================================
  // MAIN UI
  // ==================================
  return (
    <View style={styles.container}>
      {/* Header with Back Button and Location Info */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {locationInfo?.name || decodedLocationName}
          </Text>
          {locationInfo && (
            <Text style={styles.headerSubtitle}>
              {locationInfo.uploads} {locationInfo.uploads === 1 ? "post" : "posts"}
            </Text>
          )}
        </View>
      </View>

      {/* Search Bar with inline Category Button */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputWrapper}>
          <Ionicons name="search" size={20} color="#999" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search"
            placeholderTextColor="#999"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          
          {/* ✅ Category Filter Button Inside Search Bar */}
          <TouchableOpacity 
            style={styles.inlineFilterButton}
            onPress={() => setShowCategoryModal(true)}
          >
            <Ionicons name="options-outline" size={18} color="#FFF" />
            <Text style={styles.inlineFilterText}>
              {selectedCategory && selectedCategory !== 'All' 
                ? selectedCategory.substring(0, 8) + '...' 
                : 'Category'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Grid */}
      {filteredPosts.length > 0 ? (
        <FlatList
          data={filteredPosts}
          renderItem={renderGridItem}
          keyExtractor={(item) => item.id}
          numColumns={NUM_COLUMNS}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 80 }}
          columnWrapperStyle={{
            gap: SPACING,
            paddingHorizontal: SPACING,
          }}
        />
      ) : (
        <View style={styles.emptyContainer}>
  <Ionicons 
    name={selectedCategory && selectedCategory !== 'All' ? "restaurant-outline" : "search-outline"} 
    size={64} 
    color="#ccc" 
  />
  <Text style={styles.emptyText}>
    {selectedCategory && selectedCategory !== 'All'
      ? `No ${selectedCategory} posts found`
      : searchQuery 
      ? "No matching posts" 
      : "No posts for this location"}
  </Text>
  <Text style={styles.emptySubtext}>
    {selectedCategory && selectedCategory !== 'All'
      ? `Try selecting a different category or post the first ${selectedCategory} dish from ${decodedLocationName}!`
      : searchQuery
      ? "Try a different search term"
      : `Be the first to post about ${decodedLocationName}!`}
  </Text>
</View>
      )}

      {/* Category Filter Modal */}
      <Modal
        visible={showCategoryModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowCategoryModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.categoryModal}>
            <View style={styles.categoryModalHeader}>
              <Text style={styles.categoryModalTitle}>Filter by Category</Text>
              <TouchableOpacity onPress={() => setShowCategoryModal(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            
            <FlatList
              data={CATEGORIES}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.categoryItem,
                    (selectedCategory === item || (item === 'All' && !selectedCategory)) && styles.categoryItemSelected
                  ]}
                  onPress={() => {
                    setSelectedCategory(item === 'All' ? '' : item);
                    setShowCategoryModal(false);
                  }}
                >
                  <View style={styles.categoryItemContent}>
                    <Ionicons 
                      name={getCategoryIcon(item)} 
                      size={24} 
                      color={(selectedCategory === item || (item === 'All' && !selectedCategory)) ? "#FFF" : "#666"} 
                    />
                    <Text style={[
                      styles.categoryItemText,
                      (selectedCategory === item || (item === 'All' && !selectedCategory)) && styles.categoryItemTextSelected
                    ]}>
                      {item}
                    </Text>
                  </View>
                  {(selectedCategory === item || (item === 'All' && !selectedCategory)) && (
                    <Ionicons name="checkmark-circle" size={24} color="#FFF" />
                  )}
                </TouchableOpacity>
              )}
              contentContainerStyle={styles.categoryList}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

// =======================
//  STYLES
// =======================
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e5e5",
  },
  backButton: {
    marginRight: 12,
    padding: 4,
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#000",
  },
  headerSubtitle: {
    fontSize: 13,
    color: "#666",
    marginTop: 2,
  },

  // Search Container
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#fff",
  },

  // Search Input Wrapper (contains search bar + inline button)
  searchInputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F5F5F5",
    borderRadius: 25,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },

  searchIcon: {
    marginRight: 10,
  },

  searchInput: {
    flex: 1,
    fontSize: 15,
    color: "#333",
    fontWeight: "400",
  },

  // ✅ Inline filter button inside search bar
  inlineFilterButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1B7C82",
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 15,
    marginLeft: 8,
    gap: 4,
    borderWidth: 1,
    borderColor: "#000",
  },

  inlineFilterText: {
    fontSize: 12,
    color: "#FFF",
    fontWeight: "600",
    maxWidth: 60,
  },

  // Grid Tiles
  tile: {
    width: TILE_SIZE,
    height: TILE_SIZE,
    borderRadius: 6,
    overflow: "hidden",
    backgroundColor: "#eaeaea",
    position: "relative",
    marginBottom: SPACING,
  },

  gridImage: {
    width: "100%",
    height: "100%",
  },

  playIcon: {
    position: "absolute",
    bottom: 6,
    left: 6,
    backgroundColor: "rgba(0,0,0,0.45)",
    padding: 4,
    borderRadius: 20,
  },

  // Empty State
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
  },

  emptyText: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: "600",
    color: "#666",
  },

  emptySubtext: {
    marginTop: 8,
    fontSize: 14,
    color: "#999",
    textAlign: "center",
    paddingHorizontal: 40,
  },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },

  categoryModal: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "70%",
  },

  categoryModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5E5",
  },

  categoryModalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
  },

  categoryList: {
    padding: 12,
  },

  categoryItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: "#F9F9F9",
  },

  categoryItemSelected: {
    backgroundColor: "#1B7C82",
    borderWidth: 2,
    borderColor: "#FFF",
  },

  categoryItemContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },

  categoryItemText: {
    fontSize: 16,
    color: "#333",
    flex: 1,
  },

  categoryItemTextSelected: {
    fontWeight: "600",
    color: "#FFF",
  },
});