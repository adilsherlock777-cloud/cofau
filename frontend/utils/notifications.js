import axios from 'axios';
import Constants from 'expo-constants';

const API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || 'https://api.cofau.com/api';

/**
 * Fetch all notifications for the current user
 */
export const fetchNotifications = async (token, limit = 50, skip = 0) => {
  try {
    const response = await axios.get(`${API_URL}/notifications`, {
      headers: { Authorization: `Bearer ${token}` },
      params: { limit, skip },
    });
    return response.data;
  } catch (error) {
    console.error('❌ Error fetching notifications:', error.response?.data || error.message);
    throw error;
  }
};

/**
 * Get unread notification count
 */
// In your utils/notifications.js file
export const fetchUnreadCount = async (token) => {
  try {
    const response = await axios.get(`${BACKEND_URL}/api/notifications/unread-count`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data.unread_count || 0;
  } catch (error) {
    console.error('Error fetching unread count:', error);
    return 0;
  }
};

/**
 * Mark a specific notification as read
 */
export const markNotificationAsRead = async (token, notificationId) => {
  try {
    const response = await axios.post(
      `${API_URL}/notifications/${notificationId}/mark-read`,
      {},
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    return response.data;
  } catch (error) {
    console.error('❌ Error marking notification as read:', error.response?.data || error.message);
    throw error;
  }
};

/**
 * Mark all notifications as read
 */
export const markAllNotificationsAsRead = async (token) => {
  try {
    const response = await axios.post(
      `${API_URL}/notifications/mark-read`,
      {},
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    return response.data;
  } catch (error) {
    console.error('❌ Error marking all notifications as read:', error.response?.data || error.message);
    throw error;
  }
};

/**
 * Format timestamp to "time ago" format
 */
export const formatTimeAgo = (timestamp) => {
  const now = new Date();
  const then = new Date(timestamp);
  const seconds = Math.floor((now - then) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d`;
  return `${Math.floor(seconds / 604800)}w`;
};
