const fs = require("fs");
const path = require("path");

const mapsPath = path.join(
  __dirname,
  "..",
  "node_modules",
  "@expo",
  "config-plugins",
  "build",
  "ios",
  "Maps.js"
);

if (fs.existsSync(mapsPath)) {
  let content = fs.readFileSync(mapsPath, "utf8");

  content = content.replace(
    /pod 'react-native-google-maps'/g,
    "# react-native-google-maps removed - using react-native-maps/Google subspec instead"
  );

  fs.writeFileSync(mapsPath, content);
  console.log("✅ Patched @expo/config-plugins Maps.js to remove react-native-google-maps pod");
} else {
  console.log("⚠️ Maps.js not found, skipping patch");
}
