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


// Reduce file watching to minimum for low-resource environments  
config.watchFolders = [__dirname];

// Completely disable file watching to work around ENOSPC limits
// This means you'll need to manually restart for file changes
config.watcher = {
  watchman: {
    deferStates: [],
  },
};

// Set environment to tell metro to avoid watching node_modules
process.env.CHOKIDAR_USEPOLLING = 'true';
process.env.WATCHPACK_POLLING = 'true';

// Drastically reduce workers
config.maxWorkers = 1;

// Exclude platform-specific directories from resolution
config.resolver.blacklistRE = /node_modules\/.*\/(android|ios|macos|windows|tvos)\/.*$/;

module.exports = config;
