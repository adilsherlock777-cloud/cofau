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

const API_BASE = process.env.EXPO_PUBLIC_BACKEND_URL || "https://backend.cofau.com";

// Convert https → wss
const WS_BASE = API_BASE.replace(/^http/, "ws");

interface Message {
  id: string;
  from_user: string;
  to_user: string;
  message: string;
  created_at: string;
}

export default function ChatScreen() {
  const { user, token } = useAuth() as { user: any; token: string | null };
  const { userId, fullName } = useLocalSearchParams();
  const router = useRouter();

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const wsRef = useRef<WebSocket | null>(null);
  const flatListRef = useRef<FlatList<Message> | null>(null);

  const currentUserId = user?.id || user?._id;

  useEffect(() => {
    if (!token || !userId) return;

    // ✅ THIS IS THE REAL WORKING ROUTE
    const wsUrl = `${WS_BASE}/api/chat/ws/${userId}?token=${encodeURIComponent(token)}`;

    console.log("🔗 Connecting WebSocket:", wsUrl);

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("🟢 WebSocket Connected");
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === "history") {
          setMessages(data.messages || []);
        } else if (data.type === "message") {
          setMessages((prev) => [...prev, data]);
        }

        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 80);
      } catch (e) {
        console.log("❌ WS parse error:", e);
      }
    };

    ws.onerror = (err) => {
      console.log("❌ WS error:", err);
      // The error event doesn't provide much detail, but we'll handle it in onclose
    };

    ws.onclose = (event) => {
      console.log("🔴 WS closed", {
        code: event.code,
        reason: event.reason,
        wasClean: event.wasClean
      });
      
      // Common WebSocket close codes:
      // 1000 = Normal closure
      // 1001 = Going away
      // 1006 = Abnormal closure (connection lost)
      // 1008 = Policy violation (auth error)
      // 1011 = Internal server error
      
      if (event.code === 1008) {
        console.log("❌ Authentication failed - token may be invalid");
      } else if (event.code === 1006) {
        console.log("❌ Connection lost - check nginx WebSocket configuration");
      } else if (event.code !== 1000 && event.code !== 1001) {
        console.log("🔄 Connection closed unexpectedly, code:", event.code);
      }
    };

    return () => {
      console.log("🔌 Cleaning WebSocket");
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
    };
  }, [token, userId]);

  const sendMsg = async () => {
    const text = input.trim();
    if (!text) return;

    if (!wsRef.current) {
      console.log("❌ WebSocket not initialized");
      return;
    }

    const readyState = wsRef.current.readyState;
    
    // Wait a bit if still connecting
    if (readyState === WebSocket.CONNECTING) {
      console.log("⏳ WebSocket still connecting, waiting...");
      // Wait up to 3 seconds for connection
      let attempts = 0;
      while (wsRef.current.readyState === WebSocket.CONNECTING && attempts < 30) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
      }
      
      if (wsRef.current.readyState !== WebSocket.OPEN) {
        console.log(`❌ WebSocket failed to connect. State: ${wsRef.current.readyState}`);
        return;
      }
    }
    
    if (readyState === WebSocket.CLOSED || readyState === WebSocket.CLOSING) {
      console.log(`❌ WebSocket is closed. State: ${readyState}`);
      return;
    }
    
    if (readyState !== WebSocket.OPEN) {
      console.log(`❌ WebSocket not ready. State: ${readyState} (0=CONNECTING, 1=OPEN, 2=CLOSING, 3=CLOSED)`);
      return;
    }

    try {
      wsRef.current.send(JSON.stringify({ message: text }));
      console.log("📤 Message sent:", text);
      setInput("");
    } catch (error) {
      console.log("❌ Error sending message:", error);
    }
  };

  const renderItem = ({ item }: { item: Message }) => {
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
          {new Date(item.created_at).toLocaleTimeString([], {
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
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={26} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{fullName || "Chat"}</Text>
      </View>

      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item, index) => String(item.id || index)}
        renderItem={renderItem}
        contentContainerStyle={styles.messageList}
      />

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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderBottomWidth: 1,
    borderColor: "#eee",
  },
  headerTitle: { marginLeft: 12, fontSize: 18, fontWeight: "600" },
  messageList: { paddingHorizontal: 12, paddingVertical: 8 },
  bubble: { maxWidth: "75%", padding: 10, borderRadius: 15, marginVertical: 4 },
  bubbleLeft: { alignSelf: "flex-start", backgroundColor: "#f2f2f2" },
  bubbleRight: { alignSelf: "flex-end", backgroundColor: "#4dd0e1" },
  msg: { fontSize: 15 },
  time: { fontSize: 10, marginTop: 4, color: "#555", textAlign: "right" },
  inputRow: {
    flexDirection: "row",
    padding: 10,
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
