import axios from 'axios';

const API_BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://foodsocial-app.preview.emergentagent.com';
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
 * Create a new post with image upload
 * @param {Object} postData - Post data (rating, review_text, map_link, file)
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
    
    // Append file - handle both web and native
    if (postData.file) {
      // For web: postData.file is a File object
      // For native: postData.file is an object with uri, name, type
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
    const response = await axios.get(`${API_URL}/posts/${postId}/comments`);
    return response.data;
  } catch (error) {
    console.error('❌ Error fetching comments:', error.response?.data || error.message);
    throw error;
  }
};

/**
 * Add a comment to a post
 */
export const addComment = async (postId, commentText) => {
  try {
    const formData = new FormData();
    formData.append('comment_text', commentText);
    
    // Don't set Content-Type manually - let axios handle it for FormData
    const response = await axios.post(`${API_URL}/posts/${postId}/comment`, formData);
    return response.data;
  } catch (error) {
    console.error('❌ Error adding comment:', error.response?.data || error.message);
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

export default api;
