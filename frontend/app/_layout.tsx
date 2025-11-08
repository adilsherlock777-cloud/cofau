import { Slot, useRouter, useSegments } from 'expo-router';
import { SafeAreaView } from 'react-native';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { useEffect } from 'react';

function RootLayoutNav() {
  const { isAuthenticated, loading, user, token } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    console.log('🔄 _layout: Auth state changed');
    console.log('   - loading:', loading);
    console.log('   - isAuthenticated:', isAuthenticated);
    console.log('   - token:', token ? 'Present' : 'None');
    console.log('   - user:', user?.email || 'None');
    console.log('   - segments:', segments);
    
    if (loading) {
      console.log('⏳ _layout: Still loading, skipping navigation');
      return;
    }

    const inAuthGroup = segments[0] === 'auth';
    console.log('   - inAuthGroup:', inAuthGroup);

    if (!isAuthenticated && !inAuthGroup) {
      console.log('🔐 _layout: Not authenticated, redirecting to login');
      router.replace('/auth/login');
    } else if (isAuthenticated && inAuthGroup) {
      console.log('✅ _layout: Authenticated in auth group, redirecting to feed');
      router.replace('/feed');
    } else {
      console.log('✅ _layout: No redirect needed');
    }
  }, [isAuthenticated, loading, segments, user]);

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