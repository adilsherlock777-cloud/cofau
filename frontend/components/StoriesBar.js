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
import { normalizeMediaUrl, normalizeProfilePicture, normalizeStoryUrl, BACKEND_URL } from "../utils/imageUrlFix";

export default function StoriesBar({ refreshTrigger }) {
  const router = useRouter();
  const { user, token } = useAuth();

  const [stories, setStories] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) fetchStories();
  }, [token, refreshTrigger]);

  /* --------------------------------------------------
     FETCH STORIES + FIX ALL URLS + FIX media_type
  -------------------------------------------------- */
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
        },
        stories: u.stories.map((s) => ({
          ...s,
          media_url: normalizeStoryUrl(s.media_url),
          media_type: s.media_type || s.type || "image", // ★ FIX 1 — Needed for StoryViewer
        })),
      }));

      setStories(fixed);
    } catch (err) {
      console.log("❌ Story fetch error:", err?.response?.data || err.message);
    } finally {
      setLoading(false);
    }
  };

  /* --------------------------------------------------
      OPEN STORY VIEWER
  -------------------------------------------------- */
  const handleStoryPress = (userStories) => {
    router.push({
      pathname: "/story-viewer",
      params: {
        userId: userStories.user.id,
        stories: JSON.stringify(userStories.stories), // includes media_type now 👍
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
      {/* Your Story */}
      {user && (
        <TouchableOpacity style={styles.storyItem} onPress={handleAddStory}>
          <View style={styles.yourStoryContainer}>
            <UserAvatar
              profilePicture={normalizeProfilePicture(user.profile_picture)}
              username={user.full_name}
              size={60}
              showLevelBadge={false}
            />
            <View style={styles.addIconContainer}>
              <Ionicons name="add" size={20} color="#fff" />
            </View>
          </View>

          <Text style={styles.storyUsername} numberOfLines={1}>
            Your Story
          </Text>
        </TouchableOpacity>
      )}

      {/* Other Users */}
      {stories.map((u) => {
        if (!u.user || !u.user.id) return null;

        return (
          <TouchableOpacity
            key={u.user.id}
            style={styles.storyItem}
            onPress={() => handleStoryPress(u)}
          >
            <LinearGradient
              colors={["#feda75", "#fa7e1e", "#d62976", "#962fbf", "#4f5bd5"]}
              style={styles.gradientRing}
            >
              <View style={styles.storyInnerWhiteRing}>
                <UserAvatar
                  profilePicture={normalizeProfilePicture(u.user.profile_picture)}
                  username={u.user.username}
                  size={58}
                />
              </View>
            </LinearGradient>

            <Text style={styles.storyUsername} numberOfLines={1}>
              {u.user.username}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

/* --------------------------------------------------
   STYLES
-------------------------------------------------- */
const styles = StyleSheet.create({
  container: {
    backgroundColor: "#FFF",
    borderBottomWidth: 1,
    borderBottomColor: "#EEE",
  },
  loadingContainer: { padding: 20, alignItems: "center" },
  contentContainer: { paddingHorizontal: 12, paddingVertical: 16 },
  storyItem: { alignItems: "center", marginRight: 16, width: 70 },
  yourStoryContainer: { position: "relative" },
  addIconContainer: {
    position: "absolute",
    bottom: 0,
    right: 0,
    backgroundColor: "#4dd0e1",
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#FFF",
  },
  gradientRing: {
    width: 70,
    height: 70,
    borderRadius: 35,
    padding: 3,
    justifyContent: "center",
    alignItems: "center",
  },
  storyInnerWhiteRing: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#FFF",
    justifyContent: "center",
    alignItems: "center",
  },
  storyUsername: {
    marginTop: 6,
    fontSize: 12,
    color: "#333",
    textAlign: "center",
  },
});
