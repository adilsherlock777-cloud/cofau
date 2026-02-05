import { Redirect } from 'expo-router';
import { useAuth } from '../context/AuthContext';

export default function Index() {
  const { accountType } = useAuth();

  // Redirect restaurant accounts to leaderboard, regular users to feed
  const redirectPath = accountType === 'restaurant' ? '/leaderboard' : '/feed';

  return <Redirect href={redirectPath} />;
}