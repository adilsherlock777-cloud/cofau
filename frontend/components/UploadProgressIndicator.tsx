import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useUpload } from '../context/UploadContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const MIN_UPLOAD_DISPLAY_TIME = 1500; // Minimum time to show uploading state

export default function UploadProgressIndicator() {
  const { uploadState, retryUpload, clearUploadState } = useUpload();
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(-100)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const successOpacity = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const uploadStartTime = useRef<number>(0);
  const [displayProgress, setDisplayProgress] = useState(0);
  const [showProcessing, setShowProcessing] = useState(false);

  const isVisible = uploadState.isUploading || uploadState.error || uploadState.showSuccess || showProcessing;

  // Track upload start time
  useEffect(() => {
    if (uploadState.isUploading && uploadStartTime.current === 0) {
      uploadStartTime.current = Date.now();
      setShowProcessing(false);
    }
  }, [uploadState.isUploading]);

  // Slide animation
  useEffect(() => {
    if (isVisible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 50,
        friction: 8,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: -100,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [isVisible]);

  // Smooth progress animation with simulated progress for fast uploads
  useEffect(() => {
    if (uploadState.isUploading) {
      // Simulate smooth progress for better UX
      const targetProgress = Math.max(uploadState.progress, displayProgress);

      // If real progress is 0, simulate initial progress
      if (uploadState.progress === 0 && displayProgress < 10) {
        const interval = setInterval(() => {
          setDisplayProgress(prev => {
            if (prev >= 10 || uploadState.progress > 0) {
              clearInterval(interval);
              return prev;
            }
            return prev + 2;
          });
        }, 100);
        return () => clearInterval(interval);
      }

      setDisplayProgress(targetProgress);
    } else {
      setDisplayProgress(0);
      uploadStartTime.current = 0;
    }
  }, [uploadState.isUploading, uploadState.progress]);

  // Animate progress bar
  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: displayProgress,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [displayProgress]);

  // Pulse animation for uploading state
  useEffect(() => {
    if (uploadState.isUploading) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 0.7,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [uploadState.isUploading]);

  // Handle success with minimum display time
  useEffect(() => {
    if (uploadState.showSuccess) {
      const elapsed = Date.now() - uploadStartTime.current;
      const remainingTime = Math.max(0, MIN_UPLOAD_DISPLAY_TIME - elapsed);

      // Show processing if upload was too fast
      if (remainingTime > 0) {
        setShowProcessing(true);
        setDisplayProgress(100);
      }

      const showSuccessTimer = setTimeout(() => {
        setShowProcessing(false);
        Animated.timing(successOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }).start();

        // Auto-hide after 3 seconds
        const hideTimer = setTimeout(() => {
          Animated.timing(successOpacity, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }).start(() => {
            clearUploadState();
          });
        }, 3000);

        return () => clearTimeout(hideTimer);
      }, remainingTime);

      return () => clearTimeout(showSuccessTimer);
    }
  }, [uploadState.showSuccess]);

  if (!isVisible) return null;

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

  const showUploadingUI = uploadState.isUploading || showProcessing;
  const showSuccessUI = uploadState.showSuccess && !showProcessing;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ translateY: slideAnim }],
          top: insets.top,
        },
      ]}
    >
      {showUploadingUI && (
        <View style={styles.uploadingContainer}>
          <View style={styles.leftSection}>
            <Animated.View style={{ opacity: pulseAnim }}>
              <Ionicons name="cloud-upload-outline" size={20} color="#FF9A4D" />
            </Animated.View>
            <Text style={styles.uploadingText}>
              {displayProgress >= 100 ? 'Processing...' : 'Uploading post...'}
            </Text>
          </View>
          <View style={styles.rightSection}>
            {displayProgress >= 100 ? (
              <ActivityIndicator size="small" color="#FF9A4D" />
            ) : (
              <Text style={styles.progressText}>{Math.round(displayProgress)}%</Text>
            )}
          </View>
          <View style={styles.progressBarContainer}>
            <Animated.View
              style={[
                styles.progressBar,
                { width: progressWidth },
              ]}
            />
          </View>
        </View>
      )}

      {showSuccessUI && (
        <Animated.View style={[styles.successContainer, { opacity: successOpacity }]}>
          <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
          <Text style={styles.successText}>Post uploaded successfully!</Text>
          <TouchableOpacity onPress={clearUploadState} style={styles.closeButton}>
            <Ionicons name="close" size={18} color="#666" />
          </TouchableOpacity>
        </Animated.View>
      )}

      {uploadState.error && (
        <View style={styles.errorContainer}>
          <View style={styles.errorLeft}>
            <Ionicons name="alert-circle" size={20} color="#E94A37" />
            <Text style={styles.errorText} numberOfLines={1}>
              {uploadState.error}
            </Text>
          </View>
          <View style={styles.errorActions}>
            <TouchableOpacity onPress={retryUpload} style={styles.retryButton}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={clearUploadState} style={styles.closeButton}>
              <Ionicons name="close" size={18} color="#666" />
            </TouchableOpacity>
          </View>
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 9999,
    backgroundColor: '#fff',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
    overflow: 'hidden',
  },
  uploadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    paddingBottom: 20,
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  uploadingText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  progressText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FF9A4D',
  },
  progressBarContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: '#f0f0f0',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#FF9A4D',
    borderRadius: 2,
  },
  successContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 10,
  },
  successText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: '#4CAF50',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
  },
  errorLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  errorText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#E94A37',
    flex: 1,
  },
  errorActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  retryButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#FF9A4D',
    borderRadius: 6,
  },
  retryText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
  },
  closeButton: {
    padding: 4,
  },
});
