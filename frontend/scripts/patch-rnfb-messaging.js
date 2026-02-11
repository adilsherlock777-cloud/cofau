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

  // Fix clang module import ordering issue with static frameworks.
  // When using use_frameworks! :linkage => :static, clang tracks which module
  // first exposes a type. RNFBApp's module exposes React types (RCTConvert,
  // RCTPromiseRejectBlock, etc.) through its headers/categories. If RNFBApp
  // headers are imported before React headers in RNFBMessaging, clang rejects
  // the later direct React imports. Fix: reorder so all React imports come first.
  const original = [
    "#import <Firebase/Firebase.h>",
    "#import <RNFBApp/RNFBSharedUtils.h>",
    "#import <React/RCTConvert.h>",
    "#import <React/RCTUtils.h>",
  ].join("\n");

  const patched = [
    "#import <React/RCTBridgeModule.h>",
    "#import <React/RCTConvert.h>",
    "#import <React/RCTUtils.h>",
    "#import <Firebase/Firebase.h>",
    "#import <RNFBApp/RNFBSharedUtils.h>",
  ].join("\n");

  if (content.includes(original)) {
    content = content.replace(original, patched);
    fs.writeFileSync(filePath, content);
    console.log("✅ Patched RNFBMessagingModule.m - reordered React imports before RNFBApp");
  } else if (content.includes(patched)) {
    console.log("ℹ️  RNFBMessagingModule.m already patched, skipping");
  } else {
    console.log("⚠️  RNFBMessagingModule.m imports don't match expected pattern, skipping");
  }
} else {
  console.log("⚠️  RNFBMessagingModule.m not found, skipping patch");
}
