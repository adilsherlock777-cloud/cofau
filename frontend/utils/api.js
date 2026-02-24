import axios from 'axios';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { storage } from './storage';

const API_BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://api.cofau.com';
const API_URL = `${API_BASE_URL}/api`;

// Create axios instance
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add request interceptor to automatically include Authorization header
api.interceptors.request.use(
  async (config) => {
    const token = await storage.getItem('userToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add request interceptor for global axios instance as well
axios.interceptors.request.use(
  async (config) => {
    const token = await storage.getItem('userToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Note: Authorization header is set globally in AuthContext after login
// via axios.defaults.headers.common['Authorization']
// AND via request interceptors above for reliability

/**
 * Create a new post with image/video upload
 * @param {Object} postData - Post data (rating, review_text, map_link, file, media_type)
 * @returns {Promise} - API response
 */
export const createPost = async (postData) => {
  try {
    const formData = new FormData();

    // Append form fields
    formData.append('rating', postData.rating);
    formData.append('review_text', postData.review_text);
    if (postData.map_link) {
      formData.append('map_link', postData.map_link);
    }
    if (postData.location_name) {
      formData.append('location_name', postData.location_name);
    }
    if (postData.category) {
      formData.append('category', postData.category);  // ✅ Add category
    }
    if (postData.dish_name) {
      formData.append('dish_name', postData.dish_name);  // ✅ Add dish name
    }
    if (postData.tagged_restaurant_id) {                          // ← ADD THIS
      formData.append('tagged_restaurant_id', postData.tagged_restaurant_id);  // ← ADD THIS
    }
    if (postData.media_type) {
      formData.append('media_type', postData.media_type);
    }

    // Append file - handle both web and native
    if (postData.file) {
      if (postData.file.uri) {
        // React Native
        const fileUri = postData.file.uri;
        const filename = postData.file.name || fileUri.split('/').pop();
        const fileType = postData.file.type || 'image/jpeg';

        formData.append('file', {
          uri: fileUri,
          name: filename,
          type: fileType,
        });
      } else {
        // Web - File object
        formData.append('file', postData.file);
      }
    }

    const response = await axios.post(`${API_URL}/posts/create`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
        'Authorization': axios.defaults.headers.common['Authorization'],
      },
    });

    return response.data;
  } catch (error) {
    console.error('❌ Error creating post:', error.response?.data || error.message);
    throw error;
  }
};

/**
 * Like a post
 */
export const likePost = async (postId, accountType) => {
  try {
    // Use different endpoint for restaurant posts
    const endpoint = accountType === 'restaurant'
      ? `${API_URL}/restaurant/posts/public/${postId}/like`  // ← Note: /public/ path
      : `${API_URL}/posts/${postId}/like`;
    
    const response = await axios.post(endpoint);
    return response.data;
  } catch (error) {
    console.error('❌ Error liking post:', error.response?.data || error.message);
    throw error;
  }
};

/**
 * Unlike a post
 */
export const unlikePost = async (postId, accountType) => {
  try {
    // Use different endpoint for restaurant posts
    const endpoint = accountType === 'restaurant'
      ? `${API_URL}/restaurant/posts/public/${postId}/like`  // ← Note: /public/ path
      : `${API_URL}/posts/${postId}/like`;
    
    const response = await axios.delete(endpoint);
    return response.data;
  } catch (error) {
    console.error('❌ Error unliking post:', error.response?.data || error.message);
    throw error;
  }
};

/**
 * Increment share count for a post
 */
export const incrementShareCount = async (postId) => {
  try {
    const response = await axios.post(`${API_URL}/posts/${postId}/share`);
    return response.data;
  } catch (error) {
    console.error('Error updating share count:', error.response?.data || error.message);
  }
};

/**
 * Add a comment to a post
 */
export const addComment = async (postId, commentText, token, accountType) => {
  try {
    // Use different endpoint for restaurant posts
    const endpoint = accountType === 'restaurant'
      ? `${API_URL}/restaurant/posts/public/${postId}/comment`
      : `${API_URL}/posts/${postId}/comment`;
    
    const formData = new FormData();
    formData.append('comment_text', commentText);
    
    const response = await axios.post(endpoint, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    return response.data;
  } catch (error) {
    console.error('❌ Error adding comment:', error.response?.data || error.message);
    throw error;
  }
};

/**
 * Get comments for a post
 */
export const getComments = async (postId, accountType) => {
  try {
    // Use different endpoint for restaurant posts
    const endpoint = accountType === 'restaurant'
      ? `${API_URL}/restaurant/posts/public/${postId}/comments`
      : `${API_URL}/posts/${postId}/comments`;
    
    const response = await axios.get(endpoint);
    return response.data;
  } catch (error) {
    console.error('❌ Error fetching comments:', error.response?.data || error.message);
    throw error;
  }
};

/**
 * Delete a comment
 */
export const deleteComment = async (postId, commentId, accountType) => {
  try {
    // Use different endpoint for restaurant posts
    const endpoint = accountType === 'restaurant'
      ? `${API_URL}/restaurant/posts/public/${postId}/comment/${commentId}`
      : `${API_URL}/posts/${postId}/comment/${commentId}`;
    
    const response = await axios.delete(endpoint);
    return response.data;
  } catch (error) {
    console.error('❌ Error deleting comment:', error.response?.data || error.message);
    throw error;
  }
};
/**
 * Follow a user or restaurant
 */
export const followUser = async (userId, accountType) => {
  try {
    // Use different endpoint for restaurant accounts
    const endpoint = accountType === 'restaurant'
      ? `${API_URL}/restaurant/posts/follow/${userId}`
      : `${API_URL}/users/${userId}/follow`;
    
    const response = await axios.post(endpoint);
    return response.data;
  } catch (error) {
    console.error('❌ Error following user:', error.response?.data || error.message);
    throw error;
  }
};

/**
 * Unfollow a user or restaurant
 */
export const unfollowUser = async (userId, accountType) => {
  try {
    // Use different endpoint for restaurant accounts
    const endpoint = accountType === 'restaurant'
      ? `${API_URL}/restaurant/posts/follow/${userId}`
      : `${API_URL}/users/${userId}/follow`;
    
    const response = await axios.delete(endpoint);
    return response.data;
  } catch (error) {
    console.error('❌ Error unfollowing user:', error.response?.data || error.message);
    throw error;
  }
};

/**
 * Get user's followers
 */
export const getFollowers = async (userId) => {
  try {
    const response = await axios.get(`${API_URL}/users/${userId}/followers`);
    return response.data;
  } catch (error) {
    console.error('❌ Error fetching followers:', error.response?.data || error.message);
    throw error;
  }
};

/**
 * Get users that a user is following
 */
export const getFollowing = async (userId) => {
  try {
    const response = await axios.get(`${API_URL}/users/${userId}/following`);
    return response.data;
  } catch (error) {
    console.error('❌ Error fetching following:', error.response?.data || error.message);
    throw error;
  }
};

/** 
 * Send a compliment to a user
 * @param {string} recipientId - The user ID to send compliment to
 * @param {string} complimentType - Type of compliment (amazing_taste, on_point, never_miss, top_tier, knows_good_food, custom)
 * @param {string} customMessage - Optional custom message (required if complimentType is 'custom')
 */
export const sendCompliment = async (recipientId, complimentType, customMessage = null) => {
  try {
    const payload = {
      recipient_id: recipientId,
      compliment_type: complimentType,
    };
    
    // Add custom message if provided
    if (customMessage) {
      payload.custom_message = customMessage;
    }
    
    const response = await axios.post(`${API_URL}/compliments/send`, payload);
    return response.data;
  } catch (error) {
    console.error('❌ Error sending compliment:', error.response?.data || error.message);
    throw error;
  }
};

/**
 * Save a post
 */
export const savePost = async (postId) => {
  try {
    const response = await axios.post(`${API_URL}/saved/add`, { postId });
    return response.data;
  } catch (error) {
    console.error('❌ Error saving post:', error.response?.data || error.message);
    throw error;
  }
};

/**
 * Unsave a post
 */
export const unsavePost = async (postId) => {
  try {
    const response = await axios.delete(`${API_URL}/saved/remove/${postId}`);
    return response.data;
  } catch (error) {
    console.error('❌ Error unsaving post:', error.response?.data || error.message);
    throw error;
  }
};

/**
 * Get user's saved posts
 */
export const getSavedPosts = async () => {
  try {
    const response = await axios.get(`${API_URL}/saved/list`);
    return response.data;
  } catch (error) {
    console.error('❌ Error fetching saved posts:', error.response?.data || error.message);
    throw error;
  }
};

/**
 * Search users by username
 */
export const searchUsers = async (query) => {
  try {
    const response = await axios.get(`${API_URL}/search/users`, {
      params: { q: query, limit: 10 },
    });
    return response.data;
  } catch (error) {
    console.error('❌ Error searching users:', error.response?.data || error.message);
    throw error;
  }
};

/**
 * Search locations/restaurants
 */
export const searchLocations = async (query) => {
  try {
    const response = await axios.get(`${API_URL}/search/locations`, {
      params: { q: query, limit: 10 },
    });
    return response.data;
  } catch (error) {
    console.error('❌ Error searching locations:', error.response?.data || error.message);
    throw error;
  }
};

/**
 * Report a post
 */
export const reportPost = async (postId, description) => {
  try {
    const formData = new FormData();
    formData.append('description', description);

    const response = await axios.post(`${API_URL}/posts/${postId}/report`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  } catch (error) {
    console.error('❌ Error reporting post:', error.response?.data || error.message);
    throw error;
  }
};

/**
 * Report a user
 */
export const reportUser = async (userId, description) => {
  try {
    const formData = new FormData();
    formData.append('description', description);

    const response = await axios.post(`${API_URL}/users/${userId}/report`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  } catch (error) {
    console.error('❌ Error reporting user:', error.response?.data || error.message);
    throw error;
  }
};

/**
 * Mark a story as viewed
 */
export const markStoryViewed = async (storyId) => {
  try {
    const response = await axios.post(`${API_URL}/stories/${storyId}/view`);
    return response.data;
  } catch (error) {
    console.error('❌ Error marking story as viewed:', error.response?.data || error.message);
    throw error;
  }
};

/**
 * Get story views count and viewers list
 */
export const getStoryViews = async (storyId) => {
  try {
    const response = await axios.get(`${API_URL}/stories/${storyId}/views`);
    return response.data;
  } catch (error) {
    console.error('❌ Error getting story views:', error.response?.data || error.message);
    throw error;
  }
};

/**
 * Share/repost a story to your own story
 */
export const shareStory = async (storyId) => {
  try {
    const response = await axios.post(`${API_URL}/stories/${storyId}/share`);
    return response.data;
  } catch (error) {
    console.error('❌ Error sharing story:', error.response?.data || error.message);
    throw error;
  }
};

/**
 * Share a post to users via chat
 * @param {string} postId - Post ID to share
 * @param {Array<string>} userIds - Array of user IDs to share with
 * @returns {Promise} - API response
 */
export const sharePostToUsers = async (postId, userIds) => {
  try {
    const response = await axios.post(`${API_URL}/chat/share-post`, {
      post_id: postId,
      user_ids: userIds,
    });
    return response.data;
  } catch (error) {
    console.error('❌ Error sharing post:', error.response?.data || error.message);
    throw error;
  }
};

/**
 * Add a post to story (Add to Story feature)
 * @param {string} postId - Post ID to add to story
 * @param {string} mediaUrl - Media URL from the post
 * @param {string} review - Review text from the post
 * @param {number} rating - Rating from the post
 * @param {string} location - Location name from the post
 * @returns {Promise} - API response
 */
export const addPostToStory = async (postId, mediaUrl, review = "", rating = 0, location = "") => {
  try {
    const response = await axios.post(`${API_URL}/stories/create-from-post`, {
      post_id: postId,
      media_url: mediaUrl,
      review: review,
      rating: rating,
      location: location,
    });
    return response.data;
  } catch (error) {
    console.error('❌ Error adding post to story:', error.response?.data || error.message);
    throw error;
  }
};

export default api;

export const blockUser = async (userId) => {
  const response = await axios.post(`${API_URL}/users/${userId}/block`);
  return response.data;
};

export const unblockUser = async (userId) => {
  const response = await axios.delete(`${API_URL}/users/${userId}/block`);
  return response.data;
};

export const getBlockedUsers = async () => {
  try {
    const response = await axios.get(`${API_URL}/users/blocked-list`);
    return response.data;
  } catch (error) {
    console.error('❌ getBlockedUsers: Error occurred:', {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data,
      url: error.config?.url,
      headers: error.config?.headers
    });
    throw error;
  }
};

export const createRestaurantPost = async (postData) => {
  try {
    const formData = new FormData();

    // Append form fields
    formData.append('price', postData.price);
    formData.append('about', postData.about);
    
    if (postData.map_link) {
      formData.append('map_link', postData.map_link);
    }
    if (postData.location_name) {
      formData.append('location_name', postData.location_name);
    }
    if (postData.category) {
      formData.append('category', postData.category);
    }
    if (postData.dish_name) {
      formData.append('dish_name', postData.dish_name);  // ✅ Add dish name for restaurant posts
    }
    if (postData.media_type) {
      formData.append('media_type', postData.media_type);
    }

    // Append file - handle both web and native
    if (postData.file) {
      if (postData.file.uri) {
        // React Native
        formData.append('file', {
          uri: postData.file.uri,
          name: postData.file.name || postData.file.uri.split('/').pop(),
          type: postData.file.type || 'image/jpeg',
        });
      } else {
        // Web - File object
        formData.append('file', postData.file);
      }
    }

    const response = await axios.post(`${API_URL}/restaurant/posts/create`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
        'Authorization': axios.defaults.headers.common['Authorization'],
      },
    });

    return response.data;
  } catch (error) {
    console.error('❌ Error creating restaurant post:', error.response?.data || error.message);
    throw error;
  }
};

// ==================== CREATE MENU ITEM ====================

export const createMenuItem = async (data: {
  item_name: string;
  price: string;
  description?: string;
  category?: string;
  media_type: string;
  file: any;
}): Promise<any> => {
  const formData = new FormData();
  
  formData.append('item_name', data.item_name);
  formData.append('price', data.price);
  if (data.description) formData.append('description', data.description);
  if (data.category) formData.append('category', data.category);
  formData.append('media_type', data.media_type);
  formData.append('file', data.file);

  const token = await AsyncStorage.getItem('token');
  
  const response = await fetch(
    `${API_BASE_URL}/api/restaurant/posts/menu/create`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: formData,
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to create menu item');
  }

  return response.json();
};

// ==================== GET RESTAURANT MENU ====================

export const getRestaurantMenu = async (restaurantId: string): Promise<any[]> => {
  const token = await AsyncStorage.getItem('token');
  
  const response = await fetch(
    `${API_BASE_URL}/api/restaurant/posts/menu/${restaurantId}`,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error('Failed to fetch menu');
  }

  return response.json();
};

// ==================== DELETE MENU ITEM ====================

export const deleteMenuItem = async (itemId: string): Promise<any> => {
  const token = await AsyncStorage.getItem('token');
  
  const response = await fetch(
    `${API_BASE_URL}/api/restaurant/posts/menu/${itemId}`,
    {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to delete menu item');
  }

  return response.json();
};
