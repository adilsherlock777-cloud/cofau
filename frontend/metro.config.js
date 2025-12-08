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

// Use polling watcher instead of native file watchers to avoid ENOSPC
config.watcher = {
  healthCheck: {
    enabled: false,
  },
};

// Drastically reduce workers
config.maxWorkers = 1;

// Disable file watching for node_modules
config.resolver.disableHierarchicalLookup = true;

module.exports = config;
