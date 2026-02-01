import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import axios from "axios";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || "https://api.cofau.com";

interface WalletBalanceModalProps {
  visible: boolean;
  onClose: () => void;
  token: string;
}

export const WalletBalanceModal: React.FC<WalletBalanceModalProps> = ({
  visible,
  onClose,
  token,
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [walletBalance, setWalletBalance] = useState<number>(0);

  useEffect(() => {
    if (visible && token) {
      fetchWalletBalance();
    }
  }, [visible, token]);

  const fetchWalletBalance = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await axios.get(`${BACKEND_URL}/api/wallet/balance`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setWalletBalance(response.data.balance || 0);
    } catch (err: any) {
      console.error("Error fetching wallet balance:", err);
      setError("Failed to load wallet balance");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <LinearGradient
            colors={["#FF8C42", "#FFA726"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.header}
          >
            <View style={styles.headerContent}>
              <Ionicons name="wallet" size={24} color="#FFF" />
              <Text style={styles.headerTitle}>COFAU WALLET</Text>
            </View>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={onClose}
              activeOpacity={0.7}
            >
              <Ionicons name="close" size={28} color="#000" />
            </TouchableOpacity>
          </LinearGradient>

          {/* Content */}
          <View style={styles.content}>
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#FF7A18" />
                <Text style={styles.loadingText}>Loading wallet...</Text>
              </View>
            ) : error ? (
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle" size={48} color="#FF6B6B" />
                <Text style={styles.errorText}>{error}</Text>
                <TouchableOpacity
                  style={styles.retryButton}
                  onPress={fetchWalletBalance}
                >
                  <Text style={styles.retryButtonText}>Retry</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.balanceContainer}>
                <Text style={styles.balanceLabel}>Wallet Balance</Text>

                <View style={styles.balanceAmountContainer}>
                  <View style={styles.coinIcon}>
                    <Text style={styles.coinText}>₹</Text>
                  </View>
                  <Text style={styles.balanceAmount}>₹{walletBalance}</Text>
                </View>

                <Text style={styles.balanceSubtext}>
                  Total amount collected in your wallet
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContainer: {
    width: SCREEN_WIDTH - 40,
    maxWidth: 400,
    backgroundColor: "#FFF",
    borderRadius: 20,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 15,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#FFF",
    letterSpacing: 1,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    minHeight: 200,
  },
  loadingContainer: {
    padding: 60,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#666",
  },
  errorContainer: {
    padding: 60,
    justifyContent: "center",
    alignItems: "center",
  },
  errorText: {
    marginTop: 12,
    fontSize: 14,
    color: "#666",
    textAlign: "center",
  },
  retryButton: {
    marginTop: 16,
    backgroundColor: "#FF7A18",
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 20,
  },
  retryButtonText: {
    color: "#FFF",
    fontWeight: "600",
  },
  balanceContainer: {
    padding: 40,
    alignItems: "center",
  },
  balanceLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#888",
    marginBottom: 20,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  balanceAmountContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  coinIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#FFD700",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
    shadowColor: "#FFD700",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  coinText: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#FFF",
  },
  balanceAmount: {
    fontSize: 48,
    fontWeight: "800",
    color: "#222",
  },
  balanceSubtext: {
    fontSize: 13,
    color: "#999",
    textAlign: "center",
    marginTop: 8,
  },
});
