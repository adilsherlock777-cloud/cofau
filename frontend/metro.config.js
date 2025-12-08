// metro.config.js
const { getDefaultConfig } = require("expo/metro-config");
const path = require('path');
const { FileStore } = require('metro-cache');

const config = getDefaultConfig(__dirname);

// Use a stable on-disk store (shared across web/android)
const root = process.env.METRO_CACHE_ROOT || path.join(__dirname, '.metro-cache');
config.cacheStores = [
  new FileStore({ root: path.join(root, 'cache') }),
];


// Drastically reduce file watching to avoid ENOSPC error
config.watchFolders = [__dirname];

// Exclude large directories that don't need watching
config.resolver.blockList = [
  /node_modules\/.*\/(android|ios|windows|macos|linux|tvos|visionos)$/,
  /node_modules\/.*\/__tests__$/,
  /node_modules\/.*\/\.git$/,
  /node_modules\/.*\/test$/,
  /node_modules\/.*\/tests$/,
  /node_modules\/.*\/spec$/,
  /node_modules\/.*\/examples$/,
  /node_modules\/.*\/docs$/,
  /node_modules\/.*\/\.expo$/,
  /node_modules\/react-native\/React\//,
  /node_modules\/react-native\/Libraries\//,
  /node_modules\/react-native\/third-party\//,
];

// Reduce the number of workers to decrease resource usage
config.maxWorkers = 1;

module.exports = config;
