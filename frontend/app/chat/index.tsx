import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, FlatList } from "react-native";
import { useRouter } from "expo-router";
import axios from "axios";
import { useAuth } from "../../context/AuthContext";
import UserAvatar from "../../components/UserAvatar";

const API_BASE = process.env.EXPO_PUBLIC_BACKEND_URL || "https://backend.cofau.com";
const API_URL = `${API_BASE}/api`;

export default function ChatListScreen() {
  const { token } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);

  useEffect(() => {
    if (!token) return;
    axios.get(`${API_URL}/chat/list`, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => setItems(res.data))
      .catch((err) => console.log("Chat list error", err?.response?.data || err));
  }, [token]);

  const renderItem = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={styles.item}
      onPress={() => router.push({ pathname: "/chat/[userId]", params: { userId: item.other_user_id, fullName: item.other_user_name } })}
    >
      <UserAvatar profilePicture={item.other_user_profile_picture} username={item.other_user_name} size={40} />
      <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={styles.name}>{item.other_user_name}</Text>
          <Text numberOfLines={1} style={styles.preview}>{item.last_from_me ? "You: " : ""}{item.last_message}</Text>
      </View>
      <Text style={styles.time}>{new Date(item.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <FlatList data={items} keyExtractor={(item) => item.other_user_id} renderItem={renderItem} ItemSeparatorComponent={() => <View style={styles.sep} />} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  item: { flexDirection: "row", alignItems: "center", padding: 12 },
  name: { fontSize: 15, fontWeight: "600" },
  preview: { fontSize: 13, color: "#555", marginTop: 2 },
  time: { fontSize: 11, color: "#777" },
  sep: { height: 1, backgroundColor: "#eee", marginLeft: 70 },
});
