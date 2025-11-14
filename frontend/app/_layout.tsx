import { Slot, useRouter, useSegments } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context"; // ✅ changed import
import { StatusBar } from "expo-status-bar";
import { StyleSheet, Platform } from "react-native";
import { AuthProvider, useAuth } from "../context/AuthContext";
import { LevelProvider } from "../context/LevelContext";
import LevelUpAnimation from "../components/LevelUpAnimation";
import { useEffect } from "react";

function RootLayoutNav() {
  const { isAuthenticated, loading, user, token } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    console.log("🔄 _layout: Auth state changed");
    console.log("   - loading:", loading);
    console.log("   - isAuthenticated:", isAuthenticated);
    console.log("   - token:", token ? "Present" : "None");
    console.log("   - user:", user?.email || "None");
    console.log("   - segments:", segments);

    if (loading) {
      console.log("⏳ _layout: Still loading, skipping navigation");
      return;
    }

    const inAuthGroup = segments[0] === "auth";
    console.log("   - inAuthGroup:", inAuthGroup);

    setTimeout(() => {
      if (!isAuthenticated && !inAuthGroup) {
        console.log("🔐 Redirect → /auth/login");
        router.replace("/auth/login");
      } else if (isAuthenticated && inAuthGroup) {
        console.log("✅ Redirect → /feed");
        router.replace("/feed");
      } else {
        console.log("✅ No redirect needed");
      }
    }, 100);
  }, [isAuthenticated, loading, segments, user]);

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
    paddingBottom: 10, // 👈 ensures your bottom nav stays above Android bar
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
