import React, { useRef, createContext, useContext } from "react";
import { Tabs, useRouter } from "expo-router";
import { View, StyleSheet, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useAuth } from "../../context/AuthContext";

// Context to let feed.tsx know when Home tab is double-tapped
type FeedRefreshFn = () => void;
const FeedRefreshContext = createContext<{
  register: (fn: FeedRefreshFn) => void;
  trigger: () => void;
}>({
  register: () => {},
  trigger: () => {},
});

export const useFeedRefresh = () => useContext(FeedRefreshContext);

// Context to let profile.tsx know when Profile tab is double-tapped
type ProfileRefreshFn = () => void;
const ProfileRefreshContext = createContext<{
  register: (fn: ProfileRefreshFn) => void;
  trigger: () => void;
}>({
  register: () => {},
  trigger: () => {},
});

export const useProfileRefresh = () => useContext(ProfileRefreshContext);

export default function TabsLayout() {
  const { accountType } = useAuth();
  const isRestaurant = accountType === "restaurant";
  const router = useRouter();
  const feedRefreshRef = useRef<FeedRefreshFn | null>(null);
  const profileRefreshRef = useRef<ProfileRefreshFn | null>(null);

  const feedRefreshValue = {
    register: (fn: FeedRefreshFn) => {
      feedRefreshRef.current = fn;
    },
    trigger: () => {
      feedRefreshRef.current?.();
    },
  };

  const profileRefreshValue = {
    register: (fn: ProfileRefreshFn) => {
      profileRefreshRef.current = fn;
    },
    trigger: () => {
      profileRefreshRef.current?.();
    },
  };

  return (
    <FeedRefreshContext.Provider value={feedRefreshValue}>
    <ProfileRefreshContext.Provider value={profileRefreshValue}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: styles.tabBar,
          tabBarActiveTintColor: "#000",
          tabBarInactiveTintColor: "#000",
          tabBarLabelStyle: styles.tabLabel,
        }}
      >
        <Tabs.Screen
          name="feed"
          options={{
            title: "Home",
            tabBarIcon: ({ focused }) =>
              focused ? (
                <LinearGradient
                  colors={["#FF8C00", "#E94A37"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.iconGradient}
                >
                  <Ionicons name="home" size={18} color="#fff" />
                </LinearGradient>
              ) : (
                <Ionicons name="home-outline" size={20} color="#000" />
              ),
          }}
          listeners={{
            tabPress: (e) => {
              // When Home tab is tapped while already focused, refresh feed
              feedRefreshRef.current?.();
            },
          }}
        />
        <Tabs.Screen
          name="explore"
          options={{
            title: isRestaurant ? "Dashboard" : "Explore",
            tabBarIcon: ({ focused }) =>
              focused ? (
                <LinearGradient
                  colors={["#FF8C00", "#E94A37"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.iconGradient}
                >
                  <Ionicons
                    name={isRestaurant ? "analytics" : "compass"}
                    size={18}
                    color="#fff"
                  />
                </LinearGradient>
              ) : (
                <Ionicons
                  name={isRestaurant ? "analytics-outline" : "compass-outline"}
                  size={20}
                  color="#000"
                />
              ),
          }}
        />
        <Tabs.Screen
          name="leaderboard"
          options={{
            title: isRestaurant ? "Orders" : "Delivery",
            tabBarIcon: ({ focused }) =>
              focused ? (
                <LinearGradient
                  colors={["#FF8C00", "#E94A37"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.centerCircleGradient}
                >
                  <Ionicons name="fast-food" size={22} color="#fff" />
                </LinearGradient>
              ) : (
                <View style={styles.centerCircle}>
                  <Ionicons name="fast-food" size={22} color="#000" />
                </View>
              ),
            tabBarItemStyle: styles.centerItem,
          }}
        />
        <Tabs.Screen
          name="happening"
          options={{
            title: isRestaurant ? "Sales" : "Happening",
            tabBarIcon: ({ focused }) =>
              focused ? (
                <LinearGradient
                  colors={["#FF8C00", "#E94A37"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.iconGradient}
                >
                  <Ionicons
                    name={isRestaurant ? "analytics" : "location"}
                    size={18}
                    color="#fff"
                  />
                </LinearGradient>
              ) : (
                <Ionicons
                  name={isRestaurant ? "analytics-outline" : "location-outline"}
                  size={20}
                  color="#000"
                />
              ),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: "Profile",
            tabBarIcon: ({ focused }) =>
              focused ? (
                <LinearGradient
                  colors={["#FF8C00", "#E94A37"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.iconGradient}
                >
                  <Ionicons name="person" size={18} color="#fff" />
                </LinearGradient>
              ) : (
                <Ionicons name="person-outline" size={20} color="#000" />
              ),
          }}
          listeners={{
            tabPress: (e) => {
              e.preventDefault();
              router.navigate('/profile');
              profileRefreshRef.current?.();
            },
          }}
        />
      </Tabs>
    </ProfileRefreshContext.Provider>
    </FeedRefreshContext.Provider>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#eee",
    paddingVertical: 4,
    height: Platform.OS === "ios" ? 85 : 65,
    paddingBottom: Platform.OS === "ios" ? 25 : 8,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: "500",
    marginTop: 2,
  },
  iconGradient: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  centerCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#fff",
    borderWidth: 2,
    borderColor: "#000",
    justifyContent: "center",
    alignItems: "center",
    marginTop: -18,
    marginBottom: 6,
  },
  centerCircleGradient: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
    marginTop: -18,
    marginBottom: 6,
  },
  centerItem: {
    marginTop: 0,
  },
});
