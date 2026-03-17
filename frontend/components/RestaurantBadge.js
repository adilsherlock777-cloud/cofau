import React from "react";
import { View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

/**
 * Restaurant badge – straight fork & knife inside a plate circle.
 */
const RestaurantBadge = ({ size = 18 }) => {
  const iconH = size * 0.52;
  const tineW = size * 0.04;
  const tineH = iconH * 0.38;
  const handleW = size * 0.065;
  const handleH = iconH * 0.52;
  const knifeW = size * 0.09;

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
      }}
    >
      {/* Inner plate circle */}
      <View
        style={{
          position: "absolute",
          width: size * 0.78,
          height: size * 0.78,
          borderRadius: size * 0.39,
          borderWidth: size * 0.06,
          borderColor: "rgba(255,255,255,0.45)",
        }}
      />

      {/* Utensils container */}
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: size * 0.12 }}>
        {/* Fork - straight */}
        <View style={{ alignItems: "center" }}>
          <View style={{ flexDirection: "row", gap: size * 0.02 }}>
            <View style={{ width: tineW, height: tineH, backgroundColor: "#fff", borderRadius: tineW / 2 }} />
            <View style={{ width: tineW, height: tineH, backgroundColor: "#fff", borderRadius: tineW / 2 }} />
            <View style={{ width: tineW, height: tineH, backgroundColor: "#fff", borderRadius: tineW / 2 }} />
          </View>
          <View style={{ width: handleW, height: handleH, backgroundColor: "#fff", borderRadius: handleW / 2, marginTop: -1 }} />
        </View>

        {/* Knife - straight */}
        <View style={{ alignItems: "center" }}>
          <View style={{
            width: knifeW,
            height: tineH + 1,
            backgroundColor: "#fff",
            borderTopLeftRadius: knifeW / 2,
            borderTopRightRadius: knifeW / 2,
            borderBottomLeftRadius: knifeW * 0.15,
            borderBottomRightRadius: knifeW * 0.15,
          }} />
          <View style={{ width: handleW, height: handleH, backgroundColor: "#fff", borderRadius: handleW / 2, marginTop: -1 }} />
        </View>
      </View>
    </LinearGradient>
  );
};

export default RestaurantBadge;
