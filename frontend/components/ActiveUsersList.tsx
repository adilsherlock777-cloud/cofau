import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import axios from "axios";
import UserAvatar from "./UserAvatar";
import CofauVerifiedBadge from "./CofauVerifiedBadge";

const API_BASE_URL =
  process.env.EXPO_PUBLIC_BACKEND_URL || "https://api.cofau.com";
const API_URL = `${API_BASE_URL}/api`;

interface ActiveUser {
  user_id: string;
  full_name: string;
  username: string;
  profile_picture: string | null;
  level: number;
  badge: string | null;
  followers_count: number;
  post_count: number;
  total_likes: number;
  total_comments: number;
  engagement_score: number;
}

interface ActiveUsersListProps {
  token: string;
}

export const ActiveUsersList: React.FC<ActiveUsersListProps> = ({ token }) => {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [users, setUsers] = useState<ActiveUser[]>([]);

  const fetchActiveUsers = useCallback(async () => {
    try {
      const response = await axios.get(`${API_URL}/restaurant/active-users`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUsers(response.data.active_users || []);
    } catch (error) {
      console.error("Error fetching active users:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) {
      fetchActiveUsers();
    }
  }, [token]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchActiveUsers();
  }, [fetchActiveUsers]);

  const handleUserPress = (userId: string) => {
    router.push(`/profile?userId=${userId}`);
  };

  const renderUserItem = ({
    item,
    index,
  }: {
    item: ActiveUser;
    index: number;
  }) => (
    <TouchableOpacity
      style={styles.userCard}
      onPress={() => handleUserPress(item.user_id)}
      activeOpacity={0.7}
    >
      <View style={styles.rankBadge}>
        <Text style={styles.rankText}>{index + 1}</Text>
      </View>

      <UserAvatar
        profilePicture={item.profile_picture}
        username={item.full_name || item.username}
        size={48}
        level={item.level}
      />

      <View style={styles.userInfo}>
        <View style={styles.nameRow}>
          <Text style={styles.userName} numberOfLines={1}>
            {item.full_name || item.username}
          </Text>
          {item.badge === "verified" && <CofauVerifiedBadge size={14} />}
        </View>
        <Text style={styles.userHandle} numberOfLines={1}>
          @{item.username}
        </Text>
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Ionicons name="document-text-outline" size={12} color="#888" />
            <Text style={styles.statText}>{item.post_count} posts</Text>
          </View>
          <View style={styles.statItem}>
            <Ionicons name="heart-outline" size={12} color="#E94A37" />
            <Text style={styles.statText}>{item.total_likes}</Text>
          </View>
          <View style={styles.statItem}>
            <Ionicons name="chatbubble-outline" size={12} color="#4A90D9" />
            <Text style={styles.statText}>{item.total_comments}</Text>
          </View>
          <View style={styles.statItem}>
            <Ionicons name="people-outline" size={12} color="#888" />
            <Text style={styles.statText}>{item.followers_count}</Text>
          </View>
        </View>
      </View>

      <Ionicons name="chevron-forward" size={18} color="#ccc" />
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#E94A37" />
        <Text style={styles.loadingText}>Finding active foodies...</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={users}
      keyExtractor={(item) => item.user_id}
      renderItem={renderUserItem}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor="#E94A37"
        />
      }
      contentContainerStyle={styles.listContent}
      ListHeaderComponent={
        <View style={styles.header}>
          <Ionicons name="people-circle" size={36} color="#E94A37" />
          <Text style={styles.headerTitle}>Active Food Bloggers</Text>
          <Text style={styles.headerSubtitle}>
            Users who posted in the last 2 days
          </Text>
          <View style={styles.tipCard}>
            <Ionicons name="bulb" size={20} color="#FF9800" />
            <Text style={styles.tipText}>
              These foodies are actively posting right now! Invite them to your restaurant for reviews and collaborations to boost your visibility.
            </Text>
          </View>
        </View>
      }
      ListEmptyComponent={
        <View style={styles.emptyState}>
          <Ionicons name="people-outline" size={64} color="#ccc" />
          <Text style={styles.emptyText}>No active users found</Text>
          <Text style={styles.emptySubText}>
            Check back later for active food bloggers
          </Text>
        </View>
      }
    />
  );
};

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 60,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#999",
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 120,
  },
  header: {
    alignItems: "center",
    marginBottom: 16,
    paddingTop: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#333",
    marginTop: 8,
  },
  headerSubtitle: {
    fontSize: 13,
    color: "#aaa",
    marginTop: 2,
  },
  tipCard: {
    flexDirection: "row",
    backgroundColor: "#FFF8E1",
    borderRadius: 12,
    padding: 12,
    marginTop: 14,
    gap: 10,
    alignItems: "flex-start",
    borderWidth: 1,
    borderColor: "#FFE082",
  },
  tipText: {
    flex: 1,
    fontSize: 13,
    color: "#666",
    lineHeight: 18,
  },
  userCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9F9F9",
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  rankBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#E94A37",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  rankText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "bold",
  },
  userInfo: {
    flex: 1,
    marginLeft: 10,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  userName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
  },
  userHandle: {
    fontSize: 12,
    color: "#999",
    marginTop: 1,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
    gap: 10,
  },
  statItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  statText: {
    fontSize: 11,
    color: "#888",
  },
  emptyState: {
    alignItems: "center",
    paddingTop: 60,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: "600",
    color: "#999",
  },
  emptySubText: {
    marginTop: 4,
    fontSize: 13,
    color: "#bbb",
  },
});
