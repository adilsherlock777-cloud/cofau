const fs = require("fs");
const path = require("path");

const filePath = path.join(
  __dirname,
  "..",
  "node_modules",
  "@react-native-firebase",
  "messaging",
  "ios",
  "RNFBMessaging",
  "RNFBMessagingModule.m"
);

if (fs.existsSync(filePath)) {
  let content = fs.readFileSync(filePath, "utf8");

  // Add React/RCTBridgeModule.h import before RNFBApp imports to fix
  // clang module import ordering issue with static frameworks.
  // Without this, RCTPromiseRejectBlock is first seen through the RNFBApp
  // module and clang rejects the later direct import from React.
  if (!content.includes("#import <React/RCTBridgeModule.h>")) {
    content = content.replace(
      "#import <Firebase/Firebase.h>",
      "#import <React/RCTBridgeModule.h>\n#import <Firebase/Firebase.h>"
    );
    fs.writeFileSync(filePath, content);
    console.log("✅ Patched RNFBMessagingModule.m - added React/RCTBridgeModule.h import");
  } else {
    console.log("ℹ️  RNFBMessagingModule.m already has RCTBridgeModule import, skipping");
  }
} else {
  console.log("⚠️  RNFBMessagingModule.m not found, skipping patch");
}
