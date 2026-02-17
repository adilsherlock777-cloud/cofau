import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Image,
  ActivityIndicator,
} from 'react-native';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext'; // ⬅️ ADD THIS
import UserAvatar from '../../components/UserAvatar';
import {
  fetchNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  formatTimeAgo,
} from '../../utils/notifications';

export default function NotificationsScreen() {
  const router = useRouter();
  const { token } = useAuth();
  const { refreshUnreadCount, setUnreadCount } = useNotifications(); // ⬅️ ADD THIS
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadNotifications = async () => {
    try {
      setLoading(true);
      const data = await fetchNotifications(token);
      setNotifications(data);
      
      // ⬅️ Update unread count based on fetched data
      const unreadCount = data.filter((n: any) => !n.isRead).length;
      setUnreadCount(unreadCount);
    } catch (error) {
      console.error('❌ Error loading notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadNotifications();
    setRefreshing(false);
  };

  const handleNotificationPress = async (notification: any) => {
    // Mark as read
    if (!notification.isRead) {
      try {
        await markNotificationAsRead(token, notification.id);
        // Update local state
        setNotifications((prev) =>
          prev.map((n: any) => (n.id === notification.id ? { ...n, isRead: true } : n))
        );
        // Decrement unread count
        setUnreadCount((prev: number) => Math.max(0, prev - 1));
      } catch (error) {
        console.error('❌ Error marking notification as read:', error);
      }
    }

    // Navigate based on notification type
    const type = notification.type;

    // Post-related notifications
    if (type === 'like' || type === 'comment' || type === 'new_post') {
      if (notification.postId) {
        router.push(`/post-details/${notification.postId}`);
      }
    }
    // User-related notifications
    else if (type === 'follow' || type === 'compliment') {
      if (notification.fromUserId) {
        router.push(`/profile?userId=${notification.fromUserId}`);
      }
    }
    // Story-related notifications
    else if (type === 'story_like') {
      // Route to the user's profile who posted the story
      if (notification.fromUserId) {
        router.push(`/profile?userId=${notification.fromUserId}`);
      }
    }
    // Message notifications
    else if (type === 'message') {
      if (notification.fromUserId) {
        router.push(`/chat?userId=${notification.fromUserId}`);
      } else {
        router.push('/chat');
      }
    }
    // Wallet and reward notifications
    else if (type === 'wallet_reward' || type === 'delivery_completed_reward' || type === 'reward_earned') {
      // Route to the leaderboard screen which shows Delivery/Rewards
      router.push('/(tabs)/leaderboard');
    }
    // Order notifications for customers
    else if (type === 'order_preparing' || type === 'order_in_progress' || type === 'order_completed') {
      // Route to leaderboard which shows orders/delivery for customers
      router.push('/(tabs)/leaderboard');
    }
    // Order notifications for restaurants
    else if (type === 'new_order') {
      // Route to leaderboard which shows orders for restaurants
      router.push('/(tabs)/leaderboard');
    }
    // Fallback: if no specific route, go to feed
    else {
      console.log(`⚠️ Unhandled notification type: ${type}`);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await markAllNotificationsAsRead(token);
      // Update local state
      setNotifications((prev) => prev.map((n: any) => ({ ...n, isRead: true })));
      // ⬅️ Reset unread count to 0
      setUnreadCount(0);
    } catch (error) {
      console.error('❌ Error marking all as read:', error);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, []);

  // Reload notifications when screen is focused
  useFocusEffect(
    React.useCallback(() => {
      loadNotifications();
    }, [])
  );

const renderNotification = ({ item }: { item: any }) => {
  const isUnread = !item.isRead;

  // Get the action text without the username
  const getActionText = () => {
    if (!item.message) return '';
    return item.message.replace(item.fromUserName, '').trim();
  };

  const isRewardNotification = item.type === 'wallet_reward' || item.type === 'delivery_completed_reward' || item.type === 'reward_earned';

  return (
    <TouchableOpacity
      style={[styles.notificationItem, isUnread && styles.unreadNotification]}
      onPress={() => handleNotificationPress(item)}
    >
      <UserAvatar
        profilePicture={item.fromUserProfilePicture}
        username={item.fromUserName}
        size={42}
        level={item.fromUserLevel}
        showLevelBadge={true}
      />

      <View style={styles.notificationContent}>
        <Text style={[styles.notificationText, isUnread && styles.unreadText]}>
          <Text style={styles.username}>{item.fromUserName}</Text>
          {` ${getActionText()}`}
        </Text>
        <Text style={styles.timeAgo}>{formatTimeAgo(item.createdAt)}</Text>
      </View>

      {/* Right side: Amazon icon for reward notifications, post thumbnail for others */}
      {isRewardNotification ? (
        <View style={styles.amazonThumbnail}>
          <FontAwesome5 name="amazon" size={22} color="#FF9800" />
        </View>
      ) : item.postThumbnail ? (
        <Image
          source={{ uri: item.postThumbnail }}
          style={styles.postThumbnail}
          resizeMode="cover"
        />
      ) : isUnread ? (
        <View style={styles.unreadDot} />
      ) : null}
    </TouchableOpacity>
  );
};

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4dd0e1" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        <TouchableOpacity onPress={handleMarkAllAsRead} style={styles.markAllButton}>
          <Ionicons name="checkmark-done" size={24} color="#1B7C82" />
        </TouchableOpacity>
      </View>

      {/* Notifications List */}
      <FlatList
        data={notifications}
        renderItem={renderNotification}
        keyExtractor={(item: any) => item.id}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#1B7C82" />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="notifications-off-outline" size={80} color="#CCC" />
            <Text style={styles.emptyText}>No notifications yet</Text>
            <Text style={styles.emptySubtext}>When someone interacts with your posts, you'll see it here</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  paddingHorizontal: 16,
  paddingTop: 50,      // ⬅️ ADD THIS (adjust value: 40-60 depending on your device)
  paddingBottom: 12,   // ⬅️ CHANGE paddingVertical to paddingBottom
  backgroundColor: '#FFF',
  borderBottomWidth: 1,
  borderBottomColor: '#E0E0E0',
},
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  markAllButton: {
    padding: 8,
  },
  listContainer: {
    paddingVertical: 8,
  },
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  unreadNotification: {
    backgroundColor: '#E3F2FD',
  },
  amazonThumbnail: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#FFF3E0',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  notificationContent: {
    flex: 1,
    marginLeft: 12,
  },
  notificationText: {
    fontSize: 14,
    color: '#555',
    lineHeight: 20,
  },
  unreadText: {
    fontWeight: '600',
    color: '#333',
  },
  username: {
    fontWeight: 'bold',
    color: '#333',
  },
  timeAgo: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  postThumbnail: {
    width: 50,
    height: 50,
    borderRadius: 8,
    marginLeft: 12,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#1B7C82',
    marginLeft: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 100,
  },

  postThumbnail: {
  width: 44,
  height: 44,
  borderRadius: 8,
  marginLeft: 12,
  backgroundColor: '#E0E0E0',  // Placeholder color while loading
},
unreadDot: {
  width: 8,
  height: 8,
  borderRadius: 4,
  backgroundColor: '#4dd0e1',
  marginLeft: 8,
},
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#999',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#BBB',
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
});