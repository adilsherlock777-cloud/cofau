import React, { useState, useEffect } from 'react';
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
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { Image } from 'react-native';

// Conditional Firebase import - returns null if not available (Expo Go)
let auth: any = null;
try {
  auth = require('@react-native-firebase/auth').default;
} catch (e) {
  console.log('Firebase Auth not available (Expo Go mode)');
}

export default function LoginScreen() {
  console.log('🎬 LoginScreen component rendered');
  const router = useRouter();
  const { login, loginWithPhone } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isRestaurant, setIsRestaurant] = useState(false); // Toggle for restaurant login
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');

  // Phone login states
  const [showPhoneLogin, setShowPhoneLogin] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
  const [confirm, setConfirm] = useState<any>(null);
  const [phoneError, setPhoneError] = useState('');

  // Resend timer countdown
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [resendTimer]);

  const showAlert = (title: string, message: string) => {
    if (Platform.OS === 'web') {
      window.alert(`${title}\n${message}`);
    } else {
      Alert.alert(title, message);
    }
  };

  // Format phone number for Firebase (needs country code)
  const formatPhoneNumber = (phone: string): string => {
    let cleaned = phone.replace(/\D/g, '');
    if (!phone.startsWith('+')) {
      if (cleaned.length === 10) {
        return `+91${cleaned}`;
      }
    }
    return phone.startsWith('+') ? phone : `+${cleaned}`;
  };

  // Send OTP for phone login
  const handleSendOtp = async () => {
    // Check if Firebase is available
    if (!auth) {
      showAlert('Not Available', 'Phone login requires a built app. Please use email/password login in Expo Go, or install the APK/IPA build.');
      return;
    }

    if (!phoneNumber || phoneNumber.replace(/\D/g, '').length < 10) {
      setPhoneError('Please enter a valid phone number');
      return;
    }

    setPhoneError('');
    setSendingOtp(true);
    try {
      const formattedPhone = formatPhoneNumber(phoneNumber);
      const confirmation = await auth().signInWithPhoneNumber(formattedPhone);
      setConfirm(confirmation);
      setOtpSent(true);
      setResendTimer(60);
      showAlert('OTP Sent', `Verification code sent to ${formattedPhone}`);
    } catch (error: any) {
      console.error('Error sending OTP:', error);
      let errorMessage = 'Failed to send OTP. Please try again.';
      if (error.code === 'auth/invalid-phone-number') {
        errorMessage = 'Invalid phone number format.';
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = 'Too many attempts. Please try again later.';
      }
      setPhoneError(errorMessage);
    } finally {
      setSendingOtp(false);
    }
  };

  // Verify OTP and login
  const handleVerifyOtpAndLogin = async () => {
    if (!otp || otp.length < 6) {
      setPhoneError('Please enter the 6-digit OTP');
      return;
    }

    if (!confirm) {
      setPhoneError('Please request OTP first');
      return;
    }

    setPhoneError('');
    setVerifyingOtp(true);
    try {
      // Verify OTP with Firebase
      await confirm.confirm(otp);

      // Now login with phone number via backend
      const formattedPhone = formatPhoneNumber(phoneNumber);
      const result = await loginWithPhone(formattedPhone, isRestaurant);

      // Sign out from Firebase (we only used it for OTP verification)
      await auth().signOut();

      if (result.success) {
        const welcomeMessage = isRestaurant
          ? 'Welcome back, Restaurant!'
          : 'Welcome back to Cofau';
        showAlert('Login Successful!', welcomeMessage);
      } else {
        setPhoneError(result.error || 'Login failed. Phone number may not be registered.');
      }
    } catch (error: any) {
      console.error('Error verifying OTP:', error);
      let errorMessage = 'Invalid OTP. Please try again.';
      if (error.code === 'auth/invalid-verification-code') {
        errorMessage = 'Incorrect verification code.';
      } else if (error.code === 'auth/code-expired') {
        errorMessage = 'OTP has expired. Please request a new one.';
      }
      setPhoneError(errorMessage);
    } finally {
      setVerifyingOtp(false);
    }
  };

  // Reset phone login state
  const resetPhoneLogin = () => {
    setPhoneNumber('');
    setOtp('');
    setOtpSent(false);
    setConfirm(null);
    setPhoneError('');
    setResendTimer(0);
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
              trackColor={{ false: '#E0E0E0', true: '#FF2E2E' }}
              thumbColor={isRestaurant ? '#FFF' : '#FFF'}
              ios_backgroundColor="#E0E0E0"
            />
          </View>

          {/* Email/Password Section - Hidden when phone login is active */}
          {!showPhoneLogin && (
            <>
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
            </>
          )}

          {/* Login Button */}
          {!showPhoneLogin && (
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
                colors={['#FF2E2E', '#FF7A18']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
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
          )}

          {/* Login with Phone Toggle */}
          <TouchableOpacity
            style={styles.phoneLoginToggle}
            onPress={() => {
              setShowPhoneLogin(!showPhoneLogin);
              resetPhoneLogin();
              setEmailError('');
              setPasswordError('');
            }}
          >
            <Ionicons
              name={showPhoneLogin ? "mail-outline" : "call-outline"}
              size={18}
              color="#FF2E2E"
            />
            <Text style={styles.phoneLoginToggleText}>
              {showPhoneLogin ? 'Login with Email' : 'Login with Phone'}
            </Text>
          </TouchableOpacity>

          {/* Phone Login Section */}
          {showPhoneLogin && (
            <View style={styles.phoneLoginSection}>
              {/* Phone Number Input */}
              <View style={[
                styles.inputContainer,
                phoneError ? styles.inputError : null
              ]}>
                <Ionicons
                  name="call-outline"
                  size={20}
                  color={phoneError ? '#F44336' : '#999'}
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Phone Number (e.g., 9876543210)"
                  placeholderTextColor="#999"
                  value={phoneNumber}
                  onChangeText={(text) => {
                    setPhoneNumber(text);
                    setPhoneError('');
                  }}
                  keyboardType="phone-pad"
                  editable={!otpSent}
                />
                {!otpSent && phoneNumber.length >= 10 && (
                  <TouchableOpacity
                    style={[styles.sendOtpButton, (sendingOtp || resendTimer > 0) && styles.sendOtpButtonDisabled]}
                    onPress={handleSendOtp}
                    disabled={sendingOtp || resendTimer > 0}
                  >
                    {sendingOtp ? (
                      <ActivityIndicator size="small" color="#FFF" />
                    ) : (
                      <Text style={styles.sendOtpButtonText}>
                        {resendTimer > 0 ? `${resendTimer}s` : 'Send OTP'}
                      </Text>
                    )}
                  </TouchableOpacity>
                )}
              </View>

              {/* OTP Input */}
              {otpSent && (
                <View style={styles.otpContainer}>
                  <View style={[
                    styles.inputContainer,
                    phoneError ? styles.inputError : null
                  ]}>
                    <Ionicons
                      name="key-outline"
                      size={20}
                      color={phoneError ? '#F44336' : '#999'}
                      style={styles.inputIcon}
                    />
                    <TextInput
                      style={styles.input}
                      placeholder="Enter 6-digit OTP"
                      placeholderTextColor="#999"
                      value={otp}
                      onChangeText={(text) => {
                        setOtp(text);
                        setPhoneError('');
                      }}
                      keyboardType="number-pad"
                      maxLength={6}
                    />
                  </View>

                  {/* Resend OTP */}
                  <TouchableOpacity
                    style={styles.resendButton}
                    onPress={handleSendOtp}
                    disabled={resendTimer > 0 || sendingOtp}
                  >
                    <Text style={[
                      styles.resendButtonText,
                      (resendTimer > 0 || sendingOtp) && styles.resendButtonTextDisabled
                    ]}>
                      {resendTimer > 0 ? `Resend in ${resendTimer}s` : 'Resend OTP'}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Phone Error Message */}
              {phoneError ? (
                <View style={styles.errorContainer}>
                  <Ionicons name="warning-outline" size={14} color="#F44336" />
                  <Text style={styles.errorText}>{phoneError}</Text>
                </View>
              ) : null}

              {/* Verify & Login Button */}
              {otpSent && (
                <TouchableOpacity
                  style={styles.buttonContainer}
                  onPress={handleVerifyOtpAndLogin}
                  activeOpacity={0.8}
                  disabled={verifyingOtp}
                >
                  <LinearGradient
                    colors={['#FF2E2E', '#FF7A18']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.button}
                  >
                    {verifyingOtp ? (
                      <ActivityIndicator color="#FFF" />
                    ) : (
                      <Text style={styles.buttonText}>
                        Verify & Login
                      </Text>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              )}
            </View>
          )}

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
    color: '#FF2E2E',
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
    color: '#FF2E2E',
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
    color: '#FF2E2E',
    fontWeight: '600',
  },
  // Phone login styles
  phoneLoginToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    marginBottom: 16,
    gap: 8,
  },
  phoneLoginToggleText: {
    fontSize: 14,
    color: '#FF2E2E',
    fontWeight: '600',
  },
  phoneLoginSection: {
    marginBottom: 8,
  },
  sendOtpButton: {
    backgroundColor: '#FF2E2E',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  sendOtpButtonDisabled: {
    backgroundColor: '#ccc',
  },
  sendOtpButtonText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
  },
  otpContainer: {
    marginBottom: 8,
  },
  resendButton: {
    alignItems: 'flex-end',
    marginTop: -8,
    marginBottom: 12,
  },
  resendButtonText: {
    fontSize: 13,
    color: '#FF2E2E',
    fontWeight: '500',
  },
  resendButtonTextDisabled: {
    color: '#999',
  },
});