import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import MaskedView from "@react-native-masked-view/masked-view";
import axios from "axios";
import { useAuth } from "../../context/AuthContext";
import UserAvatar from "../../components/UserAvatar";

const API_BASE = process.env.EXPO_PUBLIC_BACKEND_URL || "https://api.cofau.com";
const API_URL = `${API_BASE}/api`;

// Fix URL helper for profile pics
const fixUrl = (url?: string | null) => {
  if (!url) return null;
  if (url.startsWith("http")) return url;

  url = url.replace(/\/+/g, "/");
  if (url.startsWith("/api")) return `${API_BASE}${url}`;
  return `${API_BASE}${url.startsWith("/") ? url : "/" + url}`;
};

interface ChatItem {
  other_user_id: string;
  other_user_name: string;
  other_user_profile_picture?: string | null;
  account_type?: string;
  last_message?: string;
  last_from_me?: boolean;
  created_at?: string;
  unread_count?: number;
}

export default function ChatListScreen() {
  const { token } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<ChatItem[]>([]);
  const [activeTab, setActiveTab] = useState<"users" | "restaurants">("users");
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredItems, setFilteredItems] = useState<ChatItem[]>([]);

useEffect(() => {
  if (!token) return;

  const fetchChatList = async () => {
    try {
      // Fetch chat list
      const listRes = await axios.get(`${API_URL}/chat/list`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      // Fetch unread counts per user
      const unreadRes = await axios.get(`${API_URL}/chat/unread-per-user`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const unreadCounts = unreadRes.data || {};

      const mapped = (listRes.data || []).map((it: any) => ({
        ...it,
        other_user_profile_picture: fixUrl(it.other_user_profile_picture),
        unread_count: unreadCounts[it.other_user_id] || 0,
      }));

      setItems(mapped);
    } catch (err: any) {
      console.log("Chat list error", err?.response?.data || err?.message);
    }
  };

  fetchChatList();
}, [token]);

  // Filter chats based on active tab and search query
  useEffect(() => {
    let filtered = items;

    // Filter by account type based on active tab
    if (activeTab === "users") {
      filtered = items.filter((item) => item.account_type !== "restaurant");
    } else {
      filtered = items.filter((item) => item.account_type === "restaurant");
    }

    // Filter by search query
    if (searchQuery.trim() !== "") {
      filtered = filtered.filter((item) =>
        item.other_user_name
          ?.toLowerCase()
          .includes(searchQuery.toLowerCase())
      );
    }

    setFilteredItems(filtered);
  }, [items, activeTab, searchQuery]);

  const formatTime = (timestamp?: string) => {
    if (!timestamp) return "";
    
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Now";
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;
    
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  const renderItem = ({ item }: { item: ChatItem }) => {
    const hasUnread = item.unread_count && item.unread_count > 0;
    
    return (
      <TouchableOpacity
        style={[
          styles.chatItem,
          hasUnread && styles.chatItemUnread
        ]}
        onPress={() =>
          router.push({
            pathname: "/chat/[userId]",
            params: {
              userId: item.other_user_id,
              fullName: item.other_user_name || "User",
              profilePicture: item.other_user_profile_picture || "",
            },
          })
        }
        activeOpacity={0.7}
      >
        <View style={styles.avatarContainer}>
          <UserAvatar
            profilePicture={item.other_user_profile_picture}
            username={item.other_user_name}
            size={56}
          />
          {hasUnread && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadText}>
                {item.unread_count > 99 ? "99+" : item.unread_count}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.chatContent}>
          <View style={styles.chatHeader}>
            <Text 
              style={[
                styles.userName,
                hasUnread && styles.userNameUnread
              ]} 
              numberOfLines={1}
            >
              {item.other_user_name || "Unknown User"}
            </Text>
            <Text style={styles.timeText}>{formatTime(item.created_at)}</Text>
          </View>

          <Text 
            numberOfLines={1} 
            style={[
              styles.lastMessage,
              hasUnread && styles.lastMessageUnread
            ]}
          >
            {item.last_from_me ? "You: " : ""}
            {item.last_message || "Say hello! 👋"}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Cofau Gradient Header */}
      <LinearGradient
        colors={["#FFF5F0", "#FFE5D9"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.gradientHeader}
      >
        <View style={styles.headerContent}>
          {/* Back Button */}
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={20} color="#333" />
          </TouchableOpacity>

          <MaskedView
            maskElement={
              <Text style={styles.headerTitle}>Messages</Text>
            }
          >
            <LinearGradient
              colors={["#FF2E2E", "#FF7A18"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Text style={[styles.headerTitle, { opacity: 0 }]}>Messages</Text>
            </LinearGradient>
          </MaskedView>

          {/* Spacer for centering */}
          <View style={styles.headerSpacer} />
        </View>

        {/* Search Bar - Centered */}
        <View style={styles.searchWrapper}>
          <View style={styles.searchContainer}>
            <Ionicons
              name="search"
              size={20}
              color="#999"
              style={styles.searchIcon}
            />
            <TextInput
              style={styles.searchInput}
              placeholder="Search conversations..."
              placeholderTextColor="#999"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity
                onPress={() => setSearchQuery("")}
                style={styles.clearButton}
              >
                <Ionicons name="close-circle" size={20} color="#999" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </LinearGradient>

      {/* Instagram-style Tabs */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === "users" && styles.activeTab]}
          onPress={() => setActiveTab("users")}
          activeOpacity={0.7}
        >
          <Text style={[styles.tabText, activeTab === "users" && styles.activeTabText]}>
            USERS
          </Text>
          {activeTab === "users" && <View style={styles.tabIndicator} />}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === "restaurants" && styles.activeTab]}
          onPress={() => setActiveTab("restaurants")}
          activeOpacity={0.7}
        >
          <Text style={[styles.tabText, activeTab === "restaurants" && styles.activeTabText]}>
            RESTAURANTS
          </Text>
          {activeTab === "restaurants" && <View style={styles.tabIndicator} />}
        </TouchableOpacity>
      </View>

      {/* Chat List */}
      <FlatList
        data={filteredItems}
        keyExtractor={(item) => item.other_user_id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={() => (
          <View style={styles.emptyContainer}>
            <Ionicons name="chatbubbles-outline" size={64} color="#ccc" />
            <Text style={styles.emptyTitle}>
              {searchQuery ? "No chats found" : "No messages yet"}
            </Text>
            <Text style={styles.emptySubtitle}>
              {searchQuery
                ? "Try searching for a different name"
                : "Start a conversation with someone!"}
            </Text>
          </View>
        )}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8F9FA",
  },
  gradientHeader: {
    paddingTop: Platform.OS === "ios" ? 60 : 50,
    paddingBottom: 30,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    shadowColor: "#000",
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  backButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "rgba(0, 0, 0, 0.05)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontFamily: "Lobster",
    fontSize: 36,
    letterSpacing: 1,
  },
  headerSpacer: {
    width: 40,
  },
 searchWrapper: {
  position: 'absolute',  // ✅ Add this
  bottom: -5,  // ✅ Add this - positions from bottom of gradient
  left: 20,
  right: 20,
  alignItems: "center",
},
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 25,
    paddingHorizontal: 16,
    paddingVertical: 11,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    width: "100%",
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: "#333",
  },
  clearButton: {
    padding: 4,
  },
  listContent: {
    paddingTop: 8,
    paddingBottom: 20,
  },
  chatItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: "#fff",
  },
  chatItemUnread: {
    backgroundColor: "#F0F8FF",
  },
  avatarContainer: {
    position: "relative",
    marginRight: 12,
  },
  unreadBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    backgroundColor: "#FF3B30",
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
    borderWidth: 2,
    borderColor: "#fff",
  },
  unreadText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "bold",
  },
  chatContent: {
    flex: 1,
  },
  chatHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  userName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000",
    flex: 1,
    marginRight: 8,
  },
  userNameUnread: {
    fontWeight: "700",
    color: "#000",
  },
  timeText: {
    fontSize: 13,
    color: "#8E8E93",
  },
  lastMessage: {
    fontSize: 14,
    color: "#8E8E93",
    lineHeight: 18,
  },
  lastMessageUnread: {
    fontWeight: "600",
    color: "#000",
  },
  separator: {
    height: 1,
    backgroundColor: "#F0F0F0",
    marginLeft: 84,
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 100,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#333",
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: "#8E8E93",
    textAlign: "center",
  },
  // Instagram-style Tabs
  tabsContainer: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#DBDBDB",
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  activeTab: {
    // Active tab styling handled by indicator
  },
  tabText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#8E8E93",
    letterSpacing: 0.5,
  },
  activeTabText: {
    color: "#000",
  },
  tabIndicator: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: "#000",
  },
});