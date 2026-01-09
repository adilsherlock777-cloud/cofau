import React, { useEffect, useRef } from "react";
import {
  View,
  StyleSheet,
  Animated,
  Dimensions,
  Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

/* -------------------------
   Shimmer Effect Component - Cross Platform
------------------------- */
const ShimmerEffect = ({ style }: { style?: any }) => {
  const animatedValue = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    let shimmerAnimation: Animated.CompositeAnimation;

    if (Platform.OS === "android") {
      // Android: Pulse/fade animation
      shimmerAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(animatedValue, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(animatedValue, {
            toValue: 0.3,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      );
    } else {
      // iOS: Translate shimmer animation
      shimmerAnimation = Animated.loop(
        Animated.timing(animatedValue, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
        })
      );
    }

    shimmerAnimation.start();

    return () => shimmerAnimation.stop();
  }, []);

  // Android - Pulse/fade effect
  if (Platform.OS === "android") {
    return (
      <Animated.View
        style={[
          styles.shimmerContainerAndroid,
          style,
          {
            opacity: animatedValue,
          },
        ]}
      />
    );
  }

  // iOS - Gradient shimmer effect
  const translateX = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [-SCREEN_WIDTH, SCREEN_WIDTH],
  });

  return (
    <View style={[styles.shimmerContainer, style]}>
      <Animated.View
        style={[
          styles.shimmerOverlay,
          {
            transform: [{ translateX }],
          },
        ]}
      >
        <LinearGradient
          colors={[
            "rgba(255, 255, 255, 0)",
            "rgba(255, 255, 255, 0.5)",
            "rgba(255, 255, 255, 0)",
          ]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.shimmerGradient}
        />
      </Animated.View>
    </View>
  );
};

/* -------------------------
   Story Skeleton Item
------------------------- */
const StorySkeletonItem = () => (
  <View style={styles.storyItem}>
    <View style={styles.storyCircle}>
      <ShimmerEffect style={styles.absoluteFill} />
    </View>
    <View style={styles.storyNameBar}>
      <ShimmerEffect style={styles.absoluteFill} />
    </View>
  </View>
);

/* -------------------------
   Stories Bar Skeleton
------------------------- */
const StoriesBarSkeleton = () => (
  <View style={styles.storiesContainer}>
    {[1, 2, 3, 4, 5].map((item) => (
      <StorySkeletonItem key={item} />
    ))}
  </View>
);

/* -------------------------
   Feed Post Skeleton Item
------------------------- */
const FeedPostSkeleton = () => (
  <View style={styles.postContainer}>
    {/* Header - Avatar + Username + Location */}
    <View style={styles.postHeader}>
      <View style={styles.avatarCircle}>
        <ShimmerEffect style={styles.absoluteFillRound} />
      </View>
      <View style={styles.headerTextContainer}>
        <View style={styles.usernameBar}>
          <ShimmerEffect style={styles.absoluteFill} />
        </View>
        <View style={styles.locationBar}>
          <ShimmerEffect style={styles.absoluteFill} />
        </View>
      </View>
      <View style={styles.moreButton}>
        <ShimmerEffect style={styles.absoluteFillRound} />
      </View>
    </View>

    {/* Main Image/Video Area */}
    <View style={styles.mediaContainer}>
      <ShimmerEffect style={styles.absoluteFill} />
    </View>

    {/* Action Buttons Row */}
    <View style={styles.actionsRow}>
      <View style={styles.leftActions}>
        <View style={styles.actionButton}>
          <ShimmerEffect style={styles.absoluteFillRound} />
        </View>
        <View style={styles.actionButton}>
          <ShimmerEffect style={styles.absoluteFillRound} />
        </View>
        <View style={styles.actionButton}>
          <ShimmerEffect style={styles.absoluteFillRound} />
        </View>
      </View>
      <View style={styles.actionButton}>
        <ShimmerEffect style={styles.absoluteFillRound} />
      </View>
    </View>

    {/* Likes Count */}
    <View style={styles.likesBar}>
      <ShimmerEffect style={styles.absoluteFill} />
    </View>

    {/* Caption Lines */}
    <View style={styles.captionContainer}>
      <View style={styles.captionLine1}>
        <ShimmerEffect style={styles.absoluteFill} />
      </View>
      <View style={styles.captionLine2}>
        <ShimmerEffect style={styles.absoluteFill} />
      </View>
    </View>

    {/* Timestamp */}
    <View style={styles.timestampBar}>
      <ShimmerEffect style={styles.absoluteFill} />
    </View>
  </View>
);

/* -------------------------
   Main Feed Skeleton Component
------------------------- */
export const FeedSkeleton = ({ showStories = true }: { showStories?: boolean }) => {
  return (
    <View style={styles.container}>
      {showStories && <StoriesBarSkeleton />}
      <FeedPostSkeleton />
      <FeedPostSkeleton />
    </View>
  );
};

/* -------------------------
   Export Individual Components
------------------------- */
export { StoriesBarSkeleton, FeedPostSkeleton, ShimmerEffect };

/* -------------------------
   Styles
------------------------- */
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  absoluteFill: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 4,
  },
  absoluteFillRound: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 100,
  },
  shimmerContainer: {
    overflow: "hidden",
    backgroundColor: "#E0E0E0",
  },
  shimmerContainerAndroid: {
    overflow: "hidden",
    backgroundColor: "#D0D0D0",
  },
  shimmerOverlay: {
    width: "100%",
    height: "100%",
  },
  shimmerGradient: {
    flex: 1,
    width: SCREEN_WIDTH * 2,
  },

  // Stories Bar
  storiesContainer: {
    flexDirection: "row",
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: "#E8E8E8",
  },
  storyItem: {
    alignItems: "center",
    marginRight: 16,
  },
  storyCircle: {
    width: 66,
    height: 66,
    borderRadius: 33,
    overflow: "hidden",
  },
  storyNameBar: {
    width: 50,
    height: 10,
    borderRadius: 5,
    overflow: "hidden",
    marginTop: 6,
  },

  // Post Container
  postContainer: {
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: "#E8E8E8",
  },

  // Post Header
  postHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  avatarCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    overflow: "hidden",
  },
  headerTextContainer: {
    flex: 1,
    marginLeft: 12,
  },
  usernameBar: {
    width: 100,
    height: 12,
    borderRadius: 6,
    overflow: "hidden",
    marginBottom: 6,
  },
  locationBar: {
    width: 140,
    height: 10,
    borderRadius: 5,
    overflow: "hidden",
  },
  moreButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    overflow: "hidden",
  },

  // Media Container
  mediaContainer: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH,
    overflow: "hidden",
  },

  // Actions Row
  actionsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingTop: 12,
  },
  leftActions: {
    flexDirection: "row",
    gap: 16,
  },
  actionButton: {
    width: 26,
    height: 26,
    borderRadius: 13,
    overflow: "hidden",
  },

  // Likes
  likesBar: {
    width: 80,
    height: 12,
    borderRadius: 6,
    overflow: "hidden",
    marginLeft: 14,
    marginTop: 10,
  },

  // Caption
  captionContainer: {
    paddingHorizontal: 14,
    marginTop: 8,
  },
  captionLine1: {
    width: "90%",
    height: 12,
    borderRadius: 6,
    overflow: "hidden",
    marginBottom: 6,
  },
  captionLine2: {
    width: "60%",
    height: 12,
    borderRadius: 6,
    overflow: "hidden",
  },

  // Timestamp
  timestampBar: {
    width: 60,
    height: 10,
    borderRadius: 5,
    overflow: "hidden",
    marginLeft: 14,
    marginTop: 8,
  },
});

export default FeedSkeleton;