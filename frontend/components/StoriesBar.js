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

      setStories(fixed);
    } catch (err) {
      console.log("❌ Story fetch error:", err?.response?.data || err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleStoryPress = (userStories) => {
    router.push({
      pathname: "/story-viewer",
      params: {
        userId: userStories.user.id,
        stories: JSON.stringify(userStories.stories),
        user: JSON.stringify(userStories.user),
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
      {/* ===== Your Story (NO level badge) ===== */}
      {user && (
        <TouchableOpacity style={styles.storyItem} onPress={handleAddStory}>
          <View style={styles.avatarWrapper}>
            <UserAvatar
              profilePicture={normalizeProfilePicture(user.profile_picture)}
              username={user.full_name}
              size={70}
              showLevelBadge={false}
            />

            <View style={styles.addIconContainer}>
              <Ionicons name="add" size={16} color="#fff" />
            </View>
          </View>

          <Text style={styles.storyUsername}>Your Story</Text>
        </TouchableOpacity>
      )}

      {/* ===== Other Users ===== */}
      {stories.map((u) => {
        if (!u.user?.id) return null;

        return (
          <TouchableOpacity
            key={u.user.id}
            style={styles.storyItem}
            onPress={() => handleStoryPress(u)}
          >
            <View style={styles.avatarWrapper}>
              <LinearGradient
                colors={["#E94A37", "#F2CF68", "#1B7C82"]}
                locations={[0, 0.35, 0.9]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.gradientRing}
              >
                <View style={styles.whiteRing}>
                  <UserAvatar
                    profilePicture={normalizeProfilePicture(u.user.profile_picture)}
                    username={u.user.username}
                    size={70}
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
    borderBottomColor: "#EEE",
    marginTop: -8,
    marginBottom: -8,
  },

  loadingContainer: {
    padding: 20,
    alignItems: "center",
  },

  contentContainer: {
    paddingHorizontal: 12,
    paddingVertical: 14,
  },

  storyItem: {
    alignItems: "center",
    marginRight: 16,
    width: 70,
  },

  avatarWrapper: {
    position: "relative",
  },

  /* Gradient ring – thin */
  gradientRing: {
    width: 80,
    height: 80,
    borderRadius: 40,
    padding: 2,
    justifyContent: "center",
    alignItems: "center",
  },

  whiteRing: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: "#FFF",
    justifyContent: "center",
    alignItems: "center",
  },

  addIconContainer: {
    position: "absolute",
    bottom: -2,
    right: -2,
    backgroundColor: "#4dd0e1",
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#FFF",
    zIndex: 10,
  },

  /* ✅ Correct level badge placement */
  levelBadgeWrap: {
    position: "absolute",
    bottom: 2,
    right: 2,
    zIndex: 20,
  },

  storyUsername: {
    marginTop: 4,
    fontSize: 10,
    color: "#333",
    textAlign: "center",
  },
});
