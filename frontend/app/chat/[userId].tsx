import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../context/AuthContext";

const API_BASE =
  process.env.EXPO_PUBLIC_BACKEND_URL || "https://backend.cofau.com";

// Convert http/https → ws/wss
const WS_BASE = API_BASE.replace(/^http/, "ws");

export default function ChatScreen() {
  const { user, token } = useAuth();
  const { userId, fullName } = useLocalSearchParams<{
    userId: string;
    fullName?: string;
  }>();
  const router = useRouter();

  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const wsRef = useRef<WebSocket | null>(null);
  const flatListRef = useRef<FlatList<any>>(null);

  const currentUserId = user?.id || (user as any)?._id;

  // 🟢 CONNECT TO BACKEND WEBSOCKET
  useEffect(() => {
    if (!token || !userId) {
      console.log("⚠️ Missing token or userId, not opening WS");
      return;
    }

    // ✅ MUST MATCH: router = APIRouter(prefix="/api/chat") + @router.websocket("/ws/{other_user_id}")
    const wsUrl = `${WS_BASE}/api/chat/ws/${userId}?token=${encodeURIComponent(
      token as string
    )}`;

    console.log("🔗 Connecting WebSocket to:", wsUrl);

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("🟢 WebSocket connected");
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === "history") {
          // Initial history from backend
          setMessages(data.messages || []);
        } else if (data.type === "message") {
          // New live message
          setMessages((prev) => [...prev, data]);
        }

        // Scroll to bottom
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);
      } catch (e) {
        console.log("❌ WS parse error", e);
      }
    };

    ws.onerror = (err) => {
      console.log("❌ WS error", err);
    };

    ws.onclose = (e) => {
      console.log("🔴 WS closed", e?.code, e?.reason);
    };

    return () => {
      console.log("🔌 Cleaning up WS (closing)");
      try {
        ws.close();
      } catch (e) {
        console.log("WS close error", e);
      }
    };
  }, [token, userId]);

  // 🟣 SEND MESSAGE
  const sendMsg = () => {
    const text = input.trim();
    if (!text) return;

    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.log("⚠️ WebSocket not ready, cannot send");
      return;
    }

    wsRef.current.send(JSON.stringify({ message: text }));
    setInput("");
  };

  // 💬 RENDER EACH MESSAGE BUBBLE
  const renderItem = ({ item }: any) => {
    const isMe = item.from_user === currentUserId;

    return (
      <View
        style={[
          styles.bubble,
          isMe ? styles.bubbleRight : styles.bubbleLeft,
        ]}
      >
        <Text style={styles.msg}>{item.message}</Text>

        <Text style={styles.time}>
          {new Date(item.created_at || Date.now()).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </Text>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={90}
    >
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={26} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{fullName || "Chat"}</Text>
      </View>

      {/* CHAT LIST */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item, index) => String(item.id || index)}
        renderItem={renderItem}
        contentContainerStyle={styles.messageList}
      />

      {/* INPUT BOX */}
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder="Type a message…"
          value={input}
          onChangeText={setInput}
        />
        <TouchableOpacity
          style={[
            styles.sendBtn,
            !input.trim() && { opacity: 0.4 },
          ]}
          disabled={!input.trim()}
          onPress={sendMsg}
        >
          <Ionicons name="send" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

// 🎨 STYLES
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderBottomWidth: 1,
    borderColor: "#eee",
  },
  headerTitle: {
    marginLeft: 12,
    fontSize: 18,
    fontWeight: "600",
  },

  messageList: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },

  bubble: {
    maxWidth: "75%",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    marginVertical: 4,
  },
  bubbleLeft: {
    alignSelf: "flex-start",
    backgroundColor: "#f2f2f2",
  },
  bubbleRight: {
    alignSelf: "flex-end",
    backgroundColor: "#4dd0e1",
  },
  msg: { fontSize: 15 },
  time: {
    fontSize: 10,
    marginTop: 4,
    textAlign: "right",
    color: "#555",
  },

  inputRow: {
    flexDirection: "row",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderTopWidth: 1,
    borderColor: "#eee",
    alignItems: "center",
  },
  input: {
    flex: 1,
    backgroundColor: "#f9f9f9",
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 8,
    marginRight: 8,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#4dd0e1",
    alignItems: "center",
    justifyContent: "center",
  },
});

