import React, { createContext, useState, useContext, useEffect } from 'react';
import axios from 'axios';
import { storage } from '../utils/storage';

// Use EXPO_PUBLIC_ prefix for environment variables accessible in Expo
const API_BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://food-app-debug.preview.emergentagent.com';
const API_URL = `${API_BASE_URL}/api`;

console.log('🔧 AuthContext initialized with API_URL:', API_URL);

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(null);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      // Get token from storage (SecureStore on native, localStorage on web)
      const storedToken = await storage.getItem('userToken');
      
      if (storedToken) {
        // Set axios authorization header
        axios.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
        
        // Validate token with backend
        try {
          const response = await axios.get(`${API_URL}/auth/me`);
          setUser(response.data);
          setToken(storedToken);
        } catch (error) {
          // Token invalid - delete it
          console.log('Token validation failed:', error.response?.status);
          await storage.deleteItem('userToken');
          delete axios.defaults.headers.common['Authorization'];
        }
      }
    } catch (error) {
      console.log('Error loading user:', error.message);
      try {
        await storage.deleteItem('userToken');
      } catch (deleteError) {
        console.log('Error deleting token:', deleteError);
      }
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    console.log('🔐 AuthContext: Starting login process...');
    console.log('📧 Email:', email);
    console.log('🌐 API URL:', `${API_URL}/auth/login`);
    
    try {
      // FastAPI OAuth2 expects form data with 'username' field
      const formData = new URLSearchParams();
      formData.append('username', email);
      formData.append('password', password);

      console.log('📤 Sending login request...');
      const response = await axios.post(`${API_URL}/auth/login`, formData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      console.log('✅ Login response received:', response.status);
      const { access_token } = response.data;
      console.log('🔑 Token received:', access_token ? 'Yes' : 'No');
      
      // Store token in storage
      await storage.setItem('userToken', access_token);
      console.log('💾 Token stored in SecureStore');
      setToken(access_token);

      // Set axios authorization header
      axios.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
      console.log('🔐 Authorization header set:', axios.defaults.headers.common['Authorization']);

      // Fetch user info
      console.log('👤 Fetching user info from /auth/me...');
      console.log('📡 Request URL:', `${API_URL}/auth/me`);
      console.log('📡 Request headers:', axios.defaults.headers.common);
      
      try {
        const userResponse = await axios.get(`${API_URL}/auth/me`);
        console.log('📥 User response received:', JSON.stringify(userResponse.data));
        
        // Set user state
        setUser(userResponse.data);
        console.log('✅ User state set:', userResponse.data.email);
        console.log('✅ User object:', userResponse.data);
        console.log('✅ isAuthenticated will be:', !!userResponse.data);

        console.log('🎉 Login successful! Returning success...');
        return { success: true, user: userResponse.data };
      } catch (meError) {
        console.error('❌ /auth/me failed:', meError.response?.status);
        console.error('❌ /auth/me error:', meError.response?.data);
        console.error('❌ /auth/me message:', meError.message);
        return {
          success: false,
          error: 'Failed to fetch user profile. Please try again.',
        };
      }
    } catch (error) {
      console.error('❌ Login error:', error.response?.status);
      console.error('❌ Error data:', error.response?.data);
      console.error('❌ Error message:', error.message);
      return {
        success: false,
        error: error.response?.data?.detail || error.message || 'Login failed',
      };
    }
  };

  const signup = async (fullName, email, password) => {
    try {
      const response = await axios.post(`${API_URL}/auth/signup`, {
        full_name: fullName,
        email: email,
        password: password,
      });

      const { access_token } = response.data;
      
      // Store token in SecureStore
      await SecureStore.setItemAsync('userToken', access_token);
      setToken(access_token);

      // Set axios authorization header
      axios.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;

      // Fetch user info
      const userResponse = await axios.get(`${API_URL}/auth/me`);
      setUser(userResponse.data);

      return { success: true };
    } catch (error) {
      console.log('Signup error:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.detail || 'Signup failed',
      };
    }
  };

  const logout = async () => {
    try {
      // Delete token from SecureStore
      await SecureStore.deleteItemAsync('userToken');
      
      // Clear axios authorization header
      delete axios.defaults.headers.common['Authorization'];
      
      // Clear state
      setToken(null);
      setUser(null);
    } catch (error) {
      console.log('Logout error:', error);
    }
  };

  const refreshUser = async () => {
    try {
      const response = await axios.get(`${API_URL}/auth/me`);
      setUser(response.data);
    } catch (error) {
      console.log('Error refreshing user:', error);
      // If refresh fails, logout
      await logout();
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login,
        signup,
        logout,
        refreshUser,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
