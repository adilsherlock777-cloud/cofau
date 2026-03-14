import { Platform } from 'react-native';

let analytics = null;

// Initialize analytics - works on both iOS and Android
try {
  analytics = require('@react-native-firebase/analytics').default;
} catch (error) {
  console.warn('Firebase Analytics not available:', error.message);
}

function getAnalytics() {
  try {
    return analytics ? analytics() : null;
  } catch {
    return null;
  }
}

// Screen tracking
export async function logScreenView(screenName, screenClass) {
  const instance = getAnalytics();
  if (!instance) return;
  try {
    await instance.logScreenView({
      screen_name: screenName,
      screen_class: screenClass || screenName,
    });
  } catch (e) {
    console.warn('Analytics logScreenView error:', e.message);
  }
}

// User login
export async function logLogin(method = 'email') {
  const instance = getAnalytics();
  if (!instance) return;
  try {
    await instance.logLogin({ method });
  } catch (e) {
    console.warn('Analytics logLogin error:', e.message);
  }
}

// User signup
export async function logSignUp(method = 'email') {
  const instance = getAnalytics();
  if (!instance) return;
  try {
    await instance.logSignUp({ method });
  } catch (e) {
    console.warn('Analytics logSignUp error:', e.message);
  }
}

// Set user ID for analytics
export async function setUserId(userId) {
  const instance = getAnalytics();
  if (!instance) return;
  try {
    await instance.setUserId(userId);
  } catch (e) {
    console.warn('Analytics setUserId error:', e.message);
  }
}

// Set user properties
export async function setUserProperties(properties) {
  const instance = getAnalytics();
  if (!instance) return;
  try {
    for (const [key, value] of Object.entries(properties)) {
      await instance.setUserProperty(key, value ? String(value) : null);
    }
  } catch (e) {
    console.warn('Analytics setUserProperties error:', e.message);
  }
}

// Custom events
export async function logEvent(eventName, params = {}) {
  const instance = getAnalytics();
  if (!instance) return;
  try {
    await instance.logEvent(eventName, params);
  } catch (e) {
    console.warn('Analytics logEvent error:', e.message);
  }
}

// Pre-built event helpers
export const logPostCreated = (category) =>
  logEvent('post_created', { category });

export const logPostLiked = (postId) =>
  logEvent('post_liked', { post_id: postId });

export const logPostShared = (postId) =>
  logEvent('post_shared', { post_id: postId });

export const logRestaurantViewed = (restaurantName) =>
  logEvent('restaurant_viewed', { restaurant_name: restaurantName });

export const logSearch = (searchTerm) =>
  logEvent('search', { search_term: searchTerm });
