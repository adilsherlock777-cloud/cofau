import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

const API_BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://api.cofau.com';
const API_URL = `${API_BASE_URL}/api`;

export default function RestaurantSignupScreen() {
  const router = useRouter();
  const [restaurantName, setRestaurantName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // Restaurant name validation states
  const [nameError, setNameError] = useState('');
  const [nameAvailable, setNameAvailable] = useState<boolean | null>(null);
  const [nameSuggestions, setNameSuggestions] = useState<string[]>([]);
  const [checkingName, setCheckingName] = useState(false);
  const nameCheckTimeout = useRef<NodeJS.Timeout | null>(null);

  // Check restaurant name availability
  const checkNameAvailability = async (nameToCheck: string): Promise<boolean> => {
    if (!nameToCheck || nameToCheck.trim().length < 3) {
      setNameError('');
      setNameAvailable(null);
      setNameSuggestions([]);
      return false;
    }

    setCheckingName(true);
    try {
      const response = await axios.get(`${API_URL}/restaurant/auth/check-name`, {
        params: { name: nameToCheck.trim() },
      });

      if (response.data && response.data.available === true) {
        setNameAvailable(true);
        setNameError('');
        setNameSuggestions([]);
        return true;
      } else {
        setNameAvailable(false);
        setNameError(response.data?.message || `Restaurant name "${nameToCheck}" is already taken`);
        setNameSuggestions(response.data?.suggestions || []);
        return false;
      }
    } catch (error: any) {
      console.error('Error checking restaurant name:', error);
      if (error.response?.status === 404) {
        setNameAvailable(false);
        setNameError('Unable to verify restaurant name. Please try again.');
        setNameSuggestions([]);
        return false;
      }
      setNameAvailable(null);
      setNameError('Could not verify name availability. Please try again.');
      setNameSuggestions([]);
      return false;
    } finally {
      setCheckingName(false);
    }
  };

  // Handle restaurant name input with debounce
  const handleNameChange = (text: string) => {
    setRestaurantName(text);
    setNameAvailable(null);
    setNameError('');
    setNameSuggestions([]);

    // Clear previous timeout
    if (nameCheckTimeout.current) {
      clearTimeout(nameCheckTimeout.current);
    }

    // Debounce name check (wait 500ms after user stops typing)
    if (text.trim().length >= 3) {
      nameCheckTimeout.current = setTimeout(() => {
        checkNameAvailability(text);
      }, 500);
    }
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (nameCheckTimeout.current) {
        clearTimeout(nameCheckTimeout.current);
      }
    };
  }, []);

  // Handle suggestion selection
  const handleSelectSuggestion = (suggestedName: string) => {
    setRestaurantName(suggestedName);
    setNameAvailable(true);
    setNameError('');
    setNameSuggestions([]);
    // Verify the selected name is available
    checkNameAvailability(suggestedName);
  };

  const showAlert = (title: string, message: string, onOk?: () => void) => {
    if (Platform.OS === 'web') {
      window.alert(`${title}\n${message}`);
      if (onOk) onOk();
    } else {
      Alert.alert(title, message, [{ text: 'OK', onPress: onOk }]);
    }
  };

  const handleSignup = async () => {
    // Basic validation
    if (!restaurantName || !email || !password || !confirmPassword) {
      showAlert('Error', 'Please fill in all fields');
      return;
    }

    if (restaurantName.trim().length < 3) {
      showAlert('Error', 'Restaurant name must be at least 3 characters');
      return;
    }

    // Check name availability before signup
    if (checkingName) {
      showAlert('Please Wait', 'Checking restaurant name availability...');
      return;
    }

    // Always check name availability before signup
    const trimmedName = restaurantName.trim();
    if (trimmedName.length >= 3) {
      const isAvailable = await checkNameAvailability(trimmedName);
      if (!isAvailable) {
        if (nameSuggestions.length > 0) {
          showAlert(
            'Name Taken',
            `"${trimmedName}" is already taken. Please choose a different name or select one of the suggestions below.`
          );
        } else {
          showAlert(
            'Name Taken',
            `"${trimmedName}" is already taken. Please choose a different name.`
          );
        }
        return;
      }
    } else {
      showAlert('Error', 'Restaurant name must be at least 3 characters');
      return;
    }

    if (password.length < 6) {
      showAlert('Error', 'Password must be at least 6 characters');
      return;
    }

    if (password !== confirmPassword) {
      showAlert('Error', 'Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      // Call restaurant signup API
      const response = await axios.post(`${API_URL}/restaurant/auth/signup`, {
        restaurant_name: trimmedName,
        email: email.trim(),
        password: password,
        confirm_password: confirmPassword,
      });

      if (response.data && response.data.access_token) {
        // Store token and account type
        await AsyncStorage.setItem('token', response.data.access_token);
        await AsyncStorage.setItem('account_type', 'restaurant');

        showAlert(
          'Account Created! 🎉',
          'Welcome to Cofau! Your restaurant account has been created.',
          () => {
            // Navigate to restaurant feed/home (you can change this route)
            router.replace('/feed');
          }
        );
      } else {
        showAlert('Signup Failed', 'Unexpected response from server. Please try again.');
      }
    } catch (error: any) {
      console.error('Restaurant signup error:', error);
      const errorMessage =
        error.response?.data?.detail || error.message || 'An unexpected error occurred. Please try again.';

      // If name is taken, update UI state
      if (errorMessage.toLowerCase().includes('name') && errorMessage.toLowerCase().includes('taken')) {
        setNameAvailable(false);
        setNameError(`Restaurant name "${trimmedName}" is already taken`);
        await checkNameAvailability(trimmedName);
      }

      showAlert('Signup Failed', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Logo */}
        <View style={styles.logoContainer}>
          <Image
            source={require('../../assets/images/icon.png')}
            style={styles.logoImage}
          />
        </View>

        {/* Title */}
        <Text style={styles.title}>Restaurant Sign Up</Text>
        <Text style={styles.subtitle}>Join Cofau as a Restaurant</Text>

        {/* Form */}
        <View style={styles.form}>
          {/* Restaurant Name Input */}
          <View style={styles.inputContainer}>
            <Ionicons name="restaurant-outline" size={20} color="#999" style={styles.inputIcon} />
            <TextInput
              style={[
                styles.input,
                nameAvailable === true && styles.inputSuccess,
                nameAvailable === false && styles.inputError,
              ]}
              placeholder="Restaurant Name"
              placeholderTextColor="#999"
              value={restaurantName}
              onChangeText={handleNameChange}
              autoCapitalize="words"
              autoCorrect={false}
            />
            {checkingName && (
              <ActivityIndicator size="small" color="#1B7C82" style={styles.checkingIndicator} />
            )}
            {nameAvailable === true && !checkingName && (
              <Ionicons name="checkmark-circle" size={20} color="#4CAF50" style={styles.statusIcon} />
            )}
            {nameAvailable === false && !checkingName && (
              <Ionicons name="close-circle" size={20} color="#F44336" style={styles.statusIcon} />
            )}
          </View>

          {/* Name Error Message */}
          {nameError ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{nameError}</Text>
            </View>
          ) : null}

          {/* Name Suggestions */}
          {nameSuggestions.length > 0 && (
            <View style={styles.suggestionsContainer}>
              <Text style={styles.suggestionsTitle}>Suggested names:</Text>
              {nameSuggestions.map((suggestion, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.suggestionItem}
                  onPress={() => handleSelectSuggestion(suggestion)}
                >
                  <Ionicons name="arrow-forward-circle-outline" size={16} color="#1B7C82" />
                  <Text style={styles.suggestionText}>{suggestion}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Email Input */}
          <View style={styles.inputContainer}>
            <Ionicons name="mail-outline" size={20} color="#999" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor="#999"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          {/* Password Input */}
          <View style={styles.inputContainer}>
            <Ionicons name="lock-closed-outline" size={20} color="#999" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor="#999"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
            />
            <TouchableOpacity
              onPress={() => setShowPassword(!showPassword)}
              style={styles.eyeIcon}
            >
              <Ionicons
                name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                size={20}
                color="#999"
              />
            </TouchableOpacity>
          </View>

          {/* Confirm Password Input */}
          <View style={styles.inputContainer}>
            <Ionicons name="lock-closed-outline" size={20} color="#999" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Confirm Password"
              placeholderTextColor="#999"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry={!showConfirmPassword}
              autoCapitalize="none"
            />
            <TouchableOpacity
              onPress={() => setShowConfirmPassword(!showConfirmPassword)}
              style={styles.eyeIcon}
            >
              <Ionicons
                name={showConfirmPassword ? 'eye-outline' : 'eye-off-outline'}
                size={20}
                color="#999"
              />
            </TouchableOpacity>
          </View>

          {/* Create Account Button */}
          <TouchableOpacity
            style={styles.buttonContainer}
            onPress={handleSignup}
            activeOpacity={0.8}
            disabled={loading}
          >
            <LinearGradient
              colors={['#E94A37', '#F2CF68', '#1B7C82']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.button}
            >
              {loading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.buttonText}>Create Restaurant Account</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>

          {/* Login Link */}
          <View style={styles.loginContainer}>
            <Text style={styles.loginText}>Already have an account? </Text>
            <TouchableOpacity onPress={() => router.push('/auth/login')}>
              <Text style={styles.loginLink}>Login</Text>
            </TouchableOpacity>
          </View>

          {/* User Signup Link */}
          <View style={styles.userSignupContainer}>
            <Text style={styles.userSignupText}>Not a restaurant? </Text>
            <TouchableOpacity onPress={() => router.push('/auth/signup')}>
              <Text style={styles.userSignupLink}>Sign up as User</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logoImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
    marginBottom: 40,
  },
  form: {
    width: '100%',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    paddingHorizontal: 16,
    marginBottom: 16,
    height: 56,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  inputSuccess: {
    borderColor: '#4CAF50',
  },
  inputError: {
    borderColor: '#F44336',
  },
  eyeIcon: {
    padding: 4,
  },
  checkingIndicator: {
    marginLeft: 8,
  },
  statusIcon: {
    marginLeft: 8,
  },
  errorContainer: {
    marginTop: -12,
    marginBottom: 8,
    marginLeft: 4,
  },
  errorText: {
    fontSize: 12,
    color: '#F44336',
  },
  suggestionsContainer: {
    marginTop: -8,
    marginBottom: 16,
    padding: 12,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  suggestionsTitle: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
    fontWeight: '600',
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 8,
    marginBottom: 4,
    borderRadius: 6,
    backgroundColor: '#FFF',
  },
  suggestionText: {
    fontSize: 14,
    color: '#333',
    marginLeft: 8,
    flex: 1,
  },
  buttonContainer: {
    marginTop: 8,
    marginBottom: 24,
  },
  button: {
    height: 56,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFF',
    letterSpacing: 0.5,
  },
  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  loginText: {
    fontSize: 14,
    color: '#999',
  },
  loginLink: {
    fontSize: 14,
    color: '#1B7C82',
    fontWeight: '600',
  },
  userSignupContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  userSignupText: {
    fontSize: 14,
    color: '#999',
  },
  userSignupLink: {
    fontSize: 14,
    color: '#1B7C82',
    fontWeight: '600',
  },
});