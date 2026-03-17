import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  FlatList,
  TextInput,
  ActivityIndicator,
  Animated,
  Linking,
  Alert,
  Platform,
  Dimensions,
  KeyboardAvoidingView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import MaskedView from "@react-native-masked-view/masked-view";
import { useAuth } from "../context/AuthContext";
import { useRouter } from "expo-router";
import { getFollowers, getFollowing } from "../utils/api";
import UserAvatar from "./UserAvatar";
import axios from "axios";

const API_BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL || "https://api.cofau.com";
const API_URL = `${API_BASE_URL}/api`;
const { height: SCREEN_HEIGHT } = Dimensions.get("window");

export default function NudgeModal({ visible, onClose, post }) {
  const { user, token } = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState(null); // null = picker, "cofau" = friend list
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sendingTo, setSendingTo] = useState(null);
  const slideAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setMode(null);
      setSearchQuery("");
      setSendingTo(null);
      Animated.spring(slideAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }).start();
    } else {
      slideAnim.setValue(0);
    }
  }, [visible]);

  const fetchFriends = async () => {
    if (!user?.id || !token) return;
    setLoading(true);
    try {
      const [followers, following] = await Promise.all([
        getFollowers(user.id).catch(() => []),
        getFollowing(user.id).catch(() => []),
      ]);

      const allUsersMap = new Map();
      (followers || []).forEach((f) => {
        const id = f.id || f.user_id || f._id;
        if (id && id !== user.id) {
          allUsersMap.set(id, {
            id,
            full_name: f.full_name || f.username || "Unknown",
            username: f.username || f.full_name || "Unknown",
            profile_picture: f.profile_picture || f.profile_picture_url,
            level: f.level || 1,
            badge: f.badge,
          });
        }
      });
      (following || []).forEach((f) => {
        const id = f.id || f.user_id || f._id;
        if (id && id !== user.id && !allUsersMap.has(id)) {
          allUsersMap.set(id, {
            id,
            full_name: f.full_name || f.username || "Unknown",
            username: f.username || f.full_name || "Unknown",
            profile_picture: f.profile_picture || f.profile_picture_url,
            level: f.level || 1,
            badge: f.badge,
          });
        }
      });

      setFriends(Array.from(allUsersMap.values()));
    } catch (err) {
      console.error("Error fetching friends:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCofauNudge = () => {
    setMode("cofau");
    fetchFriends();
  };

  const handleExternalNudge = async () => {
    const locationName = post?.restaurant_name || post?.location_name || "";
    const postLink = `https://api.cofau.com/share/${post?.id}`;

    const locationPart = locationName ? `\n📍 ${locationName}` : "";
    const message = `Hey! I think you would love to try this!! 🍛${locationPart}\n\n${postLink}`;

    const encodedMessage = encodeURIComponent(message);

    // Try whatsapp:// scheme first (works when WhatsApp is installed)
    // Then fallback to https://wa.me which opens WhatsApp or App Store
    try {
      const whatsappScheme = `whatsapp://send?text=${encodedMessage}`;
      const canOpen = await Linking.canOpenURL(whatsappScheme);
      if (canOpen) {
        await Linking.openURL(whatsappScheme);
        onClose();
        return;
      }
    } catch (e) {
      // whatsapp:// not available
    }

    // Fallback: https://wa.me works universally — opens WhatsApp or redirects to store
    try {
      await Linking.openURL(`https://wa.me/?text=${encodedMessage}`);
    } catch (e) {
      Alert.alert("Share", message);
    }

    onClose();
  };

  const sendNudge = async (friendId, friendName) => {
    setSendingTo(friendId);
    try {
      const dishName = post?.dish_name || post?.title || "this post";
      const restaurantName = post?.restaurant_name || post?.location_name || "";

      await axios.post(
        `${API_URL}/nudge`,
        {
          post_id: post?.id,
          to_user_id: friendId,
          dish_name: dishName,
          restaurant_name: restaurantName,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      Alert.alert("Nudge Sent!", `${friendName} will see your nudge 🍛`);
      onClose();
    } catch (err) {
      console.error("Error sending nudge:", err);
      Alert.alert("Oops", "Couldn't send nudge. Try again!");
    } finally {
      setSendingTo(null);
    }
  };

  const filteredFriends = friends.filter(
    (f) =>
      f.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.username?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderFriendItem = ({ item }) => (
    <TouchableOpacity
      style={styles.friendRow}
      onPress={() => sendNudge(item.id, item.full_name)}
      disabled={sendingTo === item.id}
      activeOpacity={0.7}
    >
      <UserAvatar
        profilePicture={item.profile_picture}
        username={item.full_name}
        size={44}
        level={item.level}
        showLevelBadge={true}
      />
      <View style={styles.friendInfo}>
        <Text style={styles.friendName} numberOfLines={1}>
          {item.full_name}
        </Text>
        <Text style={styles.friendUsername} numberOfLines={1}>
          @{item.username}
        </Text>
      </View>
      {sendingTo === item.id ? (
        <ActivityIndicator size="small" color="#FF5722" />
      ) : (
        <LinearGradient
          colors={["#FF2E2E", "#FF7A18"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.nudgeSendBtn}
        >
          <Text style={styles.nudgeSendBtnText}>Nudge</Text>
        </LinearGradient>
      )}
    </TouchableOpacity>
  );

  const translateY = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [400, 0],
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        {/* Tap backdrop to close */}
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.keyboardView}
        >
          <Animated.View
            style={[
              styles.sheet,
              mode === "cofau" && styles.sheetExpanded,
              { transform: [{ translateY }] },
            ]}
          >
            {/* Handle bar */}
            <View style={styles.handleBar} />

            {/* Header */}
            <View style={styles.header}>
              {mode !== null && (
                <TouchableOpacity
                  onPress={() => setMode(null)}
                  style={styles.backBtn}
                >
                  <Ionicons name="arrow-back" size={22} color="#333" />
                </TouchableOpacity>
              )}
              <MaskedView
                maskElement={
                  <Text style={[styles.headerTitle, { opacity: 1 }]}>
                    {mode === null ? "Nudge a Friend" : "Choose a Cofau Friend"}
                  </Text>
                }
              >
                <LinearGradient
                  colors={["#FF2E2E", "#FF7A18"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <Text style={[styles.headerTitle, { opacity: 0 }]}>
                    {mode === null ? "Nudge a Friend" : "Choose a Cofau Friend"}
                  </Text>
                </LinearGradient>
              </MaskedView>
            </View>

            {/* Mode Picker */}
            {mode === null && (
              <View style={styles.optionsContainer}>
                <TouchableOpacity
                  style={styles.optionCard}
                  onPress={handleCofauNudge}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={["#FF2E2E", "#FF7A18"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.optionIconWrap}
                  >
                    <Ionicons name="people" size={26} color="#FFF" />
                  </LinearGradient>
                  <View style={styles.optionTextWrap}>
                    <Text style={styles.optionTitle}>Nudge a Cofau Friend</Text>
                    <Text style={styles.optionDesc}>
                      Send an in-app nudge — they'll see it instantly
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#CCC" />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.optionCard}
                  onPress={handleExternalNudge}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={["#25D366", "#128C7E"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.optionIconWrap}
                  >
                    <Ionicons name="logo-whatsapp" size={26} color="#FFF" />
                  </LinearGradient>
                  <View style={styles.optionTextWrap}>
                    <Text style={styles.optionTitle}>Nudge via WhatsApp</Text>
                    <Text style={styles.optionDesc}>
                      Invite a friend who's not on Cofau yet
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#CCC" />
                </TouchableOpacity>
              </View>
            )}

            {/* Cofau Friends List */}
            {mode === "cofau" && (
              <View style={styles.friendsContainer}>
                {/* Search */}
                <View style={styles.searchWrap}>
                  <Ionicons
                    name="search"
                    size={18}
                    color="#999"
                    style={{ marginLeft: 12 }}
                  />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Search friends..."
                    placeholderTextColor="#999"
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    autoCorrect={false}
                  />
                  {searchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => setSearchQuery("")} style={{ paddingRight: 12 }}>
                      <Ionicons name="close-circle" size={18} color="#CCC" />
                    </TouchableOpacity>
                  )}
                </View>

                {loading ? (
                  <View style={styles.loadingWrap}>
                    <ActivityIndicator size="large" color="#FF5722" />
                    <Text style={styles.loadingText}>Loading friends...</Text>
                  </View>
                ) : filteredFriends.length === 0 && !searchQuery ? (
                  // Empty state — no friends at all
                  <View style={styles.emptyWrap}>
                    <LinearGradient
                      colors={["#FF2E2E", "#FF7A18"]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.emptyIconWrap}
                    >
                      <Ionicons name="people-outline" size={36} color="#FFF" />
                    </LinearGradient>
                    <Text style={styles.emptyTitle}>No friends yet</Text>
                    <Text style={styles.emptyDesc}>
                      Follow foodies on Cofau to nudge them{"\n"}about your favorite dishes!
                    </Text>
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={() => {
                        onClose();
                        router.push("/(tabs)/explore");
                      }}
                    >
                      <LinearGradient
                        colors={["#FF2E2E", "#FF7A18"]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.findFriendsBtn}
                      >
                        <Ionicons name="search" size={16} color="#FFF" />
                        <Text style={styles.findFriendsBtnText}>Find Friends to Follow</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>
                ) : filteredFriends.length === 0 && searchQuery ? (
                  // Empty state — search has no results
                  <View style={styles.emptyWrap}>
                    <Ionicons name="search-outline" size={40} color="#DDD" />
                    <Text style={styles.emptyTitle}>No results</Text>
                    <Text style={styles.emptyDesc}>
                      No friends matching "{searchQuery}"
                    </Text>
                  </View>
                ) : (
                  <FlatList
                    data={filteredFriends}
                    keyExtractor={(item) => item.id}
                    renderItem={renderFriendItem}
                    style={styles.friendsList}
                    contentContainerStyle={styles.friendsListContent}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                    bounces={true}
                  />
                )}
              </View>
            )}
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const BOTTOM_SAFE = Platform.OS === "ios" ? 34 : 20;

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  backdrop: {
    flex: 1,
  },
  keyboardView: {
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#FFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: BOTTOM_SAFE,
  },
  sheetExpanded: {
    height: SCREEN_HEIGHT * 0.6,
  },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#DDD",
    alignSelf: "center",
    marginTop: 10,
    marginBottom: 6,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  backBtn: {
    marginRight: 10,
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
  },

  // Options picker
  optionsContainer: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 10,
    gap: 12,
  },
  optionCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FAFAFA",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
  },
  optionIconWrap: {
    width: 50,
    height: 50,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  optionTextWrap: {
    flex: 1,
    marginLeft: 14,
    marginRight: 8,
  },
  optionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#222",
    marginBottom: 3,
  },
  optionDesc: {
    fontSize: 12.5,
    color: "#777",
    lineHeight: 17,
  },

  // Friends list
  friendsContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F3F3F3",
    borderRadius: 12,
    marginBottom: 8,
    height: 42,
  },
  searchInput: {
    flex: 1,
    paddingHorizontal: 10,
    fontSize: 14,
    color: "#333",
    height: 42,
  },
  friendsList: {
    flex: 1,
  },
  friendsListContent: {
    paddingBottom: 10,
  },
  friendRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#F0F0F0",
  },
  friendInfo: {
    flex: 1,
    marginLeft: 12,
    marginRight: 10,
  },
  friendName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#222",
  },
  friendUsername: {
    fontSize: 12,
    color: "#999",
    marginTop: 1,
  },
  nudgeSendBtn: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 20,
  },
  nudgeSendBtnText: {
    color: "#FFF",
    fontSize: 13,
    fontWeight: "700",
  },

  // Loading & empty
  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  loadingText: {
    fontSize: 13,
    color: "#999",
  },
  emptyWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 30,
  },
  emptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#222",
    marginBottom: 6,
  },
  emptyDesc: {
    fontSize: 13.5,
    color: "#888",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 20,
  },
  findFriendsBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
    gap: 8,
  },
  findFriendsBtnText: {
    color: "#FFF",
    fontSize: 14,
    fontWeight: "700",
  },
});
