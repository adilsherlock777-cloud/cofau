import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  TextInput,
  Modal,
  Alert,
  Dimensions,
  Share,
  Platform,
  KeyboardAvoidingView,
  Keyboard,
  TouchableWithoutFeedback,
  Clipboard,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { useFocusEffect } from 'expo-router';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://api.cofau.com';

const TABS = ['Onboarded', 'Pending', 'Rejected'];

export default function InviteRestaurantScreen() {
  const { token } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState(0);
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [showHowItWorks, setShowHowItWorks] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);

  // Claim form
  const [claimEmail, setClaimEmail] = useState('');
  const [claimPhone, setClaimPhone] = useState('');
  const [claimUpi, setClaimUpi] = useState('');
  const [claimLoading, setClaimLoading] = useState(false);
  const [claimMessage, setClaimMessage] = useState<{ type: string; text: string } | null>(null);

  const [data, setData] = useState({
    referral_code: '',
    referral_balance: 0,
    total_earned: 0,
    onboarded_count: 0,
    pending_count: 0,
    request_sent_count: 0,
    rejected_count: 0,
    can_claim: false,
    claim_threshold: 5,
    reward_per_referral: 75,
    target_amount: 375,
    progress_percent: 0,
    referrals: [] as any[],
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await axios.get(`${BACKEND_URL}/api/referral/info`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setData(res.data);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load referral data');
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      if (token) fetchData();
    }, [token])
  );

  const handleCopyCode = () => {
    Clipboard.setString(data.referral_code);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Join Cofau as a restaurant partner! Use my invite code: ${data.referral_code}\n\nSign up here: https://cofau.com/restaurant-signup`,
        title: 'Invite Restaurant to Cofau',
      });
    } catch (err) {
      // user cancelled
    }
  };

  const handleClaim = async () => {
    if (!claimEmail.trim()) {
      Alert.alert('Error', 'Please enter your email address');
      return;
    }
    if (!claimPhone.trim()) {
      Alert.alert('Error', 'Please enter your phone number');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(claimEmail.trim())) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }
    const phoneDigits = claimPhone.replace(/\D/g, '');
    if (phoneDigits.length < 10) {
      Alert.alert('Error', 'Please enter a valid phone number');
      return;
    }
    if (!claimUpi.trim()) {
      Alert.alert('Error', 'Please enter your UPI ID');
      return;
    }

    setClaimLoading(true);
    setClaimMessage(null);

    try {
      const res = await axios.post(
        `${BACKEND_URL}/api/referral/claim`,
        { email: claimEmail.trim(), phone: claimPhone.trim(), upi_id: claimUpi.trim() },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.data.success) {
        setClaimMessage({ type: 'success', text: res.data.message });
        setClaimEmail('');
        setClaimPhone('');
        setClaimUpi('');
        await fetchData();
      }
    } catch (err: any) {
      setClaimMessage({ type: 'error', text: err.response?.data?.detail || 'Failed to submit claim' });
    } finally {
      setClaimLoading(false);
    }
  };

  // Filter referrals by tab
  const getFilteredReferrals = () => {
    switch (activeTab) {
      case 0: // Onboarded
        return data.referrals.filter((r) => r.status === 'approved');
      case 1: // Pending
        return data.referrals.filter((r) => r.status === 'pending_verification' || r.status === 'request_sent');
      case 2: // Rejected
        return data.referrals.filter((r) => r.status === 'rejected');
      default:
        return data.referrals;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return '#4CAF50';
      case 'pending_verification':
      case 'request_sent': return '#FF9800';
      case 'rejected': return '#F44336';
      default: return '#999';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'approved': return 'Verified';
      case 'pending_verification': return 'Under Review';
      case 'request_sent': return 'Signup Pending';
      case 'rejected': return 'Rejected';
      default: return status;
    }
  };

  const filteredReferrals = getFilteredReferrals();
  const progressWidth = Math.min(data.progress_percent, 100);
  const milestoneMarkers = Array.from({ length: 10 }, (_, i) => i + 1);

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#FF7A18" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="alert-circle" size={48} color="#FF6B6B" />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={fetchData}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient
        colors={['#1B7C82', '#2BA8B0']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.header}
      >
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Ionicons name="restaurant" size={20} color="#FFF" />
          <Text style={styles.headerTitle}>INVITE RESTAURANT</Text>
          <Ionicons name="gift" size={20} color="#FFD700" />
        </View>
        <TouchableOpacity
          style={styles.infoButton}
          onPress={() => setShowHowItWorks(true)}
          activeOpacity={0.7}
        >
          <Ionicons name="information-circle-outline" size={24} color="#FFF" />
        </TouchableOpacity>
      </LinearGradient>

      <ScrollView
        style={styles.content}
        contentContainerStyle={{ paddingBottom: 30 }}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* Referral Code Card */}
        <View style={styles.codeCard}>
          <Text style={styles.codeLabel}>YOUR REFERRAL CODE</Text>
          <View style={styles.codeRow}>
            <View style={styles.codeBox}>
              <Text style={styles.codeText}>{data.referral_code}</Text>
            </View>
            <TouchableOpacity
              style={[styles.copyButton, codeCopied && styles.copyButtonCopied]}
              onPress={handleCopyCode}
              activeOpacity={0.7}
            >
              <Ionicons name={codeCopied ? 'checkmark' : 'copy-outline'} size={18} color="#FFF" />
              <Text style={styles.copyButtonText}>{codeCopied ? 'Copied!' : 'Copy'}</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={styles.shareButton}
            onPress={handleShare}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={['#1B7C82', '#2BA8B0']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.shareButtonGradient}
            >
              <Ionicons name="share-social" size={18} color="#FFF" />
              <Text style={styles.shareButtonText}>Share with Restaurant</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Earnings Card */}
        <View style={styles.earningsCard}>
          <View style={styles.earningsHeader}>
            <View style={styles.earningsLeft}>
              <View style={styles.coinIcon}>
                <Text style={styles.coinText}>₹</Text>
              </View>
              <Text style={styles.balanceAmount}>₹{data.referral_balance}</Text>
            </View>
            <View style={styles.earningsRight}>
              <Text style={styles.earningsLabel}>Earned</Text>
              <Text style={styles.totalEarned}>₹{data.total_earned}</Text>
            </View>
          </View>

          {/* Progress Bar with milestone markers */}
          <View style={styles.progressSection}>
            <View style={styles.progressLabels}>
              <Text style={styles.progressLabelLeft}>0</Text>
              <Text style={styles.progressLabelRight}>{data.claim_threshold * data.reward_per_referral}</Text>
            </View>
            <View style={styles.progressBarBg}>
              <LinearGradient
                colors={['#4CAF50', '#66BB6A']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.progressBarFill, { width: `${progressWidth}%` }]}
              />
              {/* Milestone dots */}
              {milestoneMarkers.map((m) => (
                <View
                  key={m}
                  style={[
                    styles.milestoneDot,
                    {
                      left: `${(m / 10) * 100}%`,
                      backgroundColor: data.onboarded_count >= m ? '#FFF' : 'rgba(255,255,255,0.4)',
                    },
                  ]}
                />
              ))}
            </View>
            <View style={styles.progressMeta}>
              <Text style={styles.referralCount}>
                <Text style={styles.referralCountBold}>{data.onboarded_count}</Text>
                <Text>/10 restaurants onboarded</Text>
              </Text>
              <Text style={styles.perReferral}>₹{data.reward_per_referral}/referral</Text>
            </View>
          </View>

          {/* Claim Button */}
          <TouchableOpacity
            style={[
              styles.claimButton,
              !data.can_claim && styles.claimButtonLocked,
            ]}
            onPress={() => {
              if (data.can_claim) {
                setShowClaimModal(true);
                setClaimMessage(null);
              }
            }}
            activeOpacity={data.can_claim ? 0.8 : 1}
          >
            {data.can_claim ? (
              <>
                <Ionicons name="gift" size={20} color="#FFF" />
                <Text style={styles.claimButtonText}>Claim ₹{data.referral_balance}</Text>
              </>
            ) : (
              <>
                <Ionicons name="lock-closed" size={18} color="#FFF" />
                <Text style={styles.claimButtonText}>
                  {data.onboarded_count < data.claim_threshold
                    ? `Onboard ${data.claim_threshold - data.onboarded_count} more to unlock`
                    : 'No balance to claim'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Tabs */}
        <View style={styles.tabContainer}>
          {TABS.map((tab, index) => {
            const count = index === 0
              ? data.onboarded_count
              : index === 1
              ? data.pending_count + data.request_sent_count
              : data.rejected_count;

            return (
              <TouchableOpacity
                key={tab}
                style={[styles.tab, activeTab === index && styles.tabActive]}
                onPress={() => setActiveTab(index)}
                activeOpacity={0.7}
              >
                <Text style={[styles.tabText, activeTab === index && styles.tabTextActive]}>
                  {tab}
                </Text>
                {count > 0 && (
                  <View style={[styles.tabBadge, activeTab === index && styles.tabBadgeActive]}>
                    <Text style={[styles.tabBadgeText, activeTab === index && styles.tabBadgeTextActive]}>
                      {count}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Referral List */}
        <View style={styles.referralList}>
          {filteredReferrals.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons
                name={activeTab === 0 ? 'checkmark-circle-outline' : activeTab === 1 ? 'time-outline' : 'close-circle-outline'}
                size={48}
                color="#CCC"
              />
              <Text style={styles.emptyStateText}>
                {activeTab === 0
                  ? 'No restaurants onboarded yet'
                  : activeTab === 1
                  ? 'No pending verifications'
                  : 'No rejected referrals'}
              </Text>
              {activeTab === 0 && (
                <Text style={styles.emptyStateSubtext}>
                  Share your referral code with restaurants to start earning!
                </Text>
              )}
            </View>
          ) : (
            filteredReferrals.map((referral) => (
              <View key={referral.id} style={styles.referralItem}>
                <View style={styles.referralItemLeft}>
                  <View style={[styles.referralIcon, { backgroundColor: getStatusColor(referral.status) + '15' }]}>
                    <Ionicons
                      name={
                        referral.status === 'approved'
                          ? 'checkmark-circle'
                          : referral.status === 'rejected'
                          ? 'close-circle'
                          : 'time'
                      }
                      size={24}
                      color={getStatusColor(referral.status)}
                    />
                  </View>
                  <View style={styles.referralItemInfo}>
                    <Text style={styles.referralName}>{referral.restaurant_name}</Text>
                    <View style={styles.referralStatusRow}>
                      <View style={[styles.statusDot, { backgroundColor: getStatusColor(referral.status) }]} />
                      <Text style={[styles.referralStatus, { color: getStatusColor(referral.status) }]}>
                        {getStatusLabel(referral.status)}
                      </Text>
                    </View>
                    {referral.admin_message ? (
                      <Text style={styles.adminMessage} numberOfLines={2}>
                        {referral.admin_message}
                      </Text>
                    ) : null}
                  </View>
                </View>
                {referral.reward_amount > 0 && (
                  <Text style={styles.referralReward}>+₹{referral.reward_amount}</Text>
                )}
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* How It Works Modal */}
      <Modal
        visible={showHowItWorks}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowHowItWorks(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.howItWorksContainer}>
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setShowHowItWorks(false)}
            >
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>

            <View style={styles.howItWorksIcon}>
              <LinearGradient
                colors={['#1B7C82', '#2BA8B0']}
                style={styles.howItWorksIconBg}
              >
                <Ionicons name="gift" size={32} color="#FFF" />
              </LinearGradient>
            </View>

            <Text style={styles.howItWorksTitle}>How It Works</Text>

            <View style={styles.stepItem}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>1</Text>
              </View>
              <View style={styles.stepContent}>
                <Text style={styles.stepTitle}>Share Your Code</Text>
                <Text style={styles.stepDesc}>Share your unique referral code with restaurant owners you know</Text>
              </View>
            </View>

            <View style={styles.stepItem}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>2</Text>
              </View>
              <View style={styles.stepContent}>
                <Text style={styles.stepTitle}>Restaurant Signs Up</Text>
                <Text style={styles.stepDesc}>They enter your code during signup with their FSSAI document</Text>
              </View>
            </View>

            <View style={styles.stepItem}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>3</Text>
              </View>
              <View style={styles.stepContent}>
                <Text style={styles.stepTitle}>Cofau Verifies</Text>
                <Text style={styles.stepDesc}>Our team reviews and verifies the restaurant's documents</Text>
              </View>
            </View>

            <View style={styles.stepItem}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>4</Text>
              </View>
              <View style={styles.stepContent}>
                <Text style={styles.stepTitle}>You Earn ₹75</Text>
                <Text style={styles.stepDesc}>Once approved, ₹75 is added to your referral balance instantly</Text>
              </View>
            </View>

            <View style={styles.stepItem}>
              <View style={[styles.stepNumber, { backgroundColor: '#FFD700' }]}>
                <Text style={[styles.stepNumberText, { color: '#333' }]}>5</Text>
              </View>
              <View style={styles.stepContent}>
                <Text style={styles.stepTitle}>Claim After 5 Referrals</Text>
                <Text style={styles.stepDesc}>Once 5 restaurants are onboarded, claim your earnings via UPI</Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.gotItButton}
              onPress={() => setShowHowItWorks(false)}
              activeOpacity={0.8}
            >
              <Text style={styles.gotItButtonText}>Got It!</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Claim Modal */}
      <Modal
        visible={showClaimModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowClaimModal(false)}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <KeyboardAvoidingView
            style={styles.modalOverlay}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            <View style={styles.claimModalContainer}>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => {
                  setShowClaimModal(false);
                  setClaimEmail('');
                  setClaimPhone('');
                  setClaimUpi('');
                  setClaimMessage(null);
                }}
              >
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>

              <View style={styles.claimModalIcon}>
                <Ionicons name="gift" size={40} color="#1B7C82" />
              </View>

              <Text style={styles.claimModalTitle}>Claim ₹{data.referral_balance}</Text>
              <Text style={styles.claimModalSubtitle}>
                Enter your details to receive your referral earnings via UPI
              </Text>

              {claimMessage && (
                <View style={[
                  styles.claimMessageBox,
                  claimMessage.type === 'success' ? styles.claimMessageSuccess : styles.claimMessageError,
                ]}>
                  <Ionicons
                    name={claimMessage.type === 'success' ? 'checkmark-circle' : 'alert-circle'}
                    size={20}
                    color={claimMessage.type === 'success' ? '#4CAF50' : '#F44336'}
                  />
                  <Text style={[
                    styles.claimMessageText,
                    claimMessage.type === 'success' ? { color: '#2E7D32' } : { color: '#C62828' },
                  ]}>
                    {claimMessage.text}
                  </Text>
                </View>
              )}

              {!claimMessage?.type || claimMessage?.type === 'error' ? (
                <>
                  <TextInput
                    style={styles.claimInput}
                    placeholder="Enter your email address"
                    placeholderTextColor="#999"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    value={claimEmail}
                    onChangeText={setClaimEmail}
                    editable={!claimLoading}
                  />
                  <TextInput
                    style={styles.claimInput}
                    placeholder="Enter your phone number"
                    placeholderTextColor="#999"
                    keyboardType="phone-pad"
                    value={claimPhone}
                    onChangeText={setClaimPhone}
                    editable={!claimLoading}
                  />
                  <TextInput
                    style={styles.claimInput}
                    placeholder="Enter your UPI ID (e.g. name@upi)"
                    placeholderTextColor="#999"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    value={claimUpi}
                    onChangeText={setClaimUpi}
                    editable={!claimLoading}
                  />

                  <TouchableOpacity
                    style={[
                      styles.submitClaimButton,
                      (claimLoading || !data.can_claim) && styles.submitClaimButtonDisabled,
                    ]}
                    onPress={data.can_claim ? handleClaim : undefined}
                    activeOpacity={data.can_claim ? 0.8 : 1}
                    disabled={claimLoading || !data.can_claim}
                  >
                    {claimLoading ? (
                      <ActivityIndicator size="small" color="#FFF" />
                    ) : (
                      <>
                        <Ionicons name="send" size={18} color="#FFF" />
                        <Text style={styles.submitClaimButtonText}>Submit Claim</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity
                  style={styles.doneButton}
                  onPress={() => {
                    setShowClaimModal(false);
                    setClaimMessage(null);
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={styles.doneButtonText}>Done</Text>
                </TouchableOpacity>
              )}
            </View>
          </KeyboardAvoidingView>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    padding: 20,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
  },
  errorText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 16,
    backgroundColor: '#FF7A18',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 20,
  },
  retryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 56 : 16,
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#FFF',
    letterSpacing: 1,
  },
  infoButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  content: {
    flex: 1,
  },

  // Code Card
  codeCard: {
    backgroundColor: '#FFF',
    margin: 16,
    marginBottom: 10,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  codeLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#999',
    letterSpacing: 1.5,
    marginBottom: 12,
    textAlign: 'center',
  },
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  codeBox: {
    flex: 1,
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#1B7C82',
    borderStyle: 'dashed',
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  codeText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1B7C82',
    letterSpacing: 2,
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1B7C82',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 6,
  },
  copyButtonCopied: {
    backgroundColor: '#4CAF50',
  },
  copyButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFF',
  },
  shareButton: {
    marginTop: 14,
    borderRadius: 12,
    overflow: 'hidden',
  },
  shareButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    gap: 8,
  },
  shareButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFF',
  },

  // Earnings Card
  earningsCard: {
    backgroundColor: '#FFF',
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  earningsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  earningsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  coinIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFD700',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 4,
  },
  coinText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFF',
  },
  balanceAmount: {
    fontSize: 30,
    fontWeight: '800',
    color: '#222',
  },
  earningsRight: {
    alignItems: 'flex-end',
  },
  earningsLabel: {
    fontSize: 11,
    color: '#999',
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  totalEarned: {
    fontSize: 16,
    fontWeight: '700',
    color: '#4CAF50',
  },

  // Progress
  progressSection: {
    marginBottom: 16,
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  progressLabelLeft: {
    fontSize: 11,
    color: '#999',
    fontWeight: '600',
  },
  progressLabelRight: {
    fontSize: 11,
    color: '#999',
    fontWeight: '600',
  },
  progressBarBg: {
    height: 14,
    backgroundColor: '#E8E8E8',
    borderRadius: 7,
    overflow: 'hidden',
    position: 'relative',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 7,
  },
  milestoneDot: {
    position: 'absolute',
    top: 4,
    width: 6,
    height: 6,
    borderRadius: 3,
    marginLeft: -3,
  },
  progressMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  referralCount: {
    fontSize: 12,
    color: '#666',
  },
  referralCountBold: {
    fontWeight: '800',
    color: '#222',
    fontSize: 14,
  },
  perReferral: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4CAF50',
  },

  // Claim Button
  claimButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1B7C82',
    paddingVertical: 14,
    borderRadius: 25,
    gap: 8,
    shadowColor: '#1B7C82',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  claimButtonLocked: {
    backgroundColor: '#B0BEC5',
    shadowColor: '#B0BEC5',
  },
  claimButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFF',
  },

  // Tabs
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 6,
    marginBottom: 4,
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    gap: 4,
  },
  tabActive: {
    backgroundColor: '#1B7C82',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
  },
  tabTextActive: {
    color: '#FFF',
  },
  tabBadge: {
    backgroundColor: '#E0E0E0',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  tabBadgeActive: {
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  tabBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#666',
  },
  tabBadgeTextActive: {
    color: '#FFF',
  },

  // Referral List
  referralList: {
    marginHorizontal: 16,
    marginTop: 8,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyStateText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#999',
    marginTop: 12,
  },
  emptyStateSubtext: {
    fontSize: 13,
    color: '#BBB',
    textAlign: 'center',
    marginTop: 6,
  },
  referralItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  referralItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  referralIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  referralItemInfo: {
    flex: 1,
  },
  referralName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#222',
    marginBottom: 3,
  },
  referralStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  referralStatus: {
    fontSize: 12,
    fontWeight: '600',
  },
  adminMessage: {
    fontSize: 11,
    color: '#999',
    marginTop: 3,
    fontStyle: 'italic',
  },
  referralReward: {
    fontSize: 16,
    fontWeight: '800',
    color: '#4CAF50',
    marginLeft: 8,
  },

  // How It Works Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  howItWorksContainer: {
    width: SCREEN_WIDTH - 48,
    maxWidth: 380,
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 24,
    paddingTop: 40,
  },
  modalCloseButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  howItWorksIcon: {
    alignItems: 'center',
    marginBottom: 16,
  },
  howItWorksIconBg: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  howItWorksTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#222',
    textAlign: 'center',
    marginBottom: 20,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#1B7C82',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    marginTop: 2,
  },
  stepNumberText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFF',
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#222',
    marginBottom: 2,
  },
  stepDesc: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
  },
  gotItButton: {
    backgroundColor: '#1B7C82',
    paddingVertical: 14,
    borderRadius: 25,
    alignItems: 'center',
    marginTop: 8,
  },
  gotItButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFF',
  },

  // Claim Modal
  claimModalContainer: {
    width: SCREEN_WIDTH - 48,
    maxWidth: 380,
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 24,
    paddingTop: 40,
    alignItems: 'center',
  },
  claimModalIcon: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#E0F2F1',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  claimModalTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#222',
    marginBottom: 8,
  },
  claimModalSubtitle: {
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 18,
  },
  claimMessageBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 10,
    marginBottom: 16,
    width: '100%',
  },
  claimMessageSuccess: {
    backgroundColor: '#E8F5E9',
  },
  claimMessageError: {
    backgroundColor: '#FFEBEE',
  },
  claimMessageText: {
    fontSize: 13,
    flex: 1,
    lineHeight: 18,
  },
  claimInput: {
    width: '100%',
    height: 50,
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 15,
    color: '#222',
    marginBottom: 12,
    backgroundColor: '#FAFAFA',
  },
  submitClaimButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1B7C82',
    paddingVertical: 14,
    borderRadius: 25,
    width: '100%',
    marginTop: 4,
    gap: 8,
    shadowColor: '#1B7C82',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  submitClaimButtonDisabled: {
    backgroundColor: '#B0BEC5',
    shadowColor: '#B0BEC5',
  },
  submitClaimButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFF',
  },
  doneButton: {
    backgroundColor: '#1B7C82',
    paddingVertical: 14,
    borderRadius: 25,
    alignItems: 'center',
    width: '100%',
    marginTop: 8,
  },
  doneButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFF',
  },
});
