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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import axios from 'axios';

const API_BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://api.cofau.com';
const API_URL = `${API_BASE_URL}/api`;

export default function SignupScreen() {
  const router = useRouter();
  const { signup } = useAuth();
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Username validation states
  const [usernameError, setUsernameError] = useState('');
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [usernameSuggestions, setUsernameSuggestions] = useState<string[]>([]);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const usernameCheckTimeout = useRef<NodeJS.Timeout | null>(null);

  // Check username availability
  const checkUsernameAvailability = async (usernameToCheck: string): Promise<boolean> => {
    if (!usernameToCheck || usernameToCheck.trim().length < 3) {
      setUsernameError('');
      setUsernameAvailable(null);
      setUsernameSuggestions([]);
      return false;
    }

    setCheckingUsername(true);
    try {
      const response = await axios.get(`${API_URL}/api/auth/check-username`, {
        params: { username: usernameToCheck },
      });

      if (response.data.available) {
        setUsernameAvailable(true);
        setUsernameError('');
        setUsernameSuggestions([]);
        return true;
      } else {
        setUsernameAvailable(false);
        setUsernameError(`Username "${usernameToCheck}" is already taken`);
        setUsernameSuggestions(response.data.suggestions || []);
        return false;
      }
    } catch (error: any) {
      console.error('Error checking username:', error);
      setUsernameAvailable(null);
      setUsernameError('');
      setUsernameSuggestions([]);
      return false;
    } finally {
      setCheckingUsername(false);
    }
  };

  // Handle username input with debounce
  const handleUsernameChange = (text: string) => {
    setUsername(text);
    setUsernameAvailable(null);
    setUsernameError('');
    setUsernameSuggestions([]);

    // Clear previous timeout
    if (usernameCheckTimeout.current) {
      clearTimeout(usernameCheckTimeout.current);
    }

    // Debounce username check (wait 500ms after user stops typing)
    if (text.trim().length >= 3) {
      usernameCheckTimeout.current = setTimeout(() => {
        checkUsernameAvailability(text);
      }, 500);
    }
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (usernameCheckTimeout.current) {
        clearTimeout(usernameCheckTimeout.current);
      }
    };
  }, []);

  // Handle suggestion selection
  const handleSelectSuggestion = (suggestedUsername: string) => {
    setUsername(suggestedUsername);
    setUsernameAvailable(true);
    setUsernameError('');
    setUsernameSuggestions([]);
    // Verify the selected username is available
    checkUsernameAvailability(suggestedUsername);
  };

  const handleSignup = async () => {
    // Basic validation
    if (!fullName || !username || !email || !password || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (username.trim().length < 3) {
      Alert.alert('Error', 'Username must be at least 3 characters');
      return;
    }

    // Check username availability before signup
    if (checkingUsername) {
      Alert.alert('Please Wait', 'Checking username availability...');
      return;
    }

    // If username hasn't been checked yet, check it now
    if (usernameAvailable === null && username.trim().length >= 3) {
      const isAvailable = await checkUsernameAvailability(username.trim());
      if (!isAvailable) {
        Alert.alert('Username Taken', 'Please choose a different username or select one of the suggestions');
        return;
      }
    }

    if (usernameAvailable === false) {
      Alert.alert('Username Taken', 'Please choose a different username or select one of the suggestions');
      return;
    }

    if (password.length < 4) {
      Alert.alert('Error', 'Password must be at least 4 characters');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      // Call backend signup API
      const result = await signup(fullName, username.trim(), email, password);

      if (result.success) {
        // Success - AuthContext will handle redirect
        Alert.alert(
          'Account Created! 🎉',
          'Welcome to Cofau',
          [
            {
              text: 'OK',
              onPress: () => router.replace('/feed'),
            },
          ]
        );
      } else {
        // Show error from backend
        Alert.alert('Signup Failed', result.error || 'Please try again');
      }
    } catch (error) {
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
      console.error('Signup error:', error);
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
          <LinearGradient
            colors={['#4dd0e1', '#ba68c8', '#ff80ab']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.logo}
          >
            <Text style={styles.logoText}>C</Text>
          </LinearGradient>
        </View>

        {/* Title */}
        <Text style={styles.title}>Create Account</Text>
        <Text style={styles.subtitle}>Join Cofau today</Text>

        {/* Form */}
        <View style={styles.form}>
          {/* Full Name Input */}
          <View style={styles.inputContainer}>
            <Ionicons name="person-outline" size={20} color="#999" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Full Name"
              placeholderTextColor="#999"
              value={fullName}
              onChangeText={setFullName}
              autoCapitalize="words"
            />
          </View>

          {/* Username Input */}
          <View style={styles.inputContainer}>
            <Ionicons name="at-outline" size={20} color="#999" style={styles.inputIcon} />
            <TextInput
              style={[
                styles.input,
                usernameAvailable === true && styles.inputSuccess,
                usernameAvailable === false && styles.inputError,
              ]}
              placeholder="Username"
              placeholderTextColor="#999"
              value={username}
              onChangeText={handleUsernameChange}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {checkingUsername && (
              <ActivityIndicator size="small" color="#4dd0e1" style={styles.checkingIndicator} />
            )}
            {usernameAvailable === true && !checkingUsername && (
              <Ionicons name="checkmark-circle" size={20} color="#4CAF50" style={styles.statusIcon} />
            )}
            {usernameAvailable === false && !checkingUsername && (
              <Ionicons name="close-circle" size={20} color="#F44336" style={styles.statusIcon} />
            )}
          </View>

          {/* Username Error Message */}
          {usernameError ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{usernameError}</Text>
            </View>
          ) : null}

          {/* Username Suggestions */}
          {usernameSuggestions.length > 0 && (
            <View style={styles.suggestionsContainer}>
              <Text style={styles.suggestionsTitle}>Suggested usernames:</Text>
              {usernameSuggestions.map((suggestion, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.suggestionItem}
                  onPress={() => handleSelectSuggestion(suggestion)}
                >
                  <Ionicons name="arrow-forward-circle-outline" size={16} color="#4dd0e1" />
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
              colors={['#4dd0e1', '#ba68c8', '#ff80ab']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.button}
            >
              {loading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.buttonText}>Create Account</Text>
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
  logo: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  logoText: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#FFF',
  },
  title: {
    fontSize: 32,
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
  eyeIcon: {
    padding: 4,
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
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFF',
    letterSpacing: 1,
  },
  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loginText: {
    fontSize: 14,
    color: '#999',
  },
  loginLink: {
    fontSize: 14,
    color: '#4dd0e1',
    fontWeight: '600',
  },
  inputSuccess: {
    borderColor: '#4CAF50',
  },
  inputError: {
    borderColor: '#F44336',
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
});