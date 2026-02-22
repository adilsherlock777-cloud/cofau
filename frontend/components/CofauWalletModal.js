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
  TextInput,
  Alert,
} from "react-native";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons, MaterialIcons, FontAwesome5 } from "@expo/vector-icons";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || "https://api.cofau.com";

const CofauWalletModal = ({ visible, onClose }) => {
  const { token } = useAuth();
  const router = useRouter();

  // State variables
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showClaimInfo, setShowClaimInfo] = useState(false);
  const [showPointsCriteria, setShowPointsCriteria] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showAllTransactions, setShowAllTransactions] = useState(false);
  const [claimEmail, setClaimEmail] = useState("");
  const [claimPhone, setClaimPhone] = useState("");
  const [claimLoading, setClaimLoading] = useState(false);
  const [claimMessage, setClaimMessage] = useState(null);
  const [transactionsVersion, setTransactionsVersion] = useState(0);
  const [walletData, setWalletData] = useState({
    balance: 0,
    target_amount: 500,
    amount_needed: 500,
    progress_percent: 0,
    can_claim_voucher: false,
    delivery_discount: {
      per_order: 25,
      deliveries_worth: 0,
    },
    recent_transactions: [],
  });
  const transactionsScrollRef = React.useRef(null);

  const fetchWalletData = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await axios.get(`${BACKEND_URL}/api/wallet/balance`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setWalletData(response.data);
    } catch (err) {
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

  const handleClaimVoucher = async () => {
    if (!claimEmail.trim()) {
      Alert.alert("Error", "Please enter your email address");
      return;
    }

    if (!claimPhone.trim()) {
      Alert.alert("Error", "Please enter your phone number");
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(claimEmail.trim())) {
      Alert.alert("Error", "Please enter a valid email address");
      return;
    }

    // Basic phone validation (at least 10 digits)
    const phoneDigits = claimPhone.replace(/\D/g, '');
    if (phoneDigits.length < 10) {
      Alert.alert("Error", "Please enter a valid phone number (at least 10 digits)");
      return;
    }

    setClaimLoading(true);
    setClaimMessage(null);

    try {
      const response = await axios.post(
        `${BACKEND_URL}/api/wallet/claim-voucher`,
        {
          email: claimEmail.trim(),
          phone: claimPhone.trim()
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        setClaimMessage({ type: "success", text: response.data.message });
        setClaimEmail("");
        setClaimPhone("");
        // Reset wallet display to 0 after successful claim
        setWalletData(prev => ({
          ...prev,
          balance: 0,
          amount_needed: 500,
          progress_percent: 0,
          can_claim_voucher: false,
        }));
        // Refresh from backend to get actual remaining balance
        await fetchWalletData();
        setTransactionsVersion((prev) => prev + 1);
      }
    } catch (err) {
      const errorMessage = err.response?.data?.detail || "Failed to submit claim request";
      setClaimMessage({ type: "error", text: errorMessage });
    } finally {
      setClaimLoading(false);
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
          {/* Header - NOT inside ScrollView */}
          <LinearGradient
            colors={["#FF8C42", "#FFA726"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.header}
          >
            <View style={styles.headerTitleContainer}>
              <Ionicons name="gift" size={20} color="#FFF" />
              <Text style={styles.headerTitle}>COFAU REWARDS</Text>
              <Ionicons name="trophy" size={20} color="#FFF" />
            </View>
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

                {/* Amazon Icon */}
                <View style={styles.giftBoxContainer}>
                  <View style={styles.giftBox}>
                    <FontAwesome5 name="amazon" size={26} color="#FF9800" />
                  </View>
                </View>
              </View>

              <View style={styles.unlockRow}>
                <Text style={styles.unlockText}>
                  <Text style={styles.unlockAmount}>₹{walletData.amount_needed}</Text>
                  <Text> more to unlock Amazon voucher</Text>
                </Text>
                <TouchableOpacity
                  style={styles.claimButtonActive}
                  onPress={() => {
                    setShowEmailModal(true);
                    setClaimMessage(null);
                  }}
                  activeOpacity={0.7}
                >
                  <Ionicons name="gift" size={14} color="#FFF" />
                  <Text style={styles.claimButtonActiveText}>Claim</Text>
                </TouchableOpacity>
              </View>

              {/* Points Criteria Button */}
              <TouchableOpacity
                style={styles.pointsCriteriaButton}
                onPress={() => setShowPointsCriteria(true)}
                activeOpacity={0.7}
              >
                <MaterialIcons name="info-outline" size={16} color="#FF7A18" />
                <Text style={styles.pointsCriteriaButtonText}>Points Criteria</Text>
              </TouchableOpacity>
            </View>

            {/* Divider */}
            <View style={styles.divider} />

            {/* Transaction History Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>EARNING HISTORY</Text>

              {walletData.recent_transactions.slice(0, 5).map((transaction) => (
                <View key={transaction.id} style={styles.transactionRow}>
                  <Text style={styles.transactionDate}>{transaction.date}</Text>
                  <Text style={[styles.transactionAmount, transaction.amount < 0 && styles.transactionAmountDeducted]}>
                    {transaction.amount < 0 ? `-₹${Math.abs(transaction.amount)}` : `+₹${transaction.amount}`}
                  </Text>
                  <Text style={styles.transactionDesc}>{transaction.description}</Text>
                </View>
              ))}

              <TouchableOpacity
                style={styles.viewAllButton}
                activeOpacity={0.7}
                onPress={() => setShowAllTransactions(true)}
              >
                <Text style={styles.viewAllText}>View All Transactions</Text>
              </TouchableOpacity>

              {/* Add Post Earn Reward Box */}
              <TouchableOpacity
                style={styles.earnRewardBox}
                activeOpacity={0.85}
                onPress={() => {
                  if (onClose) onClose();
                  router.push("/add-post");
                }}
              >
                <LinearGradient
                  colors={["#FF8C42", "#FFA726"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.earnRewardBoxGradient}
                >
                  <Text style={styles.earnRewardText}>UPLOAD POST & EARN REWARDS</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
            </ScrollView>
          )}

          {/* Claim Info Modal */}
          {showClaimInfo && (
            <View style={styles.overlayModal}>
              <View style={styles.claimInfoContainer}>
                <Text style={styles.claimInfoTitle}>How to Use Your Rewards</Text>

                {/* Delivery Discount */}
                <View style={styles.deliveryCard}>
                  <View style={styles.deliveryIconContainer}>
                    <Ionicons name="bicycle" size={24} color="#4CAF50" />
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

                {/* Amazon Voucher */}
                <View style={[
                  styles.voucherCard,
                  !walletData.can_claim_voucher && styles.voucherCardLocked
                ]}>
                  <View style={[
                    styles.voucherIconContainer,
                    !walletData.can_claim_voucher && styles.voucherIconLocked
                  ]}>
                    <Ionicons
                      name={walletData.can_claim_voucher ? "gift" : "lock-closed"}
                      size={24}
                      color={walletData.can_claim_voucher ? "#FF9800" : "#999"}
                    />
                  </View>
                  <View style={styles.voucherContent}>
                    <Text style={[
                      styles.voucherTitle,
                      !walletData.can_claim_voucher && styles.voucherTitleLocked
                    ]}>
                      AMAZON VOUCHER
                    </Text>
                    <Text style={styles.voucherSubtext}>
                      <Text>Minimum </Text>
                      <Text style={styles.highlightText}>₹{walletData.target_amount}</Text>
                      <Text> required</Text>
                    </Text>
                    {!walletData.can_claim_voucher && (
                      <Text style={styles.voucherSubtext}>
                        <Text>You need </Text>
                        <Text style={styles.highlightText}>₹{walletData.amount_needed}</Text>
                        <Text> more</Text>
                      </Text>
                    )}
                    {walletData.can_claim_voucher && (
                      <Text style={[styles.voucherSubtext, { color: "#4CAF50", fontWeight: "600" }]}>
                        You can claim your voucher now!
                      </Text>
                    )}
                  </View>
                </View>

                {walletData.can_claim_voucher && (
                  <TouchableOpacity
                    style={styles.claimVoucherButton}
                    activeOpacity={0.8}
                    onPress={() => {
                      setShowClaimInfo(false);
                      setShowEmailModal(true);
                      setClaimMessage(null);
                    }}
                  >
                    <Ionicons name="gift" size={18} color="#FFF" />
                    <Text style={styles.claimVoucherButtonText}>Claim Amazon Voucher</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={styles.doneButton}
                  onPress={() => setShowClaimInfo(false)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.doneButtonText}>Done</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Points Criteria Modal */}
          {showPointsCriteria && (
            <View style={styles.overlayModal}>
              <View style={styles.pointsCriteriaContainer}>
                <Text style={styles.pointsCriteriaTitle}>Points Criteria</Text>

                <ScrollView
                  style={styles.pointsCriteriaScroll}
                  showsVerticalScrollIndicator={false}
                >
                  <View style={styles.noteBox}>
                    <MaterialIcons name="info" size={20} color="#FF7A18" />
                    <Text style={styles.noteText}>
                      Earn rewards by posting reviews on Cofau!
                    </Text>
                  </View>

                  <View style={styles.pointItem}>
                    <Text style={styles.pointEmoji}>🎉</Text>
                    <View style={styles.pointContent}>
                      <Text style={styles.pointTitle}>First Post Bonus</Text>
                      <Text style={styles.pointDesc}>Get ₹50 on your very first post. Welcome to Cofau!</Text>
                    </View>
                  </View>

                  <View style={styles.pointItem}>
                    <Text style={styles.pointEmoji}>💰</Text>
                    <View style={styles.pointContent}>
                      <Text style={styles.pointTitle}>₹25 Per Post</Text>
                      <Text style={styles.pointDesc}>Earn ₹25 for every post you upload</Text>
                    </View>
                  </View>

                  <View style={styles.pointItem}>
                    <Text style={styles.pointEmoji}>🍔</Text>
                    <View style={styles.pointContent}>
                      <Text style={styles.pointTitle}>Delivery Rewards</Text>
                      <Text style={styles.pointDesc}>₹10/- for every delivery completed. Earn ₹50/- Bonus for completing 10 delivery orders!</Text>
                    </View>
                  </View>

                  <View style={styles.pointItem}>
                    <Text style={styles.pointEmoji}>📅</Text>
                    <View style={styles.pointContent}>
                      <Text style={styles.pointTitle}>2 Posts Per Week</Text>
                      <Text style={styles.pointDesc}>Earn rewards on up to 2 posts per week. 3rd post onwards won't earn wallet rewards</Text>
                    </View>
                  </View>

                  <View style={styles.pointItem}>
                    <View style={styles.pointAmazonIcon}>
                      <FontAwesome5 name="amazon" size={22} color="#FF9800" />
                    </View>
                    <View style={styles.pointContent}>
                      <Text style={styles.pointTitle}>Amazon Voucher</Text>
                      <Text style={styles.pointDesc}>Reach ₹500 to claim your Amazon voucher!</Text>
                    </View>
                  </View>

                  <View style={styles.pointItem}>
                    <Text style={styles.pointEmoji}>⭐</Text>
                    <View style={styles.pointContent}>
                      <Text style={styles.pointTitle}>Points Per Post</Text>
                      <Text style={styles.pointDesc}>Earn 25 points with every post you share</Text>
                    </View>
                  </View>
                </ScrollView>

                <TouchableOpacity
                  style={styles.gotItButton}
                  onPress={() => setShowPointsCriteria(false)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.gotItButtonText}>Got it. Keep Earning</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* All Transactions Modal */}
          {showAllTransactions && (
            <View style={styles.overlayModal}>
              <View style={styles.transactionsContainer}>
                <View style={styles.transactionsHeader}>
                  <Text style={styles.transactionsTitle}>Transaction History</Text>
                  <TouchableOpacity
                    style={styles.transactionsCloseButton}
                    onPress={() => setShowAllTransactions(false)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="close" size={22} color="#000" />
                  </TouchableOpacity>
                </View>

                <ScrollView
                  key={transactionsVersion}
                  ref={transactionsScrollRef}
                  style={styles.transactionsList}
                  contentContainerStyle={{ paddingBottom: 16 }}
                  showsVerticalScrollIndicator={false}
                >
                  {walletData.recent_transactions.length === 0 ? (
                    <Text style={styles.noTransactionsText}>No transactions yet</Text>
                  ) : (
                    walletData.recent_transactions.map((transaction) => (
                      <View key={transaction.id} style={styles.transactionRow}>
                        <Text style={styles.transactionDate}>{transaction.date}</Text>
                        <Text style={[styles.transactionAmount, transaction.amount < 0 && styles.transactionAmountDeducted]}>
                          {transaction.amount < 0 ? `-₹${Math.abs(transaction.amount)}` : `+₹${transaction.amount}`}
                        </Text>
                        <Text style={styles.transactionDesc}>{transaction.description}</Text>
                      </View>
                    ))
                  )}
                </ScrollView>
              </View>
            </View>
          )}

          {/* Email Claim Modal */}
          {showEmailModal && (
            <View style={styles.overlayModal}>
              <View style={styles.emailModalContainer}>
                <TouchableOpacity
                  style={styles.emailModalClose}
                  onPress={() => {
                    setShowEmailModal(false);
                    setClaimEmail("");
                    setClaimPhone("");
                    setClaimMessage(null);
                  }}
                >
                  <Ionicons name="close" size={24} color="#666" />
                </TouchableOpacity>

                <View style={styles.emailModalIcon}>
                  <Ionicons name="gift" size={40} color="#FF9800" />
                </View>

                <Text style={styles.emailModalTitle}>Claim Amazon Voucher</Text>
                <Text style={styles.emailModalSubtitle}>
                  Please enter your email address and phone number to receive Amazon voucher
                </Text>

                {claimMessage && (
                  <View style={[
                    styles.claimMessageBox,
                    claimMessage.type === "success" ? styles.claimMessageSuccess : styles.claimMessageError
                  ]}>
                    <Ionicons
                      name={claimMessage.type === "success" ? "checkmark-circle" : "alert-circle"}
                      size={20}
                      color={claimMessage.type === "success" ? "#4CAF50" : "#F44336"}
                    />
                    <Text style={[
                      styles.claimMessageText,
                      claimMessage.type === "success" ? styles.claimMessageTextSuccess : styles.claimMessageTextError
                    ]}>
                      {claimMessage.text}
                    </Text>
                  </View>
                )}

                {!claimMessage?.type || claimMessage?.type === "error" ? (
                  <>
                    <TextInput
                      style={styles.emailInput}
                      placeholder="Enter your email address"
                      placeholderTextColor="#999"
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                      value={claimEmail}
                      onChangeText={setClaimEmail}
                      editable={!claimLoading}
                    />

                    <TextInput
                      style={styles.emailInput}
                      placeholder="Enter your phone number"
                      placeholderTextColor="#999"
                      keyboardType="phone-pad"
                      value={claimPhone}
                      onChangeText={setClaimPhone}
                      editable={!claimLoading}
                    />

                    <TouchableOpacity
                      style={[styles.submitButton, claimLoading && styles.submitButtonDisabled]}
                      onPress={handleClaimVoucher}
                      activeOpacity={0.8}
                      disabled={claimLoading}
                    >
                      {claimLoading ? (
                        <ActivityIndicator size="small" color="#FFF" />
                      ) : (
                        <>
                          <Ionicons name="send" size={18} color="#FFF" />
                          <Text style={styles.submitButtonText}>Submit</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </>
                ) : (
                  <TouchableOpacity
                    style={styles.doneButton}
                    onPress={() => {
                      setShowEmailModal(false);
                      setClaimEmail("");
                      setClaimPhone("");
                      setClaimMessage(null);
                    }}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.doneButtonText}>Done</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
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
  headerTitleContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
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
    transform: [{ translateY: -5 }],
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
  claimButtonActive: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FF7A18",
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 20,
    gap: 6,
    shadowColor: "#FF7A18",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  claimButtonActiveText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFF",
  },
  pointsCriteriaButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFF",
    paddingVertical: 12,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: "#FF7A18",
    gap: 6,
    marginTop: 12,
  },
  pointsCriteriaButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FF7A18",
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
    marginTop: 15,
  },
  voucherCardLocked: {
    opacity: 0.6,
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
  voucherIconLocked: {
    backgroundColor: "#F5F5F5",
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
  voucherTitleLocked: {
    color: "#999",
  },
  voucherSubtext: {
    fontSize: 13,
    color: "#555",
    lineHeight: 20,
  },
  claimVoucherButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FF9800",
    paddingVertical: 14,
    borderRadius: 25,
    marginBottom: 10,
    gap: 8,
    shadowColor: "#FF9800",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  claimVoucherButtonText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFF",
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
  transactionAmountDeducted: {
    color: "#E94A37",
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
  transactionsContainer: {
    width: "100%",
    maxHeight: SCREEN_HEIGHT * 0.8,
    backgroundColor: "#FFF",
    borderRadius: 16,
    overflow: "hidden",
  },
  transactionsHeader: {
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F5F5F5",
  },
  transactionsTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#222",
  },
  transactionsCloseButton: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  transactionsList: {
    paddingHorizontal: 16,
  },
  noTransactionsText: {
    textAlign: "center",
    color: "#8E8E8E",
    marginTop: 24,
    fontSize: 14,
  },
  earnRewardBox: {
    marginTop: 15,
    borderRadius: 12,
    overflow: "hidden",
    shadowColor: "#FF7A18",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  earnRewardBoxGradient: {
    padding: 16,
    alignItems: "center",
  },
  earnRewardText: {
    fontSize: 18,
    fontWeight: "800",
    color: "#FFF",
    textAlign: "center",
    letterSpacing: 1,
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
  overlayModal: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  claimInfoContainer: {
    backgroundColor: "#FFF",
    borderRadius: 16,
    padding: 20,
    width: "90%",
    maxWidth: 350,
  },
  claimInfoTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#222",
    textAlign: "center",
    marginBottom: 20,
  },
  doneButton: {
    backgroundColor: "#FF7A18",
    paddingVertical: 14,
    borderRadius: 25,
    marginTop: 20,
    shadowColor: "#FF7A18",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  doneButtonText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFF",
    textAlign: "center",
  },
  pointsCriteriaContainer: {
    backgroundColor: "#FFF",
    borderRadius: 16,
    padding: 20,
    width: "90%",
    maxWidth: 350,
    maxHeight: SCREEN_HEIGHT * 0.7,
  },
  pointsCriteriaTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#222",
    textAlign: "center",
    marginBottom: 15,
  },
  pointsCriteriaScroll: {
    maxHeight: SCREEN_HEIGHT * 0.5,
  },
  noteBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF3E0",
    padding: 12,
    borderRadius: 10,
    marginBottom: 20,
    gap: 10,
  },
  noteText: {
    flex: 1,
    fontSize: 13,
    color: "#666",
    lineHeight: 18,
  },
  pointItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 18,
  },
  pointEmoji: {
    fontSize: 24,
    marginRight: 12,
    marginTop: 2,
  },
  pointAmazonIcon: {
    width: 30,
    marginRight: 12,
    marginTop: 2,
    alignItems: "center",
  },
  pointContent: {
    flex: 1,
  },
  pointTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#222",
    marginBottom: 4,
  },
  pointDesc: {
    fontSize: 13,
    color: "#666",
    lineHeight: 18,
  },
  gotItButton: {
    backgroundColor: "#FF7A18",
    paddingVertical: 14,
    borderRadius: 25,
    marginTop: 15,
    shadowColor: "#FF7A18",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  gotItButtonText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFF",
    textAlign: "center",
  },
  emailModalContainer: {
    backgroundColor: "#FFF",
    borderRadius: 20,
    padding: 24,
    width: "90%",
    maxWidth: 350,
    alignItems: "center",
  },
  emailModalClose: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F5F5F5",
    justifyContent: "center",
    alignItems: "center",
  },
  emailModalIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#FFF3E0",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  emailModalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#222",
    textAlign: "center",
    marginBottom: 8,
  },
  emailModalSubtitle: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    marginBottom: 20,
    lineHeight: 20,
  },
  emailInput: {
    width: "100%",
    height: 50,
    borderWidth: 1.5,
    borderColor: "#E0E0E0",
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    color: "#222",
    backgroundColor: "#FAFAFA",
    marginBottom: 16,
  },
  submitButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FF9800",
    width: "100%",
    paddingVertical: 14,
    borderRadius: 25,
    gap: 8,
    shadowColor: "#FF9800",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFF",
  },
  claimMessageBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 12,
    borderRadius: 10,
    marginBottom: 16,
    width: "100%",
    gap: 10,
  },
  claimMessageSuccess: {
    backgroundColor: "#E8F5E9",
  },
  claimMessageError: {
    backgroundColor: "#FFEBEE",
  },
  claimMessageText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  claimMessageTextSuccess: {
    color: "#2E7D32",
  },
  claimMessageTextError: {
    color: "#C62828",
  },
});

export default CofauWalletModal;
