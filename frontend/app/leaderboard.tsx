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
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import { normalizeMediaUrl, normalizeProfilePicture, BACKEND_URL } from "../utils/imageUrlFix";
import { followUser, unfollowUser } from "../utils/api";
import UserAvatar from "../components/UserAvatar";

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
timeout: 10000, // 10 second timeout
});

// Ensure response has expected structure
const data = response.data || {};

// Validate and format dates
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

// Debug: Log first entry to verify data structure
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
// Server responded with error
errorMessage = err.response.data?.detail || err.response.data?.message || `Server error: ${err.response.status}`;
} else if (err.request) {
// Request made but no response
errorMessage = "Network error. Please check your connection.";
} else {
// Something else happened
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

// Parse the date string - handle ISO format with or without 'Z'
let date: Date;

// If it's an ISO string without timezone, add UTC indicator
if (dateString.includes('T') && !dateString.includes('Z') && !dateString.includes('+')) {
// Assume UTC if no timezone specified
date = new Date(dateString + 'Z');
} else {
date = new Date(dateString);
}

// Check if date is valid
if (isNaN(date.getTime())) {
console.error("Invalid date:", dateString);
return '';
}

// Format as "Dec 10" - use UTC methods to avoid timezone issues
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
// Refresh the leaderboard after regeneration
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
{/* Header with Gradient */}
<LinearGradient
colors={["#E94A37", "#F2CF68", "#1B7C82"]}
start={{ x: 0, y: 0 }}
end={{ x: 1, y: 0 }}
style={styles.gradientHeader}
>
<Text style={styles.cofauTitle}>Cofau</Text>
</LinearGradient>

{/* Banner Container with 3D Box */}
<View style={styles.bannerContainer}>
<View style={styles.bannerCard}>
<Text style={styles.bannerTitle}>COFAU TOP PICKS</Text>
<Text style={styles.bannerSubtitle}>Last 3 Days</Text>
</View>
</View>

{leaderboardData && leaderboardData.from_date && leaderboardData.to_date && (
<View>
<Text style={styles.dateRange}>
{formatDate(leaderboardData.from_date)} - {formatDate(leaderboardData.to_date)}
{leaderboardData.window_days && ` (${leaderboardData.window_days} days)`}
</Text>
{leaderboardData.total_posts_analyzed !== undefined && leaderboardData.total_posts_analyzed > 0 && (
<Text style={styles.postsCountText}>
{leaderboardData.total_posts_analyzed} images analyzed
</Text>
)}
{/* Check if entries have the new fields, if not show regenerate option */}
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

{/* Empty State */}
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

{/* Leaderboard Entries */}
{entries.length > 0 && (
<View style={styles.section}>
<Text style={styles.sectionTitle}>Top Posts This Week</Text>
{entries.map((entry: any, index: number) => {
const isRankOne = index === 0;
const isOwnPost = entry.user_id === user?.id;
const isFollowing = followingStates[entry.user_id] || false;

// Debug logging for each entry
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

return (
<TouchableOpacity
key={entry.post_id}
style={[
styles.leaderboardCard,
index === 0 && { borderColor: "#C0C0C0" },  // Gold for #1
index === 1 && { borderColor: "#C0C0C0" },  // Silver for #2
index === 2 && { borderColor: "#C0C0C0" },  // Bronze for #3
index > 2 && { borderColor: "#1B7C82" },    // Cofau teal for others
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

{isRankOne ? (
/* RANK #1 - Full Profile Info */
<View style={styles.rankOneContainer}>
<View style={styles.rankOneProfileSection}>
<UserAvatar
profilePicture={normalizeProfilePicture(entry.user_profile_picture)}
username={entry.username}
size={80}
showLevelBadge={false}
level={1}
style={{}}
/>
<View style={styles.rankOneInfo}>
<Text style={styles.rankOneName} numberOfLines={1}>
{entry.full_name || entry.username || "Unknown User"}
</Text>
<View style={styles.rankOneStats}>
<View style={styles.statItem}>
<Ionicons name="people-outline" size={16} color="#666" />
<Text style={styles.statText}>
{entry.followers_count !== undefined && entry.followers_count !== null 
  ? entry.followers_count 
  : 0}
</Text>
</View>
<View style={styles.statItem}>
<Ionicons name="images-outline" size={16} color="#666" />
<Text style={styles.statText}>
{entry.posts_count !== undefined && entry.posts_count !== null 
  ? entry.posts_count 
  : 0}
</Text>
</View>
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
) : (
/* REMAINING RANKS - Profile Picture and Name Only */
<View style={styles.otherRanksContainer}>
<UserAvatar
profilePicture={normalizeProfilePicture(entry.user_profile_picture)}
username={entry.username}
size={50}
showLevelBadge={false}
level={1}
style={{}}
/>
<Text style={styles.otherRanksName} numberOfLines={1}>
{entry.full_name || entry.username || "Unknown User"}
</Text>
</View>
)}

<View style={styles.cardContent}>
{/* Media Thumbnail - Use thumbnail if available, otherwise use media_url */}
<Image
source={{
uri: normalizeMediaUrl(entry.thumbnail_url || entry.media_url) || ''
}}
style={index === 0 ? styles.mediaThumbnailLarge : styles.mediaThumbnail}
resizeMode="cover"
onError={(error) => {
console.log("Error loading thumbnail:", error);
}}
/>

{/* Entry Info */}
<View style={styles.entryInfo}>
{/* Caption */}
{entry.caption && (
<Text style={styles.captionText} numberOfLines={2}>
{entry.caption}
</Text>
)}

{/* Location */}
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

{/* Bottom Navigation - Matching Home Screen Style */}
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

{/* Center Elevated Button */}
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

/* Gradient Header */
gradientHeader: {
paddingTop: 70,
paddingBottom: 40,
paddingHorizontal: 20,
alignItems: "center",
justifyContent: "center",
borderBottomLeftRadius: 30,
borderBottomRightRadius: 30,
shadowColor: "#000",
shadowOffset: { width: 3, height: 4 },
shadowOpacity: 0.15,
shadowRadius: 8,
elevation: 6,
marginHorizontal: -16,
marginBottom: 20,
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
fontSize: 12,
color: "#000",
marginBottom: 4,
opacity: 0.7,
textAlign: "center",
},
postsCountText: {
fontSize: 12,
color: "#000",
marginBottom: 20,
opacity: 0.7,
textAlign: "center",
fontStyle: "italic",
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
borderRadius: 20,
padding: 12,
marginBottom: 12,
backgroundColor: "#FFFFFF",
borderWidth: -3,
borderColor: "#1B7C82", // Default color, will be overridden by inline styles
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
marginBottom: 8,
},
mediaThumbnail: {
width: 80,
height: 80,
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

/* Bottom Navigation - Matching Home Screen */
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

/* Banner Container */
bannerContainer: {
marginTop: -56,
marginHorizontal: 15,
marginBottom: 20,
zIndex: 10,
},

bannerCard: {
backgroundColor: "#FFFFFF",
borderRadius: 25,
paddingVertical: 15,
paddingHorizontal: 40,
alignItems: "center",
borderWidth: 0.2,
borderColor: "#000",
shadowColor: "#000",
shadowOffset: { width: 6, height: 10 },
shadowOpacity: 0.5,
shadowRadius: 12,
elevation: 16,
},

bannerTitle: {
fontSize: 22,
fontWeight: "700",
color: "#000",
textAlign: "center",
marginBottom: 4,
textDecorationLine: "underline",
},

bannerSubtitle: {
fontSize: 12,
fontWeight: "600",
color: "#666",
textAlign: "center",
},

navLabelActive: {
fontSize: 11,
color: "#000",
marginTop: 2,
textAlign: "center",
fontWeight: "700",
},

/* Rank #1 Profile Styles */
rankOneContainer: {
marginBottom: 16,
paddingBottom: 16,
borderBottomWidth: 1,
borderBottomColor: "rgba(0,0,0,0.1)",
},
rankOneProfileSection: {
flexDirection: "row",
alignItems: "center",
gap: 16,
},
rankOneInfo: {
flex: 1,
},
rankOneName: {
fontSize: 20,
fontWeight: "700",
color: "#333",
marginBottom: 12,
},
rankOneStats: {
flexDirection: "row",
gap: 20,
marginBottom: 12,
},
statItem: {
flexDirection: "row",
alignItems: "center",
gap: 6,
},
statText: {
fontSize: 14,
fontWeight: "600",
color: "#666",
},
followButtonLeaderboard: {
backgroundColor: "#1B7C82",
paddingHorizontal: 20,
paddingVertical: 8,
borderRadius: 20,
alignSelf: "flex-start",
},
followingButtonLeaderboard: {
backgroundColor: "#E8E8E8",
},
followButtonTextLeaderboard: {
color: "#fff",
fontSize: 14,
fontWeight: "600",
},
followingButtonTextLeaderboard: {
color: "#666",
},

/* Other Ranks Profile Styles */
otherRanksContainer: {
flexDirection: "row",
alignItems: "center",
gap: 12,
marginBottom: 12,
paddingBottom: 12,
borderBottomWidth: 1,
borderBottomColor: "rgba(0,0,0,0.05)",
},
otherRanksName: {
fontSize: 16,
fontWeight: "600",
color: "#333",
flex: 1,
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

