import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { Image } from 'react-native';

export default function LoginScreen() {
  console.log('🎬 LoginScreen component rendered');
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isRestaurant, setIsRestaurant] = useState(false); // Toggle for restaurant login
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const showAlert = (title: string, message: string) => {
    if (Platform.OS === 'web') {
      window.alert(`${title}\n${message}`);
    } else {
      console.log(`Alert: ${title} - ${message}`);
    }
  };

const handleLogin = async () => {
    console.log('🚀 Login Screen: handleLogin called');
    console.log('📧 Email input:', email);
    console.log('🔒 Password length:', password.length);
    console.log('🏪 Is Restaurant:', isRestaurant);
    
    // Clear previous errors
    setEmailError('');
    setPasswordError('');
    
    // Basic validation
    if (!email || !password) {
      if (!email) setEmailError('Email is required');
      if (!password) setPasswordError('Password is required');
      console.log('❌ Validation failed: Missing fields');
      return;
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setEmailError('Please enter a valid email address');
      console.log('❌ Validation failed: Invalid email format');
      return;
    }

    if (password.length < 4) {
      setPasswordError('Password must be at least 4 characters');
      console.log('❌ Validation failed: Password too short');
      return;
    }

    console.log('✅ Validation passed, setting loading state');
    setLoading(true);

    try {
      console.log('🔄 Calling login from AuthContext...');
      // Call backend login API with isRestaurant flag
      const result = await login(email, password, isRestaurant);
      console.log('📥 Login result received:', result);

      if (result.success) {
        console.log('✅ Login successful! Auth state updated.');
        const welcomeMessage = isRestaurant 
          ? 'Welcome back to Cofau Restaurant!' 
          : 'Welcome back to Cofau';
        showAlert('Login Successful! 🎉', welcomeMessage);
      } else {
        console.log('❌ Login failed:', result.error);
        
        // Parse error message to show specific field errors
        const errorMessage = (result.error || '').toLowerCase();
        
        if (errorMessage.includes('email') && errorMessage.includes('not found')) {
          setEmailError('No account found with this email');
        } else if (errorMessage.includes('user not found') || errorMessage.includes('no user')) {
          setEmailError('No account found with this email');
        } else if (errorMessage.includes('password') || errorMessage.includes('incorrect') || errorMessage.includes('invalid credentials')) {
          setPasswordError('Incorrect password. Please try again.');
        } else if (errorMessage.includes('restaurant') && errorMessage.includes('not found')) {
          setEmailError('No restaurant account found with this email');
        } else {
          // Generic error - show on password field
          setPasswordError(result.error || 'Login failed. Please check your credentials.');
        }
      }
    } catch (error: any) {
      console.error('💥 Unexpected error in handleLogin:', error);
      const errorMessage = error?.response?.data?.detail || error?.message || '';
      
      if (errorMessage.toLowerCase().includes('email') || errorMessage.toLowerCase().includes('user not found')) {
        setEmailError('No account found with this email');
      } else if (errorMessage.toLowerCase().includes('password') || errorMessage.toLowerCase().includes('incorrect')) {
        setPasswordError('Incorrect password. Please try again.');
      } else {
        setPasswordError('An unexpected error occurred. Please try again.');
      }
    } finally {
      console.log('🏁 Login process completed, clearing loading state');
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
        <Text style={styles.title}>Login</Text>
        <Text style={styles.subtitle}>
          {isRestaurant ? 'Welcome back, Restaurant!' : 'Welcome back to Cofau'}
        </Text>

        {/* Form */}
        <View style={styles.form}>
          {/* Restaurant Toggle */}
          <View style={styles.toggleContainer}>
            <Text style={styles.toggleLabel}>Login as Restaurant</Text>
            <Switch
              value={isRestaurant}
              onValueChange={setIsRestaurant}
              trackColor={{ false: '#E0E0E0', true: '#1B7C82' }}
              thumbColor={isRestaurant ? '#FFF' : '#FFF'}
              ios_backgroundColor="#E0E0E0"
            />
          </View>

          {/* Email Input */}
          <View style={[
            styles.inputContainer,
            emailError ? styles.inputError : null
          ]}>
            <Ionicons 
              name="mail-outline" 
              size={20} 
              color={emailError ? '#F44336' : '#999'} 
              style={styles.inputIcon} 
            />
            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor="#999"
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                setEmailError(''); // Clear error when user types
              }}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
            {emailError ? (
              <Ionicons name="alert-circle" size={20} color="#F44336" />
            ) : null}
          </View>
          
          {/* Email Error Message */}
          {emailError ? (
            <View style={styles.errorContainer}>
              <Ionicons name="warning-outline" size={14} color="#F44336" />
              <Text style={styles.errorText}>{emailError}</Text>
            </View>
          ) : null}

          {/* Password Input */}
          <View style={[
            styles.inputContainer,
            passwordError ? styles.inputError : null
          ]}>
            <Ionicons 
              name="lock-closed-outline" 
              size={20} 
              color={passwordError ? '#F44336' : '#999'} 
              style={styles.inputIcon} 
            />
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor="#999"
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                setPasswordError(''); // Clear error when user types
              }}
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
                color={passwordError ? '#F44336' : '#999'}
              />
            </TouchableOpacity>
          </View>
          
          {/* Password Error Message */}
          {passwordError ? (
            <View style={styles.errorContainer}>
              <Ionicons name="warning-outline" size={14} color="#F44336" />
              <Text style={styles.errorText}>{passwordError}</Text>
            </View>
          ) : null}

          {/* Forgot Password */}
          <TouchableOpacity
            onPress={() => router.push('/auth/forgot')}
            style={styles.forgotContainer}
          >
            <Text style={styles.forgotText}>Forgot Password?</Text>
          </TouchableOpacity>

          {/* Login Button */}
          <TouchableOpacity
            style={styles.buttonContainer}
            onPress={() => {
              console.log('🔘 Login button onPress triggered!');
              handleLogin();
            }}
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
                <Text style={styles.buttonText}>
                  {isRestaurant ? 'Login as Restaurant' : 'Login'}
                </Text>
              )}
            </LinearGradient>
          </TouchableOpacity>

          {/* Sign Up Link */}
          <View style={styles.signupContainer}>
            <Text style={styles.signupText}>Don't have an account? </Text>
            <TouchableOpacity onPress={() => router.push('/auth/signup')}>
              <Text style={styles.signupLink}>Sign Up</Text>
            </TouchableOpacity>
          </View>

          {/* Restaurant Sign Up Link */}
          <View style={styles.restaurantSignupContainer}>
            <Text style={styles.restaurantSignupText}>Are you a Restaurant? </Text>
            <TouchableOpacity onPress={() => router.push('/auth/restaurant-signup')}>
              <Text style={styles.restaurantSignupLink}>Sign up here</Text>
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
  toggleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  toggleLabel: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
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
  forgotContainer: {
    alignItems: 'flex-end',
    marginBottom: 24,
  },
  inputError: {
    borderColor: '#F44336',
    borderWidth: 1.5,
    backgroundColor: '#FFF5F5',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: -12,
    marginBottom: 12,
    marginLeft: 4,
    paddingHorizontal: 4,
  },
  errorText: {
    fontSize: 13,
    color: '#F44336',
    marginLeft: 6,
    fontWeight: '500',
  },
  forgotText: {
    fontSize: 14,
    color: '#1B7C82',
    fontWeight: '600',
  },
  buttonContainer: {
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
  signupContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  signupText: {
    fontSize: 14,
    color: '#999',
  },
  signupLink: {
    fontSize: 14,
    color: '#1B7C82',
    fontWeight: '600',
  },
  restaurantSignupContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  restaurantSignupText: {
    fontSize: 14,
    color: '#999',
  },
  restaurantSignupLink: {
    fontSize: 14,
    color: '#1B7C82',
    fontWeight: '600',
  },
});