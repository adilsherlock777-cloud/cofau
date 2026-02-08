import React, { createContext, useState, useContext, useEffect } from 'react';
import axios from 'axios';
import { storage } from '../utils/storage';
import { registerForPushNotificationsAsync } from '../utils/pushNotifications';

// Use EXPO_PUBLIC_ prefix for environment variables accessible in Expo
import Constants from 'expo-constants';

const API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || 'https://api.cofau.com';

console.log('🔧 AuthContext initialized with API_URL:', API_URL);

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
          console.log('🔔 Registering for push notifications on app startup...');
          console.log(`   Account type: ${storedAccountType || 'user'}`);
          registerForPushNotificationsAsync(storedToken, storedAccountType || 'user').catch(err => {
            console.log('⚠️ Push notification registration failed:', err);
            setTimeout(() => {
              console.log('🔄 Retrying push notification registration...');
              registerForPushNotificationsAsync(storedToken, storedAccountType || 'user').catch(() => {});
            }, 3000);
          });
        } catch (error) {
          // Token invalid - delete it
          console.log('Token validation failed:', error.response?.status);
          await storage.deleteItem('userToken');
          await storage.deleteItem('accountType');
          delete axios.defaults.headers.common['Authorization'];
          setAccountType(null);
        }
      }
    } catch (error) {
      console.log('Error loading user:', error.message);
      try {
        await storage.deleteItem('userToken');
        await storage.deleteItem('accountType');
      } catch (deleteError) {
        console.log('Error deleting token:', deleteError);
      }
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password, loginAsRestaurant = false) => {
    console.log('🔐 AuthContext: Starting login process...');
    console.log('📧 Email:', email);
    console.log('🏪 Login as Restaurant:', loginAsRestaurant);

    // Determine endpoints based on account type
    const loginEndpoint = loginAsRestaurant
      ? `${API_URL}/api/restaurant/auth/login`
      : `${API_URL}/api/auth/login`;

    const meEndpoint = loginAsRestaurant
      ? `${API_URL}/api/restaurant/auth/me`
      : `${API_URL}/api/auth/me`;

    console.log('🌐 Login URL:', loginEndpoint);

    try {
      // FastAPI OAuth2 expects form data with 'username' field
      const formData = new URLSearchParams();
      formData.append('username', email);
      formData.append('password', password);

      console.log('📤 Sending login request...');
      const response = await axios.post(loginEndpoint, formData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      console.log('✅ Login response received:', response.status);
      const { access_token } = response.data;
      console.log('🔑 Token received:', access_token ? 'Yes' : 'No');

      // Store token and account type in storage
      await storage.setItem('userToken', access_token);
      const accType = loginAsRestaurant ? 'restaurant' : 'user';
      await storage.setItem('accountType', accType);
      console.log('💾 Token and accountType stored');

      setToken(access_token);
      setAccountType(accType);

      // Set axios authorization header
      axios.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
      console.log('🔐 Authorization header set');

      // Fetch user/restaurant info
      console.log('👤 Fetching profile from:', meEndpoint);

      try {
        const userResponse = await axios.get(meEndpoint);
        console.log('📥 Profile response received:', JSON.stringify(userResponse.data));

        // Set user state
        setUser(userResponse.data);
        console.log('✅ User state set:', userResponse.data.email);

        // Register for push notifications immediately after login
        console.log('🔔 Registering for push notifications after login...');
        console.log(`   Account type: ${accType}`);
        registerForPushNotificationsAsync(access_token, accType).catch(err => {
          console.log('⚠️ Push notification registration failed:', err);
          setTimeout(() => {
            console.log('🔄 Retrying push notification registration...');
            registerForPushNotificationsAsync(access_token, accType).catch(() => {});
          }, 3000);
        });

        console.log('🎉 Login successful! Returning success...');
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
      console.log('🔔 Registering for push notifications after signup...');
      registerForPushNotificationsAsync(access_token, 'user').catch(err => {
        console.log('⚠️ Push notification registration failed:', err);
        setTimeout(() => {
          console.log('🔄 Retrying push notification registration...');
          registerForPushNotificationsAsync(access_token, 'user').catch(() => {});
        }, 3000);
      });

      return { success: true };
    } catch (error) {
      console.log('Signup error:', error.response?.data || error.message);
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
      console.log('🔔 Registering for push notifications after restaurant signup...');
      registerForPushNotificationsAsync(access_token, 'restaurant').catch(err => {
        console.log('⚠️ Push notification registration failed:', err);
        setTimeout(() => {
          console.log('🔄 Retrying push notification registration...');
          registerForPushNotificationsAsync(access_token, 'restaurant').catch(() => {});
        }, 3000);
      });

      return { success: true };
    } catch (error) {
      console.log('Restaurant signup error:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.detail || 'Restaurant signup failed',
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
      console.log('Logout error:', error);
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
        console.log('Error refreshing user:', error);
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