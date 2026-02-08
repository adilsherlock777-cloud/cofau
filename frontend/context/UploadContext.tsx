import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { Platform } from 'react-native';
import { useAuth } from './AuthContext';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://api.cofau.com';

interface UploadState {
  isUploading: boolean;
  progress: number;
  error: string | null;
  showSuccess: boolean;
  postData: any | null;
  accountType: string | null;
}

interface UploadResult {
  success: boolean;
  data?: any;
  error?: string;
}

interface UploadContextType {
  uploadState: UploadState;
  lastUploadTimestamp: number;
  lastUploadResult: any | null;
  startUpload: (postData: any, accountType: string) => Promise<UploadResult>;
  retryUpload: () => Promise<void>;
  clearUploadState: () => void;
}

const initialState: UploadState = {
  isUploading: false,
  progress: 0,
  error: null,
  showSuccess: false,
  postData: null,
  accountType: null,
};

const UploadContext = createContext<UploadContextType>({
  uploadState: initialState,
  lastUploadTimestamp: 0,
  lastUploadResult: null,
  startUpload: async () => ({ success: false }),
  retryUpload: async () => {},
  clearUploadState: () => {},
});

export const useUpload = () => useContext(UploadContext);

export const UploadProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token } = useAuth();
  const [uploadState, setUploadState] = useState<UploadState>(initialState);
  const [lastUploadTimestamp, setLastUploadTimestamp] = useState(0);
  const [lastUploadResult, setLastUploadResult] = useState<any | null>(null);
  const xhrRef = useRef<XMLHttpRequest | null>(null);

  const buildFormData = useCallback((postData: any, accountType: string): FormData => {
    const formData = new FormData();

    // Handle file/media - must match api.js format
    if (postData.file) {
      if (postData.file.uri) {
        // React Native
        formData.append('file', {
          uri: postData.file.uri,
          name: postData.file.name || postData.file.uri.split('/').pop(),
          type: postData.file.type || 'image/jpeg',
        } as any);
      } else {
        // Web - File object
        formData.append('file', postData.file);
      }
    }

    if (accountType === 'restaurant') {
      // Restaurant post fields - match api.js createRestaurantPost
      if (postData.price) formData.append('price', postData.price);
      if (postData.about) formData.append('about', postData.about);
      if (postData.map_link) formData.append('map_link', postData.map_link);
      if (postData.location_name) formData.append('location_name', postData.location_name);
      if (postData.category) formData.append('category', postData.category);
      if (postData.dish_name) formData.append('dish_name', postData.dish_name);
      if (postData.media_type) formData.append('media_type', postData.media_type);
    } else {
      // Regular user post fields - match api.js createPost
      if (postData.rating) formData.append('rating', postData.rating.toString());
      if (postData.review_text) formData.append('review_text', postData.review_text);
      if (postData.map_link) formData.append('map_link', postData.map_link);
      if (postData.location_name) formData.append('location_name', postData.location_name);
      if (postData.category) formData.append('category', postData.category);
      if (postData.dish_name) formData.append('dish_name', postData.dish_name);
      if (postData.tagged_restaurant_id) formData.append('tagged_restaurant_id', postData.tagged_restaurant_id);
      if (postData.media_type) formData.append('media_type', postData.media_type);
    }

    return formData;
  }, []);

  const performUpload = useCallback((formData: FormData, accountType: string): Promise<UploadResult> => {
    return new Promise((resolve) => {
      const xhr = new XMLHttpRequest();
      xhrRef.current = xhr;

      const endpoint = accountType === 'restaurant'
        ? `${API_URL}/api/restaurant/posts/create`
        : `${API_URL}/api/posts/create`;

      console.log('📤 Starting upload to:', endpoint);
      console.log('📤 Token present:', !!token);

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const progress = Math.round((event.loaded / event.total) * 100);
          console.log('📤 Upload progress:', progress + '%');
          setUploadState(prev => ({ ...prev, progress }));
        }
      };

      xhr.onload = () => {
        xhrRef.current = null;
        console.log('📤 Upload response status:', xhr.status);
        console.log('📤 Upload response:', xhr.responseText?.substring(0, 500));

        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const data = JSON.parse(xhr.responseText);
            setUploadState(prev => ({
              ...prev,
              isUploading: false,
              showSuccess: true,
              error: null,
              postData: null,
              accountType: null,
            }));
            setLastUploadResult(data);
            setLastUploadTimestamp(Date.now());
            resolve({ success: true, data });
          } catch (e) {
            console.error('📤 Failed to parse response:', e);
            setUploadState(prev => ({
              ...prev,
              isUploading: false,
              error: 'Failed to parse response',
            }));
            resolve({ success: false, error: 'Failed to parse response' });
          }
        } else {
          let errorMessage = 'Upload failed';
          try {
            const errorData = JSON.parse(xhr.responseText);
            errorMessage = errorData.detail || errorData.message || errorData.error || errorMessage;
          } catch (e) {
            errorMessage = xhr.responseText || `Upload failed (${xhr.status})`;
          }
          console.error('📤 Upload failed:', errorMessage);
          setUploadState(prev => ({
            ...prev,
            isUploading: false,
            error: errorMessage,
          }));
          resolve({ success: false, error: errorMessage });
        }
      };

      xhr.onerror = (event) => {
        xhrRef.current = null;
        console.error('📤 Network error:', event);
        setUploadState(prev => ({
          ...prev,
          isUploading: false,
          error: 'Network error. Please check your connection.',
        }));
        resolve({ success: false, error: 'Network error' });
      };

      xhr.ontimeout = () => {
        xhrRef.current = null;
        console.error('📤 Upload timeout');
        setUploadState(prev => ({
          ...prev,
          isUploading: false,
          error: 'Upload timed out. Please try again.',
        }));
        resolve({ success: false, error: 'Upload timed out' });
      };

      xhr.open('POST', endpoint);
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      xhr.timeout = 300000; // 5 minute timeout
      xhr.send(formData);
    });
  }, [token]);

  const startUpload = useCallback(async (postData: any, accountType: string): Promise<UploadResult> => {
    if (uploadState.isUploading) {
      return { success: false, error: 'Upload already in progress' };
    }

    setUploadState({
      isUploading: true,
      progress: 0,
      error: null,
      showSuccess: false,
      postData,
      accountType,
    });

    const formData = buildFormData(postData, accountType);
    return performUpload(formData, accountType);
  }, [uploadState.isUploading, buildFormData, performUpload]);

  const retryUpload = useCallback(async () => {
    if (!uploadState.postData || !uploadState.accountType) {
      return;
    }

    setUploadState(prev => ({
      ...prev,
      isUploading: true,
      progress: 0,
      error: null,
    }));

    const formData = buildFormData(uploadState.postData, uploadState.accountType);
    await performUpload(formData, uploadState.accountType);
  }, [uploadState.postData, uploadState.accountType, buildFormData, performUpload]);

  const clearUploadState = useCallback(() => {
    if (xhrRef.current) {
      xhrRef.current.abort();
      xhrRef.current = null;
    }
    setUploadState(initialState);
  }, []);

  const value = {
    uploadState,
    lastUploadTimestamp,
    lastUploadResult,
    startUpload,
    retryUpload,
    clearUploadState,
  };

  return (
    <UploadContext.Provider value={value}>
      {children}
    </UploadContext.Provider>
  );
};

export default UploadContext;
