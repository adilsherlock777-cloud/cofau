import { Slot, useRouter, useSegments } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import { StyleSheet, Platform } from "react-native";
import { AuthProvider, useAuth } from "../context/AuthContext";
import { NotificationProvider } from "../context/NotificationContext";
import { LevelProvider } from "../context/LevelContext";
import { UploadProvider } from "../context/UploadContext";
import LevelUpAnimation from "../components/LevelUpAnimation";
import UploadProgressIndicator from "../components/UploadProgressIndicator";
import { useEffect } from "react";
import { 
  setupNotificationListeners, 
  registerForPushNotificationsAsync  // ⬅️ ADD THIS IMPORT
} from "../utils/pushNotifications";

function RootLayoutNav() {
  const { isAuthenticated, loading, user, token, accountType } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  // ✅ Fonts FIRST
  const [fontsLoaded] = useFonts({
    Lobster: require("../assets/fonts/Lobster-Regular.ttf"),
  });

  // ✅ Effects MUST come before conditional returns
  useEffect(() => {
    if (isAuthenticated) {
      const cleanup = setupNotificationListeners(router);
      return cleanup;
    }
  }, [isAuthenticated, router]);


 useEffect(() => {
    if (isAuthenticated && token) {
      console.log('🔔 Attempting to register push notifications...');
      console.log(`   Account type: ${accountType || 'user'}`);
      registerForPushNotificationsAsync(token, accountType || 'user')
        .then((pushToken) => {
          if (pushToken) {
            console.log('✅ Push token obtained:', pushToken);
          } else {
            console.log('⚠️ No push token returned');
          }
        })
        .catch((error) => {
          console.error('❌ Push registration error:', error);
        });
    }
  }, [isAuthenticated, token, accountType]);

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === "auth";
    const inShareGroup = segments[0] === "share";

    if (!isAuthenticated && !inAuthGroup && !inShareGroup) {
      router.replace("/auth/login");
    } else if (isAuthenticated && inAuthGroup) {
      router.replace(accountType === 'restaurant' ? "/leaderboard" : "/feed");
    }
  }, [isAuthenticated, loading, segments, accountType]);

  // ✅ NOW it is safe to return conditionally
  if (!fontsLoaded) return null;

  return (
    <SafeAreaView style={styles.container} edges={["bottom", "left", "right"]}>
      <StatusBar style={Platform.OS === "ios" ? "dark" : "auto"} />
      <Slot />
      <UploadProgressIndicator />
      <LevelUpAnimation />
    </SafeAreaView>
  );
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    paddingBottom: 10,
  },
});

export default function RootLayout() {
  return (
    <AuthProvider>
      <LevelProvider>
        <NotificationProvider>
          <UploadProvider>
            <RootLayoutNav />
          </UploadProvider>
        </NotificationProvider>
      </LevelProvider>
    </AuthProvider>
  );
}
