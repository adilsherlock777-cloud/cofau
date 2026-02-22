import React, { createContext, useState, useContext, useEffect } from 'react';
import axios from 'axios';
import { storage } from '../utils/storage';
import { registerForPushNotificationsAsync } from '../utils/pushNotifications';

// Use EXPO_PUBLIC_ prefix for environment variables accessible in Expo
import Constants from 'expo-constants';

const API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || 'https://api.cofau.com';

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(null);
  const [accountType, setAccountType] = useState(null); // 'user' or 'restaurant'

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      // Get token and account type from storage
      const storedToken = await storage.getItem('userToken');
      const storedAccountType = await storage.getItem('accountType');

      if (storedAccountType) {
        setAccountType(storedAccountType);
      }

      if (storedToken) {
        // Set axios authorization header
        axios.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;

        // Determine which endpoint to use based on account type
        const meEndpoint = storedAccountType === 'restaurant'
          ? `${API_URL}/api/restaurant/auth/me`
          : `${API_URL}/api/auth/me`;

        // Validate token with backend
        try {
          const response = await axios.get(meEndpoint);
          setUser(response.data);
          setToken(storedToken);

          // Register for push notifications (works even without navigation)
          registerForPushNotificationsAsync(storedToken, storedAccountType || 'user').catch(err => {
            setTimeout(() => {
              registerForPushNotificationsAsync(storedToken, storedAccountType || 'user').catch(() => {});
            }, 3000);
          });
        } catch (error) {
          // Token invalid - delete it
          await storage.deleteItem('userToken');
          await storage.deleteItem('accountType');
          delete axios.defaults.headers.common['Authorization'];
          setAccountType(null);
        }
      }
    } catch (error) {
      try {
        await storage.deleteItem('userToken');
        await storage.deleteItem('accountType');
      } catch (deleteError) {
      }
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password, loginAsRestaurant = false) => {

    // Determine endpoints based on account type
    const loginEndpoint = loginAsRestaurant
      ? `${API_URL}/api/restaurant/auth/login`
      : `${API_URL}/api/auth/login`;

    const meEndpoint = loginAsRestaurant
      ? `${API_URL}/api/restaurant/auth/me`
      : `${API_URL}/api/auth/me`;

    try {
      // FastAPI OAuth2 expects form data with 'username' field
      const formData = new URLSearchParams();
      formData.append('username', email);
      formData.append('password', password);

      const response = await axios.post(loginEndpoint, formData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      const { access_token } = response.data;

      // Store token and account type in storage
      await storage.setItem('userToken', access_token);
      const accType = loginAsRestaurant ? 'restaurant' : 'user';
      await storage.setItem('accountType', accType);

      setToken(access_token);
      setAccountType(accType);

      // Set axios authorization header
      axios.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;

      // Fetch user/restaurant info

      try {
        const userResponse = await axios.get(meEndpoint);

        // Set user state
        setUser(userResponse.data);

        // Register for push notifications immediately after login
        registerForPushNotificationsAsync(access_token, accType).catch(err => {
          setTimeout(() => {
            registerForPushNotificationsAsync(access_token, accType).catch(() => {});
          }, 3000);
        });

        return { success: true, user: userResponse.data };
      } catch (meError) {
        console.error('❌ /auth/me failed:', meError.response?.status);
        console.error('❌ /auth/me error:', meError.response?.data);
        return {
          success: false,
          error: 'Failed to fetch profile. Please try again.',
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

  const signup = async (fullName, username, email, password, phoneNumber = null, phoneVerified = false) => {
    try {
      const response = await axios.post(`${API_URL}/api/auth/signup`, {
        full_name: fullName,
        username: username,
        email: email,
        password: password,
        phone_number: phoneNumber,
        phone_verified: phoneVerified,
      });

      const { access_token } = response.data;

      // Store token and account type in storage
      await storage.setItem('userToken', access_token);
      await storage.setItem('accountType', 'user');
      setToken(access_token);
      setAccountType('user');

      // Set axios authorization header
      axios.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;

      // Fetch user info
      const userResponse = await axios.get(`${API_URL}/api/auth/me`);
      setUser(userResponse.data);

      // Register for push notifications immediately after signup
      registerForPushNotificationsAsync(access_token, 'user').catch(err => {
        setTimeout(() => {
          registerForPushNotificationsAsync(access_token, 'user').catch(() => {});
        }, 3000);
      });

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.detail || 'Signup failed',
      };
    }
  };

  const restaurantSignup = async (restaurantName, email, password) => {
    try {
      const response = await axios.post(`${API_URL}/api/restaurant/auth/signup`, {
        restaurant_name: restaurantName,
        email: email,
        password: password,
        confirm_password: password,
      });

      const { access_token } = response.data;

      // Store token and account type in storage
      await storage.setItem('userToken', access_token);
      await storage.setItem('accountType', 'restaurant');
      setToken(access_token);
      setAccountType('restaurant');

      // Set axios authorization header
      axios.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;

      // Fetch restaurant info
      const restaurantResponse = await axios.get(`${API_URL}/api/restaurant/auth/me`);
      setUser(restaurantResponse.data);

      // Register for push notifications
      registerForPushNotificationsAsync(access_token, 'restaurant').catch(err => {
        setTimeout(() => {
          registerForPushNotificationsAsync(access_token, 'restaurant').catch(() => {});
        }, 3000);
      });

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.detail || 'Restaurant signup failed',
      };
    }
  };

  const loginWithPhone = async (phoneNumber, loginAsRestaurant = false) => {

    // Determine endpoints based on account type
    const loginEndpoint = loginAsRestaurant
      ? `${API_URL}/api/restaurant/auth/login-phone`
      : `${API_URL}/api/auth/login-phone`;

    const meEndpoint = loginAsRestaurant
      ? `${API_URL}/api/restaurant/auth/me`
      : `${API_URL}/api/auth/me`;

    try {
      const response = await axios.post(loginEndpoint, {
        phone_number: phoneNumber,
      });

      const { access_token } = response.data;

      // Store token and account type in storage
      await storage.setItem('userToken', access_token);
      const accType = loginAsRestaurant ? 'restaurant' : 'user';
      await storage.setItem('accountType', accType);

      setToken(access_token);
      setAccountType(accType);

      // Set axios authorization header
      axios.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;

      // Fetch user/restaurant info

      try {
        const userResponse = await axios.get(meEndpoint);

        // Set user state
        setUser(userResponse.data);

        // Register for push notifications immediately after login
        registerForPushNotificationsAsync(access_token, accType).catch(err => {
        });

        return { success: true, user: userResponse.data };
      } catch (meError) {
        console.error('❌ /auth/me failed:', meError.response?.status);
        return {
          success: false,
          error: 'Failed to fetch profile. Please try again.',
        };
      }
    } catch (error) {
      console.error('❌ Phone login error:', error.response?.status);
      console.error('❌ Error data:', error.response?.data);
      return {
        success: false,
        error: error.response?.data?.detail || error.message || 'Phone login failed',
      };
    }
  };

  const logout = async () => {
    try {
      // Delete token and account type from storage
      await storage.deleteItem('userToken');
      await storage.deleteItem('accountType');

      // Clear axios authorization header
      delete axios.defaults.headers.common['Authorization'];

      // Clear state
      setToken(null);
      setUser(null);
      setAccountType(null);
    } catch (error) {
    }
  };

  const refreshUser = async () => {
    try {
      // Determine which endpoint to use based on account type
      const meEndpoint = accountType === 'restaurant'
        ? `${API_URL}/api/restaurant/auth/me`
        : `${API_URL}/api/auth/me`;

      const response = await axios.get(meEndpoint);
      setUser(response.data);
    } catch (error) {
      // Only log if it's not a 401 (expected when not authenticated)
      if (error.response?.status !== 401) {
      }
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
        accountType,
        login,
        loginWithPhone,
        signup,
        restaurantSignup,
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