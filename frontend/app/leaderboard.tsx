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
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import { normalizeMediaUrl, BACKEND_URL } from "../utils/imageUrlFix";

export default function LeaderboardScreen() {
  const router = useRouter();
  const { token } = useAuth() as any;
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [leaderboardData, setLeaderboardData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  const fetchLeaderboard = async () => {
    try {
      setError(null);
      const response = await axios.get(`${BACKEND_URL}/api/leaderboard/current`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      
      setLeaderboardData(response.data);
      console.log("✅ Leaderboard data loaded:", response.data);
    } catch (err: any) {
      console.error("❌ Error fetching leaderboard:", err);
      setError(err.response?.data?.detail || "Failed to load leaderboard");
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
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
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
  
  // Card colors for visual variety
  const cardColors = [
    "#FFE5E5", // light pink
    "#FFF8E5", // light yellow
    "#E5F5E5", // light green
    "#E5F0FF", // light blue
    "#FFF0F5", // light pink-beige
    "#F0FFE5", // light lime
    "#FFE5F0", // light rose
    "#E5FFFF", // light cyan
  ];

  const handlePostPress = (postId: string) => {
    router.push(`/post-details/${postId}`);
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
        {/* Main Title */}
        <Text style={styles.mainTitle}>Community Leaderboards</Text>
        
        {leaderboardData && (
          <Text style={styles.dateRange}>
            {formatDate(leaderboardData.from_date)} - {formatDate(leaderboardData.to_date)}
          </Text>
        )}

        {/* Empty State */}
        {entries.length === 0 && (
          <View style={styles.emptyContainer}>
            <Ionicons name="trophy-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>No leaderboard data yet</Text>
            <Text style={styles.emptySubtext}>
              Start posting to see the leaderboard!
            </Text>
          </View>
        )}

        {/* Leaderboard Entries */}
        {entries.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Top Posts This Week</Text>
            {entries.map((entry: any, index: number) => (
              <TouchableOpacity
                key={entry.post_id}
                style={[
                  styles.leaderboardCard,
                  { backgroundColor: cardColors[index % cardColors.length] },
                  index < 3 && styles.topThreeCard,
                ]}
                onPress={() => handlePostPress(entry.post_id)}
                activeOpacity={0.7}
              >
                {/* Rank Badge */}
                <View style={[
                  styles.rankBadge,
                  index < 3 && styles.topThreeRankBadge
                ]}>
                  <Text style={[
                    styles.rankText,
                    index < 3 && styles.topThreeRankText
                  ]}>
                    #{entry.rank}
                  </Text>
                </View>

                <View style={styles.cardContent}>
                  {/* Media Thumbnail */}
                  <Image
                    source={{ uri: normalizeMediaUrl(entry.media_url) || '' }}
                    style={styles.mediaThumbnail}
                  />

                  {/* Entry Info */}
                  <View style={styles.entryInfo}>
                    <Text style={styles.usernameText} numberOfLines={1}>
                      {entry.username}
                    </Text>
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

                {/* Scores */}
                <View style={styles.scoresContainer}>
                  <View style={styles.scoreItem}>
                    <Ionicons name="star" size={16} color="#FFD700" />
                    <Text style={styles.scoreLabel}>Quality</Text>
                    <Text style={styles.scoreValue}>{entry.quality_score.toFixed(0)}</Text>
                  </View>
                  <View style={styles.scoreItem}>
                    <Ionicons name="heart" size={16} color="#FF6B6B" />
                    <Text style={styles.scoreLabel}>Likes</Text>
                    <Text style={styles.scoreValue}>{entry.likes_count}</Text>
                  </View>
                  <View style={styles.scoreItem}>
                    <Ionicons name="trophy" size={16} color="#4dd0e1" />
                    <Text style={styles.scoreLabel}>Score</Text>
                    <Text style={styles.scoreValue}>{entry.combined_score.toFixed(1)}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Bottom Navigation */}
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => router.push("/feed")}>
          <Ionicons name="home-outline" size={28} color="#000" />
          <Text style={styles.navLabel}>Home</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.push("/explore")}>
          <Ionicons name="compass-outline" size={28} color="#000" />
          <Text style={styles.navLabel}>Explore</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.push("/leaderboard")}>
          <Ionicons name="trophy" size={28} color="#000" />
          <Text style={styles.navLabel}>Leaderboard</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.push("/happening")}>
          <Ionicons name="restaurant-outline" size={28} color="#000" />
          <Text style={styles.navLabel}>Restaurant</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.push("/profile")}>
          <Ionicons name="person-outline" size={28} color="#000" />
          <Text style={styles.navLabel}>Profile</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFE4CC", // Light orange background
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FFE4CC",
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
    backgroundColor: "#FFE4CC",
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
    paddingTop: 40,
    paddingHorizontal: 16,
    paddingBottom: 100,
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
    fontSize: 14,
    color: "#fff",
    marginBottom: 20,
    opacity: 0.8,
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
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
    marginBottom: 16,
  },
  leaderboardCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  topThreeCard: {
    borderWidth: 2,
    borderColor: "#FFD700",
  },
  rankBadge: {
    position: "absolute",
    top: 12,
    right: 12,
    backgroundColor: "#fff",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  topThreeRankBadge: {
    backgroundColor: "#FFD700",
  },
  rankText: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#333",
  },
  topThreeRankText: {
    color: "#fff",
  },
  cardContent: {
    flexDirection: "row",
    marginBottom: 12,
  },
  mediaThumbnail: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: "#f0f0f0",
    marginRight: 12,
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
    borderColor: "#FFD700",
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
  navBar: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingVertical: 12,
    borderTopWidth: 1,
    borderColor: "#E0E0E0",
    backgroundColor: "#fff",
  },
  navLabel: {
    fontSize: 10,
    color: "#000",
    marginTop: 4,
  },
});

