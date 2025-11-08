import { useEffect } from 'react';
import { useRouter } from 'expo-router';

export default function Index() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to feed screen on app load
    router.replace('/feed');
  }, []);

  return null;
}