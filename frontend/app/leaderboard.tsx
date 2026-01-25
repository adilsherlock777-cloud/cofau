import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import { normalizeMediaUrl, normalizeProfilePicture, BACKEND_URL } from "../utils/imageUrlFix";
import { followUser, unfollowUser } from "../utils/api";
import UserAvatar from "../components/UserAvatar";
import { BlurView } from 'expo-blur';

export default function LeaderboardScreen() {
  const router = useRouter();
  const { token, user } = useAuth() as any;

  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'users' | 'restaurants'>('users');
  const [usersData, setUsersData] = useState<any[]>([]);
  const [restaurantsData, setRestaurantsData] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [followingStates, setFollowingStates] = useState<{ [key: string]: boolean }>({});
  const [followLoading, setFollowLoading] = useState<{ [key: string]: boolean }>({});

  useEffect(() => {
    if (activeTab === 'users') {
      fetchTopUsers();
    } else {
      fetchTopRestaurants();
    }
  }, [activeTab]);

  const fetchTopUsers = async () => {
    try {
      setError(null);
      setLoading(true);

      if (!token) {
        setError("Please log in to view top contributors");
        setLoading(false);
        return;
      }

      const response = await axios.get(`${BACKEND_URL}/api/leaderboard/top-contributors/users`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        timeout: 10000,
      });

      setUsersData(response.data?.contributors || []);
      console.log("✅ Top users loaded:", response.data?.contributors?.length || 0);

    } catch (err: any) {
      console.error("❌ Error fetching top users:", err);
      let errorMessage = "Failed to load top contributors";
      if (err.response) {
        errorMessage = err.response.data?.detail || err.response.data?.message || `Server error: ${err.response.status}`;
      } else if (err.request) {
        errorMessage = "Network error. Please check your connection.";
      }
      setError(errorMessage);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchTopRestaurants = async () => {
    try {
      setError(null);
      setLoading(true);

      if (!token) {
        setError("Please log in to view top contributors");
        setLoading(false);
        return;
      }

      const response = await axios.get(`${BACKEND_URL}/api/leaderboard/top-contributors/restaurants`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        timeout: 10000,
      });

      setRestaurantsData(response.data?.contributors || []);
      console.log("✅ Top restaurants loaded:", response.data?.contributors?.length || 0);

    } catch (err: any) {
      console.error("❌ Error fetching top restaurants:", err);
      let errorMessage = "Failed to load top restaurants";
      if (err.response) {
        errorMessage = err.response.data?.detail || err.response.data?.message || `Server error: ${err.response.status}`;
      } else if (err.request) {
        errorMessage = "Network error. Please check your connection.";
      }
      setError(errorMessage);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    if (activeTab === 'users') {
      fetchTopUsers();
    } else {
      fetchTopRestaurants();
    }
  };

  const handleUserPress = (userId: string) => {
    router.push(`/user/${userId}`);
  };

  const handlePostPress = (postId: string) => {
    router.push(`/post-details/${postId}`);
  };

  const handleFollowToggle = async (userId: string) => {
    if (!userId || userId === user?.id || followLoading[userId]) return;

    setFollowLoading((prev) => ({ ...prev, [userId]: true }));
    const previousState = followingStates[userId] || false;
    setFollowingStates((prev) => ({ ...prev, [userId]: !previousState }));

    try {
      if (previousState) {
        await unfollowUser(userId);
      } else {
        await followUser(userId);
      }
    } catch (error) {
      console.error("Error toggling follow:", error);
      setFollowingStates((prev) => ({ ...prev, [userId]: previousState }));
      Alert.alert("Error", "Failed to update follow status. Please try again.");
    } finally {
      setFollowLoading((prev) => ({ ...prev, [userId]: false }));
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1B7C82" />
        <Text style={styles.loadingText}>Loading top contributors...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={64} color="#FF6B6B" />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={onRefresh}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const entries = activeTab === 'users' ? usersData : restaurantsData;

  const renderThumbnail = (post: any, index: number, isSmall: boolean = false) => {
    if (!post) {
      return (
        <View 
          key={`empty-${index}`} 
          style={[
            isSmall ? styles.thumbnailSmall : styles.thumbnail,
            styles.thumbnailPlaceholder
          ]}
        >
          <Ionicons name="image-outline" size={isSmall ? 16 : 20} color="#ccc" />
        </View>
      );
    }

    return (
      <TouchableOpacity
        key={post.post_id || index}
        onPress={() => handlePostPress(post.post_id)}
        activeOpacity={0.8}
      >
        <Image
          source={{ uri: normalizeMediaUrl(post.thumbnail_url || post.media_url) || '' }}
          style={isSmall ? styles.thumbnailSmall : styles.thumbnail}
          resizeMode="cover"
        />
      </TouchableOpacity>
    );
  };

  const renderContributorCard = (entry: any, index: number) => {
    const isOwnProfile = entry.user_id === user?.id;
    const isFollowing = followingStates[entry.user_id] || entry.is_following || false;
    const rank = index + 1;

    // Get latest 3 posts and most liked 2 posts
    const latestPosts = entry.latest_posts || [];
    const mostLikedPosts = entry.most_liked_posts || [];

    return (
      <View key={entry.user_id} style={styles.cardWrapper}>
        {rank === 1 && (
          <LinearGradient
            colors={["#E94A37", "#F2CF68", "#1B7C82", "#E94A37"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.rankOneGradientBorder}
          >
            <View style={[styles.contributorCard, styles.rankOneCard]}>
              {renderCardContent(entry, rank, isOwnProfile, isFollowing, latestPosts, mostLikedPosts)}
            </View>
          </LinearGradient>
        )}

        {rank !== 1 && (
          <View style={[
            styles.contributorCard,
            rank === 2 && styles.rankTwoCard,
            rank === 3 && styles.rankThreeCard,
            rank > 3 && styles.normalCard,
          ]}>
            {renderCardContent(entry, rank, isOwnProfile, isFollowing, latestPosts, mostLikedPosts)}
          </View>
        )}
      </View>
    );
  };

  const renderCardContent = (
    entry: any, 
    rank: number, 
    isOwnProfile: boolean, 
    isFollowing: boolean,
    latestPosts: any[],
    mostLikedPosts: any[]
  ) => {
    return (
      <>
        {/* Rank Badge */}
        {rank === 1 ? (
          <Image
            source={require('../assets/badges/top1.png')}
            style={styles.rankBadgeImage}
            resizeMode="contain"
          />
        ) : (
          <View style={[
            styles.rankBadge,
            rank === 2 && styles.rankTwoBadge,
            rank === 3 && styles.rankThreeBadge,
          ]}>
            <Text style={[
              styles.rankText,
              (rank === 2 || rank === 3) && styles.topThreeRankText
            ]}>
              #{rank}
            </Text>
          </View>
        )}

        {/* Confetti for rank 1 */}
        {rank === 1 && (
          <View style={styles.confettiContainer}>
            <Text style={[styles.confettiStar, { top: 8, right: 50 }]}>✦</Text>
            <Text style={[styles.confettiStar, { top: 15, right: 80 }]}>★</Text>
            <Text style={[styles.confettiStar, { top: 25, right: 40 }]}>✧</Text>
            <Text style={[styles.confettiSparkle, { top: 12, right: 65 }]}>✨</Text>
            <Text style={[styles.confettiSparkle, { top: 30, right: 90 }]}>✨</Text>
            <View style={[styles.confettiDot, { top: 10, right: 55, backgroundColor: '#FFD700' }]} />
            <View style={[styles.confettiDotSmall, { top: 20, right: 75, backgroundColor: '#F2CF68' }]} />
            <View style={[styles.confettiDotLarge, { top: 35, right: 45, backgroundColor: '#E94A37' }]} />
            <Text style={[styles.confettiStar, { bottom: 15, left: 30 }]}>✦</Text>
            <Text style={[styles.confettiStar, { bottom: 25, left: 60 }]}>★</Text>
            <View style={[styles.confettiDot, { bottom: 18, left: 80, backgroundColor: '#F2CF68' }]} />
          </View>
        )}

        {/* Profile Section */}
        <TouchableOpacity 
          style={styles.profileSection}
          onPress={() => handleUserPress(entry.user_id)}
          activeOpacity={0.7}
        >
          <View style={{ position: 'relative' }}>
            <UserAvatar
              profilePicture={normalizeProfilePicture(entry.profile_picture)}
              username={entry.username}
              size={rank === 1 ? 60 : 50}
              showLevelBadge={activeTab === 'users'}
              level={entry.level || 1}
              style={{}}
            />
            {activeTab === 'restaurants' && (
              <View style={rank === 1 ? styles.restaurantBadge : styles.restaurantBadgeSmall}>
                <Ionicons name="storefront" size={rank === 1 ? 12 : 10} color="#fff" />
              </View>
            )}
          </View>

          <View style={styles.profileInfo}>
            <Text style={[styles.userName, rank === 1 && styles.rankOneUserName]} numberOfLines={1}>
              {entry.full_name || entry.username || "Unknown User"}
            </Text>
            
            {activeTab === 'users' && (
              <Text style={[styles.levelText, rank !== 1 && styles.levelTextSmall]}>
                Level {entry.level || 1}
              </Text>
            )}

            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Ionicons name="people" size={16} color="#666" />
                <Text style={styles.statText}>{entry.followers_count || 0}</Text>
              </View>
              <View style={styles.statItem}>
                <Ionicons name="images" size={16} color="#666" />
                <Text style={styles.statText}>{entry.posts_count || 0}</Text>
              </View>
              
              {!isOwnProfile && (
                <TouchableOpacity
                  style={[
                    styles.followButton,
                    isFollowing && styles.followingButton
                  ]}
                  onPress={(e) => {
                    e.stopPropagation();
                    handleFollowToggle(entry.user_id);
                  }}
                  disabled={followLoading[entry.user_id]}
                >
                  <Text style={[
                    styles.followButtonText,
                    isFollowing && styles.followingButtonText
                  ]}>
                    {followLoading[entry.user_id] ? "..." : (isFollowing ? "Following" : "Follow")}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </TouchableOpacity>

        {/* Bio */}
        {entry.bio && (
          <Text style={styles.bioText} numberOfLines={2}>
            {entry.bio}
          </Text>
        )}

        {/* Thumbnails Section */}
        <View style={styles.thumbnailsContainer}>
          {/* Top Row - 3 Latest Posts */}
          <View style={styles.thumbnailRow}>
            {[0, 1, 2].map((i) => renderThumbnail(latestPosts[i], i, false))}
          </View>
          
          {/* Bottom Row - 2 Most Liked Posts */}
          <View style={styles.thumbnailRowBottom}>
            {[0, 1].map((i) => renderThumbnail(mostLikedPosts[i], i, true))}
          </View>
        </View>
      </>
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Header */}
        <View style={styles.headerContainer}>
          <LinearGradient
            colors={["#E94A37", "#F2CF68", "#1B7C82"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.gradientHeader}
          >
            <Text style={styles.cofauTitle}>Cofau</Text>
          </LinearGradient>
        </View>

        {/* Title Box */}
        <View style={styles.titleBoxWrapper}>
          {Platform.OS === 'ios' ? (
            <BlurView intensity={60} tint="light" style={styles.titleBox}>
              <Text style={styles.titleMain}>Top Contributors</Text>
              <View style={styles.subtitleRow}>
                <Ionicons name="trophy" size={16} color="#E94A37" />
                <Text style={styles.titleSub}>Our Most Active Creators</Text>
              </View>
            </BlurView>
          ) : (
            <View style={[styles.titleBox, styles.titleBoxAndroid]}>
              <Text style={styles.titleMain}>Top Contributors</Text>
              <View style={styles.subtitleRow}>
                <Ionicons name="trophy" size={16} color="#E94A37" />
                <Text style={styles.titleSub}>Our Most Active Creators</Text>
              </View>
            </View>
          )}
        </View>

        {/* Tab Toggle */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'users' && styles.activeTab]}
            onPress={() => setActiveTab('users')}
          >
            <Text style={[styles.tabText, activeTab === 'users' && styles.activeTabText]}>Users</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'restaurants' && styles.activeTab]}
            onPress={() => setActiveTab('restaurants')}
          >
            <Text style={[styles.tabText, activeTab === 'restaurants' && styles.activeTabText]}>Restaurants</Text>
          </TouchableOpacity>
        </View>

        {/* Empty State */}
        {entries.length === 0 && (
          <View style={styles.emptyContainer}>
            <Ionicons name="trophy-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>No contributors yet</Text>
            <Text style={styles.emptySubtext}>
              Start posting to appear on the leaderboard!
            </Text>
          </View>
        )}

        {/* Contributors List */}
        {entries.length > 0 && (
          <View style={styles.contributorsList}>
            {entries.map((entry: any, index: number) => renderContributorCard(entry, index))}
          </View>
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
            <Ionicons name="trophy" size={20} color="#000" />
          </View>
          <Text style={styles.navLabelActive}>Top</Text>
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
    backgroundColor: "#fff",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: "#666",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    padding: 20,
  },
  errorText: {
    marginTop: 16,
    fontSize: 16,
    color: "#FF6B6B",
    textAlign: "center",
  },
  retryButton: {
    marginTop: 20,
    backgroundColor: "#1B7C82",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  retryButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 0,
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  headerContainer: {
    marginHorizontal: -16,
    marginBottom: -40,
  },
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
  cofauTitle: {
    fontFamily: "Lobster",
    fontSize: 36,
    color: "#fff",
    textAlign: "center",
    letterSpacing: 1,
    textShadowColor: "rgba(0, 0, 0, 0.15)",
    textShadowOffset: { width: 4, height: 6 },
    textShadowRadius: 4,
  },
  titleBoxWrapper: {
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 30,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.45)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  titleBox: {
    paddingVertical: 18,
    paddingHorizontal: 30,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
  },
  titleBoxAndroid: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
  },
  titleMain: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    textAlign: 'center',
  },
  subtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  titleSub: {
    fontSize: 14,
    color: '#555',
    marginLeft: 6,
    textAlign: 'center',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#F5F5F5',
    borderRadius: 25,
    padding: 4,
    marginHorizontal: 20,
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 20,
  },
  activeTab: {
    backgroundColor: '#F2CF68',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  activeTabText: {
    color: '#000',
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
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
  },
  contributorsList: {
    marginBottom: 16,
  },
  cardWrapper: {
    marginBottom: 16,
  },
  rankOneGradientBorder: {
    borderRadius: 20,
    padding: 2,
    shadowColor: "#F2CF68",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 20,
    elevation: 15,
  },
  contributorCard: {
    borderRadius: 18,
    padding: 16,
    backgroundColor: "#FFFFFF",
    position: "relative",
  },
  rankOneCard: {
    backgroundColor: "#FFFEF5",
  },
  rankTwoCard: {
    borderWidth: 3,
    borderColor: "#C0C0C0",
    shadowColor: "#C0C0C0",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  rankThreeCard: {
    borderWidth: 3,
    borderColor: "#CD7F32",
    shadowColor: "#CD7F32",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  normalCard: {
    borderWidth: 2,
    borderColor: "#1B7C82",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  rankBadgeImage: {
    position: "absolute",
    top: -20,
    right: -70,
    width: 200,
    height: 110,
    zIndex: 10,
  },
  rankBadge: {
    position: "absolute",
    top: 8,
    right: 12,
    backgroundColor: "#fff",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    zIndex: 10,
  },
  rankTwoBadge: {
    backgroundColor: "#C0C0C0",
  },
  rankThreeBadge: {
    backgroundColor: "#CD7F32",
  },
  rankText: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#333",
  },
  topThreeRankText: {
    color: "#fff",
  },
  confettiContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 0,
    overflow: "hidden",
  },
  confettiDot: {
    position: "absolute",
    width: 10,
    height: 10,
    borderRadius: 5,
    opacity: 0.6,
  },
  confettiDotSmall: {
    position: "absolute",
    width: 6,
    height: 6,
    borderRadius: 3,
    opacity: 0.5,
  },
  confettiDotLarge: {
    position: "absolute",
    width: 14,
    height: 14,
    borderRadius: 7,
    opacity: 0.7,
  },
  confettiStar: {
    position: "absolute",
    fontSize: 16,
    color: "#FFD700",
    opacity: 0.6,
  },
  confettiSparkle: {
    position: "absolute",
    fontSize: 14,
    opacity: 0.7,
  },
  profileSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
    zIndex: 1,
  },
  restaurantBadge: {
    position: 'absolute',
    bottom: -2,
    left: 40,
    backgroundColor: '#1B7C82',
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  restaurantBadgeSmall: {
    position: 'absolute',
    bottom: -2,
    left: 34,
    backgroundColor: '#1B7C82',
    borderRadius: 8,
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  profileInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 2,
  },
  rankOneUserName: {
    fontSize: 18,
    fontWeight: "700",
  },
  levelText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#1B7C82",
    marginBottom: 6,
  },
  levelTextSmall: {
    fontSize: 12,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  statItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  statText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#666",
  },
  followButton: {
    backgroundColor: "#1B7C82",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 18,
    marginLeft: 'auto',
    shadowColor: "#0d4a4f",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.5,
    shadowRadius: 0,
    elevation: 4,
    borderBottomWidth: 3,
    borderBottomColor: "#0d4a4f",
  },
  followingButton: {
    backgroundColor: "#E8E8E8",
    borderBottomColor: "#b0b0b0",
  },
  followButtonText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  followingButtonText: {
    color: "#666",
  },
  bioText: {
    fontSize: 14,
    color: "#666",
    marginBottom: 12,
    lineHeight: 20,
  },
  thumbnailsContainer: {
    marginTop: 8,
  },
  thumbnailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  thumbnailRowBottom: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },
  thumbnail: {
    width: "31%",
    aspectRatio: 1,
    borderRadius: 12,
    backgroundColor: "#f0f0f0",
  },
  thumbnailSmall: {
    width: "45%",
    aspectRatio: 1.5,
    borderRadius: 12,
    backgroundColor: "#f0f0f0",
  },
  thumbnailPlaceholder: {
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e0e0e0",
    borderStyle: "dashed",
  },
  bottomSpacer: {
    height: 20,
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
});