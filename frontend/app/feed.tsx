// ============================================
// UPDATED FEED SCREEN WITH SKELETON LOADING
// ============================================
// 
// Changes made:
// 1. Import the FeedSkeleton component
// 2. Replace the ActivityIndicator loading state with skeleton
// 3. Keep the skeleton in ListHeaderComponent for smooth experience
//
// HOW TO INTEGRATE:
// 1. Copy FeedSkeleton.tsx to your components folder
// 2. Update the import path below
// 3. Replace your loading UI section with the skeleton component
// ============================================

import React, { useEffect, useState, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Platform,
  Modal,
  FlatList,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import FeedCard from "../components/FeedCard";
import UserAvatar from "../components/UserAvatar";
import StoriesBar from "../components/StoriesBar";
import { BlurView } from 'expo-blur';
import { fetchUnreadCount } from "../utils/notifications";
import { useNotifications } from "../context/NotificationContext";
import {
  normalizeMediaUrl,
  normalizeProfilePicture,
  BACKEND_URL,
} from "../utils/imageUrlFix";

// ⭐ ADD THIS IMPORT - adjust path based on where you place the file
import { FeedSkeleton } from "../components/FeedSkeleton";

const BACKEND = BACKEND_URL;
let globalMuteState = true;

/* -------------------------
   Level System Helper
------------------------- */
const LEVEL_TABLE = [
  { level: 1, required_points: 1250 },
  { level: 2, required_points: 2500 },
  { level: 3, required_points: 3750 },
  { level: 4, required_points: 5000 },
  { level: 5, required_points: 5750 },
  { level: 6, required_points: 6500 },
  { level: 7, required_points: 7250 },
  { level: 8, required_points: 8000 },
  { level: 9, required_points: 9000 },
  { level: 10, required_points: 10000 },
  { level: 11, required_points: 11000 },
  { level: 12, required_points: 12000 },
];

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
  const { user, token, refreshUser, accountType } = useAuth() as any;

  const [feedPosts, setFeedPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { unreadCount, refreshUnreadCount } = useNotifications();
  const [visibleVideoId, setVisibleVideoId] = useState<string | null>(null);
  const [showFixedLine, setShowFixedLine] = useState(false);
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [isMuted, setIsMuted] = useState(globalMuteState);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [ownStoryData, setOwnStoryData] = useState<any>(null);

  const flatListRef = useRef<FlatList>(null);
  const postPositionsRef = useRef<Map<string, { y: number; height: number }>>(new Map());
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isScrollingRef = useRef(false);
  const paginationTriggeredRef = useRef(false);
  const lastScrollYRef = useRef(0);
  const [hasInitiallyLoaded, setHasInitiallyLoaded] = useState(false);
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);

  const POSTS_PER_PAGE = 30;
  const VISIBILITY_THRESHOLD = 0.2;

  // Handle mute toggle
  const handleMuteToggle = useCallback((newMuteState: boolean) => {
    globalMuteState = newMuteState;
    setIsMuted(newMuteState);
  }, []);

useEffect(() => {
  if (!hasInitiallyLoaded) {
    fetchFeed(true);
    setHasInitiallyLoaded(true);
  }
  refreshUnreadCount();
  loadUnreadMessagesCount();  // ⬅️ ADD THIS
}, []);


useFocusEffect(
  React.useCallback(() => {
    refreshUnreadCount();
    loadUnreadMessagesCount();  // ⬅️ ADD THIS
    refreshUser();
    fetchOwnStory();
    
    // Only fetch feed on first load
    if (!hasInitiallyLoaded) {
      fetchFeed(true);
      setHasInitiallyLoaded(true);
    }
  }, [hasInitiallyLoaded])
);

const loadUnreadMessagesCount = async () => {
  if (!token) return;
  try {
    const response = await axios.get(`${BACKEND}/api/chat/unread-count`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    setUnreadMessagesCount(response.data.unreadCount || 0);
  } catch (error) {
    console.log('Error fetching unread messages:', error);
  }
};



// ADD this ref near your other refs
const visibleVideoIdRef = useRef<string | null>(null);
const viewabilityDebounceRef = useRef<NodeJS.Timeout | null>(null);

const viewabilityConfigRef = useRef({
  itemVisiblePercentThreshold: 60,
  minimumViewTime: 300,
});

const handleViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: any[] }) => {
  if (viewabilityDebounceRef.current) {
    clearTimeout(viewabilityDebounceRef.current);
  }

  viewabilityDebounceRef.current = setTimeout(() => {
    const visibleVideo = viewableItems.find((item) => {
      const post = item.item;
      const isVideo =
        post.media_type === "video" ||
        post.media_url?.toLowerCase().endsWith(".mp4");
      return isVideo && item.isViewable;
    });

    const newVisibleId = visibleVideo ? String(visibleVideo.item.id) : null;
    
    if (newVisibleId !== visibleVideoIdRef.current) {
      console.log(`[Video] Setting visible video: ${newVisibleId}`);
      visibleVideoIdRef.current = newVisibleId;
      setVisibleVideoId(newVisibleId);
    }
  }, 150);
}).current;

  const fetchOwnStory = async () => {
    if (!token || !user?.id) return;
    try {
      const response = await axios.get(`${BACKEND}/api/stories/feed`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const ownStory = response.data.find(
        (u: any) => u.user.id === user.id || u.user._id === user.id
      );

      if (ownStory && ownStory.stories && ownStory.stories.length > 0) {
        setOwnStoryData({
          user: {
            id: user.id,
            username: user.username,
            profile_picture: user.profile_picture,
            level: user.level,
          },
          stories: ownStory.stories.map((s: any) => ({
            ...s,
            media_url: normalizeMediaUrl(s.media_url),
            media_type: s.media_type || s.type || "image",
          })),
        });
      } else {
        setOwnStoryData(null);
      }
    } catch (err) {
      if (__DEV__) console.log("Error fetching own story:", err);
      setOwnStoryData(null);
    }
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
      const res = await axios.get(
        `${BACKEND}/api/feed?skip=${skip}&limit=${POSTS_PER_PAGE}&sort=chronological${ts}`
      );

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
        description: post.review_text || post.description || post.about,
        rating: post.rating,
        price: post.price, 
        about: post.about,
        account_type: post.account_type,
        media_url: normalizeMediaUrl(post.image_url || post.media_url),
        thumbnail_url: post.thumbnail_url
          ? normalizeMediaUrl(post.thumbnail_url)
          : null,
        media_type: post.media_type,
        created_at: post.created_at,
        user_level: post.user_level || post.level || post.userLevel,
        location_name: post.location_name || post.location || post.place_name,
        location_address: post.location_address || post.address,
        map_link: post.map_link || post.google_maps_link,
        likes: post.likes || post.likes_count || 0,
        comments: post.comments || post.comments_count || 0,
        is_liked: post.is_liked || false,
        is_saved_by_user: post.is_saved_by_user || post.is_saved || false,
        is_following: post.is_following || false,
      }));

      if (forceRefresh) {
        setFeedPosts(mapped);
      } else {
        setFeedPosts((prev) => [...prev, ...mapped]);
        setPage((prev) => prev + 1);
      }

      if (res.data.length < POSTS_PER_PAGE) {
        setHasMore(false);
      }

      setVisibleVideoId(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  };

  // Track post positions
  const handlePostLayout = useCallback((postId: string, event: any) => {
    const { y, height } = event.nativeEvent.layout;
    postPositionsRef.current.set(postId, { y, height });
  }, []);

  // Find visible video
  const findVisibleVideo = useCallback(
  (scrollY: number, viewportHeight: number) => {
    const viewportTop = scrollY;
    const viewportBottom = scrollY + viewportHeight;

    let bestVideo: { id: string; visibilityRatio: number } | null = null;

    const positions = Array.from(postPositionsRef.current.entries());
    
    const videoPosts = feedPosts.filter(p => 
      p.media_type === "video" || p.media_url?.toLowerCase().endsWith(".mp4")
    );

    for (const [postId, position] of positions) {
      const post = feedPosts.find((p) => String(p.id) === String(postId));
      if (!post) continue;

      const isVideo =
        post.media_type === "video" ||
        post.media_url?.toLowerCase().endsWith(".mp4");

      if (!isVideo) continue;

      const postTop = position.y;
      const postBottom = position.y + position.height;
      const postHeight = position.height;

      const visibleTop = Math.max(postTop, viewportTop);
      const visibleBottom = Math.min(postBottom, viewportBottom);
      const visibleHeight = Math.max(0, visibleBottom - visibleTop);

      const visibilityRatio = postHeight > 0 ? visibleHeight / postHeight : 0;

      if (visibilityRatio >= VISIBILITY_THRESHOLD) {
        const candidate = { id: String(postId), visibilityRatio };
        if (!bestVideo || visibilityRatio > bestVideo.visibilityRatio) {
          bestVideo = candidate;
        }
      }
    }

    return bestVideo?.id ?? null;
  },
  [feedPosts]
);

  // Handle scroll
const handleScroll = useCallback(
  (event: any) => {
    
    const scrollY = event.nativeEvent.contentOffset.y;
    const viewportHeight = event.nativeEvent.layoutMeasurement.height;
    const contentHeight = event.nativeEvent.contentSize.height;

    setShowFixedLine(scrollY > 100);

    if (scrollY < lastScrollYRef.current - 100) {
      paginationTriggeredRef.current = false;
    }
    lastScrollYRef.current = scrollY;

    // Pagination check
    const paddingToBottom = 100;
    const isNearBottom = scrollY + viewportHeight >= contentHeight - paddingToBottom;

    if (
      isNearBottom &&
      hasMore &&
      !loadingMore &&
      !loading &&
      !paginationTriggeredRef.current
    ) {
      paginationTriggeredRef.current = true;
      fetchFeed(false).finally(() => {
        setTimeout(() => {
          paginationTriggeredRef.current = false;
        }, 1000);
      });
    }
  },
  [hasMore, loadingMore, loading]
);

 useEffect(() => {
  return () => {
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    if (viewabilityDebounceRef.current) {
      clearTimeout(viewabilityDebounceRef.current);
    }
  };
}, []);

  // Render post item
const renderPost = useCallback(
  ({ item: post }: { item: any }) => {
    const isVideo =
      post.media_type === "video" ||
      post.media_url?.toLowerCase().endsWith(".mp4");
    const shouldPlay = isVideo && visibleVideoId === String(post.id);

    return (
      <View style={styles.postContainer}>
        <FeedCard
          post={post}
          onLikeUpdate={() => {
            // Don't refresh entire feed on like
            // Just update the specific post
          }}
          onStoryCreated={() => {}}
          shouldPlay={shouldPlay}
          shouldPreload={shouldPlay}
          isMuted={isMuted}
          onMuteToggle={handleMuteToggle}
        />
      </View>
    );
  },
  [visibleVideoId, isMuted, handleMuteToggle]
);

  // List Header Component
  const ListHeader = useCallback(() => (
    <>
      {/* ================= HEADER WITH GRADIENT ================= */}
      <View style={styles.headerContainer}>
        <LinearGradient
          colors={["#E94A37", "#F2CF68", "#1B7C82"]}
          locations={[0, 0.5, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.gradientHeader}
        >
          <View style={styles.headerRow}>
            <TouchableOpacity
  style={styles.leftIcon}
  onPress={() => router.push("/chat")}
  activeOpacity={0.7}
  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
>
  <Ionicons name="chatbox-ellipses" size={20} color="#fff" />
  {unreadMessagesCount > 0 && (
   <View style={styles.chatBadge}>
  <Text style={styles.chatBadgeText}>
    {unreadMessagesCount > 99 ? "99+" : unreadMessagesCount}
  </Text>
</View>

  )}
</TouchableOpacity>

            <Text style={styles.cofauTitle} pointerEvents="none">
              Cofau
            </Text>

            <TouchableOpacity
              style={styles.leftIcon} 
              onPress={() => router.push("/notifications")}
              activeOpacity={0.7}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="notifications" size={20} color="#fff" />
              {unreadCount > 0 && (
                <View style={styles.notificationBadge}>
  <Text style={styles.notificationBadgeText}>
    {unreadCount > 99 ? "99+" : unreadCount}
  </Text>
</View>

              )}
            </TouchableOpacity>
          </View>

        </LinearGradient>

        {/* ===== LEVEL CARD ===== */}
        {/* ===== RESTAURANT CARD (for restaurant accounts) ===== */}
{user && accountType === 'restaurant' && (
  <View style={styles.levelCardWrapper}>
    <View style={[styles.levelCard, styles.levelCardAndroid]}>
      {/* Restaurant DP Container - Same as User with Story Ring */}
      <View style={styles.dpContainer}>
        <TouchableOpacity
          onPress={() => {
            if (ownStoryData) {
              router.push({
                pathname: "/story-viewer",
                params: {
                  userId: user.id,
                  stories: JSON.stringify(ownStoryData.stories),
                  user: JSON.stringify(ownStoryData.user),
                },
              });
            } else {
              setShowAddMenu(true);
            }
          }}
          activeOpacity={0.8}
        >
          {ownStoryData ? (
            <LinearGradient
              colors={["#E94A37", "#F2CF68", "#1B7C82"]}
              locations={[0, 0.35, 0.9]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.dpGradientRing}
            >
              <View style={styles.dpWhiteRing}>
                <UserAvatar
                  profilePicture={user.profile_picture}
                  username={user.restaurant_name || user.username}
                  size={66}
                  showLevelBadge={false}
                  style={{}}
                />
              </View>
            </LinearGradient>
          ) : (
            <UserAvatar
              profilePicture={user.profile_picture}
              username={user.restaurant_name || user.username}
              size={70}
              showLevelBadge={false}
              style={{}}
            />
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.dpAddButton}
          onPress={() => setShowAddMenu(true)}
        >
          <Ionicons name="add" size={19} color="#0f0303ff" />
        </TouchableOpacity>
      </View>

      {/* Total Reviews Content */}
      <View style={styles.levelContent}>
        <Text style={styles.levelLabel}>Total Reviews</Text>
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <LinearGradient
              colors={['#4CAF50', '#8BC34A']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.progressFill, { width: '0.4%' }]}
            />
          </View>
          <Text style={styles.progressText}>0/25000</Text>
        </View>
      </View>
    </View>
  </View>
)}
        {user && accountType !== 'restaurant' && (
           <View style={styles.levelCardWrapper}>
            {Platform.OS === "ios" ? (
              <BlurView intensity={60} tint="light" style={styles.levelCard}>
                <View style={styles.dpContainer}>
                  <TouchableOpacity
                    onPress={() => {
                      if (ownStoryData) {
                        router.push({
                          pathname: "/story-viewer",
                          params: {
                            userId: user.id,
                            stories: JSON.stringify(ownStoryData.stories),
                            user: JSON.stringify(ownStoryData.user),
                          },
                        });
                      } else {
                        setShowAddMenu(true);
                      }
                    }}
                    activeOpacity={0.8}
                  >
                    {ownStoryData ? (
                      <LinearGradient
                        colors={["#E94A37", "#F2CF68", "#1B7C82"]}
                        locations={[0, 0.35, 0.9]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.dpGradientRing}
                      >
                        <View style={styles.dpWhiteRing}>
                          <UserAvatar
                            profilePicture={user.profile_picture}
                            username={user.username}
                            size={66}
                            showLevelBadge={false}
                            level={user.level}
                            style={{}}
                          />
                        </View>
                      </LinearGradient>
                    ) : (
                      <UserAvatar
                        profilePicture={user.profile_picture}
                        username={user.username}
                        size={70}
                        showLevelBadge={false}
                        level={user.level}
                        style={{}}
                      />
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.dpAddButton}
                    onPress={() => setShowAddMenu(true)}
                  >
                    <Ionicons name="add" size={19} color="#0f0303ff" />
                  </TouchableOpacity>
                </View>

                <View style={styles.levelContent}>
                  <Text style={styles.levelLabel}>Level {user.level}</Text>
                  <View style={styles.progressContainer}>
                    <View style={styles.progressBar}>
                      {(() => {
                        const currentLevel = user.level || 1;
                        const currentPoints = user.currentPoints || 0;
                        const prevLevelData = LEVEL_TABLE.find(
                          (l) => l.level === currentLevel - 1
                        );
                        const prevThreshold = prevLevelData?.required_points || 0;
                        const currentLevelData = LEVEL_TABLE.find(
                          (l) => l.level === currentLevel
                        );
                        const currentThreshold =
                          currentLevelData?.required_points || 1250;
                        const pointsNeededForLevel =
                          currentThreshold - prevThreshold;
                        const progressPercent =
                          pointsNeededForLevel > 0
                            ? Math.min(
                                (currentPoints / pointsNeededForLevel) * 100,
                                100
                              )
                            : 0;

                        let gradientColors;
                        let gradientLocations;

                        if (progressPercent <= 33) {
                          gradientColors = ["#E94A37", "#E94A37"];
                          gradientLocations = [0, 1];
                        } else if (progressPercent <= 66) {
                          gradientColors = ["#E94A37", "#F2CF68"];
                          gradientLocations = [0, 1];
                        } else {
                          gradientColors = ["#E94A37", "#F2CF68", "#1B7C82"];
                          gradientLocations = [0, 0.5, 1];
                        }

                        return (
                          <LinearGradient
                            colors={gradientColors}
                            locations={gradientLocations}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={[
                              styles.progressFill,
                              { width: `${progressPercent}%` },
                            ]}
                          />
                        );
                      })()}
                    </View>
                    <Text style={styles.progressText}>
                      {user.total_points || user.points || 0}/
                      {(() => {
                        const currentLevel = user.level || 1;
                        const currentLevelData = LEVEL_TABLE.find(
                          (l) => l.level === currentLevel
                        );
                        return currentLevelData?.required_points || 1250;
                      })()}
                    </Text>
                  </View>
                </View>
              </BlurView>
            ) : (
              <View style={[styles.levelCard, styles.levelCardAndroid]}>
                <View style={styles.dpContainer}>
                  <TouchableOpacity
                    onPress={() => {
                      if (ownStoryData) {
                        router.push({
                          pathname: "/story-viewer",
                          params: {
                            userId: user.id,
                            stories: JSON.stringify(ownStoryData.stories),
                            user: JSON.stringify(ownStoryData.user),
                          },
                        });
                      } else {
                        setShowAddMenu(true);
                      }
                    }}
                    activeOpacity={0.8}
                  >
                    {ownStoryData ? (
                      <LinearGradient
                        colors={["#E94A37", "#F2CF68", "#1B7C82"]}
                        locations={[0, 0.35, 0.9]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.dpGradientRing}
                      >
                        <View style={styles.dpWhiteRing}>
                          <UserAvatar
                            profilePicture={user.profile_picture}
                            username={user.username}
                            size={66}
                            showLevelBadge={false}
                            level={user.level}
                            style={{}}
                          />
                        </View>
                      </LinearGradient>
                    ) : (
                      <UserAvatar
                        profilePicture={user.profile_picture}
                        username={user.username}
                        size={70}
                        showLevelBadge={false}
                        level={user.level}
                        style={{}}
                      />
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.dpAddButton}
                    onPress={() => setShowAddMenu(true)}
                  >
                    <Ionicons name="add" size={19} color="#0f0303ff" />
                  </TouchableOpacity>
                </View>

                <View style={styles.levelContent}>
                  <Text style={styles.levelLabel}>Level {user.level}</Text>
                  <View style={styles.progressContainer}>
                    <View style={styles.progressBar}>
                      {(() => {
                        const currentLevel = user.level || 1;
                        const currentPoints = user.currentPoints || 0;
                        const prevLevelData = LEVEL_TABLE.find(
                          (l) => l.level === currentLevel - 1
                        );
                        const prevThreshold = prevLevelData?.required_points || 0;
                        const currentLevelData = LEVEL_TABLE.find(
                          (l) => l.level === currentLevel
                        );
                        const currentThreshold =
                          currentLevelData?.required_points || 1250;
                        const pointsNeededForLevel =
                          currentThreshold - prevThreshold;
                        const progressPercent =
                          pointsNeededForLevel > 0
                            ? Math.min(
                                (currentPoints / pointsNeededForLevel) * 100,
                                100
                              )
                            : 0;

                        let gradientColors;
                        let gradientLocations;

                        if (progressPercent <= 33) {
                          gradientColors = ["#E94A37", "#E94A37"];
                          gradientLocations = [0, 1];
                        } else if (progressPercent <= 66) {
                          gradientColors = ["#E94A37", "#F2CF68"];
                          gradientLocations = [0, 1];
                        } else {
                          gradientColors = ["#E94A37", "#F2CF68", "#1B7C82"];
                          gradientLocations = [0, 0.5, 1];
                        }

                        return (
                          <LinearGradient
                            colors={gradientColors}
                            locations={gradientLocations}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={[
                              styles.progressFill,
                              { width: `${progressPercent}%` },
                            ]}
                          />
                        );
                      })()}
                    </View>
                    <Text style={styles.progressText}>
                      {user.total_points || user.points || 0}/
                      {(() => {
                        const currentLevel = user.level || 1;
                        const currentLevelData = LEVEL_TABLE.find(
                          (l) => l.level === currentLevel
                        );
                        return currentLevelData?.required_points || 1250;
                      })()}
                    </Text>
                  </View>
                </View>
              </View>
            )}
          </View>
        )}
      </View>

      {/* ================= STORIES ================= */}
      <StoriesBar refreshTrigger={refreshing} />

      {/* ⭐ SKELETON LOADING - Replace ActivityIndicator with FeedSkeleton */}
      {loading && feedPosts.length === 0 && (
        <FeedSkeleton showStories={false} />
      )}
    </>
), [user, ownStoryData, unreadCount, unreadMessagesCount, refreshing, loading, feedPosts.length, router]);

  // List Footer Component
  const ListFooter = useCallback(() => (
    loadingMore ? (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color="#4dd0e1" />
      </View>
    ) : null
  ), [loadingMore]);

  return (
    <View style={styles.container}>
      {/* Fixed Line */}
      {showFixedLine && <View style={styles.fixedLine} />}

      {/* FlatList */}
     <FlatList
  ref={flatListRef}
  data={feedPosts}
  keyExtractor={(item, index) => `post-${item.id}-${index}`}
  renderItem={renderPost}
  ListHeaderComponent={ListHeader}
  ListFooterComponent={ListFooter}
  refreshControl={
  <RefreshControl
    refreshing={refreshing}
    onRefresh={() => {
      setRefreshing(true);
      setHasInitiallyLoaded(false); // Reset the flag
      fetchFeed(true);
      setHasInitiallyLoaded(true); // Set it back
    }}
  />
}
  onScroll={handleScroll}
  scrollEventThrottle={16}
  showsVerticalScrollIndicator={false}
  contentContainerStyle={{ paddingBottom: 90 }}
  viewabilityConfig={viewabilityConfigRef.current}
  onViewableItemsChanged={handleViewableItemsChanged}
  removeClippedSubviews={Platform.OS === "android"}
  maxToRenderPerBatch={5}
  windowSize={7}
  initialNumToRender={5}
  updateCellsBatchingPeriod={50}
/>

      {/* ================= BOTTOM TABS ================= */}
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

      {/* Add Post/Story Modal */}
      <Modal
        visible={showAddMenu}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowAddMenu(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowAddMenu(false)}
        >
          <View style={styles.modalContent}>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setShowAddMenu(false);
                router.push("/add-post");
              }}
              activeOpacity={0.7}
            >
              <Ionicons name="image-outline" size={24} color="#333" />
              <Text style={styles.menuItemText}>Add Post</Text>
            </TouchableOpacity>

            <View style={styles.menuDivider} />

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setShowAddMenu(false);
                router.push("/story-upload");
              }}
              activeOpacity={0.7}
            >
              <Ionicons name="camera-outline" size={24} color="#333" />
              <Text style={styles.menuItemText}>Add Story</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

/* ================= STYLES ================= */
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
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
 // 🔴 Chat badge
chatBadge: {
  position: "absolute",
  top: 4,
  right: -2,
  backgroundColor: "#FF3B30",   // softer red
  borderRadius: 12,
  minWidth: 22,
  height: 18,
  paddingHorizontal: 6,
  alignItems: "center",
  justifyContent: "center",
  borderWidth: 2,
  borderColor: "#fff",
},

chatBadgeText: {
  color: "#fff",
  fontSize: 10,
  fontWeight: "800",
},

// 🔔 Notification badge
notificationBadge: {
  position: "absolute",
  top: -2,
  right: 11,
  backgroundColor: "#FF3B30",   // stronger red
  borderRadius: 10,
  minWidth: 22,
  height: 18,
  paddingHorizontal: 4,
  alignItems: "center",
  justifyContent: "center",
  borderWidth: 1.5,
  borderColor: "#fff",
},

notificationBadgeText: {
  color: "#fff",
  fontSize: 9,
  fontWeight: "700",
},

  leftIcon: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
  },
  restaurantLogoContainer: {
  width: 70,
  height: 70,
  borderRadius: 35,
  backgroundColor: '#FFF',
  justifyContent: 'center',
  alignItems: 'center',
  borderWidth: 2,
  borderColor: '#E0E0E0',
},
restaurantLogo: {
  width: 60,
  height: 60,
  borderRadius: 30,
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
    pointerEvents: "none",
  },
  headerIcons: {
    flexDirection: "row",
    gap: 20,
    zIndex: 10,
  },
  levelCardWrapper: {
    marginHorizontal: 20,
    marginTop: -40,
    marginBottom: 3,
    borderRadius: 25,
    overflow: "hidden",
    zIndex: 10,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.9)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  levelCard: {
    borderRadius: 25,
    paddingVertical: 22,
    paddingLeft: 90,
    paddingRight: 25,
    flexDirection: "row",
    alignItems: "center",
    position: "relative",
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    borderWidth: 1,
    borderColor: "rgba(200, 200, 200, 0.3)",
  },
  levelCardAndroid: {
    backgroundColor: "rgba(255, 255, 255, 0.9)",
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
  dpGradientRing: {
    width: 72,
    height: 72,
    borderRadius: 34,
    padding: 4,
    justifyContent: "center",
    alignItems: "center",
  },
  dpWhiteRing: {
    width: 68,
    height: 68,
    borderRadius: 35,
    backgroundColor: "#FFF",
    justifyContent: "center",
    alignItems: "center",
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
  centerNavItem: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginTop: -30,
  },
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
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: 20,
    paddingVertical: 10,
    minWidth: 200,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 24,
    gap: 16,
  },
  menuItemText: {
    fontSize: 16,
    color: "#333",
    fontWeight: "600",
  },
  menuDivider: {
    height: 1,
    backgroundColor: "#E8E8E8",
    marginHorizontal: 10,
  },
});