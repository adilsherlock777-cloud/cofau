import React, { createContext, useState, useContext, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';

const API_BASE_URL = 'https://cofau-feed-ui.preview.emergentagent.com/api';

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
      // Get token from SecureStore
      const storedToken = await SecureStore.getItemAsync('userToken');
      
      if (storedToken) {
        // Set axios authorization header
        axios.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
        
        // Validate token with backend
        try {
          const response = await axios.get(`${API_BASE_URL}/auth/me`);
          setUser(response.data);
          setToken(storedToken);
        } catch (error) {
          // Token invalid - delete it
          console.log('Token validation failed:', error.response?.status);
          await SecureStore.deleteItemAsync('userToken');
          delete axios.defaults.headers.common['Authorization'];
        }
      }
    } catch (error) {
      console.log('Error loading user:', error.message);
      try {
        await SecureStore.deleteItemAsync('userToken');
      } catch (deleteError) {
        console.log('Error deleting token:', deleteError);
      }
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    try {
      // FastAPI OAuth2 expects form data with 'username' field
      const formData = new URLSearchParams();
      formData.append('username', email);
      formData.append('password', password);

      const response = await axios.post(`${API_BASE_URL}/auth/login`, formData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      const { access_token } = response.data;
      
      // Store token in SecureStore
      await SecureStore.setItemAsync('userToken', access_token);
      setToken(access_token);

      // Set axios authorization header
      axios.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;

      // Fetch user info
      const userResponse = await axios.get(`${API_BASE_URL}/auth/me`);
      setUser(userResponse.data);

      return { success: true };
    } catch (error) {
      console.log('Login error:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.detail || 'Login failed',
      };
    }
  };

  const signup = async (fullName, email, password) => {
    try {
      const response = await axios.post(`${API_BASE_URL}/auth/signup`, {
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
      const userResponse = await axios.get(`${API_BASE_URL}/auth/me`);
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
      const response = await axios.get(`${API_BASE_URL}/auth/me`);
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
        isAuthenticated: !!token,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
