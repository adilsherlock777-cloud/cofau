import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, FlatList } from "react-native";
import { useRouter } from "expo-router";
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

export default function ChatListScreen() {
  const { token } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);

  useEffect(() => {
    if (!token) return;

    axios
      .get(`${API_URL}/chat/list`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => {
        const mapped = (res.data || []).map((it: any) => ({
          ...it,
          other_user_profile_picture: fixUrl(it.other_user_profile_picture),
        }));
        setItems(mapped);
      })
      .catch((err) =>
        console.log("Chat list error", err?.response?.data || err?.message)
      );
  }, [token]);

  const renderItem = ({ item }: any) => (
    <TouchableOpacity
      style={styles.item}
      onPress={() =>
        router.push({
          pathname: "/chat/[userId]",
          params: {
            userId: item.other_user_id,
            fullName: item.other_user_name || "User",
          },
        })
      }
    >
      <UserAvatar
        profilePicture={item.other_user_profile_picture}
        username={item.other_user_name}
        size={45}
      />

      <View style={{ flex: 1, marginLeft: 10 }}>
        <Text style={styles.name}>{item.other_user_name || "Unknown User"}</Text>

        <Text numberOfLines={1} style={styles.preview}>
          {item.last_from_me ? "You: " : ""}
          {item.last_message || ""}
        </Text>
      </View>

      {/* Time fix to avoid crash on invalid timestamps */}
      <Text style={styles.time}>
        {item.created_at
          ? new Date(item.created_at).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })
          : ""}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={items}
        keyExtractor={(item) => item.other_user_id}
        renderItem={renderItem}
        ItemSeparatorComponent={() => <View style={styles.sep} />}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={() => (
          <View style={{ padding: 20 }}>
            <Text style={{ textAlign: "center", color: "#999" }}>
              No chats yet.
            </Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  listContent: {
    paddingTop: 60, // ✅ Add top padding so first chat is visible
    paddingBottom: 20,
  },
  item: { flexDirection: "row", alignItems: "center", padding: 12 },
  name: { fontSize: 15, fontWeight: "600" },
  preview: { fontSize: 13, color: "#555", marginTop: 2 },
  time: { fontSize: 11, color: "#777" },
  sep: { height: 1, backgroundColor: "#eee", marginLeft: 70 },
});
