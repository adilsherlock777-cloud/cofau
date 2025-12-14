import { Slot, useRouter, useSegments } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import { StyleSheet, Platform } from "react-native";
import { AuthProvider, useAuth } from "../context/AuthContext";
import { LevelProvider } from "../context/LevelContext";
import LevelUpAnimation from "../components/LevelUpAnimation";
import { useEffect } from "react";
import { setupNotificationListeners } from "../utils/pushNotifications";

function RootLayoutNav() {
  const { isAuthenticated, loading, user, token } = useAuth();
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
    if (loading) return;

    const inAuthGroup = segments[0] === "auth";
    const inShareGroup = segments[0] === "share";

    if (!isAuthenticated && !inAuthGroup && !inShareGroup) {
      router.replace("/auth/login");
    } else if (isAuthenticated && inAuthGroup) {
      router.replace("/feed");
    }
  }, [isAuthenticated, loading, segments]);

  // ✅ NOW it is safe to return conditionally
  if (!fontsLoaded) return null;

  return (
    <SafeAreaView style={styles.container} edges={["bottom", "left", "right"]}>
      <StatusBar style={Platform.OS === "ios" ? "dark" : "auto"} />
      <Slot />
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
        <RootLayoutNav />
      </LevelProvider>
    </AuthProvider>
  );
}
