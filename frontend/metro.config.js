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


// Use watchman instead of node fs watchers to reduce file descriptor usage
config.watchFolders = [__dirname];

// Disable file watching entirely in low-resource environments
config.watcher = {
  watchman: {
    deferStates: ['hg.update'],
  },
};

// Reduce the number of workers to decrease resource usage
config.maxWorkers = 1;

module.exports = config;
