import { Stack, useRouter, useSegments } from "expo-router";
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
import * as Linking from "expo-linking";
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

  // ✅ Deep link handling — open shared posts directly
  useEffect(() => {
    function handleDeepLink(event: { url: string }) {
      const url = event.url;
      let postId: string | null = null;

      // Handle cofau://post/{postId}
      if (url.startsWith("cofau://post/")) {
        postId = url.replace("cofau://post/", "").split("?")[0];
      }
      // Handle https://api.cofau.com/share/{postId}
      else if (url.includes("/share/")) {
        const parts = url.split("/share/");
        if (parts[1]) {
          postId = parts[1].split("?")[0];
        }
      }

      if (postId && isAuthenticated) {
        router.push(`/post-details/${postId}`);
      }
    }

    // Handle URL that launched the app
    Linking.getInitialURL().then((url) => {
      if (url) handleDeepLink({ url });
    });

    // Handle URLs while app is already open
    const subscription = Linking.addEventListener("url", handleDeepLink);
    return () => subscription.remove();
  }, [isAuthenticated, router]);

  // ✅ Effects MUST come before conditional returns
  useEffect(() => {
    if (isAuthenticated) {
      const cleanup = setupNotificationListeners(router);
      return cleanup;
    }
  }, [isAuthenticated, router]);

 useEffect(() => {
    if (isAuthenticated && token) {
      registerForPushNotificationsAsync(token, accountType || 'user')
        .then((pushToken) => {
          if (pushToken) {
          } else {
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
      router.replace(accountType === 'restaurant' ? "/(tabs)/leaderboard" : "/(tabs)/feed");
    }
  }, [isAuthenticated, loading, segments, accountType]);

  // ✅ NOW it is safe to return conditionally
  if (!fontsLoaded) return null;

  return (
    <SafeAreaView style={styles.container} edges={["bottom", "left", "right"]}>
      <StatusBar style={Platform.OS === "ios" ? "dark" : "auto"} />
      <Stack screenOptions={{ headerShown: false }} />
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
