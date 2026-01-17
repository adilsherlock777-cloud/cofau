import React, { useState, useCallback, useEffect, useRef, memo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  TextInput,
  Modal,
  FlatList,
  RefreshControl,
  LayoutChangeEvent,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import { useAuth } from "../context/AuthContext";
import axios from "axios";
import { Image } from "expo-image";
import { Video, ResizeMode, AVPlaybackStatus } from "expo-av";
import { LinearGradient } from "expo-linear-gradient";
import MaskedView from "@react-native-masked-view/masked-view";
import { likePost, unlikePost } from "../utils/api";

const API_BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL || "https://api.cofau.com";
const API_URL = `${API_BASE_URL}/api`;

const SCREEN_WIDTH = Dimensions.get("window").width;
const SCREEN_HEIGHT = Dimensions.get("window").height;
const SPACING = 2;
const COLUMN_WIDTH = (SCREEN_WIDTH - SPACING * 3) / 3;
const SQUARE_HEIGHT = COLUMN_WIDTH;
const VERTICAL_HEIGHT = COLUMN_WIDTH * 1.5;
const SMALL_HEIGHT = COLUMN_WIDTH * 0.75;
const BLUR_HASH = "L5H2EC=PM+yV0g-mq.wG9c010J}I";
const MAX_CONCURRENT_VIDEOS = 2;


const fixUrl = (url: string | null) => {
  if (!url) return null;
  if (url.startsWith("http")) return url;
  let cleaned = url.trim().replace(/([^:]\/)\/+/g, "$1");
  if (!cleaned.startsWith("/")) cleaned = "/" + cleaned;
  return `${API_BASE_URL}${cleaned}`;
};

const isVideoFile = (url: string, media_type: string) => {
  if (media_type === "video") return true;
  if (!url) return false;
  const lower = url.toLowerCase();
  return lower.includes(".mp4") || lower.includes(".mov") || lower.includes(".mkv") || lower.includes(".webm");
};

const getTileHeight = (post: any) => {
  const isVideo = post._isVideo;
  const aspectRatio = post.aspect_ratio || (isVideo ? 0.5625 : 1);
  if (isVideo) {
    if (aspectRatio <= 0.6) return VERTICAL_HEIGHT;
    if (aspectRatio <= 0.8) return COLUMN_WIDTH * 1.25;
    return SQUARE_HEIGHT;
  }
  if (aspectRatio < 0.8) return VERTICAL_HEIGHT;
  if (aspectRatio > 1.2) return SMALL_HEIGHT;
  return SQUARE_HEIGHT;
};

const GradientHeart = ({ size = 18 }) => (
  <MaskedView maskElement={<View style={{ backgroundColor: "transparent" }}><Ionicons name="heart" size={size} color="#000" /></View>}>
    <LinearGradient colors={["#E94A37", "#F2CF68", "#1B7C82"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: size, height: size }} />
  </MaskedView>
);

const distributePosts = (posts: any[]) => {
  const columns: any[][] = [[], [], []];
  const heights = [0, 0, 0];
  posts.forEach((post) => {
    const height = getTileHeight(post);
    const shortestIndex = heights.indexOf(Math.min(...heights));
    columns[shortestIndex].push({ ...post, tileHeight: height });
    heights[shortestIndex] += height + SPACING;
  });
  return columns;
};

const VideoTile = memo(({ item, onPress, onLike, shouldPlay, onLayout }: any) => {
  const videoRef = useRef<Video>(null);
  const [isActuallyPlaying, setIsActuallyPlaying] = useState(false);

  useEffect(() => {
  const controlVideo = async () => {
    if (!videoRef.current) return;
    try {
      if (shouldPlay) {
        // iOS requires loading the video first
        const status = await videoRef.current.getStatusAsync();
        if (!status.isLoaded) {
          await videoRef.current.loadAsync(
            { uri: item.full_image_url },
            { shouldPlay: true, isLooping: true, isMuted: true }
          );
        } else {
          await videoRef.current.setPositionAsync(0);
          await videoRef.current.playAsync();
        }
      } else {
        await videoRef.current.pauseAsync();
      }
    } catch (e) {
      console.log("Video control error:", e);
    }
  };
  controlVideo();
}, [shouldPlay, item.full_image_url]);

  const displayThumbnail = item.full_thumbnail_url || item.full_image_url;

  return (
    <TouchableOpacity style={[styles.tile, { height: item.tileHeight }]} activeOpacity={0.9} onPress={() => onPress(item.id)} onLayout={(e) => onLayout(item.id, e)}>
      <Video 
  ref={videoRef} 
  source={{ uri: item.full_image_url }} 
  style={styles.tileVideo} 
  resizeMode={ResizeMode.COVER} 
  isLooping 
  isMuted={true}
  useNativeControls={false}
  shouldPlay={false}
  posterSource={{ uri: item.full_thumbnail_url || item.full_image_url }}
  usePoster={true}
  onPlaybackStatusUpdate={(status: AVPlaybackStatus) => { 
    if (status.isLoaded) setIsActuallyPlaying(status.isPlaying); 
  }} 
/>
      {!isActuallyPlaying && (
        <>
          {displayThumbnail ? (
            <Image source={{ uri: displayThumbnail }} style={styles.thumbnailOverlay} placeholder={{ blurhash: BLUR_HASH }} cachePolicy="memory-disk" contentFit="cover" />
          ) : (
            <View style={[styles.thumbnailOverlay, styles.placeholderImage]}><Ionicons name="videocam-outline" size={32} color="#ccc" /></View>
          )}
          <View style={styles.playIconContainer}><Ionicons name="play" size={24} color="#fff" /></View>
        </>
      )}
      <TouchableOpacity style={styles.likeBtn} onPress={(e) => { e.stopPropagation(); onLike(item.id, item.is_liked); }}>
        {item.is_liked ? <GradientHeart size={18} /> : <Ionicons name="heart-outline" size={18} color="#ffffff" />}
      </TouchableOpacity>
      {item.views_count > 0 && (
        <View style={styles.viewsContainer}>
          <Ionicons name="play" size={12} color="#fff" />
          <Text style={styles.viewsText}>{item.views_count > 1000 ? `${(item.views_count / 1000).toFixed(1)}K` : item.views_count}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
});

const ImageTile = memo(({ item, onPress, onLike }: any) => (
  <TouchableOpacity style={[styles.tile, { height: item.tileHeight }]} activeOpacity={0.9} onPress={() => onPress(item.id)}>
    {item.full_image_url ? (
      <Image source={{ uri: item.full_image_url }} style={styles.tileImage} placeholder={{ blurhash: BLUR_HASH }} cachePolicy="memory-disk" contentFit="cover" transition={200} />
    ) : (
      <View style={[styles.tileImage, styles.placeholderImage]}><Ionicons name="image-outline" size={32} color="#ccc" /></View>
    )}
    <TouchableOpacity style={styles.likeBtn} onPress={(e) => { e.stopPropagation(); onLike(item.id, item.is_liked); }}>
      {item.is_liked ? <GradientHeart size={18} /> : <Ionicons name="heart-outline" size={18} color="#ffffff" />}
    </TouchableOpacity>
  </TouchableOpacity>
));

const GridTile = ({ item, onPress, onLike, onVideoLayout, playingVideos }: any) => {
  if (item._isVideo) {
    return <VideoTile item={item} onPress={onPress} onLike={onLike} shouldPlay={playingVideos.includes(item.id)} onLayout={onVideoLayout} />;
  }
  return <ImageTile item={item} onPress={onPress} onLike={onLike} />;
};

export default function ExploreScreen() {
  const router = useRouter();
  const auth = useAuth() as { user: any; token: string | null };
  const { user, token } = auth;

  const scrollViewRef = useRef<ScrollView>(null);
  const videoPositions = useRef<Map<string, { top: number; height: number }>>(new Map());

  const [loading, setLoading] = useState(true);
  const [posts, setPosts] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'users' | 'restaurants'>('users');
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [appliedCategories, setAppliedCategories] = useState<string[]>([]);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [scrollY, setScrollY] = useState(0);
  const [playingVideos, setPlayingVideos] = useState<string[]>([]);

  const POSTS_PER_PAGE = 30;
  const CATEGORIES = ["All", "Vegetarian/Vegan", "Non vegetarian", "Biryani", "Desserts", "SeaFood", "Chinese", "Chats", "Arabic", "BBQ/Tandoor", "Fast Food", "Tea/Coffee", "Salad", "Karnataka Style", "Hyderabadi Style", "Kerala Style", "Andhra Style", "North Indian Style", "South Indian Style", "Punjabi Style", "Bengali Style", "Odia Style", "Gujurati Style", "Rajasthani Style", "Mangaluru Style", "Goan", "Kashmiri", "Continental", "Italian", "Japanese", "Korean", "Mexican", "Persian", "Drinks / sodas"];

  const handleVideoLayout = useCallback((videoId: string, event: LayoutChangeEvent) => {
    const { y, height } = event.nativeEvent.layout;
    videoPositions.current.set(videoId, { top: y, height });
  }, []);

  const calculateVisibleVideos = useCallback((currentScrollY: number) => {
    const visibleTop = currentScrollY;
    const visibleBottom = currentScrollY + SCREEN_HEIGHT;
    const visible: string[] = [];
    posts.forEach((post) => {
      if (!post._isVideo) return;
      const position = videoPositions.current.get(post.id);
      if (!position) return;
      if (position.top + position.height > visibleTop && position.top < visibleBottom - 100) {
        visible.push(post.id);
      }
    });
    setPlayingVideos(visible.slice(0, MAX_CONCURRENT_VIDEOS));
  }, [posts]);

  const handleScroll = useCallback((event: any) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    setScrollY(contentOffset.y);
    calculateVisibleVideos(contentOffset.y);
    if (layoutMeasurement.height + contentOffset.y >= contentSize.height - 200) {
      if (hasMore && !loadingMore && !loading) fetchPosts(false);
    }
  }, [calculateVisibleVideos, hasMore, loadingMore, loading]);

  useEffect(() => {
    if (posts.length > 0) {
      const timer = setTimeout(() => calculateVisibleVideos(scrollY), 500);
      return () => clearTimeout(timer);
    }
  }, [posts, calculateVisibleVideos, scrollY]);

  useFocusEffect(useCallback(() => {
    if (user && token) fetchPosts(true);
    return () => setPlayingVideos([]);
  }, [user, token]));

  const fetchPosts = async (refresh = false, categories?: string[]) => {
    try {
      if (refresh) { setLoading(true); setPage(1); setHasMore(true); videoPositions.current.clear(); }
      else { if (!hasMore || loadingMore) return; setLoadingMore(true); }
      const categoriesToUse = categories ?? appliedCategories;
      const skip = refresh ? 0 : (page - 1) * POSTS_PER_PAGE;
      let feedUrl;
if (activeTab === 'restaurants') {
  feedUrl = `${API_URL}/restaurant/posts/public/all?skip=${skip}&limit=${POSTS_PER_PAGE}`;
} else {
  feedUrl = `${API_URL}/feed?skip=${skip}&limit=${POSTS_PER_PAGE}`;
}
      if (categoriesToUse.length > 0) feedUrl += `&categories=${encodeURIComponent(categoriesToUse.join(","))}`;
      const res = await axios.get(feedUrl, { headers: { Authorization: `Bearer ${token || ""}` } });
      if (res.data.length === 0) { setHasMore(false); if (refresh) setPosts([]); return; }
      const newPosts = res.data.map((post: any) => {
        const fullUrl = fixUrl(post.media_url || post.image_url);
        return { ...post, full_image_url: fullUrl, full_thumbnail_url: fixUrl(post.thumbnail_url), is_liked: post.is_liked_by_user || false, _isVideo: isVideoFile(fullUrl || "", post.media_type), category: post.category?.trim() || null, aspect_ratio: post.aspect_ratio || null };
      });
      if (refresh) { setPosts(newPosts); setPage(2); }
      else { setPosts((p) => [...p, ...newPosts.filter((np: any) => !p.some((ep) => ep.id === np.id))]); setPage((prev) => prev + 1); }
      if (res.data.length < POSTS_PER_PAGE) setHasMore(false);
    } catch (err) { console.error("Fetch error:", err); }
    finally { setLoading(false); setLoadingMore(false); setRefreshing(false); }
  };

  const fetchPostsWithCategories = (categories: string[]) => fetchPosts(true, categories);
  const performSearch = () => { if (searchQuery.trim()) router.push({ pathname: "/search-results", params: { query: searchQuery.trim() } }); };
  const toggleCategory = (item: string) => { if (item === "All") setSelectedCategories([]); else setSelectedCategories((prev) => prev.includes(item) ? prev.filter((c) => c !== item) : [...prev, item]); };
  const handleLike = async (id: string, liked: boolean) => { setPosts((prev) => prev.map((p) => p.id === id ? { ...p, is_liked: !liked, likes_count: p.likes_count + (liked ? -1 : 1) } : p)); try { liked ? await unlikePost(id) : await likePost(id); } catch (err) { console.log("Like error:", err); } };
  const onRefresh = useCallback(() => { setRefreshing(true); setPlayingVideos([]); fetchPosts(true); }, [appliedCategories]);
  const handlePostPress = (postId: string) => { setPlayingVideos([]); router.push(`/post-details/${postId}`); };

  if (!user || !token) return <View style={styles.center}><ActivityIndicator size="large" color="#4dd0e1" /><Text>Authenticating…</Text></View>;
  if (loading && posts.length === 0) return <View style={styles.center}><ActivityIndicator size="large" color="#4dd0e1" /><Text>Loading explore…</Text></View>;

  const columns = distributePosts(posts);

  return (
    <View style={styles.container}>
      <View style={styles.headerContainer}>
        <LinearGradient colors={["#E94A37", "#F2CF68", "#1B7C82"]} locations={[0, 0.5, 1]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.gradientHeader}>
          <Text style={styles.headerTitle}>Cofau</Text>
        </LinearGradient>
        <View style={styles.searchBoxWrapper}>
          <View style={styles.searchBox}>
            <Ionicons name="search" size={18} color="#999" style={styles.searchIcon} />
            <TextInput style={styles.searchInput} placeholder="Search" placeholderTextColor="#999" value={searchQuery} onChangeText={setSearchQuery} returnKeyType="search" onSubmitEditing={performSearch} />
            <TouchableOpacity onPress={() => setShowCategoryModal(true)} activeOpacity={0.8}>
              <LinearGradient colors={["#E94A37", "#F2CF68", "#1B7C82"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.gradientBorder}>
                <View style={styles.inlineFilterButton}>
                  <Ionicons name="options-outline" size={18} color="#FFF" />
                  <Text style={styles.inlineFilterText}>{appliedCategories.length > 0 ? `${appliedCategories.length} selected` : "Category"}</Text>
                </View>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* USERS | RESTAURANTS TABS */}
<View style={styles.tabContainer}>
  <TouchableOpacity 
  style={[styles.tab, activeTab === 'restaurants' && styles.activeTab]}
  onPress={() => {
    if (activeTab !== 'restaurants') {
      setActiveTab('restaurants');
      setPosts([]);
      setPage(1);
      setHasMore(true);
      setLoading(true);
      fetchPosts(true);
    }
  }}
>
    <Text style={[styles.tabText, activeTab === 'users' && styles.activeTabText]}>USERS</Text>
  </TouchableOpacity>
  <TouchableOpacity 
  style={[styles.tab, activeTab === 'users' && styles.activeTab]}
  onPress={() => {
    if (activeTab !== 'users') {
      setActiveTab('users');
      setPosts([]);
      setPage(1);
      setHasMore(true);
      setLoading(true);
      fetchPosts(true);
    }
  }}
>
  
    <Text style={[styles.tabText, activeTab === 'restaurants' && styles.activeTabText]}>RESTAURANTS</Text>
  </TouchableOpacity>
</View>

      {appliedCategories.length > 0 && (
        <View style={styles.selectedTagsWrapper}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.selectedTagsContainer}>
            {appliedCategories.map((cat) => (
              <TouchableOpacity key={cat} style={styles.selectedTag} onPress={() => { const nc = appliedCategories.filter((c) => c !== cat); setAppliedCategories(nc); setSelectedCategories(nc); fetchPostsWithCategories(nc); }}>
                <Text style={styles.selectedTagText}>{cat}</Text><Ionicons name="close-circle" size={16} color="#666" />
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.clearAllButton} onPress={() => { setSelectedCategories([]); setAppliedCategories([]); fetchPostsWithCategories([]); }}><Text style={styles.clearAllText}>Clear All</Text></TouchableOpacity>
          </ScrollView>
        </View>
      )}

      <ScrollView ref={scrollViewRef} style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} onScroll={handleScroll} scrollEventThrottle={16} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#4dd0e1" />}>
        <View style={styles.masonryContainer}>
          {columns.map((column, columnIndex) => (
            <View key={columnIndex} style={styles.column}>
              {column.map((item) => <GridTile key={item.id} item={item} onPress={handlePostPress} onLike={handleLike} onVideoLayout={handleVideoLayout} playingVideos={playingVideos} />)}
            </View>
          ))}
        </View>
        {loadingMore && <View style={styles.loadingMore}><ActivityIndicator size="small" color="#4dd0e1" /></View>}
        {!loading && posts.length === 0 && <View style={styles.emptyState}><Ionicons name="restaurant-outline" size={64} color="#ccc" /><Text style={styles.emptyStateText}>No posts found</Text></View>}
        <View style={{ height: 120 }} />
      </ScrollView>

      <View style={styles.navBar}>
        <TouchableOpacity style={styles.navItem} onPress={() => router.push("/feed")}><Ionicons name="home-outline" size={20} color="#000" /><Text style={styles.navLabel}>Home</Text></TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => router.push("/explore")}><Ionicons name="compass" size={20} color="#000" /><Text style={styles.navLabelActive}>Explore</Text></TouchableOpacity>
        <TouchableOpacity style={styles.centerNavItem} onPress={() => router.push("/leaderboard")}><View style={styles.centerIconCircle}><Ionicons name="camera" size={22} color="#000" /></View><Text style={styles.navLabel}>Top Posts</Text></TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => router.push("/happening")}><Ionicons name="location-outline" size={20} color="#000" /><Text style={styles.navLabel}>Happening</Text></TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => router.push("/profile")}><Ionicons name="person-outline" size={20} color="#000" /><Text style={styles.navLabel}>Profile</Text></TouchableOpacity>
      </View>

      <Modal visible={showCategoryModal} transparent animationType="slide" onRequestClose={() => { setSelectedCategories(appliedCategories); setShowCategoryModal(false); }}>
        <View style={styles.modalOverlay}>
          <View style={styles.categoryModal}>
            <View style={styles.categoryModalHeader}>
              <Text style={styles.categoryModalTitle}>Filter by Category</Text>
              <TouchableOpacity onPress={() => { setSelectedCategories(appliedCategories); setShowCategoryModal(false); }}><Ionicons name="close" size={24} color="#333" /></TouchableOpacity>
            </View>
            {selectedCategories.length > 0 && <View style={styles.selectedCountContainer}><Text style={styles.selectedCountText}>{selectedCategories.length} categories selected</Text><TouchableOpacity onPress={() => setSelectedCategories([])}><Text style={styles.clearAllModalText}>Clear All</Text></TouchableOpacity></View>}
            <FlatList data={CATEGORIES} keyExtractor={(item) => item} renderItem={({ item }) => {
              const isSelected = item === "All" ? selectedCategories.length === 0 : selectedCategories.includes(item);
              return (
                <TouchableOpacity style={[styles.categoryItem, isSelected && styles.categoryItemSelected]} onPress={() => { if (item === "All") { setSelectedCategories([]); setShowCategoryModal(false); setAppliedCategories([]); fetchPostsWithCategories([]); } else toggleCategory(item); }}>
                  <View style={styles.categoryItemContent}><Ionicons name={getCategoryIcon(item)} size={24} color={isSelected ? "#fff" : "#666"} /><Text style={[styles.categoryItemText, isSelected && styles.categoryItemTextSelected]}>{item}</Text></View>
                  {isSelected ? <Ionicons name="checkmark-circle" size={24} color="#4ECDC4" /> : <Ionicons name="ellipse-outline" size={24} color="#CCC" />}
                </TouchableOpacity>
              );
            }} contentContainerStyle={styles.categoryList} />
            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.doneButton} onPress={() => { setAppliedCategories(selectedCategories); setShowCategoryModal(false); setPosts([]); setPage(1); setHasMore(true); setPlayingVideos([]); fetchPostsWithCategories(selectedCategories); }}>
                <Text style={styles.doneButtonText}>Apply Filters {selectedCategories.length > 0 ? `(${selectedCategories.length})` : ""}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function getCategoryIcon(category: string): any {
  const icons: { [key: string]: string } = { All: "grid-outline", "Vegetarian/Vegan": "leaf-outline", "Non vegetarian": "restaurant-outline", Biryani: "restaurant", SeaFood: "fish-outline", Chinese: "restaurant-outline", Chats: "cafe-outline", Desserts: "ice-cream-outline", Arabic: "restaurant-outline", "BBQ/Tandoor": "flame-outline", "Fast Food": "fast-food-outline", "Tea/Coffee": "cafe-outline", Salad: "nutrition-outline", Continental: "globe-outline", Italian: "pizza-outline", "Drinks / sodas": "wine-outline" };
  return icons[category] || "location-outline";
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#fff" },
  headerContainer: { position: "relative", marginBottom: 30, zIndex: 10 },
  tabContainer: {
  flexDirection: 'row',
  paddingHorizontal: 16,
  marginTop: 10,
  marginBottom: 10,
},
tab: {
  flex: 1,
  paddingVertical: 12,
  alignItems: 'center',
  borderBottomWidth: 2,
  borderBottomColor: 'transparent',
},
activeTab: {
  borderBottomColor: '#F2CF68', // Orange underline
},
tabText: {
  fontSize: 14,
  fontWeight: '600',
  color: '#999',
},
activeTabText: {
  color: '#000',
},
  gradientHeader: { paddingTop: 65, paddingBottom: 55, alignItems: "center", justifyContent: "center", borderBottomLeftRadius: 30, borderBottomRightRadius: 30, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 6 },
  headerTitle: { fontFamily: "Lobster", fontSize: 32, color: "#fff", textAlign: "center", letterSpacing: 1 },
  searchBoxWrapper: { position: "absolute", bottom: -25, left: 16, right: 16, zIndex: 10 },
  searchBox: { backgroundColor: "#fff", borderRadius: 25, paddingHorizontal: 16, paddingVertical: 8, flexDirection: "row", alignItems: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.5, shadowRadius: 12, elevation: 12 },
  searchIcon: { marginRight: 10 },
  searchInput: { flex: 1, fontSize: 14, color: "#333" },
  inlineFilterButton: { flexDirection: "row", alignItems: "center", backgroundColor: "#1B7C82", borderRadius: 18, paddingVertical: 5, paddingHorizontal: 12, gap: 4 },
  gradientBorder: { borderRadius: 20, padding: 2 },
  inlineFilterText: { fontSize: 12, color: "#FFF", fontWeight: "600", maxWidth: 70 },
  selectedTagsWrapper: { paddingHorizontal: 16, marginBottom: 10 },
  selectedTagsContainer: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 4 },
  selectedTag: { flexDirection: "row", alignItems: "center", backgroundColor: "#FFF5E6", borderRadius: 16, paddingVertical: 6, paddingLeft: 12, paddingRight: 8, gap: 4, borderWidth: 1, borderColor: "#F2CF68" },
  selectedTagText: { fontSize: 12, color: "#333", fontWeight: "500" },
  clearAllButton: { paddingVertical: 6, paddingHorizontal: 12 },
  clearAllText: { fontSize: 12, color: "#E94A37", fontWeight: "600" },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: SPACING },
  masonryContainer: { flexDirection: "row", justifyContent: "space-between" },
  column: { width: COLUMN_WIDTH, gap: SPACING },
  tile: { width: "100%", borderRadius: 8, overflow: "hidden", backgroundColor: "#1a1a1a", position: "relative", marginBottom: SPACING },
  tileImage: { width: "100%", height: "100%" },
  tileVideo: { width: "100%", height: "100%" },
  thumbnailOverlay: { width: "100%", height: "100%", position: "absolute", top: 0, left: 0 },
  placeholderImage: { backgroundColor: "#2a2a2a", justifyContent: "center", alignItems: "center" },
  playIconContainer: { position: "absolute", top: "50%", left: "50%", transform: [{ translateX: -20 }, { translateY: -20 }], width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center" },
  likeBtn: { position: "absolute", top: 8, right: 8, backgroundColor: "rgba(0,0,0,0.4)", padding: 8, borderRadius: 20 },
  viewsContainer: { position: "absolute", bottom: 8, left: 8, flexDirection: "row", alignItems: "center", backgroundColor: "rgba(0,0,0,0.5)", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, gap: 4 },
  viewsText: { color: "#fff", fontSize: 12, fontWeight: "600" },
  loadingMore: { padding: 20, alignItems: "center" },
  emptyState: { flex: 1, justifyContent: "center", alignItems: "center", paddingVertical: 60 },
  emptyStateText: { fontSize: 18, fontWeight: "600", color: "#333", marginTop: 16 },
  navBar: { position: "absolute", bottom: 0, left: 0, right: 0, flexDirection: "row", justifyContent: "space-around", alignItems: "center", paddingVertical: 8, paddingTop: 4, borderTopWidth: 1, borderTopColor: "#E8E8E8", backgroundColor: "#FFFFFF", elevation: 8 },
  navItem: { alignItems: "center", justifyContent: "center", paddingVertical: 4, paddingHorizontal: 12 },
  navLabel: { fontSize: 11, color: "#000", marginTop: 2, textAlign: "center", fontWeight: "500" },
  navLabelActive: { fontSize: 11, color: "#000", marginTop: 0, textAlign: "center", fontWeight: "700" },
  centerNavItem: { alignItems: "center", justifyContent: "center", paddingVertical: 8, paddingHorizontal: 12, marginTop: -30 },
  centerIconCircle: { width: 56, height: 56, borderRadius: 28, backgroundColor: "#fff", borderWidth: 2, borderColor: "#333", justifyContent: "center", alignItems: "center", marginBottom: 4, elevation: 8 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0, 0, 0, 0.7)", justifyContent: "flex-end" },
  categoryModal: { backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: "80%" },
  categoryModalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, borderBottomWidth: 1, borderBottomColor: "#E5E5E5" },
  categoryModalTitle: { fontSize: 20, fontWeight: "bold", color: "#000" },
  selectedCountContainer: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingVertical: 12, backgroundColor: "#F0F9F9" },
  selectedCountText: { fontSize: 14, color: "#4ECDC4", fontWeight: "600" },
  clearAllModalText: { fontSize: 14, color: "#E94A37", fontWeight: "600" },
  categoryList: { padding: 12 },
  categoryItem: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, borderRadius: 12, marginBottom: 8, backgroundColor: "#F9F9F9" },
  categoryItemSelected: { backgroundColor: "#1B7C82", borderWidth: 2, borderColor: "#4ECDC4" },
  categoryItemContent: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  categoryItemText: { fontSize: 16, color: "#000", flex: 1 },
  categoryItemTextSelected: { fontWeight: "600", color: "#fff" },
  modalFooter: { padding: 16, borderTopWidth: 1, borderTopColor: "#E5E5E5" },
  doneButton: { backgroundColor: "#4ECDC4", paddingVertical: 14, borderRadius: 12, alignItems: "center" },
  doneButtonText: { color: "#FFF", fontSize: 16, fontWeight: "bold" },
});