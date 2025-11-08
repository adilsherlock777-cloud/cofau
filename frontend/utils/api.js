import axios from 'axios';

const API_BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://food-app-debug.preview.emergentagent.com';
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

export default api;
