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
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../context/AuthContext";
import UserAvatar from "../../components/UserAvatar";
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
  const { userId, fullName, profilePicture } = useLocalSearchParams();
  const router = useRouter();

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [postData, setPostData] = useState<{ [key: string]: any }>({});
  const [loadingPosts, setLoadingPosts] = useState<{ [key: string]: boolean }>({});
  const [showMenu, setShowMenu] = useState(false);
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
          historyMessages.forEach((msg: Message) => {
            if (msg.post_id) {
              fetchPost(msg.post_id);
            }
          });
        } else if (data.type === "message") {
          setMessages((prev) => [...prev, data]);
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
    };

    ws.onclose = (event) => {
      console.log("🔴 WS closed", {
        code: event.code,
        reason: event.reason,
        wasClean: event.wasClean
      });
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

    if (readyState === WebSocket.CONNECTING) {
      console.log("⏳ WebSocket still connecting, waiting...");
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
      console.log(`❌ WebSocket not ready. State: ${readyState}`);
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
          styles.messageRow,
          isMe ? styles.messageRowRight : styles.messageRowLeft,
        ]}
      >
        {/* Profile Picture - Show for other user's messages */}
        {!isMe && (
          <View style={styles.avatarContainer}>
            <UserAvatar
              profilePicture={profilePicture as string}
              username={fullName as string}
              size={32}
            />
          </View>
        )}

        <View
          style={[
            styles.bubble,
            isMe ? styles.bubbleRight : styles.bubbleLeft,
          ]}
        >
          <Text style={[styles.msg, isMe && styles.msgRight]}>{item.message}</Text>
          
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

        {/* Profile Picture - Show for my messages */}
        {isMe && (
          <View style={styles.avatarContainer}>
            <UserAvatar
              profilePicture={user?.profile_picture}
              username={user?.username}
              size={32}
            />
          </View>
        )}
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={90}
    >
      {/* Cofau Gradient Header */}
      <LinearGradient
        colors={["#E94A37", "#F2CF68", "#1B7C82"]}
        locations={[0, 0.5, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <TouchableOpacity 
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Chat</Text>
          <View style={styles.headerSpacer} />
        </View>
      </LinearGradient>

      {/* User Info Header - Below Gradient */}
      <View style={styles.userInfoHeader}>
        <View style={styles.userInfoContent}>
          <UserAvatar
            profilePicture={profilePicture as string}
            username={fullName as string}
            size={44}
          />
          <View style={styles.userTextInfo}>
            <Text style={styles.userName}>{fullName || "User"}</Text>
            <Text style={styles.userStatus}>Tap here for info</Text>
          </View>
        </View>
        
        <TouchableOpacity 
          style={styles.menuButton}
          onPress={() => setShowMenu(!showMenu)}
        >
          <Ionicons name="ellipsis-vertical" size={20} color="#666" />
        </TouchableOpacity>

        {/* Dropdown Menu */}
        {showMenu && (
          <View style={styles.dropdownMenu}>
            <TouchableOpacity style={styles.menuItem}>
              <Ionicons name="person-outline" size={18} color="#333" />
              <Text style={styles.menuText}>View Profile</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem}>
              <Ionicons name="notifications-off-outline" size={18} color="#333" />
              <Text style={styles.menuText}>Mute</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem}>
              <Ionicons name="trash-outline" size={18} color="#FF3B30" />
              <Text style={[styles.menuText, { color: "#FF3B30" }]}>Clear Chat</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item, index) => String(item.id || index)}
        renderItem={renderItem}
        contentContainerStyle={styles.messageList}
      />

      <View style={styles.inputContainer}>
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder="Type a message…"
            placeholderTextColor="#999"
            value={input}
            onChangeText={setInput}
            multiline
            maxLength={500}
          />
          
          <TouchableOpacity
            style={[
              styles.sendBtn,
              !input.trim() && styles.sendBtnDisabled,
            ]}
            disabled={!input.trim()}
            onPress={sendMsg}
          >
            <Ionicons name="send" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: "#F8F9FA" 
  },
  header: {
    paddingTop: Platform.OS === "ios" ? 60 : 50,
    paddingBottom: 12,
    paddingHorizontal: 16,
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
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { 
    flex: 1,
    marginLeft: 12,
    fontSize: 20, 
    fontWeight: "700",
    color: "#fff",
    textShadowColor: "rgba(0, 0, 0, 0.15)",
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 3,
  },
  headerSpacer: {
    width: 40,
  },
  // User Info Header Styles
  userInfoHeader: {
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E8E8E8",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    position: "relative",
  },
  userInfoContent: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  userTextInfo: {
    marginLeft: 12,
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000",
    marginBottom: 2,
  },
  userStatus: {
    fontSize: 13,
    color: "#8E8E93",
  },
  menuButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F2F2F7",
    alignItems: "center",
    justifyContent: "center",
  },
  dropdownMenu: {
    position: "absolute",
    top: 60,
    right: 16,
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingVertical: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
    minWidth: 180,
    zIndex: 1000,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  menuText: {
    marginLeft: 12,
    fontSize: 15,
    color: "#333",
  },
  // Message List Styles
  messageList: { 
    paddingHorizontal: 16, 
    paddingVertical: 12,
    flexGrow: 1,
  },
  messageRow: {
    flexDirection: "row",
    marginVertical: 4,
    alignItems: "flex-end",
  },
  messageRowLeft: {
    justifyContent: "flex-start",
  },
  messageRowRight: {
    justifyContent: "flex-end",
  },
  avatarContainer: {
    marginHorizontal: 8,
  },
  bubble: { 
    maxWidth: "70%", 
    padding: 12, 
    borderRadius: 20, 
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  bubbleLeft: { 
    backgroundColor: "#fff",
    borderBottomLeftRadius: 4,
  },
  bubbleRight: { 
    backgroundColor: "#4DD0E1",
    borderBottomRightRadius: 4,
  },
  msg: { 
    fontSize: 15, 
    color: "#000",
    lineHeight: 20,
  },
  msgRight: {
    color: "#fff",
  },
  time: { 
    fontSize: 11, 
    marginTop: 4, 
    color: "#999",
  },
  timeRight: { 
    color: "rgba(255,255,255,0.7)" 
  },
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
    height: 180,
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
  inputContainer: {
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#E5E5EA",
    paddingBottom: Platform.OS === "ios" ? 20 : 10,
  },
  inputRow: {
    flexDirection: "row",
    padding: 10,
    alignItems: "flex-end",
  },
  input: {
    flex: 1,
    backgroundColor: "#F2F2F7",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 8,
    fontSize: 16,
    maxHeight: 100,
    color: "#000",
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#4DD0E1",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#4DD0E1",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  sendBtnDisabled: {
    opacity: 0.4,
    shadowOpacity: 0,
    elevation: 0,
  },
});
