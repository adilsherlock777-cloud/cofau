const { withDangerousMod } = require("expo/config-plugins");
const fs = require("fs");
const path = require("path");

module.exports = function withModularHeaders(config) {
  return withDangerousMod(config, [
    "ios",
    async (config) => {
      const podfilePath = path.join(
        config.modRequest.platformProjectRoot,
        "Podfile"
      );
      let podfile = fs.readFileSync(podfilePath, "utf8");

      // Add modular headers for Firebase and Google Maps pods
      const modularHeadersDeps = [
        "FirebaseCore",
        "FirebaseCoreInternal",
        "FirebaseAuth",
        "FirebaseAuthInterop",
        "FirebaseAppCheckInterop",
        "FirebaseMessaging",
        "FirebaseMessagingInterop",
        "FirebaseCoreExtension",
        "FirebaseInstallations",
        "GoogleUtilities",
        "RecaptchaInterop",
        "GoogleMaps",
        "Google-Maps-iOS-Utils",
      ];

      const insertLines = modularHeadersDeps
        .map((dep) => `  pod '${dep}', :modular_headers => true`)
        .join("\n");

      // Use the Google subspec of react-native-maps
      const googleMapsSubspec = `  pod 'react-native-maps/Google', :path => '../node_modules/react-native-maps'`;

      if (!podfile.includes("modular_headers => true")) {
        podfile = podfile.replace(
          /use_frameworks! :linkage => :static/,
          `use_frameworks! :linkage => :static\n\n${insertLines}\n${googleMapsSubspec}`
        );
      } else if (!podfile.includes("react-native-maps/Google")) {
        podfile = podfile.replace(
          /use_frameworks! :linkage => :static/,
          `use_frameworks! :linkage => :static\n${googleMapsSubspec}`
        );
      }

      // Inject build settings fix inside existing post_install block
      const buildSettingsFix = `
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |config|
        config.build_settings['CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES'] = 'YES'
        config.build_settings['DEFINES_MODULE'] = 'YES'
        if ['react-native-maps', 'react-native-google-maps'].include?(target.name)
          config.build_settings['GCC_WARN_INHIBIT_ALL_WARNINGS'] = 'YES'
          config.build_settings['OTHER_CFLAGS'] = '$(inherited) -Wno-error -Wno-non-modular-include-in-framework-module -Wno-error=non-modular-include-in-framework-module'
          config.build_settings['HEADER_SEARCH_PATHS'] = '$(inherited) "$(PODS_ROOT)/Headers/Public" "$(PODS_ROOT)/Headers/Public/React-Core" "$(PODS_TARGET_SRCROOT)/ios/AirMaps"'
          config.build_settings['CLANG_ENABLE_MODULES'] = 'YES'
        end
        if target.name.start_with?('RNFB')
          config.build_settings['HEADER_SEARCH_PATHS'] = '$(inherited) "$(PODS_ROOT)/Headers/Public" "$(PODS_ROOT)/Headers/Public/React-Core"'
        end
      end
    end`;

      if (!podfile.includes("CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES")) {
        podfile = podfile.replace(
          /post_install do \|installer\|/,
          `post_install do |installer|${buildSettingsFix}`
        );
      }

      fs.writeFileSync(podfilePath, podfile);
      return config;
    },
  ]);
};
