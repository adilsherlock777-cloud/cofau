module.exports = {
  dependencies: {
    '@react-native-firebase/messaging': {
      platforms: {
        ios: null, // Disable on iOS - only used on Android. iOS uses Expo Notifications.
      },
    },
  },
};
