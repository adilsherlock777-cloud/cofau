import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import UserAvatar from "./UserAvatar";
import LevelBadge from "./LevelBadge";
import {
  normalizeProfilePicture,
  normalizeStoryUrl,
  BACKEND_URL,
} from "../utils/imageUrlFix";

export default function StoriesBar({ refreshTrigger }) {
  const router = useRouter();
  const { user, token } = useAuth();

  const [stories, setStories] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) fetchStories();
  }, [token, refreshTrigger]);

  const fetchStories = async () => {
    try {
      setLoading(true);

      const response = await axios.get(`${BACKEND_URL}/api/stories/feed`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const fixed = response.data.map((u) => ({
  ...u,
  user: {
    ...u.user,
    id: u.user.id || u.user._id,
    username: u.user.username || u.user.full_name || "User",
    profile_picture: normalizeProfilePicture(u.user.profile_picture),
    level:
      u.user.level ||
      u.user.user_level ||
      u.user.userLevel ||
      u.user.levelNumber ||
      null,
  },
  stories: u.stories.map((s) => ({
    ...s,
    media_url: normalizeStoryUrl(s.media_url),
    media_type: s.media_type || s.type || "image",
  })),
}));

// Filter out own user's stories - they only appear in level card
const filtered = fixed.filter(u => u.user.id !== user?.id);
setStories(filtered);
    } catch (err) {
      console.log("❌ Story fetch error:", err?.response?.data || err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleStoryPress = (userStories, index) => {
  router.push({
    pathname: "/story-viewer",
    params: {
      userId: userStories.user.id,
      stories: JSON.stringify(userStories.stories),
      user: JSON.stringify(userStories.user),
      allUsersStories: JSON.stringify(stories), // Pass ALL users' stories
      currentUserIndex: index, // Pass the index of tapped user
    },
  });
};

  const handleAddStory = () => router.push("/story-upload");

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color="#4dd0e1" />
      </View>
    );
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
    >

      {/* ===== Other Users ===== */}
      {stories.map((u, index) => {
        if (!u.user?.id) return null;

        return (
          <TouchableOpacity
            key={u.user.id}
            style={styles.storyItem}
            onPress={() => handleStoryPress(u, index)}
          >
            <View style={styles.avatarWrapper}>
              <LinearGradient
                colors={["#FF2E2E", "#F2CF68", "#FF9A4D"]}
                locations={[0, 0.5, 1]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.gradientRing}
              >
                <View style={styles.whiteRing}>
                  <UserAvatar
                    profilePicture={normalizeProfilePicture(u.user.profile_picture)}
                    username={u.user.username}
                    size={65}
                    showLevelBadge={false}
                  />
                </View>
              </LinearGradient>

              {/* ✅ Level badge ON DP EDGE */}
              {u.user.level && (
                <View style={styles.levelBadgeWrap}>
                  <LevelBadge level={u.user.level} size="small" />
                </View>
              )}
            </View>

            <Text style={styles.storyUsername}>{u.user.username}</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

/* ================= STYLES ================= */

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#FFF",
    borderBottomWidth: 1,
    borderBottomColor: "transparent",
    marginTop: -6,
    marginBottom: -5.5,
  },

  loadingContainer: {
    padding: 20,
    alignItems: "center",
  },

  contentContainer: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },

  storyItem: {
    alignItems: "center",
    marginRight: 14,
    width: 65,
  },

  avatarWrapper: {
    position: "relative",
  },

  /* Gradient ring – thin */
  gradientRing: {
    width: 70,
    height: 70,
    borderRadius: 55,
    padding: 4,
    justifyContent: "center",
    alignItems: "center",
  },

  whiteRing: {
    width: 66,
    height: 66,
    borderRadius: 38,
    backgroundColor: "#FFF",
    justifyContent: "center",
    alignItems: "center",
  },

  addIconContainer: {
    position: "absolute",
    bottom: 0,
    right: 8,
    backgroundColor: "#fff",
    borderRadius: 12,
    width: 16,
    height: 16,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#000",
    zIndex: 10,
  },

  /* ✅ Correct level badge placement */
  levelBadgeWrap: {
    position: "absolute",
    bottom: 2,
    right: 4,
    zIndex: 30,
  },

  storyUsername: {
    marginTop: 4,
    fontSize: 11,
    color: "#333",
    textAlign: "center",
  },
});
