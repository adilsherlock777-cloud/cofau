import React from "react";
import { View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

/**
 * Spoon & Fork badge for restaurant accounts.
 * Orange gradient background (Cofau theme) with white utensils.
 */
const RestaurantBadge = ({ size = 18 }) => {
  const utensilColor = "#fff";
  const utensilHeight = size * 0.6;
  const handleWidth = size * 0.11;
  const gap = size * 0.14;

  return (
    <LinearGradient
      colors={["#FF8C00", "#E94A37"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "row",
      }}
    >
      {/* Fork - left */}
      <View style={{ alignItems: "center", marginRight: gap / 2 }}>
        {/* Fork tines */}
        <View style={{ flexDirection: "row", gap: size * 0.025 }}>
          <View
            style={{
              width: handleWidth * 0.55,
              height: utensilHeight * 0.4,
              backgroundColor: utensilColor,
              borderTopLeftRadius: size * 0.06,
              borderTopRightRadius: size * 0.06,
            }}
          />
          <View
            style={{
              width: handleWidth * 0.55,
              height: utensilHeight * 0.4,
              backgroundColor: utensilColor,
              borderTopLeftRadius: size * 0.06,
              borderTopRightRadius: size * 0.06,
            }}
          />
          <View
            style={{
              width: handleWidth * 0.55,
              height: utensilHeight * 0.4,
              backgroundColor: utensilColor,
              borderTopLeftRadius: size * 0.06,
              borderTopRightRadius: size * 0.06,
            }}
          />
        </View>
        {/* Fork handle */}
        <View
          style={{
            width: handleWidth,
            height: utensilHeight * 0.55,
            backgroundColor: utensilColor,
            borderBottomLeftRadius: size * 0.05,
            borderBottomRightRadius: size * 0.05,
          }}
        />
      </View>

      {/* Spoon - right */}
      <View style={{ alignItems: "center", marginLeft: gap / 2 }}>
        {/* Spoon bowl */}
        <View
          style={{
            width: handleWidth * 2,
            height: utensilHeight * 0.4,
            backgroundColor: utensilColor,
            borderTopLeftRadius: size * 0.2,
            borderTopRightRadius: size * 0.2,
            borderBottomLeftRadius: size * 0.08,
            borderBottomRightRadius: size * 0.08,
          }}
        />
        {/* Spoon handle */}
        <View
          style={{
            width: handleWidth,
            height: utensilHeight * 0.55,
            backgroundColor: utensilColor,
            borderBottomLeftRadius: size * 0.05,
            borderBottomRightRadius: size * 0.05,
          }}
        />
      </View>
    </LinearGradient>
  );
};

export default RestaurantBadge;
