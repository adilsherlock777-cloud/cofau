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
  Image,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../context/AuthContext";
import axios from "axios";
import { normalizeMediaUrl, normalizeProfilePicture } from "../../utils/imageUrlFix";

const API_BASE = process.env.EXPO_PUBLIC_BACKEND_URL || "https://api.cofau.com";
const API_URL = `${API_BASE}/api`;

// Convert https → wss or http → ws
const WS_BASE = API_BASE.replace(/^https?/, (match) => match === "https" ? "wss" : "ws");

interface Message {
  id: string;
  from_user: string;
  to_user: string;
  message: string;
  post_id?: string | null;
  created_at: string;
}

export default function ChatScreen() {
  const { user, token } = useAuth() as { user: any; token: string | null };
  const { userId, fullName } = useLocalSearchParams();
  const router = useRouter();

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [postData, setPostData] = useState<{ [key: string]: any }>({});
  const [loadingPosts, setLoadingPosts] = useState<{ [key: string]: boolean }>({});
  const wsRef = useRef<WebSocket | null>(null);
  const flatListRef = useRef<FlatList<Message> | null>(null);

  const currentUserId = user?.id || user?._id;

  // Fetch post data when post_id is present
  const fetchPost = async (postId: string) => {
    if (postData[postId] || loadingPosts[postId]) return;
    
    setLoadingPosts((prev) => ({ ...prev, [postId]: true }));
    try {
      const response = await axios.get(`${API_URL}/posts/${postId}`);
      setPostData((prev) => ({ ...prev, [postId]: response.data }));
    } catch (error) {
      console.error("Error fetching post:", error);
    } finally {
      setLoadingPosts((prev) => ({ ...prev, [postId]: false }));
    }
  };

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
          const historyMessages = data.messages || [];
          setMessages(historyMessages);
          // Fetch posts for messages with post_id
          historyMessages.forEach((msg: Message) => {
            if (msg.post_id) {
              fetchPost(msg.post_id);
            }
          });
        } else if (data.type === "message") {
          setMessages((prev) => [...prev, data]);
          // Fetch post if this message has a post_id
          if (data.post_id) {
            fetchPost(data.post_id);
          }
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
    const post = item.post_id ? postData[item.post_id] : null;
    const isLoadingPost = item.post_id ? loadingPosts[item.post_id] : false;

    return (
      <View
        style={[
          styles.bubble,
          isMe ? styles.bubbleRight : styles.bubbleLeft,
        ]}
      >
        <Text style={styles.msg}>{item.message}</Text>
        
        {/* Post Preview */}
        {item.post_id && (
          <TouchableOpacity
            style={styles.postPreview}
            onPress={() => router.push(`/post-details/${item.post_id}`)}
            activeOpacity={0.7}
          >
            {isLoadingPost ? (
              <View style={styles.postLoadingContainer}>
                <ActivityIndicator size="small" color={isMe ? "#fff" : "#666"} />
              </View>
            ) : post ? (
              <>
                <Image
                  source={{ uri: normalizeMediaUrl(post.thumbnail_url || post.media_url || post.image_url) }}
                  style={styles.postImage}
                  resizeMode="cover"
                />
                <View style={styles.postInfo}>
                  <Text style={[styles.postUsername, isMe && styles.postUsernameRight]}>
                    {post.username || "User"}
                  </Text>
                  {post.review_text && (
                    <Text
                      style={[styles.postText, isMe && styles.postTextRight]}
                      numberOfLines={2}
                    >
                      {post.review_text}
                    </Text>
                  )}
                  {post.rating && (
                    <Text style={[styles.postRating, isMe && styles.postRatingRight]}>
                      ⭐ {post.rating}/10
                    </Text>
                  )}
                </View>
              </>
            ) : (
              <View style={styles.postErrorContainer}>
                <Ionicons name="image-outline" size={24} color={isMe ? "#fff" : "#666"} />
                <Text style={[styles.postErrorText, isMe && styles.postErrorTextRight]}>
                  Post unavailable
                </Text>
              </View>
            )}
          </TouchableOpacity>
        )}
        
        <Text style={[styles.time, isMe && styles.timeRight]}>
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
  msg: { fontSize: 15, marginBottom: 4 },
  time: { fontSize: 10, marginTop: 4, color: "#555", textAlign: "right" },
  timeRight: { color: "rgba(255,255,255,0.8)" },
  postPreview: {
    marginTop: 8,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "rgba(0,0,0,0.05)",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.1)",
  },
  postImage: {
    width: "100%",
    height: 200,
    backgroundColor: "#f0f0f0",
  },
  postInfo: {
    padding: 10,
  },
  postUsername: {
    fontSize: 14,
    fontWeight: "600",
    color: "#000",
    marginBottom: 4,
  },
  postUsernameRight: {
    color: "#fff",
  },
  postText: {
    fontSize: 13,
    color: "#666",
    marginBottom: 4,
  },
  postTextRight: {
    color: "rgba(255,255,255,0.9)",
  },
  postRating: {
    fontSize: 12,
    color: "#666",
  },
  postRatingRight: {
    color: "rgba(255,255,255,0.8)",
  },
  postLoadingContainer: {
    padding: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  postErrorContainer: {
    padding: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  postErrorText: {
    marginTop: 8,
    fontSize: 12,
    color: "#666",
  },
  postErrorTextRight: {
    color: "rgba(255,255,255,0.8)",
  },
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
