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
  Linking,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
//import auth from '@react-native-firebase/auth';
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
  const [termsAccepted, setTermsAccepted] = useState(false);
  const usernameCheckTimeout = useRef<NodeJS.Timeout | null>(null);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
  const [confirm, setConfirm] = useState<any>(null);

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
      // Fix: API_URL already includes /api, so use /auth/check-username not /api/auth/check-username
      const response = await axios.get(`${API_URL}/auth/check-username`, {
        params: { username: usernameToCheck.trim() },
      });

      if (response.data && response.data.available === true) {
        setUsernameAvailable(true);
        setUsernameError('');
        setUsernameSuggestions([]);
        return true;
      } else {
        setUsernameAvailable(false);
        setUsernameError(`Username "${usernameToCheck}" is already taken`);
        setUsernameSuggestions(response.data?.suggestions || []);
        return false;
      }
    } catch (error: any) {
      console.error('Error checking username:', error);
      // If it's a 404, the endpoint might not exist - treat as unavailable to be safe
      if (error.response?.status === 404) {
        setUsernameAvailable(false);
        setUsernameError('Unable to verify username. Please try again.');
        setUsernameSuggestions([]);
        return false;
      }
      // For other errors, don't block signup but show warning
      setUsernameAvailable(null);
      setUsernameError('Could not verify username availability. Please try again.');
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

  // Handle suggestion selection
  const handleSelectSuggestion = (suggestedUsername: string) => {
    setUsername(suggestedUsername);
    setUsernameAvailable(true);
    setUsernameError('');
    setUsernameSuggestions([]);
    // Verify the selected username is available
    checkUsernameAvailability(suggestedUsername);
  };

  // Format phone number for Firebase
const formatPhoneNumber = (phone: string): string => {
  let cleaned = phone.replace(/\D/g, '');
  if (!phone.startsWith('+')) {
    if (cleaned.length === 10) {
      return `+91${cleaned}`;
    }
  }
  return phone.startsWith('+') ? phone : `+${cleaned}`;
};

// Send OTP
const handleSendOtp = async () => {
  // Firebase disabled - auto verify for now
  Alert.alert('Info', 'Phone verification will be available soon');
  setOtpSent(true);
  setOtpVerified(true);

  // if (!phoneNumber || phoneNumber.replace(/\D/g, '').length < 10) {
  //   Alert.alert('Error', 'Please enter a valid phone number');
  //   return;
  // }

  // setSendingOtp(true);
  // try {
  //   const formattedPhone = formatPhoneNumber(phoneNumber);
  //   const confirmation = await auth().signInWithPhoneNumber(formattedPhone);
  //   setConfirm(confirmation);
  //   setOtpSent(true);
  //   setResendTimer(60);
  //   Alert.alert('OTP Sent', `Verification code sent to ${formattedPhone}`);
  // } catch (error: any) {
  //   console.error('Error sending OTP:', error);
  //   let errorMessage = 'Failed to send OTP. Please try again.';
  //   if (error.code === 'auth/invalid-phone-number') {
  //     errorMessage = 'Invalid phone number format.';
  //   } else if (error.code === 'auth/too-many-requests') {
  //     errorMessage = 'Too many attempts. Please try again later.';
  //   }
  //   Alert.alert('Error', errorMessage);
  // } finally {
  //   setSendingOtp(false);
  // }
};

// Verify OTP
const handleVerifyOtp = async () => {
  // Firebase disabled - auto verify for now
  setOtpVerified(true);
  Alert.alert('Verified! ✓', 'Phone number verified successfully');
  
  // if (!otp || otp.length < 6) {
  //   Alert.alert('Error', 'Please enter the 6-digit OTP');
  //   return;
  // }

  // if (!confirm) {
  //   Alert.alert('Error', 'Please request OTP first');
  //   return;
  // }

  // setVerifyingOtp(true);
  // try {
  //   await confirm.confirm(otp);
  //   setOtpVerified(true);
  //   Alert.alert('Verified! ✓', 'Phone number verified successfully');
  // } catch (error: any) {
  //   console.error('Error verifying OTP:', error);
  //   let errorMessage = 'Invalid OTP. Please try again.';
  //   if (error.code === 'auth/invalid-verification-code') {
  //     errorMessage = 'Incorrect verification code.';
  //   } else if (error.code === 'auth/code-expired') {
  //     errorMessage = 'OTP has expired. Please request a new one.';
  //   }
  //   Alert.alert('Error', errorMessage);
  // } finally {
  //   setVerifyingOtp(false);
  // }
};

  const handleSignup = async () => {
    // Check terms acceptance first
    if (!termsAccepted) {
      Alert.alert('Terms Required', 'Please agree to the Terms of Use and Privacy Policy to continue.');
      return;
    }

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

    // Always check username availability before signup to ensure it's still available
    const trimmedUsername = username.trim();
    if (trimmedUsername.length >= 3) {
      const isAvailable = await checkUsernameAvailability(trimmedUsername);
      if (!isAvailable) {
        // Show error with suggestions if available
        if (usernameSuggestions.length > 0) {
          Alert.alert(
            'Username Taken',
            `"${trimmedUsername}" is already taken. Please choose a different username or select one of the suggestions below.`
          );
        } else {
          Alert.alert(
            'Username Taken',
            `"${trimmedUsername}" is already taken. Please choose a different username.`
          );
        }
        return;
      }
    } else {
      Alert.alert('Error', 'Username must be at least 3 characters');
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
      const result = await signup(
  fullName, 
  username.trim(), 
  email, 
  password,
  phoneNumber ? formatPhoneNumber(phoneNumber) : null,
  otpVerified
);

// Sign out from Firebase after signup
//if (result.success && otpVerified) {
 // await auth().signOut();
//}

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
        // Show specific error from backend
        const errorMessage = result.error || 'Please try again';
        
        // If username is taken, update UI state
        if (errorMessage.toLowerCase().includes('username') && errorMessage.toLowerCase().includes('taken')) {
          setUsernameAvailable(false);
          setUsernameError(`Username "${username.trim()}" is already taken`);
          // Re-check to get suggestions
          await checkUsernameAvailability(username.trim());
        }
        
        Alert.alert('Signup Failed', errorMessage);
      }
    } catch (error: any) {
      console.error('Signup error:', error);
      const errorMessage = error.response?.data?.detail || error.message || 'An unexpected error occurred. Please try again.';
      
      // If username is taken, update UI state
      if (errorMessage.toLowerCase().includes('username') && errorMessage.toLowerCase().includes('taken')) {
        setUsernameAvailable(false);
        setUsernameError(`Username "${username.trim()}" is already taken`);
        // Re-check to get suggestions
        await checkUsernameAvailability(username.trim());
      }
      
      Alert.alert('Error', errorMessage);
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
    style={styles.logo}
    resizeMode="contain"
  />
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
              <ActivityIndicator size="small" color="#FF2E2E" style={styles.checkingIndicator} />
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
                  <Ionicons name="arrow-forward-circle-outline" size={16} color="#FF2E2E" />
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

          {/* Phone Number Input (Optional) */}
<View style={styles.phoneContainer}>
  <View style={[styles.inputContainer, styles.phoneInput]}>
    <Ionicons name="call-outline" size={20} color="#999" style={styles.inputIcon} />
    <TextInput
      style={styles.input}
      placeholder="Phone (Optional)"
      placeholderTextColor="#999"
      value={phoneNumber}
      onChangeText={setPhoneNumber}
      keyboardType="phone-pad"
      editable={!otpVerified}
    />
    {otpVerified && (
      <Ionicons name="checkmark-circle" size={20} color="#4CAF50" style={styles.statusIcon} />
    )}
  </View>
  
  {phoneNumber.length >= 10 && !otpVerified && (
    <TouchableOpacity
      style={[styles.otpButton, (sendingOtp || resendTimer > 0) && styles.otpButtonDisabled]}
      onPress={handleSendOtp}
      disabled={sendingOtp || resendTimer > 0}
    >
      {sendingOtp ? (
        <ActivityIndicator size="small" color="#FFF" />
      ) : (
        <Text style={styles.otpButtonText}>
          {resendTimer > 0 ? `${resendTimer}s` : otpSent ? 'Resend' : 'Verify'}
        </Text>
      )}
    </TouchableOpacity>
  )}
</View>

{/* OTP Input */}
{otpSent && !otpVerified && (
  <View style={styles.phoneContainer}>
    <View style={[styles.inputContainer, styles.phoneInput]}>
      <Ionicons name="key-outline" size={20} color="#999" style={styles.inputIcon} />
      <TextInput
        style={styles.input}
        placeholder="Enter 6-digit OTP"
        placeholderTextColor="#999"
        value={otp}
        onChangeText={setOtp}
        keyboardType="number-pad"
        maxLength={6}
      />
    </View>
    
    <TouchableOpacity
      style={[styles.otpButton, styles.verifyButton, verifyingOtp && styles.otpButtonDisabled]}
      onPress={handleVerifyOtp}
      disabled={verifyingOtp}
    >
      {verifyingOtp ? (
        <ActivityIndicator size="small" color="#FFF" />
      ) : (
        <Text style={styles.otpButtonText}>Verify</Text>
      )}
    </TouchableOpacity>
  </View>
)}

{/* Verified Badge */}
{otpVerified && (
  <View style={styles.verifiedBadge}>
    <Ionicons name="shield-checkmark" size={16} color="#4CAF50" />
    <Text style={styles.verifiedText}>Phone number verified</Text>
  </View>
)}

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

          {/* Terms and Privacy Policy Checkbox */}
          <View style={styles.termsContainer}>
            <TouchableOpacity
              style={styles.checkbox}
              onPress={() => setTermsAccepted(!termsAccepted)}
              activeOpacity={0.7}
            >
              <View style={[
                styles.checkboxBox,
                termsAccepted && styles.checkboxChecked
              ]}>
                {termsAccepted && (
                  <Ionicons name="checkmark" size={16} color="#fff" />
                )}
              </View>
            </TouchableOpacity>
            
            <Text style={styles.termsText}>
              I agree to the{' '}
              <Text
                style={styles.termsLink}
                onPress={() => Linking.openURL('https://adilsherlock777-cloud.github.io/cofau/terms-of-use.html')}
              >
                Terms of Use
              </Text>
              {' '}and{' '}
              <Text
                style={styles.termsLink}
                onPress={() => Linking.openURL('https://adilsherlock777-cloud.github.io/cofau/privacy-policy.html')}
              >
                Privacy Policy
              </Text>
            </Text>
          </View>

          {/* Create Account Button */}
          <TouchableOpacity
            style={[
              styles.buttonContainer,
              !termsAccepted && styles.buttonDisabled
            ]}
            onPress={handleSignup}
            activeOpacity={0.8}
            disabled={loading || !termsAccepted}
          >
            <LinearGradient
              colors={!termsAccepted ? ['#ccc', '#ccc', '#ccc'] : ['#FF2E2E', '#FF7A18']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
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
    color: '#FF2E2E',
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
  termsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 20,
    marginTop: 8,
    paddingHorizontal: 4,
  },
  checkbox: {
    marginRight: 12,
    marginTop: 2,
  },
  checkboxBox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#FF2E2E',
    borderColor: '#FF2E2E',
  },
  termsText: {
    flex: 1,
    fontSize: 14,
    color: '#666',
    lineHeight: 22,
  },
  phoneContainer: {
  flexDirection: 'row',
  alignItems: 'center',
  marginBottom: 16,
  gap: 10,
},
phoneInput: {
  flex: 1,
  marginBottom: 0,
},
otpButton: {
  backgroundColor: '#FF2E2E',
  paddingHorizontal: 16,
  height: 56,
  borderRadius: 12,
  justifyContent: 'center',
  alignItems: 'center',
  minWidth: 80,
},
otpButtonDisabled: {
  backgroundColor: '#ccc',
},
otpButtonText: {
  color: '#FFF',
  fontSize: 14,
  fontWeight: '600',
},
verifyButton: {
  backgroundColor: '#4CAF50',
},
verifiedBadge: {
  flexDirection: 'row',
  alignItems: 'center',
  marginTop: -8,
  marginBottom: 16,
  marginLeft: 4,
},
verifiedText: {
  fontSize: 12,
  color: '#4CAF50',
  marginLeft: 4,
  fontWeight: '500',
},
  termsLink: {
    color: '#FF2E2E',
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  buttonDisabled: {
    opacity: 0.6,
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