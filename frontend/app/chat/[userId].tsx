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
  Alert,
  Modal,
  TouchableWithoutFeedback,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../context/AuthContext";
import UserAvatar from "../../components/UserAvatar";
import axios from "axios";
import { normalizeMediaUrl, normalizeProfilePicture } from "../../utils/imageUrlFix";
import { likePost } from "../../utils/api";

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
  story_id?: string | null;
  story_data?: {
    media_url: string;
    media_type: string;
    story_owner_id: string;
    story_owner_username: string;
    story_owner_profile_picture?: string;
  } | null;
  created_at: string;
}

export default function ChatScreen() {
  const { user, token } = useAuth() as { user: any; token: string | null };
  const { userId, fullName, profilePicture, autoSendOrderCard, orderDetails } = useLocalSearchParams();
  const router = useRouter();

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [postData, setPostData] = useState<{ [key: string]: any }>({});
  const [loadingPosts, setLoadingPosts] = useState<{ [key: string]: boolean }>({});
  const [showMenu, setShowMenu] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [isBlocking, setIsBlocking] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const flatListRef = useRef<FlatList<Message> | null>(null);

  const currentUserId = user?.id || user?._id;
  const otherUserId = userId as string;
  const [hasAutoSent, setHasAutoSent] = useState(false);

 // Check if user is blocked on mount and mark messages as read
useEffect(() => {
  checkBlockStatus();
  checkMuteStatus();
  markMessagesAsRead();
}, []);

const markMessagesAsRead = async () => {
  if (!token || !otherUserId) return;
  try {
    await axios.post(
      `${API_URL}/chat/mark-read/${otherUserId}`,
      {},
      { headers: { Authorization: `Bearer ${token}` } }
    );
  } catch (error) {
  }
};

  const checkBlockStatus = async () => {
    try {
      const response = await axios.get(`${API_URL}/chat/is-blocked/${otherUserId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setIsBlocked(response.data.i_blocked_them);
    } catch (error) {
      console.error("Error checking block status:", error);
    }
  };

  const checkMuteStatus = async () => {
    try {
      const response = await axios.get(`${API_URL}/chat/is-muted/${otherUserId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setIsMuted(response.data.is_muted);
    } catch (error) {
      // Mute endpoint might not exist yet, default to false
      setIsMuted(false);
    }
  };

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

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
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
      }
    };

    ws.onerror = (err) => {
    };

    ws.onclose = (event) => {
    };

    return () => {
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
    };
  }, [token, userId]);

  // Auto-send order review card when coming from leaderboard
  useEffect(() => {
    if (autoSendOrderCard === "true" && orderDetails && !hasAutoSent && wsRef.current) {
      const sendOrderCard = async () => {
        // Wait for WebSocket to be ready
        let attempts = 0;
        while (wsRef.current?.readyState === WebSocket.CONNECTING && attempts < 50) {
          await new Promise(resolve => setTimeout(resolve, 100));
          attempts++;
        }

        if (wsRef.current?.readyState === WebSocket.OPEN) {
          try {
            const parsedOrderDetails = orderDetails ? JSON.parse(orderDetails as string) : null;

            if (!parsedOrderDetails) return;

            // Format the order details message as a card-like text
            const orderId = parsedOrderDetails.order_id
              ? `Order #${parsedOrderDetails.order_id.slice(0, 8)}`
              : "Order";
            const date = parsedOrderDetails.created_at
              ? new Date(parsedOrderDetails.created_at).toLocaleDateString()
              : "";

            let messageText = "";
            if (parsedOrderDetails.is_complaint) {
              messageText = `📢 Regarding Your Complaint\n\n`;
              messageText += `${orderId}${date ? ` • ${date}` : ""}\n`;
              messageText += `Dish: ${parsedOrderDetails.dish_name}\n`;
              messageText += `Rating: ${parsedOrderDetails.rating}⭐\n\n`;
              messageText += `"${parsedOrderDetails.review_text}"\n\n`;
              messageText += `I'd like to discuss your complaint and resolve this issue. How can I help?`;
            } else {
              messageText = `✨ Thank You for Your Review!\n\n`;
              messageText += `${orderId}${date ? ` • ${date}` : ""}\n`;
              messageText += `Dish: ${parsedOrderDetails.dish_name}\n`;
              messageText += `Rating: ${parsedOrderDetails.rating}⭐\n\n`;
              messageText += `"${parsedOrderDetails.review_text}"\n\n`;
              messageText += `We appreciate your feedback! Is there anything else we can help you with?`;
            }

            // Send the formatted message
            wsRef.current.send(JSON.stringify({
              message: messageText
            }));

            setHasAutoSent(true);
          } catch (error) {
            console.error("❌ Error auto-sending order card:", error);
          }
        }
      };

      sendOrderCard();
    }
  }, [autoSendOrderCard, hasAutoSent, orderDetails, wsRef.current?.readyState]);

  const sendMsg = async () => {
    const text = input.trim();
    if (!text) return;

    if (isBlocked) {
      Alert.alert("Blocked", "You have blocked this user. Unblock them to send messages.");
      return;
    }

    if (!wsRef.current) {
      return;
    }

    const readyState = wsRef.current.readyState;

    if (readyState === WebSocket.CONNECTING) {
      let attempts = 0;
      while (wsRef.current.readyState === WebSocket.CONNECTING && attempts < 30) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
      }

      if (wsRef.current.readyState !== WebSocket.OPEN) {
        return;
      }
    }

    if (readyState === WebSocket.CLOSED || readyState === WebSocket.CLOSING) {
      return;
    }

    if (readyState !== WebSocket.OPEN) {
      return;
    }

    try {
      wsRef.current.send(JSON.stringify({ message: text }));
      setInput("");
    } catch (error) {
    }
  };

  // =============================================
  // MENU ACTION HANDLERS
  // =============================================

  const handleViewProfile = () => {
    setShowMenu(false);
    router.push(`/profile?userId=${otherUserId}`);
  };

  const handleToggleMute = async () => {
    setShowMenu(false);
    
    try {
      if (isMuted) {
        await axios.delete(`${API_URL}/chat/unmute/${otherUserId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setIsMuted(false);
        Alert.alert("Unmuted", `You will now receive notifications from ${fullName}`);
      } else {
        await axios.post(`${API_URL}/chat/mute/${otherUserId}`, {}, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setIsMuted(true);
        Alert.alert("Muted", `You will no longer receive notifications from ${fullName}`);
      }
    } catch (error) {
      console.error("Error toggling mute:", error);
      Alert.alert("Error", "Failed to update mute settings");
    }
  };

  const handleClearChat = () => {
    setShowMenu(false);
    
    Alert.alert(
      "Clear Chat",
      "Are you sure you want to delete all messages? This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: async () => {
            setIsClearing(true);
            try {
              await axios.delete(`${API_URL}/chat/clear/${otherUserId}`, {
                headers: { Authorization: `Bearer ${token}` },
              });
              setMessages([]);
              Alert.alert("Success", "Chat cleared successfully");
            } catch (error) {
              console.error("Error clearing chat:", error);
              Alert.alert("Error", "Failed to clear chat");
            } finally {
              setIsClearing(false);
            }
          },
        },
      ]
    );
  };

  const handleBlockUser = () => {
    setShowMenu(false);
    
    if (isBlocked) {
      // Unblock user
      Alert.alert(
        "Unblock User",
        `Are you sure you want to unblock ${fullName}?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Unblock",
            onPress: async () => {
              setIsBlocking(true);
              try {
                await axios.delete(`${API_URL}/chat/unblock/${otherUserId}`, {
                  headers: { Authorization: `Bearer ${token}` },
                });
                setIsBlocked(false);
                Alert.alert("Unblocked", `${fullName} has been unblocked`);
              } catch (error) {
                console.error("Error unblocking user:", error);
                Alert.alert("Error", "Failed to unblock user");
              } finally {
                setIsBlocking(false);
              }
            },
          },
        ]
      );
    } else {
      // Block user
      Alert.alert(
        "Block User",
        `Are you sure you want to block ${fullName}? They won't be able to message you.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Block",
            style: "destructive",
            onPress: async () => {
              setIsBlocking(true);
              try {
                await axios.post(`${API_URL}/chat/block/${otherUserId}`, {}, {
                  headers: { Authorization: `Bearer ${token}` },
                });
                setIsBlocked(true);
                Alert.alert("Blocked", `${fullName} has been blocked`);
              } catch (error) {
                console.error("Error blocking user:", error);
                Alert.alert("Error", "Failed to block user");
              } finally {
                setIsBlocking(false);
              }
            },
          },
        ]
      );
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
          <Text style={[styles.msg, isMe && styles.msgRight]}>
            {item.post_id ? "Hey, Look out this Dish 🍽" : item.message}
          </Text>

          {/* Post Preview */}
          {item.post_id && (
            <TouchableOpacity
              style={styles.postPreview}
              onPress={() => router.push(`/post-details/${item.post_id}`)}
              activeOpacity={0.8}
            >
              {isLoadingPost ? (
                <View style={styles.postLoadingContainer}>
                  <ActivityIndicator size="small" color="#E94A37" />
                </View>
              ) : post ? (
                <View style={styles.postCard}>
                  {/* Post Image with gradient overlay */}
                  <View style={styles.postImageWrapper}>
                    <Image
                      source={{ uri: normalizeMediaUrl(post.thumbnail_url || post.media_url || post.image_url) }}
                      style={styles.postImage}
                      resizeMode="cover"
                    />
                    <LinearGradient
                      colors={["transparent", "rgba(0,0,0,0.6)"]}
                      style={styles.postImageOverlay}
                    />
                    {/* Rating badge on image */}
                    {post.rating > 0 && (
                      <View style={styles.postRatingBadge}>
                        <Text style={styles.postRatingBadgeText}>⭐ {post.rating}/10</Text>
                      </View>
                    )}
                    {/* Category badge */}
                    {post.category && (
                      <View style={styles.postCategoryBadge}>
                        <Text style={styles.postCategoryText}>{post.category}</Text>
                      </View>
                    )}
                  </View>
                  {/* Post Info */}
                  <View style={styles.postInfo}>
                    <View style={styles.postInfoHeader}>
                      {post.user_profile_picture || post.restaurant_profile_picture ? (
                        <Image
                          source={{ uri: normalizeMediaUrl(post.user_profile_picture || post.restaurant_profile_picture) }}
                          style={styles.postAuthorAvatar}
                        />
                      ) : (
                        <View style={styles.postAuthorAvatarPlaceholder}>
                          <Text style={styles.postAuthorAvatarText}>
                            {(post.username || "U")[0].toUpperCase()}
                          </Text>
                        </View>
                      )}
                      <View style={styles.postAuthorInfo}>
                        <Text style={styles.postUsername} numberOfLines={1}>
                          {post.username || "User"}
                        </Text>
                        {(post.dish_name || post.location_name) && (
                          <Text style={styles.postLocation} numberOfLines={1}>
                            {post.dish_name ? `🍽 ${post.dish_name}` : ""}
                            {post.dish_name && post.location_name ? " · " : ""}
                            {post.location_name ? `📍 ${post.location_name}` : ""}
                          </Text>
                        )}
                      </View>
                    </View>
                    {post.review_text && (
                      <Text style={styles.postText} numberOfLines={2}>
                        {post.review_text}
                      </Text>
                    )}
                    {/* Action buttons */}
                    <View style={styles.postActions}>
                      <TouchableOpacity
                        style={styles.postActionBtn}
                        activeOpacity={0.7}
                        onPress={async (e) => {
                          e.stopPropagation?.();
                          const postId = item.post_id!;
                          const currentPost = postData[postId];
                          if (!currentPost) return;
                          const prevCount = currentPost.likes_count || 0;
                          // Optimistic update
                          setPostData((prev) => ({
                            ...prev,
                            [postId]: {
                              ...prev[postId],
                              likes_count: prevCount + 1,
                            },
                          }));
                          try {
                            await likePost(postId, currentPost.account_type);
                          } catch {
                            // Revert on error
                            setPostData((prev) => ({
                              ...prev,
                              [postId]: {
                                ...prev[postId],
                                likes_count: prevCount,
                              },
                            }));
                          }
                        }}
                      >
                        <Ionicons
                          name={post.is_liked_by_user ? "heart" : "heart-outline"}
                          size={18}
                          color={post.is_liked_by_user ? "#E94A37" : "#666"}
                        />
                        <Text style={[styles.postActionText, post.is_liked_by_user && { color: "#E94A37" }]}>
                          {post.likes_count || 0}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.postActionBtn}
                        activeOpacity={0.7}
                        onPress={(e) => {
                          e.stopPropagation?.();
                          router.push(`/post-details/${item.post_id}`);
                        }}
                      >
                        <Ionicons name="chatbubble-outline" size={16} color="#666" />
                        <Text style={styles.postActionText}>{post.comments_count || 0}</Text>
                      </TouchableOpacity>
                      <View style={styles.postViewLink}>
                        <Text style={styles.postViewLinkText}>View Post</Text>
                        <Ionicons name="chevron-forward" size={12} color="#E94A37" />
                      </View>
                    </View>
                  </View>
                </View>
              ) : (
                <View style={styles.postErrorContainer}>
                  <Ionicons name="image-outline" size={24} color="#999" />
                  <Text style={styles.postErrorText}>
                    Post unavailable
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          )}

          {/* Story Reply Preview */}
          {item.story_data && (
            <View style={styles.storyReplyPreview}>
              <Image
                source={{ uri: normalizeMediaUrl(item.story_data.media_url) }}
                style={styles.storyReplyImage}
                resizeMode="cover"
              />
              <View style={styles.storyReplyOverlay}>
                <Text style={[styles.storyReplyLabel, isMe && styles.storyReplyLabelRight]}>
                  Replied to {item.story_data.story_owner_username}'s story
                </Text>
              </View>
            </View>
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
  style={{ flex: 1 }}
  behavior={Platform.OS === "ios" ? "padding" : "height"}
  keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
>

      {/* Cofau Gradient Header */}
      <LinearGradient
        colors={["#FFF5F0", "#FFE5D9"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <TouchableOpacity 
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Chat</Text>
          <View style={styles.headerSpacer} />
        </View>
      </LinearGradient>

      {/* User Info Header - Below Gradient */}
      <TouchableOpacity 
        style={styles.userInfoHeader}
        onPress={handleViewProfile}
        activeOpacity={0.7}
      >
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
            <TouchableOpacity style={styles.menuItem} onPress={handleViewProfile}>
              <Ionicons name="person-outline" size={18} color="#333" />
              <Text style={styles.menuText}>View Profile</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.menuItem} onPress={handleToggleMute}>
              <Ionicons 
                name={isMuted ? "notifications-outline" : "notifications-off-outline"} 
                size={18} 
                color="#333" 
              />
              <Text style={styles.menuText}>{isMuted ? "Unmute" : "Mute"}</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.menuItem} onPress={handleClearChat}>
              <Ionicons name="trash-outline" size={18} color="#FF3B30" />
              <Text style={[styles.menuText, { color: "#FF3B30" }]}>Clear Chat</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.menuItem} onPress={handleBlockUser}>
              <Ionicons 
                name={isBlocked ? "lock-open-outline" : "ban-outline"} 
                size={18} 
                color={isBlocked ? "#333" : "#FF3B30"} 
              />
              <Text style={[styles.menuText, !isBlocked && { color: "#FF3B30" }]}>
                {isBlocked ? "Unblock User" : "Block User"}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </TouchableOpacity>

      {/* Close menu when tapping outside */}
      {showMenu && (
        <TouchableWithoutFeedback onPress={() => setShowMenu(false)}>
          <View style={styles.menuOverlay} />
        </TouchableWithoutFeedback>
      )}

      {/* Blocked Banner */}
      {isBlocked && (
        <View style={styles.blockedBanner}>
          <Ionicons name="ban-outline" size={16} color="#FF3B30" />
          <Text style={styles.blockedText}>You have blocked this user</Text>
          <TouchableOpacity onPress={handleBlockUser}>
            <Text style={styles.unblockText}>Unblock</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Loading indicator for clearing */}
      {isClearing && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#1B7C82" />
          <Text style={styles.loadingText}>Clearing chat...</Text>
        </View>
      )}

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
            placeholder={isBlocked ? "You blocked this user" : "Type a message…"}
            placeholderTextColor="#999"
            value={input}
            onChangeText={setInput}
            multiline
            maxLength={500}
            editable={!isBlocked}
          />
          
          <TouchableOpacity
            style={[
              styles.sendBtn,
              (!input.trim() || isBlocked) && styles.sendBtnDisabled,
            ]}
            disabled={!input.trim() || isBlocked}
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
    backgroundColor: "rgba(255, 255, 255, 0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    flex: 1,
    marginLeft: 12,
    fontSize: 20,
    fontWeight: "700",
    color: "#333",
    textShadowColor: "rgba(255, 255, 255, 0.5)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
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
    zIndex: 1001,
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
    zIndex: 1002,
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
  menuOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
  },
  // Blocked Banner
  blockedBanner: {
    backgroundColor: "#FFF5F5",
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#FFE0E0",
  },
  blockedText: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    color: "#FF3B30",
  },
  unblockText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#007AFF",
  },
  // Loading Overlay
  loadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(255,255,255,0.9)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 2000,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: "#666",
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
    maxWidth: "75%", 
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
    backgroundColor: "#FFE0D6",
    borderBottomRightRadius: 4,
  },
  msg: { 
    fontSize: 15, 
    color: "#000",
    lineHeight: 20,
  },
  msgRight: {
    color: "#333",
  },
  storyReplyPreview: {
    marginTop: 8,
    marginBottom: 4,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.1)',
    width: 180,  // Fixed width for better appearance
  },
  storyReplyImage: {
    width: '100%',
    height: 220,
    backgroundColor: '#f0f0f0',
  },
  storyReplyOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  storyReplyLabel: {
    fontSize: 11,
    color: '#fff',
    fontStyle: 'italic',
  },
  storyReplyLabelRight: {
    color: '#fff',
  },
  time: { 
    fontSize: 11, 
    marginTop: 4, 
    color: "#999",
  },
  timeRight: {
    color: "#999"
  },
  postPreview: {
    marginTop: 8,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  postCard: {
    borderRadius: 16,
    overflow: "hidden",
  },
  postImageWrapper: {
    position: "relative",
  },
  postImage: {
    width: "100%",
    height: 160,
    backgroundColor: "#f0f0f0",
  },
  postImageOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 60,
  },
  postRatingBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "rgba(0,0,0,0.65)",
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  postRatingBadgeText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
  },
  postCategoryBadge: {
    position: "absolute",
    top: 8,
    left: 8,
    backgroundColor: "rgba(233,74,55,0.85)",
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  postCategoryText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "600",
    textTransform: "capitalize",
  },
  postInfo: {
    padding: 10,
  },
  postInfoHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  postAuthorAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginRight: 8,
    borderWidth: 1,
    borderColor: "#eee",
  },
  postAuthorAvatarPlaceholder: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginRight: 8,
    backgroundColor: "#E94A37",
    alignItems: "center",
    justifyContent: "center",
  },
  postAuthorAvatarText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
  postAuthorInfo: {
    flex: 1,
  },
  postUsername: {
    fontSize: 13,
    fontWeight: "700",
    color: "#222",
  },
  postLocation: {
    fontSize: 11,
    color: "#888",
    marginTop: 1,
  },
  postText: {
    fontSize: 12,
    color: "#555",
    lineHeight: 17,
    marginBottom: 8,
  },
  postActions: {
    flexDirection: "row",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
    paddingTop: 8,
  },
  postActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 16,
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  postActionText: {
    fontSize: 12,
    color: "#666",
    fontWeight: "600",
  },
  postViewLink: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: "auto",
    gap: 2,
  },
  postViewLinkText: {
    fontSize: 11,
    color: "#E94A37",
    fontWeight: "600",
  },
  postLoadingContainer: {
    padding: 30,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fafafa",
  },
  postErrorContainer: {
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fafafa",
  },
  postErrorText: {
    marginTop: 8,
    fontSize: 12,
    color: "#999",
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
    backgroundColor: "#E94A37",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#E94A37",
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