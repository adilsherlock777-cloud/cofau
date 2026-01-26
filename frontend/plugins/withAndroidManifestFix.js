const { withAndroidManifest, AndroidConfig } = require('@expo/config-plugins');

/**
 * Config plugin to fix Android manifest merger conflicts with Firebase messaging
 * Adds tools:replace attributes to resolve conflicts
 */
const withAndroidManifestFix = (config) => {
  return withAndroidManifest(config, async (config) => {
    const androidManifest = config.modResults;
    const { manifest } = androidManifest;

    if (!manifest || !manifest.application || !manifest.application[0]) {
      return config;
    }

    const application = manifest.application[0];
    
    // Ensure tools namespace is declared
    if (!manifest.$ || !manifest.$['xmlns:tools']) {
      if (!manifest.$) {
        manifest.$ = {};
      }
      manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';
    }

    if (!application['meta-data']) {
      return config;
    }

    // Find and fix Firebase messaging meta-data conflicts
    application['meta-data'].forEach((metaData) => {
      if (!metaData.$ || !metaData.$['android:name']) {
        return;
      }
      
      const name = metaData.$['android:name'];
      
      // Fix default_notification_channel_id conflict
      if (name === 'com.google.firebase.messaging.default_notification_channel_id') {
        metaData.$['tools:replace'] = 'android:value';
      }
      
      // Fix default_notification_color conflict
      if (name === 'com.google.firebase.messaging.default_notification_color') {
        metaData.$['tools:replace'] = 'android:resource';
      }
    });

    return config;
  });
};

module.exports = withAndroidManifestFix;
