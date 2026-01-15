import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import axios from 'axios';
import Constants from 'expo-constants';

const API_URL = `${process.env.EXPO_PUBLIC_BACKEND_URL || 'https://api.cofau.com'}/api`;

// Configure how notifications are handled when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    console.log('📬 Notification received in foreground:', notification);
    return {
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      priority: Notifications.AndroidNotificationPriority.MAX,
    };
  },
});

// Ensure Android notification channel exists
async function ensureNotificationChannel() {
  if (Platform.OS === 'android') {
    try {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Default Notifications',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#E94A37',
        sound: 'default',
        enableVibrate: true,
        showBadge: true,
      });
      console.log('✅ Android notification channel created');
    } catch (error) {
      console.error('❌ Failed to create notification channel:', error);
    }
  }
}

// Create channel immediately when module loads
ensureNotificationChannel();

export async function registerForPushNotificationsAsync(token, retryCount = 0) {
  const MAX_RETRIES = 3;
  const RETRY_DELAY = 2000;

  if (!Device.isDevice) {
    console.log('⚠️ Push notifications only work on physical devices');
    return null;
  }

  if (!token) {
    console.log('⚠️ No auth token provided for push notification registration');
    return null;
  }

  try {
    // Ensure channel exists before registering
    await ensureNotificationChannel();

    // Request permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      console.log('📱 Requesting push notification permissions...');
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('❌ Push notification permission denied by user');
      return null;
    }

    console.log('✅ Push notification permissions granted');

    // Get the Expo push token
    const expoPushToken = await Notifications.getExpoPushTokenAsync({
      projectId: Constants.expoConfig?.extra?.eas?.projectId,
    });

    if (!expoPushToken?.data) {
      console.log('❌ Failed to get Expo push token');
      return null;
    }

    console.log('📱 Expo Push Token:', expoPushToken.data);

    // Register token with backend
    if (token && expoPushToken.data) {
      let registered = false;
      
      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
          const response = await axios.post(
            `${API_URL}/notifications/register-device`,
            {
              deviceToken: expoPushToken.data,
              platform: Platform.OS,
            },
            {
              headers: { Authorization: `Bearer ${token}` },
              timeout: 10000,
            }
          );
          
          if (response.data?.success) {
            console.log('✅ Device token registered with backend successfully');
            console.log(`   Token count: ${response.data.tokenCount || 1}`);
            registered = true;
            break;
          }
        } catch (error) {
          const status = error.response?.status;
          const isLastAttempt = attempt === MAX_RETRIES;
          
          if (status === 401) {
            console.log('⚠️ Push notification registration failed - user not authenticated');
            break;
          } else if (status === 404) {
            console.log('⚠️ Push notification endpoint not found');
            break;
          } else {
            if (isLastAttempt) {
              console.error('❌ Error registering device token after retries:', error.response?.data || error.message);
            } else {
              console.log(`⚠️ Error registering device token (attempt ${attempt + 1}/${MAX_RETRIES + 1}), retrying...`);
              await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * (attempt + 1)));
            }
          }
        }
      }

      if (!registered && retryCount < MAX_RETRIES) {
        console.log(`🔄 Retrying token registration in ${RETRY_DELAY * 2}ms...`);
        setTimeout(() => {
          registerForPushNotificationsAsync(token, retryCount + 1);
        }, RETRY_DELAY * 2);
      }
    }

    return expoPushToken.data;
  } catch (error) {
    console.error('❌ Error registering for push notifications:', error);
    
    if (retryCount < MAX_RETRIES) {
      console.log(`🔄 Retrying push notification registration in ${RETRY_DELAY * 2}ms...`);
      setTimeout(() => {
        registerForPushNotificationsAsync(token, retryCount + 1);
      }, RETRY_DELAY * 2);
    }
    
    return null;
  }
}

export function setupNotificationListeners(navigation) {
  console.log('🔔 Setting up notification listeners...');

  const notificationListener = Notifications.addNotificationReceivedListener((notification) => {
    console.log('📬 Notification received in foreground:', notification);
    const data = notification.request.content.data;
    console.log('   Type:', data?.type);
    console.log('   From:', data?.fromUserName || data?.fromUserId);
  });

  const responseListener = Notifications.addNotificationResponseReceivedListener((response) => {
    console.log('👆 Notification tapped:', response);
    const data = response.notification.request.content.data;
    
    setTimeout(() => {
      try {
        if (data?.type === 'message' && data?.fromUserId) {
          console.log('   Navigating to chat with:', data.fromUserId);
          navigation?.push(`/chat/${data.fromUserId}`);
        } else if (data?.type === 'like' && data?.postId) {
          console.log('   Navigating to post:', data.postId);
          navigation?.push(`/post-details/${data.postId}`);
        } else if (data?.type === 'comment' && data?.postId) {
          console.log('   Navigating to post:', data.postId);
          navigation?.push(`/post-details/${data.postId}`);
        } else if (data?.type === 'new_post' && data?.postId) {
          console.log('   Navigating to post:', data.postId);
          navigation?.push(`/post-details/${data.postId}`);
        } else if (data?.type === 'follow' && data?.fromUserId) {
          console.log('   Navigating to profile:', data.fromUserId);
          navigation?.push(`/profile?userId=${data.fromUserId}`);
        } else if (data?.type === 'compliment' && data?.fromUserId) {
          console.log('   Navigating to profile:', data.fromUserId);
          navigation?.push(`/profile?userId=${data.fromUserId}`);
        } else {
          console.log('   Unknown notification type, navigating to feed');
          navigation?.push('/feed');
        }
      } catch (error) {
        console.error('❌ Error navigating from notification:', error);
      }
    }, 500);
  });

  Notifications.getLastNotificationResponseAsync().then((response) => {
    if (response) {
      console.log('📱 App opened from notification:', response);
      const data = response.notification.request.content.data;
      
      setTimeout(() => {
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
        } else if (data?.type === 'compliment' && data?.fromUserId) {
          navigation?.push(`/profile?userId=${data.fromUserId}`);
        }
      }, 1000);
    }
  });

  return () => {
    console.log('🔕 Cleaning up notification listeners...');
    if (notificationListener && notificationListener.remove) {
      notificationListener.remove();
    }
    
    if (responseListener && responseListener.remove) {
      responseListener.remove();
    }
  };
}

export async function sendLocalNotification(title, body, data = {}) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data,
      sound: true,
    },
    trigger: null,
  });
}