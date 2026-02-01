import React, { useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Dimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const PostRewardModal = ({ visible, onClose, rewardData }) => {
  // Default values if rewardData is null
  const data = rewardData || {
    wallet_earned: 0,
    points_earned: 25,
    message: "Post Uploaded!",
    tip: "",
    new_balance: 0,
  };

  const hasWalletReward = data.wallet_earned > 0;

  // Auto-close after 4 seconds
  useEffect(() => {
    if (visible) {
      const timer = setTimeout(() => {
        onClose();
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [visible]);

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          
          {/* Icon */}
          <View style={styles.iconContainer}>
            {hasWalletReward ? (
              <LinearGradient
                colors={["#FFD700", "#FFA500"]}
                style={styles.iconCircle}
              >
                <Text style={styles.iconEmoji}>🎉</Text>
              </LinearGradient>
            ) : (
              <View style={styles.iconCircleGreen}>
                <Ionicons name="checkmark" size={40} color="#FFF" />
              </View>
            )}
          </View>

          {/* Title */}
          <Text style={styles.title}>{data.message}</Text>

          {/* Rewards Container */}
          <View style={styles.rewardsContainer}>
            
            {/* Wallet Reward (if earned) */}
            {hasWalletReward && (
              <View style={styles.rewardItem}>
                <LinearGradient
                  colors={["#FF7A18", "#FF9A4D"]}
                  style={styles.rewardBadge}
                >
                  <Text style={styles.rewardBadgeText}>+₹{data.wallet_earned}</Text>
                </LinearGradient>
                <Text style={styles.rewardLabel}>Cofau Wallet</Text>
              </View>
            )}

            {/* Points Reward */}
            <View style={styles.rewardItem}>
              <View style={styles.pointsBadge}>
                <Text style={styles.pointsBadgeText}>+{data.points_earned}</Text>
              </View>
              <Text style={styles.rewardLabel}>Points</Text>
            </View>
          </View>

          {/* Wallet Balance (if wallet earned) */}
          {hasWalletReward && (
            <View style={styles.balanceContainer}>
              <Ionicons name="wallet-outline" size={18} color="#666" />
              <Text style={styles.balanceText}>
                Wallet Balance: <Text style={styles.balanceAmount}>₹{data.new_balance}</Text>
              </Text>
            </View>
          )}

          {/* Tip Message (if no wallet earned) */}
          {!hasWalletReward && data.tip ? (
            <View style={styles.tipContainer}>
              <Text style={styles.tipIcon}>💡</Text>
              <Text style={styles.tipText}>{data.tip}</Text>
            </View>
          ) : null}

          {/* Close Button */}
          <TouchableOpacity 
            style={styles.closeButtonContainer} 
            onPress={onClose}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={hasWalletReward ? ["#FF7A18", "#FF9A4D"] : ["#4CAF50", "#66BB6A"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.closeButton}
            >
              <Text style={styles.closeButtonText}>
                {hasWalletReward ? "Awesome!" : "Got it!"}
              </Text>
            </LinearGradient>
          </TouchableOpacity>

        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContainer: {
    width: SCREEN_WIDTH - 60,
    maxWidth: 340,
    backgroundColor: "#FFF",
    borderRadius: 24,
    padding: 30,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 15,
  },
  iconContainer: {
    marginBottom: 20,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#FFD700",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  iconCircleGreen: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#4CAF50",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#4CAF50",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  iconEmoji: {
    fontSize: 40,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: "#222",
    marginBottom: 20,
    textAlign: "center",
  },
  rewardsContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "flex-start",
    gap: 20,
    marginBottom: 20,
  },
  rewardItem: {
    alignItems: "center",
  },
  rewardBadge: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 16,
    marginBottom: 8,
    shadowColor: "#FF7A18",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 5,
  },
  rewardBadgeText: {
    fontSize: 24,
    fontWeight: "800",
    color: "#FFF",
  },
  pointsBadge: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: "#F0F0F0",
    marginBottom: 8,
    borderWidth: 2,
    borderColor: "#E0E0E0",
  },
  pointsBadgeText: {
    fontSize: 24,
    fontWeight: "800",
    color: "#333",
  },
  rewardLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#666",
  },
  balanceContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9F9F9",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    marginBottom: 20,
    gap: 8,
  },
  balanceText: {
    fontSize: 14,
    color: "#666",
  },
  balanceAmount: {
    fontWeight: "700",
    color: "#222",
  },
  tipContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#FFF9E6",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#FFE082",
    gap: 10,
  },
  tipIcon: {
    fontSize: 18,
  },
  tipText: {
    flex: 1,
    fontSize: 13,
    color: "#666",
    lineHeight: 20,
  },
  closeButtonContainer: {
    width: "100%",
  },
  closeButton: {
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  closeButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFF",
  },
});

export default PostRewardModal;