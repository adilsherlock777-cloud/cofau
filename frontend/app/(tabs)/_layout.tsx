import React, { useRef, useState, createContext, useContext } from "react";
import { Tabs, useRouter } from "expo-router";
import { View, Text, StyleSheet, Platform, Modal, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import MaskedView from "@react-native-masked-view/masked-view";
import { useAuth } from "../../context/AuthContext";

const GradientIcon = ({ name, size = 22 }: { name: any; size?: number }) => (
  <MaskedView maskElement={<Ionicons name={name} size={size} color="#000" />}>
    <LinearGradient
      colors={["#FF8C00", "#E94A37"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ width: size, height: size }}
    />
  </MaskedView>
);

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

// Context to let explore.tsx know when Explore tab is double-tapped
type ExploreRefreshFn = () => void;
const ExploreRefreshContext = createContext<{
  register: (fn: ExploreRefreshFn) => void;
  trigger: () => void;
}>({
  register: () => {},
  trigger: () => {},
});

export const useExploreRefresh = () => useContext(ExploreRefreshContext);

export default function TabsLayout() {
  const { accountType } = useAuth();
  const isRestaurant = accountType === "restaurant";
  const router = useRouter();
  const feedRefreshRef = useRef<FeedRefreshFn | null>(null);
  const profileRefreshRef = useRef<ProfileRefreshFn | null>(null);
  const exploreRefreshRef = useRef<ExploreRefreshFn | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);

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

  const exploreRefreshValue = {
    register: (fn: ExploreRefreshFn) => {
      exploreRefreshRef.current = fn;
    },
    trigger: () => {
      exploreRefreshRef.current?.();
    },
  };

  return (
    <FeedRefreshContext.Provider value={feedRefreshValue}>
    <ProfileRefreshContext.Provider value={profileRefreshValue}>
    <ExploreRefreshContext.Provider value={exploreRefreshValue}>
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
                <GradientIcon name="home" size={22} />
              ) : (
                <Ionicons name="home-outline" size={22} color="#000" />
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
            title: "Explore",
            tabBarIcon: ({ focused }) =>
              focused ? (
                <GradientIcon name="compass" size={22} />
              ) : (
                <Ionicons
                  name="compass-outline"
                  size={22}
                  color="#000"
                />
              ),
          }}
          listeners={{
            tabPress: () => {
              exploreRefreshRef.current?.();
            },
          }}
        />
        <Tabs.Screen
          name="leaderboard"
          options={{
            title: "Upload",
            tabBarIcon: () => (
              <LinearGradient
                colors={["#FF8C00", "#E94A37"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.centerCircleGradient}
              >
                <Ionicons name="camera" size={22} color="#fff" />
              </LinearGradient>
            ),
            tabBarItemStyle: styles.centerItem,
            tabBarActiveTintColor: "#E94A37",
          }}
          listeners={{
            tabPress: (e) => {
              e.preventDefault();
              setShowUploadModal(true);
            },
          }}
        />
        <Tabs.Screen
          name="happening"
          options={{
            title: isRestaurant ? "Dashboard" : "Saved",
            tabBarIcon: ({ focused }) =>
              focused ? (
                <GradientIcon name={isRestaurant ? "analytics" : "location"} size={22} />
              ) : (
                <Ionicons name={isRestaurant ? "analytics-outline" : "location-outline"} size={22} color="#000" />
              ),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: "Profile",
            tabBarIcon: ({ focused }) =>
              focused ? (
                <GradientIcon name="person" size={22} />
              ) : (
                <Ionicons name="person-outline" size={22} color="#000" />
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

      {/* Upload Choice Modal */}
      <Modal
        visible={showUploadModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowUploadModal(false)}
      >
        <TouchableOpacity
          style={styles.uploadModalOverlay}
          activeOpacity={1}
          onPress={() => setShowUploadModal(false)}
        >
          <View style={styles.uploadModalBox}>
            <Text style={styles.uploadModalTitle}>What would you like to share?</Text>

            <TouchableOpacity
              style={styles.uploadModalOption}
              activeOpacity={0.7}
              onPress={() => {
                setShowUploadModal(false);
                router.push("/add-post");
              }}
            >
              <LinearGradient
                colors={["#FF8C00", "#E94A37"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.uploadModalIconCircle}
              >
                <Ionicons name="camera" size={22} color="#fff" />
              </LinearGradient>
              <View style={{ flex: 1 }}>
                <Text style={styles.uploadModalOptionTitle}>Post a Bite</Text>
                <Text style={styles.uploadModalOptionDesc}>Share a food photo or video</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#ccc" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.uploadModalOption}
              activeOpacity={0.7}
              onPress={() => {
                setShowUploadModal(false);
                router.push("/story-upload");
              }}
            >
              <LinearGradient
                colors={["#FF8C00", "#E94A37"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.uploadModalIconCircle}
              >
                <Ionicons name="sparkles" size={22} color="#fff" />
              </LinearGradient>
              <View style={{ flex: 1 }}>
                <Text style={styles.uploadModalOptionTitle}>Upload Bite Stories</Text>
                <Text style={styles.uploadModalOptionDesc}>Share moments that disappear</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#ccc" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.uploadModalCancel}
              onPress={() => setShowUploadModal(false)}
            >
              <Text style={styles.uploadModalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </ExploreRefreshContext.Provider>
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
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#fff",
    borderWidth: 2,
    borderColor: "#000",
    justifyContent: "center",
    alignItems: "center",
  },
  centerCircleGradient: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    marginTop: -18,
  },
  centerItem: {
    marginTop: 0,
  },
  uploadModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  uploadModalBox: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: Platform.OS === "ios" ? 40 : 20,
  },
  uploadModalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#333",
    textAlign: "center",
    marginBottom: 20,
  },
  uploadModalOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    gap: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: "#F0F0F0",
  },
  uploadModalIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  uploadModalOptionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },
  uploadModalOptionDesc: {
    fontSize: 13,
    color: "#999",
    marginTop: 2,
  },
  uploadModalCancel: {
    marginTop: 16,
    alignItems: "center",
    paddingVertical: 12,
  },
  uploadModalCancelText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#999",
  },
});
