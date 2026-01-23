import React, { useState } from 'react';
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
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';

const API_BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://api.cofau.com';
const API_URL = `${API_BASE_URL}/api`;

export default function ResetPasswordScreen() {
  const router = useRouter();
  const { phone } = useLocalSearchParams<{ phone: string }>();
  
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [confirmError, setConfirmError] = useState('');

  const handleResetPassword = async () => {
    // Clear errors
    setPasswordError('');
    setConfirmError('');

    // Validation
    if (!newPassword) {
      setPasswordError('Please enter a new password');
      return;
    }

    if (newPassword.length < 4) {
      setPasswordError('Password must be at least 4 characters');
      return;
    }

    if (!confirmPassword) {
      setConfirmError('Please confirm your password');
      return;
    }

    if (newPassword !== confirmPassword) {
      setConfirmError('Passwords do not match');
      return;
    }

    if (!phone) {
      Alert.alert('Error', 'Phone number not found. Please try again.');
      router.replace('/auth/forgot');
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post(`${API_URL}/auth/reset-password`, {
        phone_number: phone,
        new_password: newPassword,
      });

      if (response.data) {
        Alert.alert(
          'Password Reset! 🎉',
          'Your password has been updated successfully.',
          [
            {
              text: 'Login Now',
              onPress: () => router.replace('/auth/login'),
            },
          ]
        );
      }
    } catch (error: any) {
      console.error('Reset password error:', error);
      const errorMessage = error.response?.data?.detail || 'Failed to reset password. Please try again.';
      
      if (errorMessage.toLowerCase().includes('not found') || errorMessage.toLowerCase().includes('no user')) {
        Alert.alert('Error', 'No account found with this phone number.');
      } else {
        Alert.alert('Error', errorMessage);
      }
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
            <Ionicons name="key" size={48} color="#FFF" />
          </LinearGradient>
        </View>

        {/* Title */}
        <Text style={styles.title}>Reset Password</Text>
        <Text style={styles.subtitle}>
          Create a new password for your account
        </Text>

        {/* Verified Phone Badge */}
        {phone && (
          <View style={styles.phoneBadge}>
            <Ionicons name="shield-checkmark" size={16} color="#4CAF50" />
            <Text style={styles.phoneBadgeText}>Verified: {phone}</Text>
          </View>
        )}

        {/* Form */}
        <View style={styles.form}>
          {/* New Password Input */}
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
              placeholder="New Password"
              placeholderTextColor="#999"
              value={newPassword}
              onChangeText={(text) => {
                setNewPassword(text);
                setPasswordError('');
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
          
          {/* Password Error */}
          {passwordError ? (
            <View style={styles.errorContainer}>
              <Ionicons name="warning-outline" size={14} color="#F44336" />
              <Text style={styles.errorText}>{passwordError}</Text>
            </View>
          ) : null}

          {/* Confirm Password Input */}
          <View style={[
            styles.inputContainer,
            confirmError ? styles.inputError : null
          ]}>
            <Ionicons 
              name="lock-closed-outline" 
              size={20} 
              color={confirmError ? '#F44336' : '#999'} 
              style={styles.inputIcon} 
            />
            <TextInput
              style={styles.input}
              placeholder="Confirm New Password"
              placeholderTextColor="#999"
              value={confirmPassword}
              onChangeText={(text) => {
                setConfirmPassword(text);
                setConfirmError('');
              }}
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
                color={confirmError ? '#F44336' : '#999'}
              />
            </TouchableOpacity>
          </View>
          
          {/* Confirm Error */}
          {confirmError ? (
            <View style={styles.errorContainer}>
              <Ionicons name="warning-outline" size={14} color="#F44336" />
              <Text style={styles.errorText}>{confirmError}</Text>
            </View>
          ) : null}

          {/* Reset Button */}
          <TouchableOpacity
            style={[styles.buttonContainer, loading && styles.buttonDisabled]}
            onPress={handleResetPassword}
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
                <Text style={styles.buttonText}>Reset Password</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>

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
    marginBottom: 20,
    paddingHorizontal: 20,
    lineHeight: 24,
  },
  phoneBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E8F5E9',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    alignSelf: 'center',
    marginBottom: 30,
  },
  phoneBadgeText: {
    fontSize: 14,
    color: '#4CAF50',
    marginLeft: 6,
    fontWeight: '500',
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
  eyeIcon: {
    padding: 4,
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