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

import React, { useEffect, useState, useRef, useCallback, useMemo } from "react";
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
  Animated,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useFocusEffect, useNavigation, useLocalSearchParams } from "expo-router";
import { useFeedRefresh } from "./_layout";
import axios from "axios";
import { useAuth } from "../../context/AuthContext";
import FeedCard from "../../components/FeedCard";
import UserAvatar from "../../components/UserAvatar";
import StoriesBar from "../../components/StoriesBar";
import { BlurView } from 'expo-blur';
import MaskedView from '@react-native-masked-view/masked-view';
import { fetchUnreadCount } from "../../utils/notifications";
import { useNotifications } from "../../context/NotificationContext";
import { useUpload } from "../../context/UploadContext";
import { useLevelAnimation } from "../../context/LevelContext";
import PointsEarnedAnimation from "../../components/PointsEarnedAnimation";
import PostRewardModal from "../../components/PostRewardModal";
import SuggestedUsersBar from "../../components/SuggestedUsersBar";
import {
  normalizeMediaUrl,
  normalizeProfilePicture,
  BACKEND_URL,
} from "../../utils/imageUrlFix";

// ⭐ ADD THIS IMPORT - adjust path based on where you place the file
import { FeedSkeleton } from "../../components/FeedSkeleton";
import CofauWalletModal from "../../components/CofauWalletModal";

const BACKEND = BACKEND_URL;
let globalMuteState = true;

/* -------------------------
   Animated Typewriter Pill
------------------------- */
const PILL_WORDS = ['EARN REWARDS', 'GET FEATURED', 'LEVEL UP', 'EXPLORE DISHES'];

const AnimatedPillText = React.memo(() => {
  const [text, setText] = useState('');
  const ref = useRef({ wordIdx: 0, charIdx: 0, deleting: false, wait: 0 });

  useEffect(() => {
    const id = setInterval(() => {
      const s = ref.current;
      if (s.wait > 0) { s.wait--; return; }
      const word = PILL_WORDS[s.wordIdx];
      if (!s.deleting) {
        if (s.charIdx < word.length) {
          s.charIdx++;
          setText(word.substring(0, s.charIdx));
        } else {
          s.deleting = true;
          s.wait = 12;
        }
      } else {
        if (s.charIdx > 0) {
          s.charIdx--;
          setText(word.substring(0, s.charIdx));
        } else {
          s.deleting = false;
          s.wordIdx = (s.wordIdx + 1) % PILL_WORDS.length;
          s.wait = 3;
        }
      }
    }, 100);
    return () => clearInterval(id);
  }, []);

  return (
    <View style={{ alignItems: 'center' }}>
      <Text numberOfLines={1} style={{ fontSize: 10, fontWeight: '700', color: '#AAAAAA', letterSpacing: 0.3, lineHeight: 14 }}>
        SHARE YOUR FOOD EXPERIENCE &
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 3 }}>
        <Text style={{ fontSize: 13, fontWeight: '800', color: '#E94A37', letterSpacing: 0.4, lineHeight: 18 }}>
          {text}
        </Text>
        <Text style={{ fontSize: 13, fontWeight: '300', color: '#E94A37', lineHeight: 18 }}>|</Text>
      </View>
    </View>
  );
});

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

/* -------------------------
   Spread apart consecutive
   posts from the same user
------------------------- */
function spreadPosts(posts: any[]): any[] {
  if (posts.length <= 1) return [...posts];
  const result: any[] = [];
  const remaining = [...posts];
  let lastUserId: any = null;

  while (remaining.length > 0) {
    const idx = remaining.findIndex((p) => p.user_id !== lastUserId);
    if (idx !== -1) {
      result.push(remaining[idx]);
      lastUserId = remaining[idx].user_id;
      remaining.splice(idx, 1);
    } else {
      result.push(remaining[0]);
      lastUserId = remaining[0].user_id;
      remaining.splice(0, 1);
    }
  }
  return result;
}

/* -------------------------
   "Suggested Posts" Header
------------------------- */
const SuggestedPostsHeader = React.memo(() => (
  <View style={styles.suggestedHeaderContainer}>
    <LinearGradient
      colors={['#FF2E2E', '#FF7A18']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      style={styles.suggestedAccentLine}
    />
    <View style={styles.suggestedHeaderContent}>
      <Ionicons name="compass-outline" size={32} color="#FF7A18" />
      <Text style={styles.suggestedHeaderTitle}>Suggested Posts</Text>
      <Text style={styles.suggestedHeaderSubtitle}>
        Posts you might like based on what's trending
      </Text>
    </View>
    <LinearGradient
      colors={['#FF7A18', '#FF2E2E']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      style={styles.suggestedAccentLine}
    />
  </View>
));

export default function FeedScreen() {
  const router = useRouter();
  const { openWallet } = useLocalSearchParams<{ openWallet?: string }>();
  const { user, token, refreshUser, accountType } = useAuth() as any;
  const { lastUploadTimestamp, lastUploadResult } = useUpload();
  const { showLevelUpAnimation } = useLevelAnimation();
  const lastKnownUploadRef = useRef(lastUploadTimestamp);
  const previousLevelRef = useRef(user?.level || 1);

  // Post upload animation states
  const [showPointsAnimation, setShowPointsAnimation] = useState(false);
  const [pointsEarned, setPointsEarned] = useState(0);
  const [showRewardModal, setShowRewardModal] = useState(false);
  const [rewardData, setRewardData] = useState<any>(null);
  const pendingPointsRef = useRef<number | null>(null);
  const pendingLevelUpRef = useRef<number | null>(null);

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
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [walletUnreadCount, setWalletUnreadCount] = useState(0);
  const [suggestedPosts, setSuggestedPosts] = useState<any[]>([]);

  const flatListRef = useRef<FlatList>(null);
  const postPositionsRef = useRef<Map<string, { y: number; height: number }>>(new Map());
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isScrollingRef = useRef(false);
  const paginationTriggeredRef = useRef(false);
  const lastScrollYRef = useRef(0);
  const [hasInitiallyLoaded, setHasInitiallyLoaded] = useState(false);
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);
  const [restaurantReviewsCount, setRestaurantReviewsCount] = useState(0);
  const [suggestionsShown, setSuggestionsShown] = useState(false);
  const [showNewPostsPill, setShowNewPostsPill] = useState(false);
  const newestPostTimestampRef = useRef<string | null>(null);
  const newPostsPillAnim = useRef(new Animated.Value(0)).current;
  const justUploadedRef = useRef<boolean>(false);

  const POSTS_PER_PAGE = 30;
  const VISIBILITY_THRESHOLD = 0.2;

  // Register double-tap Home tab handler: scroll to top + refresh
  const { register: registerFeedRefresh } = useFeedRefresh();
  const navigation = useNavigation();
  const fetchFeedRef = useRef<((forceRefresh?: boolean) => void) | null>(null);

  // Build display data: deduplicate + insert "caught up" divider + suggested posts
  const displayData = useMemo(() => {
    let spread = spreadPosts(feedPosts);

    // Pin user's own post to top right after they upload
    if (justUploadedRef.current && user?.id && spread.length > 0) {
      const ownIdx = spread.findIndex(
        (p: any) =>
          p.user_id === user.id &&
          Date.now() - new Date(p.created_at).getTime() < 5 * 60 * 1000 // within 5 min
      );
      if (ownIdx > 0) {
        const [ownPost] = spread.splice(ownIdx, 1);
        spread.unshift(ownPost);
      }
      justUploadedRef.current = false;
    }

    let result = [...spread];

    // Append suggested posts when the regular feed has no more pages
    if (!hasMore && suggestedPosts.length > 0) {
      result.push({ type: 'suggested_header', id: 'suggested_header' });
      result.push(...suggestedPosts);
    }

    return result;
  }, [feedPosts, hasMore, suggestedPosts]);

  // Handle mute toggle
const handleMuteToggle = useCallback((newMuteState: boolean) => {
    globalMuteState = newMuteState;
    setIsMuted(newMuteState);
  }, []);

// Keep previous level ref in sync with user data
useEffect(() => {
  if (user?.level) {
    previousLevelRef.current = user.level;
  }
}, [user?.level]);

useEffect(() => {
  if (!hasInitiallyLoaded) {
    fetchFeed(true);
    setHasInitiallyLoaded(true);
  }
  refreshUnreadCount();
  loadUnreadMessagesCount();
  fetchWalletUnreadCount();
  fetchOwnStory();
  if (accountType === 'restaurant') {
    fetchRestaurantReviewsCount();
  }
}, []);

// Fetch own story as soon as auth is ready (token + user)
useEffect(() => {
  if (token && user?.id) {
    fetchOwnStory();
  }
}, [token, user?.id]);

const fetchRestaurantReviewsCount = async () => {
  if (!token || !user?.id || accountType !== 'restaurant') return;
  try {
    const response = await axios.get(
      `${BACKEND}/api/restaurants/${user.id}/reviews`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const reviews = response.data || [];
    setRestaurantReviewsCount(reviews.length);
  } catch (err) {
    setRestaurantReviewsCount(0);
  }
};

const fetchWalletUnreadCount = async () => {
  if (!token || accountType === 'restaurant') {
    setWalletUnreadCount(0);
    return;
  }
  try {
    const response = await axios.get(
      `${BACKEND}/api/wallet/unread-count`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    setWalletUnreadCount(response.data?.unread_count || 0);
  } catch (err) {
    setWalletUnreadCount(0);
  }
};

const checkForNewPosts = useCallback(async () => {
  if (!newestPostTimestampRef.current) return;
  try {
    // Fetch latest post by recency (not engagement) to correctly detect new posts
    const res = await axios.get(
      `${BACKEND}/api/feed?skip=0&limit=1&sort=latest&_t=${Date.now()}`
    );
    if (res.data && res.data.length > 0) {
      if (res.data[0].created_at > newestPostTimestampRef.current) {
        setShowNewPostsPill(true);
      }
    }
  } catch (err) {}
}, []);

useFocusEffect(
  React.useCallback(() => {
    refreshUnreadCount();
    loadUnreadMessagesCount();
    fetchWalletUnreadCount();
    refreshUser();
    fetchOwnStory();
    checkForNewPosts();
    if (accountType === 'restaurant') {
      fetchRestaurantReviewsCount();
    }

    // When leaving this tab, stop all video playback
    return () => {
      setVisibleVideoId(null);
    };
  }, [hasInitiallyLoaded, accountType])
);

// Animate "New Posts" pill
useEffect(() => {
  if (showNewPostsPill) {
    Animated.spring(newPostsPillAnim, {
      toValue: 1,
      friction: 6,
      tension: 80,
      useNativeDriver: true,
    }).start();
  } else {
    Animated.timing(newPostsPillAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }
}, [showNewPostsPill]);

// Auto-refresh feed every 24 hours
const lastAutoRefreshRef = useRef<number>(Date.now());
useEffect(() => {
  const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
  const interval = setInterval(() => {
    const elapsed = Date.now() - lastAutoRefreshRef.current;
    if (elapsed >= TWENTY_FOUR_HOURS) {
      lastAutoRefreshRef.current = Date.now();
      fetchFeedRef.current?.(true);
    }
  }, 60 * 1000); // check every minute
  return () => clearInterval(interval);
}, []);

// Also auto-refresh on tab focus if 24h has passed
useFocusEffect(
  React.useCallback(() => {
    const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
    const elapsed = Date.now() - lastAutoRefreshRef.current;
    if (elapsed >= TWENTY_FOUR_HOURS) {
      lastAutoRefreshRef.current = Date.now();
      fetchFeedRef.current?.(true);
    }
  }, [])
);

// Open wallet modal when navigated with openWallet param (e.g. from notifications)
useEffect(() => {
  if (openWallet === 'true') {
    setShowWalletModal(true);
    // Clear the param so it doesn't re-trigger
    router.setParams({ openWallet: undefined } as any);
  }
}, [openWallet]);

// Refresh feed and show animations when a background upload completes
useEffect(() => {
  if (lastUploadTimestamp > lastKnownUploadRef.current) {
    const prevLevel = previousLevelRef.current;
    lastKnownUploadRef.current = lastUploadTimestamp;
    justUploadedRef.current = true;
    fetchFeed(true);

    // Show animations based on upload result
    if (lastUploadResult) {
      const data = lastUploadResult;
      const hasWalletReward = data.wallet_reward && data.wallet_reward.wallet_earned > 0;

      // Wallet reward takes priority - show it first
      if (hasWalletReward) {
        setRewardData(data.wallet_reward);
        setShowRewardModal(true);
      }

      // Check for level-up
      if (data.level_update) {
        const newLevel = data.level_update.level || 1;
        if (newLevel > prevLevel) {
          if (!hasWalletReward) {
            showLevelUpAnimation(newLevel);
          } else {
            pendingLevelUpRef.current = newLevel;
          }
        }
        // Update the stored level
        previousLevelRef.current = data.level_update.level || prevLevel;

        const earnedPoints = data.level_update.pointsEarned || 25;

        if (!hasWalletReward) {
          setPointsEarned(earnedPoints);
          setShowPointsAnimation(true);
        } else {
          // Store pending points to show after reward modal closes
          pendingPointsRef.current = earnedPoints;
        }
      }
    }
  }
}, [lastUploadTimestamp, lastUploadResult]);

const loadUnreadMessagesCount = async () => {
  if (!token) return;
  try {
    const response = await axios.get(`${BACKEND}/api/chat/unread-count`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    setUnreadMessagesCount(response.data.unreadCount || 0);
  } catch (error) {
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
      if (post.type === 'suggested_header') return false;
      const isVideo =
        post.media_type === "video" ||
        post.media_url?.toLowerCase().endsWith(".mp4");
      return isVideo && item.isViewable;
    });

    const newVisibleId = visibleVideo ? String(visibleVideo.item.id) : null;
    
    if (newVisibleId !== visibleVideoIdRef.current) {
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
      // error silenced
      setOwnStoryData(null);
    }
  };

  const fetchSuggestedPosts = async () => {
    try {
      const res = await axios.get(
        `${BACKEND}/api/explore/trending?limit=20&_t=${Date.now()}`
      );
      if (!res.data || res.data.length === 0) return;

      const feedIds = new Set(feedPosts.map((p: any) => String(p.id)));
      const mapped = res.data
        .filter((post: any) => !feedIds.has(String(post.id || post._id)))
        .map((post: any) => ({
          id: post.id || post._id,
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
          shares_count: post.shares_count || post.shares || 0,
          is_liked: post.is_liked || false,
          is_saved_by_user: post.is_saved_by_user || post.is_saved || false,
          is_following: post.is_following || false,
          tagged_restaurant: post.tagged_restaurant || null,
          dish_name: post.dish_name || null,
          user_badge: post.user_badge || null,
          _isSuggested: true,
        }));

      setSuggestedPosts(mapped);
    } catch (err) {
      // silenced
    }
  };

  const fetchFeed = async (forceRefresh = false) => {
    try {
      if (forceRefresh) {
        setLoading(true);
        setPage(1);
        setHasMore(true);
        setSuggestedPosts([]);
        paginationTriggeredRef.current = false;
      } else {
        if (!hasMore || loadingMore || paginationTriggeredRef.current) return;
        setLoadingMore(true);
        paginationTriggeredRef.current = true;
      }

      const skip = forceRefresh ? 0 : (page - 1) * POSTS_PER_PAGE;
      const ts = forceRefresh ? `&_t=${Date.now()}` : "";
      const res = await axios.get(
        `${BACKEND}/api/feed?skip=${skip}&limit=${POSTS_PER_PAGE}&sort=engagement${ts}`
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
        shares_count: post.shares_count || post.shares || 0,
        is_liked: post.is_liked || false,
        is_saved_by_user: post.is_saved_by_user || post.is_saved || false,
        is_following: post.is_following || false,
        tagged_restaurant: post.tagged_restaurant || null,
        dish_name: post.dish_name || null,
        user_badge: post.user_badge || null,
      }));

      if (forceRefresh) {
        setFeedPosts(mapped);
        if (mapped.length > 0) {
          // Track the most recent created_at across all posts (not just first post,
          // since feed is sorted by engagement, not recency)
          const maxTimestamp = mapped.reduce((max: string, p: any) =>
            p.created_at > max ? p.created_at : max, mapped[0].created_at);
          newestPostTimestampRef.current = maxTimestamp;
        }
        setShowNewPostsPill(false);
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

  // Fetch suggested posts when feed runs out of pages
  useEffect(() => {
    if (!hasMore && feedPosts.length > 0 && suggestedPosts.length === 0) {
      fetchSuggestedPosts();
    }
  }, [hasMore, feedPosts.length]);

  // Keep fetchFeed ref updated and register the Home tab double-tap handler
  fetchFeedRef.current = fetchFeed;
  useEffect(() => {
    registerFeedRefresh(() => {
      if (navigation.isFocused()) {
        flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
        setRefreshing(true);
        setHasInitiallyLoaded(false);
        fetchFeedRef.current?.(true);
        setHasInitiallyLoaded(true);
      }
    });
  }, []);

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

    // Hide "New Posts" pill when scrolled near top
    if (scrollY < 50 && showNewPostsPill) {
      setShowNewPostsPill(false);
    }

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
  [hasMore, loadingMore, loading, showNewPostsPill]
);

const handleNewPostsPillPress = useCallback(() => {
  flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
  setRefreshing(true);
  fetchFeed(true);
  setShowNewPostsPill(false);
}, []);

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

// Render post or divider
const renderPost = useCallback(
  ({ item: post, index }) => {
    if (post.type === 'suggested_header') {
      return <SuggestedPostsHeader />;
    }

    const isVideo =
      post.media_type === "video" ||
      post.media_url?.toLowerCase().endsWith(".mp4");
    const shouldPlay = isVideo && visibleVideoId === String(post.id);

    // Count real posts (not dividers) for SuggestedUsersBar placement
    const realPostIndex = displayData
      .filter((item: any) => !item.type)
      .indexOf(post);
    const showSuggestions = realPostIndex >= 0 && (realPostIndex + 1) % 5 === 0;

    return (
      <View>
        <View style={styles.postContainer}>
          <FeedCard
            post={post}
            onLikeUpdate={() => {}}
            onStoryCreated={() => fetchOwnStory()}
            shouldPlay={shouldPlay}
            shouldPreload={shouldPlay}
            isMuted={isMuted}
            onMuteToggle={handleMuteToggle}
          />
        </View>

        {/* Show suggestions after every 5 posts */}
        {showSuggestions && (
          <SuggestedUsersBar refreshTrigger={refreshing} />
        )}
      </View>
    );
  },
  [visibleVideoId, isMuted, handleMuteToggle, refreshing, displayData]
);

  // List Header Component
  const ListHeader = useCallback(() => (
    <>
      <View style={styles.headerContainer}>
        <View style={styles.whiteHeader}>
          <View style={styles.headerRow}>
      {/* Chat Icon with Gradient */}
      <TouchableOpacity
        style={styles.leftIcon}
        onPress={() => router.push("/chat")}
        activeOpacity={0.7}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <MaskedView
          maskElement={
            <Ionicons name="chatbox-ellipses" size={22} color="#000" />
          }
        >
          <LinearGradient
            colors={["#FF2E2E", "#FF7A18"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Ionicons name="chatbox-ellipses" size={22} color="transparent" />
          </LinearGradient>
        </MaskedView>
        {unreadMessagesCount > 0 && (
          <View style={styles.chatBadge}>
            <Text style={styles.chatBadgeText}>
              {unreadMessagesCount > 99 ? "99+" : unreadMessagesCount}
            </Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Cofau Title with Gradient */}
      <MaskedView
        style={styles.cofauTitleContainer}
        maskElement={
          <Text style={styles.cofauTitleMask}>Cofau</Text>
        }
      >
        <LinearGradient
          colors={["#FF2E2E", "#FF7A18"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.cofauGradient}
        >
          <Text style={styles.cofauTitleTransparent}>Cofau</Text>
        </LinearGradient>
      </MaskedView>

      {/* Right Icons Container */}
      <View style={styles.headerIcons}>
        {/* Notifications Icon with Gradient */}
        <TouchableOpacity
          style={styles.leftIcon}
          onPress={() => router.push("/notifications")}
          activeOpacity={0.7}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <MaskedView
            maskElement={
              <Ionicons name="notifications" size={22} color="#000" />
            }
          >
            <LinearGradient
              colors={["#FF2E2E", "#FF7A18"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Ionicons name="notifications" size={22} color="transparent" />
            </LinearGradient>
          </MaskedView>
          {unreadCount > 0 && (
            <View style={styles.notificationBadge}>
              <Text style={styles.notificationBadgeText}>
                {unreadCount > 99 ? "99+" : unreadCount}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
          </View>

        </View>
      </View>

      {/* Share bar - half in gradient, half in white */}
      {user && accountType !== 'restaurant' && (
        <View style={styles.shareBarDivider}>
          <View style={styles.dividerLineFull} />
          <View style={styles.shareBar}>
            <View style={styles.shareBarAvatarWrap}>
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
                  }
                }}
                activeOpacity={0.8}
              >
                {ownStoryData ? (
                  <LinearGradient
                    colors={["#FF2E2E", "#F2CF68", "#FF9A4D"]}
                    locations={[0, 0.5, 1]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.shareBarDpRing}
                  >
                    <View style={styles.shareBarDpInner}>
                      <UserAvatar
                        profilePicture={user.profile_picture}
                        username={user.username}
                        size={65}
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
                    size={65}
                    showLevelBadge={false}
                    level={user.level}
                    style={{}}
                  />
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.avatarCameraBadge}
                onPress={() => setShowAddMenu(true)}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={["#FF7A18", "#FF2E2E"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.avatarCameraBadgeGradient}
                >
                  <Ionicons name="camera" size={12} color="#fff" />
                </LinearGradient>
              </TouchableOpacity>
            </View>

            <View style={styles.shareDescriptionBox}>
              <AnimatedPillText />
            </View>

            <TouchableOpacity
              onPress={async () => {
                setShowWalletModal(true);
                try {
                  await axios.post(
                    `${BACKEND}/api/wallet/mark-viewed`,
                    {},
                    { headers: { Authorization: `Bearer ${token}` } }
                  );
                  setWalletUnreadCount(0);
                } catch (err) {
                }
              }}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={["#FF7A18", "#FF2E2E"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.walletGradientButton}
              >
                <Ionicons name="gift" size={18} color="#fff" />
              </LinearGradient>
              {walletUnreadCount > 0 && (
                <View style={styles.walletPillBadge}>
                  <Text style={styles.walletPillBadgeText}>
                    {walletUnreadCount > 99 ? "99+" : walletUnreadCount}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}

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
                    colors={["#FF9A4D", "#FF9A4D"]}
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
                  {(() => {
                    const reviewsCount = restaurantReviewsCount || 0;
                    const maxReviews = 25000;
                    const progressPercent = maxReviews > 0
                      ? Math.min((reviewsCount / maxReviews) * 100, 100)
                      : 0;

                    let gradientColors;
                    let gradientLocations;

                    if (progressPercent <= 50) {
                      gradientColors = ["#FF9A4D", "#FF9A4D"];
                      gradientLocations = [0, 1];
                    } else {
                      gradientColors = ["#FF9A4D", "#FF5C5C"];
                      gradientLocations = [0, 1];
                    }

                    return (
                      <LinearGradient
                        colors={gradientColors}
                        locations={gradientLocations}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={[
                          styles.progressFill,
                          { width: `${Math.max(progressPercent, 0.5)}%` },
                        ]}
                      />
                    );
                  })()}
                </View>
                <Text style={styles.progressText}>
                  {restaurantReviewsCount || 0}/25000
                </Text>
              </View>
            </View>
          </View>
        </View>
      )}
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
        <ActivityIndicator size="small" color="#FF2E2E" />
      </View>
    ) : null
  ), [loadingMore]);

  return (
    <View style={styles.container}>
      {/* Fixed Line */}
      {showFixedLine && <View style={styles.fixedLine} />}

      {/* "New Posts" Floating Pill */}
      {showNewPostsPill && (
        <Animated.View
          style={[
            styles.newPostsPillWrapper,
            {
              opacity: newPostsPillAnim,
              transform: [{
                translateY: newPostsPillAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-30, 0],
                }),
              }],
            },
          ]}
        >
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handleNewPostsPillPress}
          >
            <LinearGradient
              colors={['#FF2E2E', '#FF7A18']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.newPostsPill}
            >
              <Ionicons name="arrow-up" size={14} color="#fff" />
              <Text style={styles.newPostsPillText}>New Posts</Text>
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* FlatList */}
     <FlatList
  ref={flatListRef}
  data={displayData}
  keyExtractor={(item, index) =>
    item.type === 'suggested_header'
      ? 'suggested_header'
      : `post-${item.id}-${index}`
  }
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

      {/* Post a Bite/Bite Stories Modal */}
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
        <Text style={styles.menuItemText}>Post a Bite</Text>
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
        <Text style={styles.menuItemText}>Bite Stories</Text>
      </TouchableOpacity>
    </View>
  </TouchableOpacity>
</Modal>

      {/* Cofau Wallet Modal */}
      <CofauWalletModal
        visible={showWalletModal}
        onClose={() => setShowWalletModal(false)}
      />

      {/* Post Reward Modal (wallet earned) */}
      <PostRewardModal
        visible={showRewardModal}
        onClose={() => {
          setShowRewardModal(false);
          setRewardData(null);
          // Show pending level-up animation
          if (pendingLevelUpRef.current !== null) {
            showLevelUpAnimation(pendingLevelUpRef.current);
            pendingLevelUpRef.current = null;
          }
          // Show pending points GIF
          if (pendingPointsRef.current !== null) {
            setPointsEarned(pendingPointsRef.current);
            setShowPointsAnimation(true);
            pendingPointsRef.current = null;
          }
        }}
        rewardData={rewardData}
      />

      {/* Points Earned GIF Animation */}
      <PointsEarnedAnimation
        visible={showPointsAnimation}
        pointsEarned={pointsEarned}
        onClose={() => setShowPointsAnimation(false)}
      />
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
    marginBottom: 0,
  },
  whiteHeader: {
  paddingTop: 60,
  paddingBottom: 50,
  paddingHorizontal: 20,
  backgroundColor: "#FFE5D9",
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
 cofauTitleContainer: {
  position: "absolute",
  left: 0,
  right: 0,
  alignItems: "center",
  justifyContent: "center",
  zIndex: 3,
},

cofauTitleMask: {
  fontFamily: "Lobster",
  fontSize: 36,
  letterSpacing: 1,
  textAlign: "center",
},

cofauTitleTransparent: {
  fontFamily: "Lobster",
  fontSize: 36,
  letterSpacing: 1,
  opacity: 0,
},

cofauGradient: {
  alignItems: "center",
  justifyContent: "center",
},
  headerIcons: {
    flexDirection: "row",
    gap: 20,
    zIndex: 10,
  },
  shareBarDivider: {
    position: "relative",
    alignItems: "center",
    marginTop: -40,
    paddingHorizontal: 20,
    zIndex: 10,
  },
  dividerLineFull: {
    position: "absolute",
    left: 0,
    right: 0,
    top: "50%",
    height: 0,
    backgroundColor: "transparent",
  },
  shareBar: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 35,
    paddingVertical: 6,
    paddingLeft: 6,
    paddingRight: 12,
    gap: 10,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    borderBottomWidth: 3.5,
    borderBottomColor: "#C8C8C8",
  },
  shareBarAvatarWrap: {
    position: "relative",
  },
  avatarCameraBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    zIndex: 5,
  },
  avatarCameraBadgeGradient: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  shareBarDpRing: {
    width: 70,
    height: 70,
    borderRadius: 55,
    padding: 4,
    justifyContent: "center",
    alignItems: "center",
  },
  shareBarDpInner: {
    width: 66,
    height: 66,
    borderRadius: 38,
    backgroundColor: "#FFF",
    justifyContent: "center",
    alignItems: "center",
  },
  shareDescriptionBox: {
    flex: 1,
    backgroundColor: "rgba(255, 255, 255, 0.5)",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 12,
    overflow: "hidden",
  },
  shareDescriptionText: {
    fontSize: 8,
    fontWeight: "700",
    color: "#AAAAAA",
    letterSpacing: 0.2,
  },
  cameraGradientButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: "center",
    alignItems: "center",
  },
  walletGradientButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: "center",
    alignItems: "center",
  },
  walletPillBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    backgroundColor: "#FF3B30",
    borderRadius: 10,
    minWidth: 18,
    height: 16,
    paddingHorizontal: 4,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#fff",
  },
  walletPillBadgeText: {
    color: "#fff",
    fontSize: 9,
    fontWeight: "700",
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
    top: 0,
    bottom: 0,
    justifyContent: "center",
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
  centerIconCircleInner: {
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
  navIconGradient: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
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
  // "New Posts" Floating Pill
  newPostsPillWrapper: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 1001,
  },
  newPostsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 6,
  },
  newPostsPillText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  // "Suggested Posts" Header
  suggestedAccentLine: {
    height: 2,
    width: '80%',
    borderRadius: 1,
  },
  suggestedHeaderContainer: {
    paddingVertical: 24,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  suggestedHeaderContent: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  suggestedHeaderTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginTop: 10,
  },
  suggestedHeaderSubtitle: {
    fontSize: 13,
    color: '#999',
    marginTop: 4,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
});