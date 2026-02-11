import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import axios from 'axios';
import Constants from 'expo-constants';

// Conditionally import Firebase Messaging for Android only
let messaging = null;
let firebaseApp = null;

if (Platform.OS === 'android') {
  try {

    // Initialize Firebase App first (required for messaging)
    firebaseApp = require('@react-native-firebase/app').default;
    messaging = require('@react-native-firebase/messaging').default;

    // Verify Firebase is initialized
    if (!firebaseApp.apps().length) {
      console.warn('⚠️ Firebase App not initialized. Make sure google-services.json is configured.');
      messaging = null;
    } else {
      console.log('✅ Firebase Messaging initialized for Android');

      // Register background message handler - critical for sound/banner when app is killed
      messaging().setBackgroundMessageHandler(async remoteMessage => {
        console.log('📬 FCM background message received:', remoteMessage);
        // The notification display is handled by FCM automatically for notification+data messages.
        // This handler ensures the app processes the data payload in the background.
      });
    }
  } catch (error) {
    console.warn('⚠️ Firebase Messaging not available:', error.message);
    console.warn('   Make sure @react-native-firebase/messaging is installed');
    console.warn('   Run: npx expo prebuild --platform android');
    messaging = null;
  }
}

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

// Channel IDs - versioned to force fresh creation when settings change
// Bump version suffix if you need to change channel settings (Android caches them permanently)
// v3: Fix missing sound and heads-up banner on Android
const DEFAULT_CHANNEL_ID = 'default_v3';
const RESTAURANT_CHANNEL_ID = 'restaurant_v3';

// Ensure Android notification channels exist
async function ensureNotificationChannel() {
  if (Platform.OS === 'android') {
    try {
      // Delete old channels that have stale/cached settings (Android never updates existing channels)
      try {
        await Notifications.deleteNotificationChannelAsync('default');
        await Notifications.deleteNotificationChannelAsync('restaurant');
        await Notifications.deleteNotificationChannelAsync('default_v2');
        await Notifications.deleteNotificationChannelAsync('restaurant_v2');
      } catch (e) {
        // Old channels may not exist, that's fine
      }

      // Create default channel for regular users
      await Notifications.setNotificationChannelAsync(DEFAULT_CHANNEL_ID, {
        name: 'Default Notifications',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#E94A37',
        sound: 'default',
        enableVibrate: true,
        enableLights: true,
        showBadge: true,
        bypassDnd: true,
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      });
      console.log('✅ Android default notification channel created (v3)');

      // Create restaurant channel
      await Notifications.setNotificationChannelAsync(RESTAURANT_CHANNEL_ID, {
        name: 'Restaurant Notifications',
        description: 'Notifications for restaurant orders and updates',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#E94A37',
        sound: 'default',
        enableVibrate: true,
        enableLights: true,
        showBadge: true,
        bypassDnd: true,
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      });
      console.log('✅ Android restaurant notification channel created (v3)');
    } catch (error) {
      console.error('❌ Failed to create notification channel:', error);
    }
  }
}

// Create channels immediately when module loads
ensureNotificationChannel();

/**
 * Get FCM token for Android devices
 */
async function getFCMToken() {
  if (Platform.OS !== 'android' || !messaging) {
    return null;
  }

  try {
    // Request permission for Android 13+
    const authStatus = await messaging().requestPermission();
    const enabled =
      authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
      authStatus === messaging.AuthorizationStatus.PROVISIONAL;

    if (!enabled) {
      console.log('❌ FCM permission not granted');
      return null;
    }

    // Get FCM token
    const fcmToken = await messaging().getToken();
    
    if (fcmToken) {
      console.log('✅ FCM token obtained:', fcmToken.substring(0, 50) + '...');
      return fcmToken;
    } else {
      console.log('⚠️ FCM token is empty');
      return null;
    }
  } catch (error) {
    console.error('❌ Error getting FCM token:', error);
    return null;
  }
}

/**
 * Get Expo push token (iOS primarily, Android as fallback)
 */
async function getExpoPushToken() {
  try {
    const expoPushToken = await Notifications.getExpoPushTokenAsync({
      projectId: Constants.expoConfig?.extra?.eas?.projectId,
    });

    if (expoPushToken?.data) {
      console.log('✅ Expo push token obtained:', expoPushToken.data);
      return expoPushToken.data;
    } else {
      console.log('❌ Failed to get Expo push token');
      return null;
    }
  } catch (error) {
    console.error('❌ Error getting Expo push token:', error);
    return null;
  }
}

export async function registerForPushNotificationsAsync(token, accountType = 'user', retryCount = 0) {
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

  console.log(`📱 Registering push notifications for account type: ${accountType}`);

  try {
    // Ensure channel exists before registering (Android)
    await ensureNotificationChannel();

    // Request permissions
    let finalStatus = 'granted';
    
    if (Platform.OS === 'android') {
      // For Android, FCM handles permissions
      if (messaging) {
        try {
          const authStatus = await messaging().requestPermission();
          finalStatus = 
            authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
            authStatus === messaging.AuthorizationStatus.PROVISIONAL
              ? 'granted'
              : 'denied';
        } catch (error) {
          console.error('❌ Error requesting FCM permission:', error);
          finalStatus = 'denied';
        }
      } else {
        // Fallback to Expo notifications if Firebase is not available
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let status = existingStatus;
        if (existingStatus !== 'granted') {
          console.log('📱 Requesting push notification permissions...');
          const { status: newStatus } = await Notifications.requestPermissionsAsync();
          status = newStatus;
        }
        finalStatus = status;
      }
    } else {
      // iOS - use Expo notifications
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let status = existingStatus;
      if (existingStatus !== 'granted') {
        console.log('📱 Requesting push notification permissions...');
        const { status: newStatus } = await Notifications.requestPermissionsAsync();
        status = newStatus;
      }
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('❌ Push notification permission denied by user');
      return null;
    }

    console.log('✅ Push notification permissions granted');

    // Get device token based on platform
    let deviceToken = null;
    let platform = Platform.OS;

    if (Platform.OS === 'android') {
      // Android: Get FCM token
      if (messaging) {
        deviceToken = await getFCMToken();
        if (!deviceToken) {
          console.log('⚠️ Failed to get FCM token, falling back to Expo token');
          // Fallback to Expo token if FCM fails
          const expoToken = await getExpoPushToken();
          deviceToken = expoToken;
        }
      } else {
        // Fallback to Expo if Firebase is not available
        console.log('⚠️ Firebase Messaging not available, using Expo token for Android');
        const expoToken = await getExpoPushToken();
        deviceToken = expoToken;
      }
    } else {
      // iOS: Get Expo push token
      deviceToken = await getExpoPushToken();
    }

    if (!deviceToken) {
      console.log('❌ Failed to get device token');
      return null;
    }

    console.log(`📱 ${Platform.OS === 'android' ? 'FCM' : 'Expo'} Token obtained:`, deviceToken.substring(0, 50) + '...');

    // Register token with backend - use correct endpoint based on account type
    if (token && deviceToken) {
      let registered = false;

      // Use restaurant endpoint for restaurant accounts
      const registerEndpoint = accountType === 'restaurant'
        ? `${API_URL}/notifications/restaurant/register-device`
        : `${API_URL}/notifications/register-device`;

      console.log(`📱 Using registration endpoint: ${registerEndpoint}`);

      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
          const response = await axios.post(
            registerEndpoint,
            {
              deviceToken: deviceToken,
              platform: platform,
            },
            {
              headers: { Authorization: `Bearer ${token}` },
              timeout: 10000,
            }
          );

          if (response.data?.success) {
            console.log('✅ Device token registered with backend successfully');
            console.log(`   Account type: ${accountType}`);
            console.log(`   Platform: ${platform}`);
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
          registerForPushNotificationsAsync(token, accountType, retryCount + 1);
        }, RETRY_DELAY * 2);
      }
    }

    return deviceToken;
  } catch (error) {
    console.error('❌ Error registering for push notifications:', error);

    if (retryCount < MAX_RETRIES) {
      console.log(`🔄 Retrying push notification registration in ${RETRY_DELAY * 2}ms...`);
      setTimeout(() => {
        registerForPushNotificationsAsync(token, accountType, retryCount + 1);
      }, RETRY_DELAY * 2);
    }

    return null;
  }
}

export function setupNotificationListeners(navigation) {
  console.log('🔔 Setting up notification listeners...');

  // Setup Expo notification listeners (for iOS and fallback Android)
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

  // Setup Firebase Messaging listeners for Android
  if (Platform.OS === 'android' && messaging) {
    try {
      // Handle foreground messages
      const unsubscribeForeground = messaging().onMessage(async remoteMessage => {
        console.log('📬 FCM notification received in foreground:', remoteMessage);
        const data = remoteMessage.data;

        // Determine which channel to use based on notification type
        // Restaurant notifications: new_order, order_in_progress
        const restaurantNotificationTypes = ['new_order', 'order_in_progress'];
        const notificationType = data?.type;
        const channelId = restaurantNotificationTypes.includes(notificationType) ? RESTAURANT_CHANNEL_ID : DEFAULT_CHANNEL_ID;
        console.log(`📱 Using channel: ${channelId} for notification type: ${notificationType}`);

        // Show local notification when app is in foreground
        await Notifications.scheduleNotificationAsync({
          content: {
            title: remoteMessage.notification?.title || 'New Notification',
            body: remoteMessage.notification?.body || '',
            data: data || {},
            sound: 'default',
            channelId: channelId,
          },
          trigger: null,
        });
      });

      // Handle notification taps (when app is in background or closed)
      messaging().onNotificationOpenedApp(remoteMessage => {
        console.log('👆 FCM notification opened app:', remoteMessage);
        const data = remoteMessage.data;
        
        setTimeout(() => {
          try {
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
            } else {
              navigation?.push('/feed');
            }
          } catch (error) {
            console.error('❌ Error navigating from FCM notification:', error);
          }
        }, 500);
      });

      // Check if app was opened from a notification
      messaging()
        .getInitialNotification()
        .then(remoteMessage => {
          if (remoteMessage) {
            console.log('📱 App opened from FCM notification:', remoteMessage);
            const data = remoteMessage.data;
            
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

      console.log('✅ FCM notification listeners set up for Android');
    } catch (error) {
      console.error('❌ Error setting up FCM listeners:', error);
    }
  }

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

export async function sendLocalNotification(title, body, data = {}, isRestaurant = false) {
  // Determine channel based on notification type or explicit flag
  const restaurantNotificationTypes = ['new_order', 'order_in_progress'];
  const channelId = isRestaurant || restaurantNotificationTypes.includes(data?.type) ? RESTAURANT_CHANNEL_ID : DEFAULT_CHANNEL_ID;

  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data,
      sound: 'default',
      channelId: channelId,
    },
    trigger: null,
  });
}
