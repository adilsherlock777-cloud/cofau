import React, { useState, useEffect } from 'react';
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
//import auth from '@react-native-firebase/auth';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
  const [confirm, setConfirm] = useState<any>(null);
  const [phoneError, setPhoneError] = useState('');
  const [otpError, setOtpError] = useState('');

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

  // Format phone number for Firebase
  const formatPhoneNumber = (phone: string): string => {
    let cleaned = phone.replace(/\D/g, '');
    if (!phone.startsWith('+')) {
      if (cleaned.length === 10) {
        return `+91${cleaned}`; // Default to India
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

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Back Button */}
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>

        {/* Logo */}
        <View style={styles.logoContainer}>
          <LinearGradient
            colors={['#E94A37', '#F2CF68', '#1B7C82']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.logo}
          >
            <Ionicons name="lock-closed" size={48} color="#FFF" />
          </LinearGradient>
        </View>

        {/* Title */}
        <Text style={styles.title}>Forgot Password</Text>
        <Text style={styles.subtitle}>
          {otpSent 
            ? 'Enter the verification code sent to your phone'
            : 'Enter your phone number to reset your password'
          }
        </Text>

        {/* Form */}
        <View style={styles.form}>
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
              placeholder="Phone Number (e.g., +91 9876543210)"
              placeholderTextColor="#999"
              value={phoneNumber}
              onChangeText={(text) => {
                setPhoneNumber(text);
                setPhoneError('');
              }}
              keyboardType="phone-pad"
              editable={!otpSent}
            />
            {otpSent && (
              <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
            )}
          </View>
          
          {/* Phone Error */}
          {phoneError ? (
            <View style={styles.errorContainer}>
              <Ionicons name="warning-outline" size={14} color="#F44336" />
              <Text style={styles.errorText}>{phoneError}</Text>
            </View>
          ) : null}

          {/* Send OTP Button (before OTP sent) */}
          {!otpSent && (
            <TouchableOpacity
              style={[styles.buttonContainer, sendingOtp && styles.buttonDisabled]}
              onPress={handleSendOtp}
              activeOpacity={0.8}
              disabled={sendingOtp}
            >
              <LinearGradient
                colors={['#E94A37', '#F2CF68', '#1B7C82']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.button}
              >
                {sendingOtp ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.buttonText}>Send OTP</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>
          )}

          {/* OTP Section (after OTP sent) */}
          {otpSent && (
            <>
              {/* OTP Input */}
              <View style={[
                styles.inputContainer,
                otpError ? styles.inputError : null
              ]}>
                <Ionicons 
                  name="key-outline" 
                  size={20} 
                  color={otpError ? '#F44336' : '#999'} 
                  style={styles.inputIcon} 
                />
                <TextInput
                  style={styles.input}
                  placeholder="Enter 6-digit OTP"
                  placeholderTextColor="#999"
                  value={otp}
                  onChangeText={(text) => {
                    setOtp(text);
                    setOtpError('');
                  }}
                  keyboardType="number-pad"
                  maxLength={6}
                />
              </View>
              
              {/* OTP Error */}
              {otpError ? (
                <View style={styles.errorContainer}>
                  <Ionicons name="warning-outline" size={14} color="#F44336" />
                  <Text style={styles.errorText}>{otpError}</Text>
                </View>
              ) : null}

              {/* Resend OTP */}
              <TouchableOpacity
                style={styles.resendContainer}
                onPress={handleSendOtp}
                disabled={resendTimer > 0 || sendingOtp}
              >
                <Text style={[
                  styles.resendText,
                  (resendTimer > 0 || sendingOtp) && styles.resendDisabled
                ]}>
                  {resendTimer > 0 
                    ? `Resend OTP in ${resendTimer}s` 
                    : 'Resend OTP'
                  }
                </Text>
              </TouchableOpacity>

              {/* Verify Button */}
              <TouchableOpacity
                style={[styles.buttonContainer, verifyingOtp && styles.buttonDisabled]}
                onPress={handleVerifyOtp}
                activeOpacity={0.8}
                disabled={verifyingOtp}
              >
                <LinearGradient
                  colors={['#E94A37', '#F2CF68', '#1B7C82']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.button}
                >
                  {verifyingOtp ? (
                    <ActivityIndicator color="#FFF" />
                  ) : (
                    <Text style={styles.buttonText}>Verify & Continue</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </>
          )}

          {/* Back to Login */}
          <View style={styles.loginContainer}>
            <Text style={styles.loginText}>Remember your password? </Text>
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
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
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
    paddingHorizontal: 20,
    lineHeight: 24,
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
  inputError: {
    borderColor: '#F44336',
    borderWidth: 1.5,
    backgroundColor: '#FFF5F5',
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#333',
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
  resendContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  resendText: {
    fontSize: 14,
    color: '#1B7C82',
    fontWeight: '600',
  },
  resendDisabled: {
    color: '#999',
  },
  buttonContainer: {
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
    color: '#1B7C82',
    fontWeight: '600',
  },
});