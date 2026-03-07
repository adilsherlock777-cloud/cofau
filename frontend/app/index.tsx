import { Redirect } from 'expo-router';
import { useAuth } from '../context/AuthContext';

export default function Index() {
  const { accountType } = useAuth();

  // Redirect restaurant accounts to dashboard, regular users to feed
  const redirectPath = accountType === 'restaurant' ? '/(tabs)/happening' : '/(tabs)/feed';

  return <Redirect href={redirectPath} />;
}