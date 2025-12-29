import React, { useEffect, useState, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import FeedCard from "../components/FeedCard";
import UserAvatar from "../components/UserAvatar";
import StoriesBar from "../components/StoriesBar";
import { fetchUnreadCount } from "../utils/notifications";
import {
  normalizeMediaUrl,
  normalizeProfilePicture,
  BACKEND_URL,
} from "../utils/imageUrlFix";

const BACKEND = BACKEND_URL;

/* -------------------------
   Normalize DP
------------------------- */
const getPostDP = (post: any) =>
  normalizeProfilePicture(
    post.user_profile_picture ||
      post.profile_picture ||
      post.profile_picture_url ||
      post.profile_pic ||
      post.user_profile_pic ||
      post.userProfilePicture ||
      post.profilePicture
  );

export default function FeedScreen() {
  const router = useRouter();
  const { user, token, refreshUser } = useAuth() as any;

  const [feedPosts, setFeedPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [visibleVideoId, setVisibleVideoId] = useState<string | null>(null);
  const [showFixedLine, setShowFixedLine] = useState(false);
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const scrollViewRef = useRef<ScrollView>(null);
  const postPositionsRef = useRef<Map<string, { y: number; height: number }>>(new Map());
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isScrollingRef = useRef(false);
  const paginationTriggeredRef = useRef(false);
  const lastScrollYRef = useRef(0);
  
  const POSTS_PER_PAGE = 30;

  useEffect(() => {
    fetchFeed();
    loadUnreadCount();
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      loadUnreadCount();
      refreshUser();
      fetchFeed(true);
    }, [token])
  );

  const loadUnreadCount = async () => {
    if (!token) return;
    try {
      const count = await fetchUnreadCount(token);
      setUnreadCount(count);
    } catch {}
  };

  const fetchFeed = async (forceRefresh = false) => {
    try {
      if (forceRefresh) {
        setLoading(true);
        setPage(1);
        setHasMore(true);
        paginationTriggeredRef.current = false;
      } else {
        if (!hasMore || loadingMore || paginationTriggeredRef.current) return;
        setLoadingMore(true);
        paginationTriggeredRef.current = true;
      }

      const skip = forceRefresh ? 0 : (page - 1) * POSTS_PER_PAGE;
      const ts = forceRefresh ? `&_t=${Date.now()}` : "";
      const res = await axios.get(`${BACKEND}/api/feed?skip=${skip}&limit=${POSTS_PER_PAGE}${ts}`);

      if (res.data.length === 0) {
        setHasMore(false);
        if (forceRefresh) {
          setFeedPosts([]);
        }
        return;
      }

      const mapped = res.data.map((post: any) => ({
        id: post.id,
        user_id: post.user_id,
        username: post.username,
        user_profile_picture: getPostDP(post),
        description: post.review_text || post.description,
        rating: post.rating,
        media_url: normalizeMediaUrl(post.image_url || post.media_url),
        thumbnail_url: post.thumbnail_url ? normalizeMediaUrl(post.thumbnail_url) : null,
        media_type: post.media_type,
        created_at: post.created_at,
        user_level: post.user_level || post.level || post.userLevel,
        // Location fields
        location_name: post.location_name || post.location || post.place_name,
        location_address: post.location_address || post.address,
        map_link: post.map_link || post.google_maps_link,
        // Engagement fields
        likes: post.likes || post.likes_count || 0,
        comments: post.comments || post.comments_count || 0,
        is_liked: post.is_liked || false,
        is_saved_by_user: post.is_saved_by_user || post.is_saved || false,
        is_following: post.is_following || false,
      }));

      // Backend already sorts by created_at descending, no need for client-side sorting
      if (forceRefresh) {
        setFeedPosts(mapped);
      } else {
        setFeedPosts((prev) => [...prev, ...mapped]);
        setPage((prev) => prev + 1);
      }

      if (res.data.length < POSTS_PER_PAGE) {
        setHasMore(false);
      }

      // Reset visible video when feed refreshes
      setVisibleVideoId(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  };

  // Track post positions for viewability detection
  const handlePostLayout = useCallback((postId: string, event: any) => {
    const { y, height } = event.nativeEvent.layout;
    postPositionsRef.current.set(postId, { y, height });
  }, []);

  // Find which video should be playing based on scroll position
  const findVisibleVideo = useCallback((scrollY: number, viewportHeight: number): string | null => {
    const viewportTop = scrollY;
    const viewportBottom = scrollY + viewportHeight;
    const viewportCenter = scrollY + viewportHeight / 2;

    interface VideoCandidate {
      id: string;
      distance: number;
    }
    let closestVideo: VideoCandidate | null = null;

    const positions = Array.from(postPositionsRef.current.entries());
    for (const [postId, position] of positions) {
      const post = feedPosts.find((p) => String(p.id) === String(postId));
      if (!post) continue;

      const isVideo =
        post.media_type === "video" ||
        post.media_url?.toLowerCase().endsWith(".mp4");

      if (!isVideo) continue;

      const postTop = position.y;
      const postBottom = position.y + position.height;
      const postCenter = position.y + position.height / 2;

      // Check if post is in viewport
      const isInViewport =
        (postTop >= viewportTop && postTop <= viewportBottom) ||
        (postBottom >= viewportTop && postBottom <= viewportBottom) ||
        (postTop <= viewportTop && postBottom >= viewportBottom);

      if (isInViewport) {
        const distance = Math.abs(postCenter - viewportCenter);
        const candidate: VideoCandidate = { id: String(postId), distance };
        if (!closestVideo || distance < closestVideo.distance) {
          closestVideo = candidate;
        }
      }
    }

    return closestVideo?.id ?? null;
  }, [feedPosts]);

  // Handle scroll events
  const handleScroll = useCallback((event: any) => {
    isScrollingRef.current = true;
    
    // Extract values immediately before event is nullified
    const scrollY = event.nativeEvent.contentOffset.y;
    const viewportHeight = event.nativeEvent.layoutMeasurement.height;
    const contentHeight = event.nativeEvent.contentSize.height;
    
    // Show fixed line when scrolled down more than 100px
    if (scrollY > 100) {
      setShowFixedLine(true);
    } else {
      setShowFixedLine(false);
    }
    
    // Reset pagination trigger if user scrolls back up significantly
    if (scrollY < lastScrollYRef.current - 100) {
      paginationTriggeredRef.current = false;
    }
    lastScrollYRef.current = scrollY;
    
    // IMMEDIATELY pause all videos when scrolling starts
    // This prevents audio overlap when swiping between videos
    if (visibleVideoId) {
      setVisibleVideoId(null);
    }
    
    // Clear existing timeout
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }

    // Set timeout to detect when scrolling stops
    scrollTimeoutRef.current = setTimeout(() => {
      isScrollingRef.current = false;
      
      const visibleId = findVisibleVideo(scrollY, viewportHeight);
      
      setVisibleVideoId(visibleId);
      
      // Only check for pagination AFTER scrolling has stopped
      // This prevents auto-scrolling during active scrolling
      const paddingToBottom = 100;
      const isNearBottom = scrollY + viewportHeight >= contentHeight - paddingToBottom;
      
      if (isNearBottom && hasMore && !loadingMore && !loading && !paginationTriggeredRef.current) {
        paginationTriggeredRef.current = true;
        fetchFeed(false).finally(() => {
          // Reset after a delay to allow for next pagination
          setTimeout(() => {
            paginationTriggeredRef.current = false;
          }, 1000);
        });
      }
    }, 200); // Wait 200ms after scrolling stops before checking pagination
  }, [findVisibleVideo, visibleVideoId, hasMore, loadingMore, loading]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  return (
    <View style={styles.container}>
      {/* Fixed Line Below Status Bar - Shows only when scrolled */}
      {showFixedLine && (
        <View style={styles.fixedLine} />
      )}
      
      <ScrollView
        ref={scrollViewRef}
        contentContainerStyle={{ paddingBottom: 90 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchFeed(true)}
          />
        }
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        {/* ================= HEADER WITH GRADIENT - NOW SCROLLABLE ================= */}
        <View style={styles.headerContainer}>
          <LinearGradient
            colors={["#E94A37", "#F2CF68", "#1B7C82"]}
            locations={[0, 0.5, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.gradientHeader}
          >
            {/* Top row with icons */}
            <View style={styles.headerRow}>
              {/* Left Message Icon */}
              <TouchableOpacity
                style={styles.leftIcon}
                onPress={() => {
                  console.log("Chat icon pressed, navigating to /chat");
                  router.push("/chat");
                }}
                activeOpacity={0.7}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="chatbox-ellipses" size={20} color="#fff" />
              </TouchableOpacity>

              <Text style={styles.cofauTitle} pointerEvents="none">Cofau</Text>

              <View style={styles.headerIcons}>
                <TouchableOpacity 
                  onPress={() => {
                    console.log("Notifications icon pressed, navigating to /notifications");
                    router.push("/notifications");
                  }}
                  activeOpacity={0.7}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="notifications" size={20} color="#fff" />
                  {unreadCount > 0 && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>
                        {unreadCount > 99 ? "99+" : unreadCount}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </LinearGradient>

          {/* ===== LEVEL CARD WITH OVERLAPPING DP - OVERLAPS GRADIENT ===== */}
          {user && (
            <View style={styles.levelCardWrapper}>
              {/* Level card - white background with more rounded edges */}
              <View style={styles.levelCard}>
                {/* Profile picture - positioned to overlap on the left */}
                <View style={styles.dpContainer}>
                  <UserAvatar
                    profilePicture={user.profile_picture}
                    username={user.username}
                    size={70}
                    showLevelBadge={false}
                    level={user.level}
                    style={{}}
                  />
                  <TouchableOpacity
                    style={styles.dpAddButton}
                    onPress={() => router.push("/add-post")}
                  >
                    <Ionicons name="add" size={19} color="#0f0303ff" />
                  </TouchableOpacity>
                </View>

                <View style={styles.levelContent}>
                  <Text style={styles.levelLabel}>Level {user.level}</Text>

                  <View style={styles.progressContainer}>
                    <View style={styles.progressBar}>
                      <LinearGradient
                        colors={["#E94A37", "#F2CF68", "#1B7C82"]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={[
                          styles.progressFill,
                          {
                            width: `${Math.min(
                              ((user.currentPoints || 0) /
                                (user.requiredPoints || 1250)) *
                                100,
                              100
                            )}%`,
                          },
                        ]}
                      />
                    </View>
                    <Text style={styles.progressText}>
                      {user.currentPoints || 0}/{user.requiredPoints || 1250}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          )}
        </View>

        {/* ================= STORIES ================= */}
        <StoriesBar refreshTrigger={refreshing} />

        {/* ================= FEED ================= */}
        {loading && feedPosts.length === 0 && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#4dd0e1" />
            <Text style={styles.loadingText}>Loading feed...</Text>
          </View>
        )}

        {feedPosts.map((post) => {
            const isVideo =
              post.media_type === "video" ||
              post.media_url?.toLowerCase().endsWith(".mp4");
            const shouldPlay = isVideo && visibleVideoId === post.id && !isScrollingRef.current;
            
            return (
              <View
                key={post.id}
                style={styles.postContainer}
                onLayout={(e) => handlePostLayout(String(post.id), e)}
              >
                <FeedCard
                  post={post}
                  onLikeUpdate={fetchFeed}
                  onStoryCreated={() => {}}
                  shouldPlay={shouldPlay}
                />
              </View>
            );
          })}

        {/* Load More Indicator */}
        {loadingMore && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color="#4dd0e1" />
          </View>
        )}
      </ScrollView>

      {/* ================= BOTTOM TABS (UPDATED) ================= */}
      <View style={styles.navBar}>
        <TouchableOpacity 
          style={styles.navItem}
          onPress={() => router.push("/feed")}
        >
          <Ionicons name="home" size={20} color="#000" />
          <Text style={styles.navLabelActive}>Home</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.navItem}
          onPress={() => router.push("/explore")}
        >
          <Ionicons name="compass-outline" size={20} color="#000" />
          <Text style={styles.navLabel}>Explore</Text>
        </TouchableOpacity>

        {/* ✅ ELEVATED CENTER BUTTON */}
        <TouchableOpacity 
          style={styles.centerNavItem}
          onPress={() => router.push("/leaderboard")}
        >
          <View style={styles.centerIconCircle}>
            <Ionicons name="camera" size={22} color="#000" />
          </View>
          <Text style={styles.navLabel}>Top Posts</Text>
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

/* ================= STYLES ================= */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },

  // Fixed line below status bar - appears on scroll
  fixedLine: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 50,
    backgroundColor: "#fff",
    borderBottomWidth: 4,
    borderBottomColor: "#E0E0E0",
    zIndex: 1000,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 5,
  },

  headerContainer: {
    position: "relative",
    marginBottom: 4,
  },

  gradientHeader: {
    paddingTop: 60,
    paddingBottom: 60,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    shadowColor: "#000",                
    shadowOffset: { width: 4, height: 4 },  
    shadowOpacity: 0.15,               
    shadowRadius: 8,                
    elevation: 6, 
  },

  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  leftIcon: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10, // Ensure it's above the title
  },

  cofauTitle: {
    position: "absolute",
    left: 0,
    right: 0,
    textAlign: "center",
    fontFamily: "Lobster",
    fontSize: 32,
    color: "#fff",
    letterSpacing: 1,
    zIndex: 3,
    textShadowColor: "rgba(0, 0, 0, 0.15)",      
    textShadowOffset: { width: 6, height: 4 },   
    textShadowRadius: 4,
    pointerEvents: "none", // Don't block touch events
  },

  headerIcons: {
    flexDirection: "row",
    gap: 20,
    zIndex: 10, // Ensure it's above the title
  },

  badge: {
    position: "absolute",
    top: -4,
    right: -4,
    backgroundColor: "#FF4444",
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },

  badgeText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
  },

  levelCardWrapper: {
    marginHorizontal: 30,
    marginTop: -40,
    marginBottom: 3,
    borderBottomLeftRadius: 30,
    zIndex: 10,
  },

  levelCard: {
    backgroundColor: "#fff",
    borderRadius: 23,
    paddingVertical: 22,
    paddingLeft: 90,
    paddingRight: 25,
    flexDirection: "row",
    alignItems: "center",
    elevation: 15,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    position: "relative",
    borderWidth: 0,  
    borderColor: "#090000ff",
  },

  dpContainer: {
    position: "absolute",
    left: 10,
    top: "133%",
    transform: [{ translateY: -40 }],
    zIndex: 6,
  },

  dpAddButton: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#f2f4f5ff",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 0.5,
    borderColor: "#050202ff",
  },

  levelContent: {
    flex: 1,
  },

  levelLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#333",
    marginBottom: 2,
  },

  progressContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },

  progressBar: {
    flex: 1,
    height: 8,
    backgroundColor: "#E8E8E8",
    borderRadius: 6,
    overflow: "hidden",
  },

  progressFill: {
    height: "100%",
    borderRadius: 4,
  },

  progressText: {
    fontSize: 12,
    color: "rgba(10, 10, 10, 1)",
    fontWeight: "600",
  },

  loadingContainer: {
    padding: 40,
    alignItems: "center",
  },

  loadingText: {
    marginTop: 22,
    color: "#d51010ff",
  },

  postContainer: {
    marginBottom: -4,
  },

  navBar: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingVertical: 8,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: "#E8E8E8",
    backgroundColor: "#FFFFFF",
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    elevation: 8,
    shadowColor: "#f7f3f3ff",
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
    width: 50,
    height: 50,
    borderRadius: 28,
    backgroundColor: "#FFFFFF", 
    borderWidth: 2, 
    borderColor: "#000", 
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 2,
    elevation: 8,
    shadowColor: "#f0ebebff",
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
});
