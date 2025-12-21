import React, { useState, useCallback, useEffect, useRef } from "react";
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
import { useRouter, useFocusEffect } from "expo-router";
import { useAuth } from "../context/AuthContext";
import axios from "axios";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import MaskedView from "@react-native-masked-view/masked-view";
import { likePost, unlikePost, reportPost } from "../utils/api";

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

// ------------------------------------------------------------
// 🔥 UNIVERSAL URL FIXER (same as FeedCard & Stories)
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
// Backend may store MOV, MP4, MKV, no extension, etc.
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

// ------------------------------------------------------------
// 🔥 GRADIENT HEART COMPONENT (Cofau Theme)
// ------------------------------------------------------------
const GradientHeart = ({ size = 18 }) => {
  return (
    <MaskedView
      maskElement={
        <View style={{ backgroundColor: 'transparent' }}>
          <Ionicons name="heart" size={size} color="#000" />
        </View>
      }
    >
      <LinearGradient
        colors={["#E94A37", "#F2CF68", "#1B7C82"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ width: size, height: size }}
      />
    </MaskedView>
  );
};

// =======================
//  MAIN COMPONENT
// =======================
export default function ExploreScreen() {
  const router = useRouter();
  const auth = useAuth() as { user: any; token: string | null };
  const { user, token } = auth;

  const [loading, setLoading] = useState(true);
  const [posts, setPosts] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [showCategoryModal, setShowCategoryModal] = useState(false);

  // Categories list
  const CATEGORIES = [
    'All',
    'Vegetarian/Vegan',
    'Non vegetarian',
    'Biryani',
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

  useFocusEffect(
    useCallback(() => {
      if (user && token) {
        console.log('🔄 Explore screen focused - refreshing posts');
        fetchPosts(true);
      }
    }, [user, token, selectedCategory])
  );

  // Refetch posts when category changes
  useEffect(() => {
    if (user && token) {
      console.log('🔄 Category changed, refetching posts:', selectedCategory);
      fetchPosts(true);
    }
  }, [selectedCategory]);

  // Posts are already filtered by backend when category is selected
  // No need for client-side filtering since backend handles it
  const filteredPosts = posts;

  // ================================
  // 🔥 Fetch Explore Posts
  // ================================
  const fetchPosts = async (refresh = false) => {
    try {
      if (refresh) {
        setLoading(true);
        setPage(1);
      } else {
        setLoadingMore(true);
      }

      const skip = refresh ? 0 : (page - 1) * 30;

      // Build URL with category filter if selected
      let feedUrl = `${API_URL}/feed?skip=${skip}`;
      if (selectedCategory && selectedCategory !== 'All') {
        feedUrl += `&category=${encodeURIComponent(selectedCategory)}`;
      }

      // No limit parameter - fetch ALL posts (or filtered by category)
      const res = await axios.get(feedUrl, {
        headers: { Authorization: `Bearer ${token || ''}` },
      });

      const newPosts = res.data.map((post: any) => {
        const rawUrl = post.media_url || post.image_url;

        const fullUrl = fixUrl(rawUrl);
        const thumb = fixUrl(post.thumbnail_url);

        return {
          ...post,
          full_image_url: fullUrl,
          full_thumbnail_url: thumb,
          is_liked: post.is_liked_by_user || false,
          _isVideo: isVideoFile(fullUrl || '', post.media_type),
          // ✅ Ensure category is preserved and trimmed
          category: post.category ? post.category.trim() : null,
        };
      });

      // ✅ Sort by created_at descending (newest first)
      const sortedNewPosts = newPosts.sort((a: any, b: any) => {
        const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
        return dateB - dateA; // Descending order (newest first)
      });

      if (refresh) {
        setPosts(sortedNewPosts);
      } else {
        // When appending, combine and sort all posts
        setPosts((p) => {
          const combined = [...p, ...sortedNewPosts];
          return combined.sort((a: any, b: any) => {
            const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
            const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
            return dateB - dateA; // Descending order (newest first)
          });
        });
      }

      setPage((prev) => prev + 1);
    } catch (err) {
      console.error("❌ Explore fetch error:", err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  // ==================================
  // 🔍 Search Logic - Navigate to Search Results Page
  // ==================================
  const performSearch = () => {
    if (searchQuery.trim()) {
      // Navigate to search results page with the query
      router.push({
        pathname: "/search-results",
        params: { query: searchQuery.trim() },
      });
    }
  };

  // ==================================
  // ❤️ Like/Unlike Handler
  // ==================================
  const handleLike = async (id: string, liked: boolean) => {
    try {
      setPosts((prev) =>
        prev.map((p) =>
          p.id === id
            ? {
              ...p,
              is_liked: !liked,
              likes_count: p.likes_count + (liked ? -1 : 1),
            }
            : p
        )
      );

      liked ? await unlikePost(id) : await likePost(id);
    } catch (err) {
      console.log("❌ Like error:", err);
    }
  };

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

        {/* Like Button with Gradient Heart */}
        <TouchableOpacity
          style={styles.likeBtn}
          onPress={(e) => {
            e.stopPropagation();
            handleLike(item.id, item.is_liked);
          }}
        >
          {item.is_liked ? (
            <GradientHeart size={18} />
          ) : (
            <Ionicons name="heart-outline" size={18} color="#ffffff" />
          )}
        </TouchableOpacity>
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
        <Text>Loading explore…</Text>
      </View>
    );

  // ==================================
  // MAIN UI
  // ==================================
  return (
    <View style={styles.container}>
      {/* Header Container - Gradient + Overlapping Search */}
      <View style={styles.headerContainer}>
        <LinearGradient
          colors={["#E94A37", "#F2CF68", "#1B7C82"]}
          locations={[0, 0.5, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.gradientHeader}
        >
          <Text style={styles.headerTitle}>Cofau</Text>
        </LinearGradient>
        
        {/* Search bar with inline category filter */}
        <View style={styles.searchBoxWrapper}>
          <View style={styles.searchBox}>
            <Ionicons name="search" size={20} color="#999" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search"
              placeholderTextColor="#999"
              value={searchQuery}
              onChangeText={setSearchQuery}
              returnKeyType="search"
              onSubmitEditing={performSearch}
            />
            {/* ✅ Category Filter Button Inside Search Bar with Gradient Border */}
<TouchableOpacity 
  onPress={() => setShowCategoryModal(true)}
  activeOpacity={0.8}
>
  <LinearGradient
    colors={["#E94A37", "#F2CF68", "#1B7C82"]}
    start={{ x: 0, y: 0 }}
    end={{ x: 1, y: 0 }}
    style={styles.gradientBorder}
  >
    <View style={styles.inlineFilterButton}>
      <Ionicons name="options-outline" size={18} color="#FFF" />
      <Text style={styles.inlineFilterText}>
        {selectedCategory && selectedCategory !== 'All' 
          ? selectedCategory.substring(0, 8) + '...' 
          : 'Category'}
      </Text>
    </View>
  </LinearGradient>
</TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Grid - No gap from search bar */}
      <FlatList
        data={filteredPosts}
        renderItem={renderGridItem}
        keyExtractor={(item) => item.id}
        numColumns={NUM_COLUMNS}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
        columnWrapperStyle={{
          gap: SPACING,
          paddingHorizontal: SPACING,
        }}
        onEndReached={() => {
          fetchPosts(false);
        }}
        onEndReachedThreshold={0.4}
        ListFooterComponent={
          loadingMore ? (
            <View style={{ padding: 20 }}>
              <ActivityIndicator size="small" />
            </View>
          ) : null
        }
      />

      {/* Bottom Navigation - Updated Style */}
      <View style={styles.navBar}>
        {/* Home */}
        <TouchableOpacity 
          style={styles.navItem}
          onPress={() => router.push("/feed")}
        >
          <Ionicons name="home-outline" size={28} color="#000" />
          <Text style={styles.navLabel}>Home</Text>
        </TouchableOpacity>
        
        {/* Explore */}
        <TouchableOpacity 
          style={styles.navItem}
          onPress={() => router.push("/explore")}
        >
          <Ionicons name="compass" size={28} color="#000" />
          <Text style={styles.navLabelActive}>Explore</Text>
        </TouchableOpacity>
        
        {/* Center - Top Posts with Camera Icon */}
        <TouchableOpacity 
          style={styles.centerNavItem}
          onPress={() => router.push("/leaderboard")}
        >
          <View style={styles.centerIconCircle}>
            <Ionicons name="camera" size={28} color="#000" />
          </View>
          <Text style={styles.navLabel}>Top Posts</Text>
        </TouchableOpacity>
        
        {/* Happening */}
        <TouchableOpacity 
          style={styles.navItem}
          onPress={() => router.push("/happening")}
        >
          <Ionicons name="location-outline" size={28} color="#000" />
          <Text style={styles.navLabel}>Happening</Text>
        </TouchableOpacity>
        
        {/* Profile */}
        <TouchableOpacity 
          style={styles.navItem}
          onPress={() => router.push("/profile")}
        >
          <Ionicons name="person-outline" size={28} color="#000" />
          <Text style={styles.navLabel}>Profile</Text>
        </TouchableOpacity>
      </View>

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
                      color={(selectedCategory === item || (item === 'All' && !selectedCategory)) ? "#4ECDC4" : "#666"} 
                    />
                    <Text style={[
                      styles.categoryItemText,
                      (selectedCategory === item || (item === 'All' && !selectedCategory)) && styles.categoryItemTextSelected
                    ]}>
                      {item}
                    </Text>
                  </View>
                  {(selectedCategory === item || (item === 'All' && !selectedCategory)) && (
                    <Ionicons name="checkmark-circle" size={24} color="#4ECDC4" />
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

// Helper function to get icons for categories
function getCategoryIcon(category: string): any {
  const icons: { [key: string]: string } = {
    'All': 'grid-outline',
    'Vegetarian/Vegan': 'leaf-outline',
    'Non vegetarian': 'restaurant-outline',
    'Biryani': 'restaurant',
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
//  STYLES
// =======================
const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: "#fff" 
  },
  
  center: { 
    flex: 1, 
    justifyContent: "center", 
    alignItems: "center" 
  },

  /* Header Container */
  headerContainer: {
    position: "relative",
    marginBottom: 30,
  },

  /* Gradient Header - With Rounded Bottom Corners */
  gradientHeader: {
    paddingTop: 65,
    paddingBottom: 55,
    alignItems: "center",
    justifyContent: "center",
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    shadowColor: "#000",                
    shadowOffset: { width: 0, height: 4 },   
    shadowOpacity: 0.15,                  
    shadowRadius: 8,                    
    elevation: 6,    
  },

  headerTitle: {
    fontFamily: "Lobster",
    fontSize: 36,
    color: "#fff",
    textAlign: "center",
    letterSpacing: 1,
    zIndex: 1,
    textShadowColor: "rgba(0, 0, 0, 0.15)",      
    textShadowOffset: { width: 4, height: 6 },   
    textShadowRadius: 4, 
  },

  /* Search Bar - Overlapping gradient edge */
  searchBoxWrapper: {
    position: "absolute",
    bottom: -25,
    left: 16,
    right: 16,
    zIndex: 10,
  },

  searchBox: {
    backgroundColor: "#fff",
    borderRadius: 25,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 12,
  },

  searchIcon: {
    marginRight: 10,
  },

  searchInput: {
    flex: 1,
    fontSize: 16,
    color: "#333",
  },

  searchInputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F5F5F5",
    borderRadius: 25,
    paddingLeft: 16,
    paddingRight: 8,  // Reduced right padding to fit category button
    paddingVertical: 8,  // Reduced vertical padding
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },

  // ✅ Inline filter button inside search bar
  inlineFilterButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1B7C82",
    borderRadius: 18,
    paddingVertical: 5,
    paddingHorizontal: 12,
    marginLeft: 0,
    gap: 0,
  },
  gradientBorder: {
    borderRadius: 20,
    padding: 2,  // This creates the border thickness
    marginLeft: -60,
  },

  inlineFilterText: {
    fontSize: 12,
    color: "#FFF",
    fontWeight: "600",
    maxWidth: 60,
  },

  /* Grid Tiles */
  tile: {
    width: TILE_SIZE,
    height: TILE_SIZE,
    borderRadius: 4,
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

  likeBtn: {
    position: "absolute",
    top: 6,
    right: 6,
    backgroundColor: "rgba(0,0,0,0.35)",
    padding: 6,
    borderRadius: 20,
  },

  /* Bottom Navigation - Updated */
  navBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingVertical: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#E8E8E8",
    backgroundColor: "#FFFFFF",
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },

  navItem: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
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

  // ✅ Center elevated item
  centerNavItem: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginTop: -30,
  },

  // ✅ Circle background for center icon
  centerIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#FFFFFF",
    borderWidth: 2,
    borderColor: "#000",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 4,
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },

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
    color: "#fff",
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