import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  ActivityIndicator,
} from "react-native";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons, MaterialIcons, FontAwesome5 } from "@expo/vector-icons";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || "https://api.cofau.com";

const CofauWalletModal = ({ visible, onClose }) => {
  const { token } = useAuth();

  // State variables
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [walletData, setWalletData] = useState({
    balance: 0,
    target_amount: 1000,
    amount_needed: 1000,
    progress_percent: 0,
    can_claim_voucher: false,
    delivery_discount: {
      per_order: 25,
      deliveries_worth: 0,
    },
    recent_transactions: [],
  });

  const fetchWalletData = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await axios.get(`${BACKEND_URL}/api/wallet/balance`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setWalletData(response.data);
    } catch (err) {
      console.log("Error fetching wallet:", err);
      setError("Failed to load wallet data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible && token) {
      fetchWalletData();
    }
  }, [visible, token]);

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          {/* Header - NOT inside ScrollView */}
          <LinearGradient
            colors={["#FF8C42", "#FFA726"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.header}
          >
            <Text style={styles.headerTitle}>COFAU WALLET</Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={onClose}
              activeOpacity={0.7}
            >
              <Ionicons name="close" size={28} color="#000" />
            </TouchableOpacity>
          </LinearGradient>

          {/* ScrollView with body content */}
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#FF7A18" />
              <Text style={styles.loadingText}>Loading wallet...</Text>
            </View>
          ) : error ? (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle" size={48} color="#FF6B6B" />
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity style={styles.retryButton} onPress={fetchWalletData}>
                <Text style={styles.retryButtonText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <ScrollView
              style={styles.content}
              contentContainerStyle={{ paddingBottom: 20 }}
              showsVerticalScrollIndicator={false}
              bounces={false}
            >
              {/* Balance Section */}
              <View style={styles.balanceSection}>
                <View style={styles.balanceRow}>
                <View style={styles.coinIcon}>
                  <Text style={styles.coinText}>₹</Text>
                </View>
                <Text style={styles.balanceAmount}>₹{walletData.balance}</Text>
              </View>

              {/* Progress Bar with Gift */}
              <View style={styles.progressRow}>
                <View style={styles.progressBarContainer}>
                  <View style={styles.progressBarBg}>
                    <LinearGradient
                      colors={["#4CAF50", "#66BB6A"]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={[styles.progressBarFill, { width: `${walletData.progress_percent}%` }]}
                    />
                    {/* Gray remaining section */}
                    <View
                      style={[
                        styles.progressBarRemaining,
                        { width: `${100 - walletData.progress_percent}%`, left: `${walletData.progress_percent}%` }
                      ]}
                    />
                  </View>
                </View>

                {/* Amazon Gift Box */}
                <View style={styles.giftBoxContainer}>
                  <View style={styles.giftBox}>
                    <Ionicons name="gift" size={24} color="#FF9800" />
                    <View style={styles.amazonSmile}>
                      <Text style={styles.amazonSmileText}>⌒</Text>
                    </View>
                  </View>
                </View>
              </View>

              <View style={styles.unlockRow}>
                <Text style={styles.unlockText}>
                  <Text style={styles.unlockAmount}>₹{walletData.amount_needed}</Text>
                  <Text> more to unlock Amazon voucher</Text>
                </Text>
                <TouchableOpacity style={styles.claimButton} disabled>
                  <Ionicons name="lock-closed" size={12} color="#666" />
                  <Text style={styles.claimButtonText}>Claim</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Divider */}
            <View style={styles.divider} />

            {/* How To Use Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>HOW TO USE</Text>

              <View style={styles.deliveryCard}>
                <View style={styles.deliveryIconContainer}>
                  <FontAwesome5 name="truck" size={20} color="#4CAF50" />
                </View>
                <View style={styles.deliveryContent}>
                  <Text style={styles.deliveryTitle}>DELIVERY DISCOUNT</Text>
                  <Text style={styles.deliverySubtext}>
                    <Text>Use </Text>
                    <Text style={styles.highlightText}>₹{walletData.delivery_discount.per_order}</Text>
                    <Text> per order</Text>
                  </Text>
                  <Text style={styles.deliverySubtext}>
                    <Text>Your balance: </Text>
                    <Text style={styles.highlightText}>{walletData.delivery_discount.deliveries_worth} deliveries</Text>
                    <Text> worth!</Text>
                  </Text>
                </View>
              </View>

              <TouchableOpacity style={styles.useButton} activeOpacity={0.8}>
                <Ionicons name="pricetag" size={18} color="#FFF" style={styles.useButtonIcon} />
                <Text style={styles.useButtonText}>Use on Next Order</Text>
              </TouchableOpacity>
            </View>

            {/* Divider */}
            <View style={styles.divider} />

            {/* Amazon Voucher Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>AMAZON VOUCHER</Text>

              <View style={styles.voucherCard}>
                <View style={styles.voucherIconContainer}>
                  <Ionicons name="gift" size={24} color="#FF9800" />
                </View>
                <View style={styles.voucherContent}>
                  <Text style={styles.voucherTitle}>AMAZON VOUCHER</Text>
                  <Text style={styles.voucherSubtext}>
                    <Text>Minimum </Text>
                    <Text style={styles.highlightText}>₹{walletData.target_amount}</Text>
                    <Text> required</Text>
                  </Text>
                  <Text style={styles.voucherSubtext}>
                    <Text>You need </Text>
                    <Text style={styles.highlightText}>₹{walletData.amount_needed}</Text>
                    <Text> more</Text>
                  </Text>
                </View>
              </View>

              <TouchableOpacity style={styles.lockedButton} disabled>
                <Ionicons name="lock-closed" size={14} color="#666" />
                <Text style={styles.lockedButtonText}>Locked - Keep Posting!</Text>
              </TouchableOpacity>
            </View>

            {/* Divider */}
            <View style={styles.divider} />

            {/* Transaction History Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>EARNING HISTORY</Text>

              {walletData.recent_transactions.map((transaction) => (
                <View key={transaction.id} style={styles.transactionRow}>
                  <Text style={styles.transactionDate}>{transaction.date}</Text>
                  <Text style={styles.transactionAmount}>+₹{transaction.amount}</Text>
                  <Text style={styles.transactionDesc}>{transaction.description}</Text>
                </View>
              ))}

              <TouchableOpacity style={styles.viewAllButton} activeOpacity={0.7}>
                <Text style={styles.viewAllText}>View All Transactions</Text>
              </TouchableOpacity>
            </View>
            </ScrollView>
          )}
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
    height: SCREEN_HEIGHT * 0.75,
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
    justifyContent: "center",
    paddingVertical: 16,
    paddingHorizontal: 20,
    position: "relative",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#FFF",
    letterSpacing: 1,
  },
  closeButton: {
    position: "absolute",
    right: 15,
    top: "50%",
    transform: [{ translateY: -14 }],
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    flex: 1,
    backgroundColor: "#FFF",
  },
  balanceSection: {
    padding: 20,
    paddingBottom: 15,
  },
  balanceRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 15,
  },
  coinIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#FFD700",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
    shadowColor: "#FFD700",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 4,
  },
  coinText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#FFF",
  },
  balanceAmount: {
    fontSize: 32,
    fontWeight: "800",
    color: "#222",
  },
  progressRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  progressBarContainer: {
    flex: 1,
    marginRight: 10,
  },
  progressBarBg: {
    height: 12,
    backgroundColor: "#E0E0E0",
    borderRadius: 6,
    overflow: "hidden",
    position: "relative",
  },
  progressBarFill: {
    height: "100%",
    borderRadius: 6,
  },
  progressBarRemaining: {
    position: "absolute",
    top: 0,
    height: "100%",
    backgroundColor: "rgba(200, 200, 200, 0.5)",
  },
  giftBoxContainer: {
    width: 50,
    alignItems: "center",
  },
  giftBox: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: "#1A1A2E",
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  amazonSmile: {
    position: "absolute",
    bottom: 6,
    left: 10,
    right: 10,
  },
  amazonSmileText: {
    fontSize: 14,
    color: "#FF9800",
    textAlign: "center",
  },
  unlockRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  unlockText: {
    fontSize: 13,
    color: "#555",
    flex: 1,
  },
  unlockAmount: {
    fontWeight: "700",
    color: "#222",
  },
  claimButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F5F5F5",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    gap: 5,
  },
  claimButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#666",
  },
  divider: {
    height: 1,
    backgroundColor: "#F0F0F0",
    marginHorizontal: 20,
  },
  section: {
    padding: 20,
    paddingTop: 15,
    paddingBottom: 15,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#888",
    textAlign: "center",
    marginBottom: 15,
    letterSpacing: 0.5,
  },
  deliveryCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 15,
  },
  deliveryIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: "#E8F5E9",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  deliveryContent: {
    flex: 1,
  },
  deliveryTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#222",
    marginBottom: 4,
  },
  deliverySubtext: {
    fontSize: 13,
    color: "#555",
    lineHeight: 20,
  },
  highlightText: {
    fontWeight: "700",
    color: "#222",
  },
  useButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FF7A18",
    paddingVertical: 14,
    borderRadius: 25,
    shadowColor: "#FF7A18",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  useButtonIcon: {
    marginRight: 8,
  },
  useButtonText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFF",
  },
  voucherCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 15,
  },
  voucherIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: "#FFF3E0",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  voucherContent: {
    flex: 1,
  },
  voucherTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#222",
    marginBottom: 4,
  },
  voucherSubtext: {
    fontSize: 13,
    color: "#555",
    lineHeight: 20,
  },
  lockedButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F5F5F5",
    paddingVertical: 14,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    gap: 8,
  },
  lockedButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#666",
  },
  transactionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F5F5F5",
  },
  transactionDate: {
    fontSize: 13,
    color: "#222",
    fontWeight: "600",
    width: 75,
  },
  transactionAmount: {
    fontSize: 13,
    fontWeight: "700",
    color: "#4CAF50",
    width: 55,
  },
  transactionDesc: {
    fontSize: 13,
    color: "#555",
    flex: 1,
  },
  viewAllButton: {
    alignItems: "center",
    paddingVertical: 15,
    marginTop: 5,
  },
  viewAllText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FF7A18",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#666",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
    paddingHorizontal: 20,
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
});

export default CofauWalletModal;
