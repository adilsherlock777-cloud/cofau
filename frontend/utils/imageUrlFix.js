/**
 * Universal Image URL Fixer for Cofau App
 * 
 * This utility resolves image loading issues in APK builds by ensuring
 * all URLs are properly formatted for both development and production.
 */

import Constants from 'expo-constants';
import { Platform } from 'react-native';

// Get backend URL from environment or fallback
export const BACKEND_URL = 
  Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || 
  'https://api.cofau.com';

// Enable more verbose logging for debugging
const DEBUG_URLS = true;

/**
 * Debug logger that works in both development and production
 */
const debugLog = (message) => {
  if (DEBUG_URLS) {
  }
};

/**
 * Universal URL normalizer for all media (images, videos)
 * Fixes URL issues in APK builds
 * 
 * @param {string|null|undefined} url - The URL to normalize
 * @returns {string|null} - Normalized absolute URL or null
 */
export const normalizeMediaUrl = (url) => {
  if (!url) return null;
  
  const originalUrl = url;
  
  // Already absolute URL with protocol
  if (url.startsWith('http')) return url;

  // Clean the URL
  let cleaned = url.trim();
  
  // Remove duplicate slashes (except after protocol)
  cleaned = cleaned.replace(/([^:]\/)\/+/g, "$1");
  
  // Fix common path issues
  if (cleaned.startsWith('backend/')) {
    cleaned = cleaned.replace('backend/', '/');
  }
  
  // CRITICAL FIX: Handle direct file IDs (common in error logs)
  // Example: 691b562fa896fb9d55eeb006_e1e92be1-99d9-43ae-a54e-223c80b6324f.mp4
  // All images now use /api/static/uploads/ path (unified storage)
  if (!cleaned.includes('/') && (cleaned.includes('.mp4') || cleaned.includes('.jpg') || cleaned.includes('.png') || cleaned.includes('.jpeg') || cleaned.includes('.gif'))) {
    // This appears to be a direct filename - use unified uploads path
    cleaned = `/api/static/uploads/${cleaned}`;
  }
  
  // Convert legacy profile picture URLs to new format
  if (cleaned.includes('/legacy-static/uploads/profile_pictures/')) {
    const filename = cleaned.split('/').pop();
    cleaned = `/api/static/uploads/${filename}`;
  }
  
  // Convert old story URLs to new unified path
  if (cleaned.includes('/api/static/stories/')) {
    const filename = cleaned.replace('/api/static/stories/', '');
    cleaned = `/api/static/uploads/${filename}`;
  }
  
  // Fix /api/static/ paths (common in APK issues)
  if (cleaned.startsWith('/api/static/')) {
    cleaned = cleaned;  // Keep as is - this is the correct format
  } 
  // Fix /static/ paths (missing /api prefix)
  else if (cleaned.startsWith('/static/')) {
    cleaned = '/api' + cleaned;
  }
  // Fix paths that are just 'static/...'
  else if (cleaned.startsWith('static/')) {
    cleaned = '/api/' + cleaned;
  }
  
  // Ensure leading slash
  if (!cleaned.startsWith('/')) {
    cleaned = '/' + cleaned;
  }
  
  // Create absolute URL
  const finalUrl = `${BACKEND_URL}${cleaned}`;
  
  // Debug in all environments
  debugLog(`🔄 [${Platform.OS}] URL normalized: ${originalUrl} → ${finalUrl}`);
  
  return finalUrl;
};

/**
 * Specific normalizer for profile pictures
 * 
 * @param {string|object|null} input - Profile picture URL or user object
 * @returns {string|null} - Normalized profile picture URL
 */
export const normalizeProfilePicture = (input) => {
  if (!input) return null;

  // If input is an object (user), extract profile picture URL
  if (typeof input === "object") {
    input = 
      input.profile_picture ||
      input.profile_picture_url ||
      input.user_profile_picture ||
      input.profile_pic ||
      input.avatar ||
      null;
  }

  // normalizeMediaUrl already handles legacy URLs, but ensure we log the conversion
  const normalized = normalizeMediaUrl(input);
  
  if (input && input.includes('/legacy-static/') && normalized) {
    debugLog(`🖼️ [${Platform.OS}] Profile picture URL converted: ${input} → ${normalized}`);
  }
  
  return normalized;
};

/**
 * Specific normalizer for story media
 * 
 * @param {string|null} url - Story media URL
 * @returns {string|null} - Normalized story media URL
 */
export const normalizeStoryUrl = (url) => {
  if (!url) return null;
  
  const originalUrl = url;
  
  // Special handling for story filenames without path
  // Example from error logs: 691b562fa896fb9d55eeb006_e1e92be1-99d9-43ae-a54e-223c80b6324f.mp4
  // All stories now use unified /api/static/uploads/ path
  if (!url.includes('/') && (url.includes('.mp4') || url.includes('.jpg') || url.includes('.png'))) {
    // Direct filename - use unified uploads path
    url = `/api/static/uploads/${url}`;
  }
  
  let normalized = normalizeMediaUrl(url);
  
  // Convert old story URLs to new unified path
  if (normalized && normalized.includes('/api/static/stories/')) {
    const filename = normalized.replace(/.*\/api\/static\/stories\//, '');
    normalized = `${BACKEND_URL}/api/static/uploads/${filename}`;
    debugLog(`🔄 [${Platform.OS}] Story URL converted from old path: ${originalUrl} → ${normalized}`);
  }
  
  // Debug in all environments
  if (originalUrl !== normalized) {
    debugLog(`🎬 [${Platform.OS}] Story URL fixed: ${originalUrl} → ${normalized}`);
  }
  
  return normalized;
};

/**
 * Utility to check if a URL is valid and accessible
 * Can be used for debugging
 * 
 * @param {string} url - URL to check
 * @returns {Promise<boolean>} - Whether the URL is accessible
 */
export const checkUrlValidity = async (url) => {
  try {
    const response = await fetch(url, { method: 'HEAD' });
    const valid = response.status >= 200 && response.status < 300;
    debugLog(`🔍 URL check: ${url} - ${valid ? '✅ Valid' : '❌ Invalid'} (${response.status})`);
    return valid;
  } catch (error) {
    debugLog(`❌ URL check failed: ${url} - ${error.message}`);
    return false;
  }
};