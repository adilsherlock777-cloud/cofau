import axios from 'axios';
import { Platform } from 'react-native';

const API_BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://api.cofau.com';
const API_URL = `${API_BASE_URL}/api`;

// Create axios instance
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Note: Authorization header is set globally in AuthContext after login
// via axios.defaults.headers.common['Authorization']

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

    console.log('📤 Creating post with data:', {
      rating: postData.rating,
      review_text: postData.review_text,
      map_link: postData.map_link,
      location_name: postData.location_name,
      category: postData.category,
      media_type: postData.media_type,
      file: postData.file?.name || postData.file?.uri || 'unknown'
    });

    const response = await axios.post(`${API_URL}/posts/create`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
        'Authorization': axios.defaults.headers.common['Authorization'],
      },
    });

    console.log('✅ Post created successfully:', response.data);
    return response.data;
  } catch (error) {
    console.error('❌ Error creating post:', error.response?.data || error.message);
    throw error;
  }
};

/**
 * Like a post
 */
export const likePost = async (postId) => {
  try {
    const response = await axios.post(`${API_URL}/posts/${postId}/like`);
    return response.data;
  } catch (error) {
    console.error('❌ Error liking post:', error.response?.data || error.message);
    throw error;
  }
};

/**
 * Unlike a post
 */
export const unlikePost = async (postId) => {
  try {
    const response = await axios.delete(`${API_URL}/posts/${postId}/like`);
    return response.data;
  } catch (error) {
    console.error('❌ Error unliking post:', error.response?.data || error.message);
    throw error;
  }
};

/**
 * Get comments for a post
 */
export const getComments = async (postId) => {
  try {
    // Normalize postId
    const normalizedPostId = Array.isArray(postId) ? postId[0] : String(postId);

    if (!normalizedPostId || normalizedPostId === 'undefined' || normalizedPostId === 'null') {
      throw new Error('Invalid post ID');
    }

    console.log('📥 Fetching comments for postId:', normalizedPostId);
    const response = await axios.get(`${API_URL}/posts/${normalizedPostId}/comments`);
    return response.data;
  } catch (error) {
    console.error('❌ Error fetching comments:', error.response?.data || error.message);
    throw error;
  }
};

/**
 * Add a comment to a post
 * @param {string} postId - The post ID
 * @param {string} commentText - The comment text
 * @param {string} token - Optional token (if not provided, uses axios defaults)
 */
export const addComment = async (postId, commentText, token = null) => {
  // Validate and normalize postId (outside try block so it's available in catch)
  if (!postId) {
    throw new Error('Post ID is required');
  }

  // Ensure postId is a string (handle array case from expo-router)
  const normalizedPostId = Array.isArray(postId) ? postId[0] : String(postId);

  if (!normalizedPostId || normalizedPostId === 'undefined' || normalizedPostId === 'null') {
    throw new Error('Invalid post ID');
  }

  try {
    const formData = new FormData();
    formData.append('comment_text', commentText.trim());

    // Get authorization token - prefer passed token, fallback to axios defaults
    const authToken = token
      ? `Bearer ${token}`
      : axios.defaults.headers.common['Authorization'];

    if (!authToken) {
      throw new Error('No authorization token found. Please login again.');
    }

    console.log('📤 Adding comment:', {
      postId: normalizedPostId,
      originalPostId: postId,
      commentText: commentText.substring(0, 50),
      tokenSource: token ? 'passed' : 'axios defaults'
    });
    console.log('🔑 Auth token present:', !!authToken);
    console.log('🌐 Platform:', Platform.OS);
    console.log('🌐 API URL:', `${API_URL}/posts/${normalizedPostId}/comment`);

    // Build headers - match post-details implementation exactly
    const headers = {
      'Authorization': authToken,
      'Content-Type': 'multipart/form-data', // Always set like post-details does
    };

    const response = await axios.post(`${API_URL}/posts/${normalizedPostId}/comment`, formData, {
      headers,
    });

    console.log('✅ Comment added successfully');
    return response.data;
  } catch (error) {
    console.error('❌ Error adding comment:', error.response?.data || error.message);
    console.error('❌ Error status:', error.response?.status);
    console.error('❌ Error URL:', `${API_URL}/posts/${normalizedPostId}/comment`);
    console.error('❌ Full error:', error);
    throw error;
  }
};

/**
 * Follow a user
 */
export const followUser = async (userId) => {
  try {
    const response = await axios.post(`${API_URL}/users/${userId}/follow`);
    return response.data;
  } catch (error) {
    console.error('❌ Error following user:', error.response?.data || error.message);
    throw error;
  }
};

/**
 * Unfollow a user
 */
export const unfollowUser = async (userId) => {
  try {
    const response = await axios.delete(`${API_URL}/users/${userId}/follow`);
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
