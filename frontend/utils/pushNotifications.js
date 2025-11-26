import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import axios from 'axios';
import Constants from 'expo-constants';

const API_URL = `${process.env.EXPO_PUBLIC_BACKEND_URL || 'https://backend.cofau.com'}/api`;

// Configure how notifications are handled when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Register for push notifications and get the device token
 */
export async function registerForPushNotificationsAsync(token) {
  if (!Device.isDevice) {
    console.log('⚠️ Push notifications only work on physical devices');
    return null;
  }

  try {
    // Request permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('❌ Failed to get push token for push notification!');
      return null;
    }

    // Get the Expo push token
    const expoPushToken = await Notifications.getExpoPushTokenAsync({
      projectId: Constants.expoConfig?.extra?.eas?.projectId,
    });

    console.log('📱 Expo Push Token:', expoPushToken.data);

    // Register token with backend
    if (token && expoPushToken.data) {
      try {
        await axios.post(
          `${API_URL}/notifications/register-device`,
          {
            deviceToken: expoPushToken.data,
            platform: Platform.OS,
          },
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        console.log('✅ Device token registered with backend');
      } catch (error) {
        // Only log error if it's not a 404 (endpoint might not exist) or 401 (not authenticated)
        if (error.response?.status !== 404 && error.response?.status !== 401) {
          console.error('❌ Error registering device token:', error.response?.data || error.message);
        } else if (error.response?.status === 404) {
          console.log('⚠️ Push notification endpoint not found - this is OK if backend is not updated');
        } else {
          console.log('⚠️ Push notification registration failed - user not authenticated');
        }
      }
    }

    return expoPushToken.data;
  } catch (error) {
    console.error('❌ Error registering for push notifications:', error);
    return null;
  }
}

/**
 * Setup notification listeners
 */
export function setupNotificationListeners(navigation) {
  // Handle notification received while app is in foreground
  const notificationListener = Notifications.addNotificationReceivedListener((notification) => {
    console.log('📬 Notification received:', notification);
  });

  // Handle notification tapped/opened
  const responseListener = Notifications.addNotificationResponseReceivedListener((response) => {
    console.log('👆 Notification tapped:', response);
    const data = response.notification.request.content.data;

    // Navigate based on notification type
    // Note: navigation is actually the router from expo-router
    if (data?.type === 'message' && data?.fromUserId) {
      navigation?.push(`/chat/${data.fromUserId}`);
    } else if (data?.type === 'like' && data?.postId) {
      navigation?.push(`/post-details/${data.postId}`);
    } else if (data?.type === 'comment' && data?.postId) {
      navigation?.push(`/post-details/${data.postId}`);
    } else if (data?.type === 'new_post' && data?.postId) {
      navigation?.push(`/post-details/${data.postId}`);
    } else if (data?.type === 'follow' && data?.fromUserId) {
      navigation?.push(`/profile?userId=${data.fromUserId}`);
    }
  });

  return () => {
    // The subscription objects have a remove() method
    if (notificationListener && notificationListener.remove) {
      notificationListener.remove();
    }
    
    if (responseListener && responseListener.remove) {
      responseListener.remove();
    }
  };
}

/**
 * Send a local notification (for testing)
 */
export async function sendLocalNotification(title, body, data = {}) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data,
      sound: true,
    },
    trigger: null, // Show immediately
  });
}

