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
import LocationPicker from '../../components/LocationPicker';
import axios from 'axios';
import * as DocumentPicker from 'expo-document-picker';
//import auth from '@react-native-firebase/auth';

const API_BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://api.cofau.com';
const API_URL = `${API_BASE_URL}/api`;

export default function RestaurantSignupScreen() {
  const router = useRouter();
  
  // Form states
  const [restaurantName, setRestaurantName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [foodType, setFoodType] = useState<'veg' | 'non_veg' | 'veg_and_non_veg' | null>(null);
  const [fssaiNumber, setFssaiNumber] = useState('');
  const [gstNumber, setGstNumber] = useState('');
  const [hasGst, setHasGst] = useState(false);
  const [fssaiDocument, setFssaiDocument] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  
  // UI states
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);

  // Firebase confirmation result
  const [confirm, setConfirm] = useState<any>(null);

  // Restaurant name validation states
  const [nameError, setNameError] = useState('');
  const [nameAvailable, setNameAvailable] = useState<boolean | null>(null);
  const [nameSuggestions, setNameSuggestions] = useState<string[]>([]);
  const [checkingName, setCheckingName] = useState(false);
  const nameCheckTimeout = useRef<NodeJS.Timeout | null>(null);

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

    if (nameCheckTimeout.current) {
      clearTimeout(nameCheckTimeout.current);
    }

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

  // Format phone number for Firebase (needs country code)
  const formatPhoneNumber = (phone: string): string => {
    let cleaned = phone.replace(/\D/g, '');
    
    // If doesn't start with country code, assume India (+91)
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

  const handlePickFssaiDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/*', 'application/pdf'],
        multiple: false,
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets?.length) {
        setFssaiDocument(result.assets[0]);
      }
    } catch (error) {
      console.error('Error picking FSSAI document:', error);
      showAlert('Error', 'Unable to pick document. Please try again.');
    }
  };

  // Main signup handler
  const handleSignup = async () => {
    // Basic validation
    if (!restaurantName || !email || !password || !confirmPassword) {
      showAlert('Error', 'Please fill in all required fields');
      return;
    }

    if (restaurantName.trim().length < 3) {
      showAlert('Error', 'Restaurant legal name must be at least 3 characters');
      return;
    }

    // Food type validation
    if (!foodType) {
      showAlert('Error', 'Please select your restaurant food type (Veg/Non-Veg)');
      return;
    }

    // FSSAI validation
    if (!fssaiNumber || fssaiNumber.trim().length !== 14) {
      showAlert('Error', 'Please enter a valid 14-digit FSSAI License Number');
      return;
    }

    if (!fssaiDocument) {
      showAlert('Error', 'Please upload your FSSAI document');
      return;
    }

    // GST validation (if enabled)
    if (hasGst && (!gstNumber || gstNumber.trim().length < 15)) {
      showAlert('Error', 'Please enter a valid GST Number (15 characters)');
      return;
    }

    if (checkingName) {
      showAlert('Please Wait', 'Checking restaurant name availability...');
      return;
    }

    const trimmedName = restaurantName.trim();
    if (trimmedName.length >= 3) {
      const isAvailable = await checkNameAvailability(trimmedName);
      if (!isAvailable) {
        if (nameSuggestions.length > 0) {
          showAlert(
            'Name Taken',
            `"${trimmedName}" is already taken. Please choose a different name.`
          );
        } else {
          showAlert('Name Taken', `"${trimmedName}" is already taken.`);
        }
        return;
      }
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
      const formData = new FormData();
      formData.append('restaurant_name', trimmedName);
      formData.append('email', email.trim());
      formData.append('password', password);
      formData.append('confirm_password', confirmPassword);
      formData.append('food_type', foodType);
      formData.append('fssai_license_number', fssaiNumber.trim());
      if (hasGst) {
        formData.append('gst_number', gstNumber.trim());
      }
      if (phoneNumber) {
        formData.append('phone_number', formatPhoneNumber(phoneNumber));
      }
      formData.append('phone_verified', otpVerified ? 'true' : 'false');
      if (latitude !== null) {
        formData.append('latitude', String(latitude));
      }
      if (longitude !== null) {
        formData.append('longitude', String(longitude));
      }

      if (fssaiDocument) {
        formData.append('fssai_license_file', {
          uri: fssaiDocument.uri,
          name: fssaiDocument.name || 'fssai-document',
          type: fssaiDocument.mimeType || 'application/octet-stream',
        } as any);
      }

      const response = await axios.post(`${API_URL}/restaurant/auth/signup-with-fssai`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (response.data && response.data.access_token) {
        await AsyncStorage.setItem('token', response.data.access_token);
        await AsyncStorage.setItem('account_type', 'restaurant');

        // Sign out from Firebase (we only used it for OTP)
        //await auth().signOut();

        showAlert(
          'Account Created! 🎉',
          'Welcome to Cofau! Your restaurant account has been created.',
          () => {
            router.replace('/feed');
          }
        );
      } else {
        showAlert('Signup Failed', 'Unexpected response from server.');
      }
    } catch (error: any) {
      console.error('Restaurant signup error:', error);
      const errorMessage =
        error.response?.data?.detail || error.message || 'An unexpected error occurred.';

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
        {/* Logo & Title */}
        <View style={styles.logoContainer}>
          <Image
            source={require('../../assets/images/icon.png')}
            style={styles.logoImage}
          />
          <Text style={styles.title}>Restaurant Sign Up</Text>
          <Text style={styles.subtitle}>Join Cofau as a Restaurant</Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          {/* Restaurant Legal Name Input */}
          <View style={styles.inputContainer}>
            <Ionicons name="business-outline" size={20} color="#999" style={styles.inputIcon} />
            <TextInput
              style={[
                styles.input,
                nameAvailable === true && styles.inputSuccess,
                nameAvailable === false && styles.inputError,
              ]}
              placeholder="Restaurant Legal Name"
              placeholderTextColor="#999"
              value={restaurantName}
              onChangeText={handleNameChange}
              autoCapitalize="words"
              autoCorrect={false}
            />
            {checkingName && (
              <ActivityIndicator size="small" color="#FF2E2E" style={styles.checkingIndicator} />
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
                  <Ionicons name="arrow-forward-circle-outline" size={16} color="#FF2E2E" />
                  <Text style={styles.suggestionText}>{suggestion}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Food Type Selection */}
          <View style={styles.foodTypeSection}>
            <Text style={styles.sectionLabel}>Food Type *</Text>
            <View style={styles.foodTypeContainer}>
              <TouchableOpacity
                style={[
                  styles.foodTypeOptionCompact,
                  foodType === 'veg' && styles.foodTypeVegSelected,
                ]}
                onPress={() => setFoodType('veg')}
              >
                <View style={[styles.foodTypeIconLarge, styles.vegIcon]}>
                  <View style={styles.vegDotLarge} />
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.foodTypeOptionCompact,
                  foodType === 'non_veg' && styles.foodTypeNonVegSelected,
                ]}
                onPress={() => setFoodType('non_veg')}
              >
                <View style={[styles.foodTypeIconLarge, styles.nonVegIcon]}>
                  <View style={styles.nonVegTriangleLarge} />
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.foodTypeOptionCompact,
                  foodType === 'veg_and_non_veg' && styles.foodTypeBothSelected,
                ]}
                onPress={() => setFoodType('veg_and_non_veg')}
              >
                <View style={styles.foodTypeBothIconsCompact}>
                  <View style={[styles.foodTypeIconMedium, styles.vegIcon]}>
                    <View style={styles.vegDotMedium} />
                  </View>
                  <View style={[styles.foodTypeIconMedium, styles.nonVegIcon]}>
                    <View style={styles.nonVegTriangleMedium} />
                  </View>
                </View>
              </TouchableOpacity>
            </View>
          </View>

          {/* FSSAI License Number Input (Mandatory) */}
          <View style={styles.inputContainer}>
            <Ionicons name="document-text-outline" size={20} color="#999" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="FSSAI License Number (14 digits) *"
              placeholderTextColor="#999"
              value={fssaiNumber}
              onChangeText={(text) => setFssaiNumber(text.replace(/[^0-9]/g, '').slice(0, 14))}
              keyboardType="number-pad"
              maxLength={14}
            />
            {fssaiNumber.length === 14 && (
              <Ionicons name="checkmark-circle" size={20} color="#4CAF50" style={styles.statusIcon} />
            )}
          </View>
          <Text style={styles.helperText}>Enter your 14-digit FSSAI License Number (mandatory)</Text>

          {/* FSSAI Document Upload (Mandatory) */}
          <View style={styles.uploadContainer}>
            <TouchableOpacity style={styles.uploadButton} onPress={handlePickFssaiDocument}>
              <Ionicons name="cloud-upload-outline" size={18} color="#1B7C82" />
              <Text style={styles.uploadButtonText}>
                {fssaiDocument ? 'Replace FSSAI Document' : 'Add FSSAI Document (PNG/JPG/PDF) *'}
              </Text>
            </TouchableOpacity>
            {fssaiDocument && (
              <View style={styles.uploadInfo}>
                <Ionicons name="document-attach-outline" size={16} color="#666" />
                <Text style={styles.uploadFileName} numberOfLines={1}>
                  {fssaiDocument.name || 'Selected document'}
                </Text>
                <TouchableOpacity onPress={() => setFssaiDocument(null)}>
                  <Ionicons name="close-circle" size={18} color="#FF2E2E" />
                </TouchableOpacity>
              </View>
            )}
          </View>

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

          {/* Phone Number Input with OTP */}
          <View style={styles.phoneContainer}>
            <View style={[styles.inputContainer, styles.phoneInput]}>
              <Ionicons name="call-outline" size={20} color="#999" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Phone Number (e.g., +91XXXXXXXXXX)"
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
            
            {!otpVerified && (
              <TouchableOpacity
                style={[
                  styles.otpButton,
                  (sendingOtp || resendTimer > 0) && styles.otpButtonDisabled
                ]}
                onPress={handleSendOtp}
                disabled={sendingOtp || resendTimer > 0}
              >
                {sendingOtp ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={styles.otpButtonText}>
                    {resendTimer > 0 ? `${resendTimer}s` : otpSent ? 'Resend' : 'Send OTP'}
                  </Text>
                )}
              </TouchableOpacity>
            )}
          </View>

          {/* OTP Input (shown after OTP is sent) */}
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

          {/* GST Number Toggle & Input (Optional) */}
          <View style={styles.gstSection}>
            <TouchableOpacity
              style={styles.gstToggle}
              onPress={() => setHasGst(!hasGst)}
            >
              <View style={[styles.checkbox, hasGst && styles.checkboxChecked]}>
                {hasGst && <Ionicons name="checkmark" size={14} color="#FFF" />}
              </View>
              <Text style={styles.gstToggleText}>I have a GST Number (Optional)</Text>
            </TouchableOpacity>

            {hasGst && (
              <View style={[styles.inputContainer, { marginTop: 12 }]}>
                <Ionicons name="receipt-outline" size={20} color="#999" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="GST Number (e.g., 22AAAAA0000A1Z5)"
                  placeholderTextColor="#999"
                  value={gstNumber}
                  onChangeText={(text) => setGstNumber(text.toUpperCase().slice(0, 15))}
                  autoCapitalize="characters"
                  maxLength={15}
                />
                {gstNumber.length === 15 && (
                  <Ionicons name="checkmark-circle" size={20} color="#4CAF50" style={styles.statusIcon} />
                )}
              </View>
            )}
          </View>

          {/* Location Picker */}
          <View style={styles.locationSection}>
            <Text style={styles.locationLabel}>
              <Ionicons name="location-outline" size={16} color="#FF2E2E" /> Restaurant Location
            </Text>
            <Text style={styles.locationHelper}>
              Tap on the map to set your restaurant's exact location
            </Text>
            <LocationPicker
              onLocationSelect={(lat: number, lng: number) => {
                setLatitude(lat);
                setLongitude(lng);
              }}
            />
            {latitude && longitude && (
              <View style={styles.coordsConfirm}>
                <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
                <Text style={styles.coordsText}>
                  Location set: {latitude.toFixed(4)}, {longitude.toFixed(4)}
                </Text>
              </View>
            )}
          </View>

          {/* Create Account Button */}
          <TouchableOpacity
            style={[styles.buttonContainer, !otpVerified && styles.buttonDisabled]}
            onPress={handleSignup}
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
    marginBottom: 20,
  },
  logoImage: {
    width: 90,
    height: 90,
    borderRadius: 45,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginBottom: 0,
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
  helperText: {
    fontSize: 12,
    color: '#999',
    marginTop: -12,
    marginBottom: 16,
    marginLeft: 4,
    fontStyle: 'italic',
  },
  uploadContainer: {
    marginBottom: 16,
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#1B7C82',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#F5FBFB',
  },
  uploadButtonText: {
    color: '#1B7C82',
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  uploadInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 8,
  },
  uploadFileName: {
    flex: 1,
    fontSize: 12,
    color: '#666',
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
  // Phone + OTP styles
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
  buttonContainer: {
    marginTop: 8,
    marginBottom: 24,
  },
  buttonDisabled: {
    opacity: 0.7,
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
  // Add these new styles
locationSection: {
  marginBottom: 20,
},
locationLabel: {
  fontSize: 16,
  fontWeight: '600',
  color: '#333',
  marginBottom: 4,
},
locationHelper: {
  fontSize: 12,
  color: '#999',
  marginBottom: 12,
  fontStyle: 'italic',
},
coordsConfirm: {
  flexDirection: 'row',
  alignItems: 'center',
  marginTop: 8,
  paddingVertical: 8,
  paddingHorizontal: 12,
  backgroundColor: '#E8F5E9',
  borderRadius: 8,
},
coordsText: {
  fontSize: 12,
  color: '#4CAF50',
  marginLeft: 6,
  fontWeight: '500',
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
    color: '#FF2E2E',
    fontWeight: '600',
  },
  // Food Type Selection Styles
  foodTypeSection: {
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  foodTypeContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    gap: 12,
  },
  foodTypeOptionCompact: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    backgroundColor: '#FFF',
  },
  foodTypeVegSelected: {
    borderColor: '#4CAF50',
    backgroundColor: '#E8F5E9',
  },
  foodTypeNonVegSelected: {
    borderColor: '#D32F2F',
    backgroundColor: '#FFEBEE',
  },
  foodTypeBothSelected: {
    borderColor: '#FF7043',
    backgroundColor: '#FFF3E0',
  },
  foodTypeIconLarge: {
    width: 32,
    height: 32,
    borderRadius: 4,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  vegIcon: {
    borderColor: '#4CAF50',
  },
  nonVegIcon: {
    borderColor: '#D32F2F',
  },
  vegDotLarge: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#4CAF50',
  },
  nonVegTriangleLarge: {
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderBottomWidth: 14,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#D32F2F',
  },
  foodTypeBothIconsCompact: {
    flexDirection: 'row',
    gap: 6,
  },
  foodTypeIconMedium: {
    width: 26,
    height: 26,
    borderRadius: 4,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  vegDotMedium: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#4CAF50',
  },
  nonVegTriangleMedium: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderBottomWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#D32F2F',
  },
  // GST Section Styles
  gstSection: {
    marginBottom: 16,
  },
  gstToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  checkboxChecked: {
    backgroundColor: '#FF2E2E',
    borderColor: '#FF2E2E',
  },
  gstToggleText: {
    fontSize: 14,
    color: '#666',
  },
});
