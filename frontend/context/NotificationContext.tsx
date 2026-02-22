import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import { useAuth } from './AuthContext';
import axios from 'axios';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://api.cofau.com';

interface NotificationContextType {
  unreadCount: number;
  refreshUnreadCount: () => Promise<void>;
  setUnreadCount: React.Dispatch<React.SetStateAction<number>>;
}

const NotificationContext = createContext<NotificationContextType>({
  unreadCount: 0,
  refreshUnreadCount: async () => {},
  setUnreadCount: () => {},
});

export const useNotifications = () => useContext(NotificationContext);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token, isAuthenticated } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const notificationListener = useRef<any>();

  // Fetch unread count from backend
  const refreshUnreadCount = useCallback(async () => {
    if (!token) return;

    try {
      const response = await axios.get(`${API_URL}/api/notifications/unread-count`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const count = response.data.unreadCount || 0;
      setUnreadCount(count);
    } catch (error) {
      console.error('Error fetching unread count:', error);
    }
  }, [token]);

  // Listen for incoming push notifications to update badge
  useEffect(() => {
    if (!isAuthenticated || !token) return;

    // Initial fetch
    refreshUnreadCount();

    // Listen for notifications received while app is foregrounded
    notificationListener.current = Notifications.addNotificationReceivedListener((notification) => {
      // Increment count immediately for responsiveness
      setUnreadCount((prev) => prev + 1);
    });

    return () => {
  if (notificationListener.current && notificationListener.current.remove) {
    notificationListener.current.remove();
  }
};
  }, [isAuthenticated, token, refreshUnreadCount]);

  // Refresh count periodically (every 30 seconds when app is active)
  useEffect(() => {
    if (!isAuthenticated || !token) return;

    const interval = setInterval(() => {
      refreshUnreadCount();
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [isAuthenticated, token, refreshUnreadCount]);

  const value = {
    unreadCount,
    refreshUnreadCount,
    setUnreadCount,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};

export default NotificationContext;