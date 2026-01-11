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
  const { token } = useAuth() as any;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [leaderboardData, setLeaderboardData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [followingStates, setFollowingStates] = useState<{ [key: string]: boolean }>({});
  const [followLoading, setFollowLoading] = useState<{ [key: string]: boolean }>({});
  const { user } = useAuth() as any;

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  const fetchLeaderboard = async () => {
    try {
      setError(null);
      setLoading(true);

      if (!token) {
        setError("Please log in to view the leaderboard");
        setLoading(false);
        return;
      }

      const response = await axios.get(`${BACKEND_URL}/api/leaderboard/current`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        timeout: 10000,
      });

      const data = response.data || {};

      const now = new Date();
      const threeDaysAgo = new Date(now);
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

      const fromDate = data.from_date || threeDaysAgo.toISOString();
      const toDate = data.to_date || now.toISOString();

      setLeaderboardData({
        from_date: fromDate,
        to_date: toDate,
        generated_at: data.generated_at || now.toISOString(),
        window_days: data.window_days || 3,
        entries: data.entries || [],
        total_posts_analyzed: data.total_posts_analyzed || 0,
        config: data.config || {},
      });

      console.log("✅ Leaderboard data loaded:", {
        from_date: fromDate,
        to_date: toDate,
        entries_count: data.entries?.length || 0,
      });

      if (data.entries && data.entries.length > 0) {
        console.log("🔍 First entry sample:", {
          rank: data.entries[0].rank,
          username: data.entries[0].username,
          full_name: data.entries[0].full_name,
          followers_count: data.entries[0].followers_count,
          posts_count: data.entries[0].posts_count,
          user_id: data.entries[0].user_id,
        });
      }
    } catch (err: any) {
      console.error("❌ Error fetching leaderboard:", err);

      let errorMessage = "Failed to load leaderboard";
      if (err.response) {
        errorMessage = err.response.data?.detail || err.response.data?.message || `Server error: ${err.response.status}`;
      } else if (err.request) {
        errorMessage = "Network error. Please check your connection.";
      } else {
        errorMessage = err.message || "An unexpected error occurred";
      }

      setError(errorMessage);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchLeaderboard();
  };

  const formatDate = (dateString: string) => {
    try {
      if (!dateString) return '';

      let date: Date;

      if (dateString.includes('T') && !dateString.includes('Z') && !dateString.includes('+')) {
        date = new Date(dateString + 'Z');
      } else {
        date = new Date(dateString);
      }

      if (isNaN(date.getTime())) {
        console.error("Invalid date:", dateString);
        return '';
      }

      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const month = monthNames[date.getUTCMonth()];
      const day = date.getUTCDate();

      return `${month} ${day}`;
    } catch (error) {
      console.error("Error formatting date:", error, dateString);
      return '';
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF6B6B" />
        <Text style={styles.loadingText}>Loading leaderboard...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={64} color="#FF6B6B" />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={fetchLeaderboard}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const entries = leaderboardData?.entries || [];

  console.log("entries", entries);

  const handlePostPress = (postId: string) => {
    router.push(`/post-details/${postId}`);
  };

  const handleFollowToggle = async (userId: string, entry: any) => {
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

  const handleRegenerateLeaderboard = async () => {
    try {
      setLoading(true);
      const response = await axios.post(
        `${BACKEND_URL}/api/leaderboard/regenerate`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      Alert.alert("Success", "Leaderboard regenerated! Refreshing...");
      setTimeout(() => {
        fetchLeaderboard();
      }, 1000);
    } catch (error: any) {
      console.error("Error regenerating leaderboard:", error);
      Alert.alert(
        "Error",
        error.response?.data?.detail || "Failed to regenerate leaderboard"
      );
    } finally {
      setLoading(false);
    }
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

        <View style={styles.titleBoxWrapper}>
          {Platform.OS === 'ios' ? (
            <BlurView intensity={60} tint="light" style={styles.titleBox}>
              <Text style={styles.titleMain}>Top Posts</Text>
              <View style={styles.subtitleRow}>
                <Ionicons name="trophy" size={16} color="#E94A37" />
                <Text style={styles.titleSub}>Best Posts This Week</Text>
              </View>
            </BlurView>
          ) : (
            <View style={[styles.titleBox, styles.titleBoxAndroid]}>
              <Text style={styles.titleMain}>Top Posts</Text>
              <View style={styles.subtitleRow}>
                <Ionicons name="trophy" size={16} color="#E94A37" />
                <Text style={styles.titleSub}>Best Posts This Week</Text>
              </View>
            </View>
          )}
        </View>

        {leaderboardData && leaderboardData.from_date && leaderboardData.to_date && (
          <View>
            <Text style={styles.lastDaysText}>Last 3 Days</Text>
            <Text style={styles.dateRange}>
              {formatDate(leaderboardData.from_date)} - {formatDate(leaderboardData.to_date)}
            </Text>
         
            {entries.length > 0 && entries[0] &&
              (entries[0].followers_count === undefined ||
                entries[0].posts_count === undefined ||
                entries[0].full_name === undefined) ? (
              <TouchableOpacity
                style={styles.regenerateButton}
                onPress={handleRegenerateLeaderboard}
              >
                <Text style={styles.regenerateButtonText}>
                  🔄 Regenerate Leaderboard (Update Required)
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        )}

        {entries.length === 0 && (
          <View style={styles.emptyContainer}>
            <Ionicons name="trophy-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>No leaderboard data yet</Text>
            <Text style={styles.emptySubtext}>
              Start posting to see the leaderboard!
            </Text>
            <TouchableOpacity
              style={styles.regenerateButton}
              onPress={handleRegenerateLeaderboard}
            >
              <Text style={styles.regenerateButtonText}>Regenerate Leaderboard</Text>
            </TouchableOpacity>
          </View>
        )}

        {entries.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}></Text>
            {entries.map((entry: any, index: number) => {
              const isOwnPost = entry.user_id === user?.id;
              const isFollowing = followingStates[entry.user_id] || false;

              if (index === 0) {
                console.log("🔍 Rendering entry:", {
                  rank: entry.rank,
                  username: entry.username,
                  full_name: entry.full_name,
                  followers_count: entry.followers_count,
                  posts_count: entry.posts_count,
                  user_id: entry.user_id,
                });
              }

              return index === 0 ? (
                <View key={entry.post_id} style={styles.rankOneWrapper}>
                  <LinearGradient
                    colors={["#E94A37", "#F2CF68", "#1B7C82", "#E94A37"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.rankOneGradientBorder}
                  >
                    <TouchableOpacity
                      style={[styles.leaderboardCard, styles.rankOneCard]}
                      onPress={() => handlePostPress(entry.post_id)}
                      activeOpacity={0.7}
                    >
                      <Image
  source={require('../assets/badges/top1.png')}
  style={styles.rankBadgeImage}
  resizeMode="contain"
/>

                      <View style={styles.rankOneContainer}>
                        <View style={styles.confettiContainer}>
                          <Text style={[styles.confettiStar, { top: 8, right: 50 }]}>✦</Text>
                          <Text style={[styles.confettiStar, { top: 15, right: 80 }]}>★</Text>
                          <Text style={[styles.confettiStar, { top: 25, right: 40 }]}>✧</Text>
                          <Text style={[styles.confettiSparkle, { top: 12, right: 65 }]}>✨</Text>
                          <Text style={[styles.confettiSparkle, { top: 30, right: 90 }]}>✨</Text>
                          
                          <View style={[styles.confettiDot, { top: 10, right: 55, backgroundColor: '#FFD700' }]} />
                          <View style={[styles.confettiDotSmall, { top: 20, right: 75, backgroundColor: '#F2CF68' }]} />
                          <View style={[styles.confettiDotLarge, { top: 35, right: 45, backgroundColor: '#E94A37' }]} />
                          
                          <View style={[styles.confettiDiamond, { top: 15, right: 100, backgroundColor: '#1B7C82' }]} />
                          <View style={[styles.confettiStrip, { top: 25, right: 60, backgroundColor: '#FFD700', transform: [{ rotate: '45deg' }] }]} />
                          
                          <Text style={[styles.confettiStar, { bottom: 15, left: 30 }]}>✦</Text>
                          <Text style={[styles.confettiStar, { bottom: 25, left: 60 }]}>★</Text>
                          <Text style={[styles.confettiStar, { bottom: 15, right: 70 }]}>✧</Text>
                          <Text style={[styles.confettiSparkle, { bottom: 20, left: 45 }]}>✨</Text>
                          <Text style={[styles.confettiSparkle, { bottom: 30, right: 50 }]}>✨</Text>
                          
                          <View style={[styles.confettiDot, { bottom: 18, left: 80, backgroundColor: '#F2CF68' }]} />
                          <View style={[styles.confettiDotSmall, { bottom: 28, left: 50, backgroundColor: '#1B7C82' }]} />
                          <View style={[styles.confettiDotLarge, { bottom: 22, right: 90, backgroundColor: '#E94A37' }]} />
                          
                          <View style={[styles.confettiDiamond, { bottom: 25, left: 100, backgroundColor: '#FFD700' }]} />
                          <View style={[styles.confettiStrip, { bottom: 20, right: 80, backgroundColor: '#F2CF68', transform: [{ rotate: '-45deg' }] }]} />
                          <View style={[styles.confettiRing, { bottom: 30, left: 70, borderColor: '#1B7C82' }]} />
                          
                          <Text style={[styles.confettiStar, { top: '40%', left: 20 }]}>✦</Text>
                          <Text style={[styles.confettiStar, { top: '50%', right: 25 }]}>★</Text>
                          <View style={[styles.confettiDotSmall, { top: '45%', left: 15, backgroundColor: '#FFD700' }]} />
                          <View style={[styles.confettiDotSmall, { top: '55%', right: 20, backgroundColor: '#F2CF68' }]} />
                        </View>

                        <View style={styles.rankOneProfileSection}>
                          <UserAvatar
                            profilePicture={normalizeProfilePicture(entry.user_profile_picture)}
                            username={entry.username}
                            size={60}
                            showLevelBadge={true}
                            level={entry.user_level || entry.level || 1}
                            style={{}}
                          />
                          <View style={styles.rankOneInfo}>
                            <Text style={styles.rankOneName} numberOfLines={1}>
                              {entry.full_name || entry.username || "Unknown User"}
                            </Text>
                            <Text style={styles.levelText}>
                              Level {entry.user_level || entry.level || 1}
                            </Text>
                            <View style={styles.rankOneStats}>
                              <View style={styles.statItem}>
                                <Ionicons name="people" size={18} color="#666" />
                                <Text style={styles.statText}>
                                  {entry.followers_count !== undefined && entry.followers_count !== null ? entry.followers_count : 0}
                                </Text>
                              </View>
                              <View style={styles.statItem}>
                                <Ionicons name="images" size={18} color="#666" />
                                <Text style={styles.statText}>
                                  {entry.posts_count !== undefined && entry.posts_count !== null ? entry.posts_count : 0}
                                </Text>
                              </View>
                              {!isOwnPost && (
                                <TouchableOpacity
                                  style={[
                                    styles.followButtonLeaderboard,
                                    isFollowing && styles.followingButtonLeaderboard
                                  ]}
                                  onPress={(e) => {
                                    e.stopPropagation();
                                    handleFollowToggle(entry.user_id, entry);
                                  }}
                                  disabled={followLoading[entry.user_id]}
                                >
                                  <Text style={[
                                    styles.followButtonTextLeaderboard,
                                    isFollowing && styles.followingButtonTextLeaderboard
                                  ]}>
                                    {followLoading[entry.user_id] ? "..." : (isFollowing ? "Following" : "Follow")}
                                  </Text>
                                </TouchableOpacity>
                              )}
                            </View>
                          </View>
                        </View>

                        <Image
                          source={{
                            uri: normalizeMediaUrl(entry.thumbnail_url || entry.media_url) || ''
                          }}
                          style={styles.rankOneFullImage}
                          resizeMode="cover"
                          onError={(error) => {
                            console.log("Error loading thumbnail:", error);
                          }}
                        />

                        <View style={styles.scoresContainerRankOne}>
                          <View style={styles.scoreItemRankOne}>
                            <Ionicons name="star" size={18} color="#FFD700" />
                            <Text style={styles.scoreLabelRankOne}>Quality</Text>
                            <Text style={styles.scoreValueRankOne}>
                              {(entry.quality_score || 0).toFixed(1)}
                            </Text>
                          </View>
                          <View style={styles.scoreDivider} />
                          <View style={styles.scoreItemRankOne}>
                            <Ionicons name="heart" size={18} color="#FF6B6B" />
                            <Text style={styles.scoreLabelRankOne}>Likes</Text>
                            <Text style={styles.scoreValueRankOne}>{entry.likes_count || 0}</Text>
                          </View>
                          <View style={styles.scoreDivider} />
                          <View style={styles.scoreItemRankOne}>
                            <Ionicons name="trophy" size={18} color="#4dd0e1" />
                            <Text style={styles.scoreLabelRankOne}>Score</Text>
                            <Text style={styles.scoreValueRankOne}>
                              {(entry.combined_score || 0).toFixed(0)}
                            </Text>
                          </View>
                        </View>
                      </View>
                    </TouchableOpacity>
                  </LinearGradient>
                </View>
              ) : (
                <TouchableOpacity
                  key={entry.post_id}
                  style={[
                    styles.leaderboardCard,
                    index === 1 && { borderColor: "#C0C0C0" },
                    index === 2 && { borderColor: "#C0C0C0" },
                    index > 2 && { borderColor: "#1B7C82" },
                  ]}
                  onPress={() => handlePostPress(entry.post_id)}
                  activeOpacity={0.7}
                >
                  {index === 0 ? (
  <Image
    source={require('../assets/badges/top1.png')}
    style={styles.rankBadgeImage}
    resizeMode="contain"
  />
) : (
  <View style={styles.rankBadge}>
    <Text style={styles.rankText}>
      #{entry.rank}
    </Text>
  </View>
)}

                  <View style={styles.otherRanksContainer}>
                    <UserAvatar
                      profilePicture={normalizeProfilePicture(entry.user_profile_picture)}
                      username={entry.username}
                      size={50}
                      showLevelBadge={true}
                      level={entry.user_level || entry.level || 1}
                      style={{}}
                    />
                    <View style={styles.otherRanksInfo}>
                      <Text style={styles.otherRanksName} numberOfLines={1}>
                        {entry.full_name || entry.username || "Unknown User"}
                      </Text>
                      <Text style={styles.levelTextSmall}>
                        Level {entry.user_level || entry.level || 1}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.cardContent}>
                    <Image
                      source={{
                        uri: normalizeMediaUrl(entry.thumbnail_url || entry.media_url) || ''
                      }}
                      style={styles.mediaThumbnail}
                      resizeMode="cover"
                      onError={(error) => {
                        console.log("Error loading thumbnail:", error);
                      }}
                    />

                    <View style={styles.entryInfo}>
                      {entry.caption && (
                        <Text style={styles.captionText} numberOfLines={2}>
                          {entry.caption}
                        </Text>
                      )}

                      {entry.location_name && (
                        <View style={styles.locationRow}>
                          <Ionicons name="location-outline" size={12} color="#666" />
                          <Text style={styles.locationText} numberOfLines={1}>
                            {entry.location_name}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>

                  <View style={styles.scoresContainer}>
                    <View style={styles.scoreItem}>
                      <Ionicons name="star" size={16} color="#FFD700" />
                      <Text style={styles.scoreLabel}>Quality</Text>
                      <Text style={styles.scoreValue}>
                        {(entry.quality_score || 0).toFixed(0)}
                      </Text>
                    </View>
                    <View style={styles.scoreItem}>
                      <Ionicons name="heart" size={16} color="#FF6B6B" />
                      <Text style={styles.scoreLabel}>Likes</Text>
                      <Text style={styles.scoreValue}>{entry.likes_count || 0}</Text>
                    </View>
                    <View style={styles.scoreItem}>
                      <Ionicons name="trophy" size={16} color="#4dd0e1" />
                      <Text style={styles.scoreLabel}>Score</Text>
                      <Text style={styles.scoreValue}>
                        {(entry.combined_score || 0).toFixed(1)}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>

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
            <Ionicons name="camera" size={20} color="#000" />
          </View>
          <Text style={styles.navLabelActive}>Top Posts</Text>
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
    backgroundColor: "#ffff",
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
    backgroundColor: "#FF6B6B",
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
  headerContainer: {
    marginHorizontal: -16,
    marginBottom: -40,
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
  rankOneWrapper: {
    marginBottom: 12,
    borderRadius: 20,
    padding: 3,
    shadowColor: "#F2CF68",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 20,
    elevation: 15,
  },

  rankBadgeImage: {
  position: "absolute",
  top: -20,
  right: -70,
  width: 200,
  height: 110,
  zIndex: 10,
},
  rankOneGradientBorder: {
    borderRadius: 20,
    padding: 2,
    paddingVertical: 1.5,  // Even thinner on top/bottom
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
  rankBadgeGradient: {
    position: "absolute",
    top: 4,
    right: 12,
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 4,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    zIndex: 10,
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
  mainTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 8,
    textAlign: "left",
    letterSpacing: 0.5,
  },
  dateRange: {
    fontSize: 10,
    color: "#888",
    marginBottom: 1,
    opacity: 0.7,
    textAlign: "center",
  },
  postsCountText: {
    fontSize: 10,
    color: "#888",
    marginBottom: -20,
    opacity: 0.7,
    textAlign: "center",
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
  rankOneBadge: {
  position: "absolute",
  top: 12,
  right: 12,
  width: 50,
  height: 50,
  borderRadius: 25,
  backgroundColor: "#FFD700",
  alignItems: "center",
  justifyContent: "center",
  borderWidth: 3,
  borderColor: "#FFA500",
  elevation: 8,
  shadowColor: "#FFD700",
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.6,
  shadowRadius: 8,
  zIndex: 10,
},

rankOneBadgeText: {
  color: "#fff",
  fontSize: 18,
  fontWeight: "bold",
  textShadowColor: "rgba(0, 0, 0, 0.3)",
  textShadowOffset: { width: 1, height: 1 },
  textShadowRadius: 2,
},
  emptySubtext: {
    marginTop: 8,
    fontSize: 14,
    color: "#999",
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: "Georgia",
    color: "#333",
    marginBottom: 16,
    textAlign: "center",
    letterSpacing: 10,
  },
  leaderboardCard: {
    borderRadius: 20,
    padding: 12,
    marginBottom: 12,
    backgroundColor: "#FFFFFF",
    borderWidth: 3,
    borderColor: "#1B7C82",
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 3, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  rankBadge: {
    position: "absolute",
    top: 4,
    right: 12,
    backgroundColor: "#fff",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    zIndex: 10,
  },
  rankText: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#333",
  },
  topThreeRankText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "bold",
  },
  cardContent: {
    flexDirection: "row",
    marginBottom: 8,
  },
  mediaThumbnail: {
    width: 140,
    height: 140,
    borderRadius: 8,
    backgroundColor: "#f0f0f0ff",
    marginRight: 12,
    overflow: "hidden",
  },
  mediaThumbnailLarge: {
    width: 160,
    height: 180,
    borderRadius: 12,
    backgroundColor: "#f0f0f0",
    marginRight: 12,
    overflow: "hidden",
  },
  entryInfo: {
    flex: 1,
    justifyContent: "center",
  },
  usernameText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 4,
  },
  captionText: {
    fontSize: 14,
    color: "#666",
    marginBottom: 4,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  locationText: {
    fontSize: 12,
    color: "#666",
    marginLeft: 4,
  },
  scoresContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.1)",
    flexWrap: "wrap",
  },
  scoreItem: {
    alignItems: "center",
  },
  scoreLabel: {
    fontSize: 11,
    color: "#666",
    marginTop: 4,
  },
  scoreValue: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
    marginTop: 2,
  },
  topPhotographersContainer: {
    flexDirection: "row",
    gap: 12,
  },
  photographerCard: {
    flex: 1,
    borderRadius: 12,
    padding: 16,
    minHeight: 180,
  },
  firstCard: {
    flexDirection: "column",
    alignItems: "flex-start",
  },
  profileImageContainer: {
    marginBottom: 12,
  },
  profileImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: "#FFD700",
  },
  photographerInfo: {
    marginBottom: 12,
  },
  photographerName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 4,
  },
  photographerPosts: {
    fontSize: 14,
    color: "#666",
  },
  viewGalleryButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginTop: "auto",
  },
  viewGalleryText: {
    marginLeft: 6,
    fontSize: 12,
    color: "#333",
    fontWeight: "500",
  },
  foodCard: {
    flex: 1,
    width: "100%",
    position: "relative",
    borderRadius: 8,
    overflow: "hidden",
    minHeight: 150,
  },
  foodImage: {
    flex: 1,
    width: "100%",
    borderRadius: 8,
    resizeMode: "cover",
  },
  foodImagePlaceholder: {
    flex: 1,
    backgroundColor: "#D0D0D0",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 8,
  },
  aiScoreBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  aiScoreText: {
    marginLeft: 4,
    fontSize: 12,
    fontWeight: "600",
    color: "#333",
  },
  viewButton: {
    position: "absolute",
    bottom: 8,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  viewButtonText: {
    marginLeft: 6,
    fontSize: 12,
    color: "#fff",
    fontWeight: "500",
  },
  risingStarCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  risingStarContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  risingStarProfileImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
    borderWidth: 2,
    borderColor: "#000",
  },
  restaurantImageContainer: {
    width: 50,
    height: 50,
    borderRadius: 8,
    backgroundColor: "#fff",
    marginRight: 12,
    overflow: "hidden",
  },
  restaurantGalleryGrid: {
    flex: 1,
    flexDirection: "row",
    flexWrap: "wrap",
  },
  galleryThumbnail: {
    width: "50%",
    height: "50%",
    backgroundColor: "#f0f0f0",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 0.5,
    borderColor: "#ddd",
    resizeMode: "cover",
  },
  risingStarInfo: {
    flex: 1,
  },
  risingStarName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 4,
  },
  risingStarMeta: {
    fontSize: 14,
    color: "#666",
    marginBottom: 2,
  },
  aiScoreRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  aiScoreTextInline: {
    marginLeft: 4,
    fontSize: 14,
    color: "#666",
    fontWeight: "500",
  },
  followButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  followButtonText: {
    marginLeft: 6,
    fontSize: 12,
    color: "#333",
    fontWeight: "500",
  },
  bottomSpacer: {
    height: 20,
  },
  lastDaysText: {
    fontSize: 10,
    color: "#888",
    textAlign: "center",
    marginTop: -5,
    marginBottom: 2,
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
  confettiDiamond: {
    position: "absolute",
    width: 8,
    height: 8,
    transform: [{ rotate: '45deg' }],
    opacity: 0.3,
  },
  confettiStrip: {
    position: "absolute",
    width: 12,
    height: 4,
    borderRadius: 2,
    opacity: 0.3,
  },
  confettiRing: {
    position: "absolute",
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    backgroundColor: "transparent",
    opacity: 0.3,
  },
  navLabelActive: {
    fontSize: 11,
    color: "#000",
    marginTop: 2,
    textAlign: "center",
    fontWeight: "700",
  },
  rankOneContainer: {
    marginBottom: 0,
    paddingBottom: 0,
    position: "relative",
  },
  rankOneCard: {
    borderWidth: 3,
    borderColor: "transparent",
    backgroundColor: "#FFFEF5",
    position: "relative",
    shadowColor: "#F2CF68",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 15,
    elevation: 12,
  },
  rankOneProfileSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginBottom: 12,
    zIndex: 1,
  },
  rankOneInfo: {
    flex: 1,
  },
  rankOneName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 4,
  },
  levelText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#1B7C82",
    marginBottom: 8,
  },
  rankOneStats: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
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
  followButtonLeaderboard: {
    backgroundColor: "#1B7C82",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 18,
    alignSelf: "flex-start",
    shadowColor: "#0d4a4f",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.8,
    shadowRadius: 0,
    elevation: 6,
    borderBottomWidth: 4,
    borderBottomColor: "#0d4a4f",
  },
  followingButtonLeaderboard: {
    backgroundColor: "#E8E8E8",
    borderBottomColor: "#b0b0b0",
  },
  followButtonTextLeaderboard: {
    color: "#fff",
    fontSize: 8,
    fontWeight: "600",
  },
  followingButtonTextLeaderboard: {
    color: "#666",
  },
  followButtonSmall: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#f5f5f5",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "#ddd",
  },
  followButtonSmallText: {
    fontSize: 12,
    color: "#666",
    fontWeight: "500",
  },
  rankOneFullImage: {
    width: "100%",
    height: 300,
    borderRadius: 16,
    marginTop: 8,
    marginBottom: 12,
    backgroundColor: "#f0f0f0",
  },
  scoresContainerRankOne: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingTop: 12,
    paddingBottom: 4,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.1)",
  },
  scoreItemRankOne: {
    alignItems: "center",
    flex: 1,
  },
  scoreLabelRankOne: {
    fontSize: 12,
    color: "#666",
    marginTop: 4,
  },
  scoreValueRankOne: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
    marginTop: 2,
  },
  scoreDivider: {
    width: 1,
    height: 40,
    backgroundColor: "rgba(0,0,0,0.1)",
  },
  otherRanksContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.05)",
  },
  otherRanksInfo: {
    flex: 1,
  },
  otherRanksName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 2,
  },
  levelTextSmall: {
    fontSize: 12,
    fontWeight: "500",
    color: "#1B7C82",
  },
  regenerateButton: {
    marginTop: 20,
    backgroundColor: "#1B7C82",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  regenerateButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
});