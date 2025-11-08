import { Slot, useRouter, useSegments } from 'expo-router';
import { SafeAreaView } from 'react-native';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { useEffect } from 'react';

function RootLayoutNav() {
  const { isAuthenticated, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === 'auth';

    if (!isAuthenticated && !inAuthGroup) {
      // Redirect to login if not authenticated
      router.replace('/auth/login');
    } else if (isAuthenticated && inAuthGroup) {
      // Redirect to feed if authenticated and in auth screens
      router.replace('/feed');
    }
  }, [isAuthenticated, loading, segments]);

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <Slot />
    </SafeAreaView>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootLayoutNav />
    </AuthProvider>
  );
}