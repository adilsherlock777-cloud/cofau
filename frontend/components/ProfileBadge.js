import React, { useState } from 'react';
import { 
  View, 
  Image, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Modal,
  Pressable,
  ScrollView
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import UserAvatar from './UserAvatar';
import CofauVerifiedBadge from './CofauVerifiedBadge';

// Import badge images
const ReviewerBadge = require('../assets/badges/reviewer.png');
const TopReviewerBadge = require('../assets/badges/top_reviewer.png');
const InfluencerBadge = require('../assets/badges/influencer.png');

/**
 * ProfileBadge Component
 * 
 * Displays user profile picture with full-size category badge and title
 * Only used on the main profile screen
 * Layout matches reference design: DP on left, Badge + Title on right
 * 
 * @param {string} profilePicture - User's profile picture URL
 * @param {string} username - User's username (for avatar fallback)
 * @param {number} level - User's level (1-12)
 * @param {number} dpSize - Size of the DP (default: 115)
 * @param {number} badgeSize - Size of the badge (default: 100)
 * @param {boolean} isOwnProfile - Whether viewing own profile (shows info button)
 */
export default function ProfileBadge({
  profilePicture,
  username,
  level = 1,
  dpSize = 90,
  badgeSize = 120,
  cameraIcon = null,
  isOwnProfile = false,
  badge = null,
}) {
  const [showLevelInfo, setShowLevelInfo] = useState(false);

  /**
   * Get category badge image based on user level
   * Level 1-4: Reviewer (blue checkmark)
   * Level 5-8: Top Reviewer (gold star)
   * Level 9-12: Influencer (phoenix)
   */
  const getCategoryBadge = () => {
    if (level <= 4) return ReviewerBadge;
    if (level <= 8) return TopReviewerBadge;
    return InfluencerBadge;
  };

  /**
   * Get badge title text based on user level
   */
  const getBadgeTitle = () => {
    if (level <= 4) return 'REVIEWER';
    if (level <= 8) return 'TOP REVIEWER';
    return 'INFLUENCER';
  };

  /**
   * Level System Info Modal
   */
  const LevelInfoModal = () => (
    <Modal
      animationType="fade"
      transparent={true}
      visible={showLevelInfo}
      onRequestClose={() => setShowLevelInfo(false)}
    >
      <Pressable 
        style={styles.modalOverlay}
        onPress={() => setShowLevelInfo(false)}
      >
        <Pressable 
          style={styles.modalContent}
          onPress={(e) => e.stopPropagation()}
        >
          <Text style={styles.modalTitle}>Level System</Text>
          
          {/* Reviewer Level */}
          <View style={styles.levelRow}>
            <Image 
              source={ReviewerBadge} 
              style={styles.modalBadgeIcon}
            />
            <View style={styles.levelTextContainer}>
              <Text style={styles.levelName}>Levels 1-4: Reviewer</Text>
              <Text style={styles.levelPoints}>25 points per post</Text>
            </View>
          </View>

          {/* Top Reviewer Level */}
          <View style={styles.levelRow}>
            <Image 
              source={TopReviewerBadge} 
              style={styles.modalBadgeIcon}
            />
            <View style={styles.levelTextContainer}>
              <Text style={styles.levelName}>Levels 5-8: Top Reviewer</Text>
              <Text style={styles.levelPoints}>15 points per post</Text>
            </View>
          </View>

          {/* Influencer Level */}
          <View style={styles.levelRow}>
            <Image 
              source={InfluencerBadge} 
              style={styles.modalBadgeIcon}
            />
            <View style={styles.levelTextContainer}>
              <Text style={styles.levelName}>Levels 9-12: Influencer</Text>
              <Text style={styles.levelPoints}>5 points per post</Text>
            </View>
          </View>

          {/* Info text */}
          <Text style={styles.infoText}>
            Earn points by creating posts and engaging with content
          </Text>

          {/* Close button */}
          <TouchableOpacity
            style={styles.closeButtonWrapper}
            onPress={() => setShowLevelInfo(false)}
          >
            <LinearGradient
              colors={['#FF7A18', '#FF2E2E']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.closeButton}
            >
              <Text style={styles.closeButtonText}>Got it</Text>
            </LinearGradient>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );

  return (
    <View style={styles.container}>
      {/* Left side: DP + Username stacked */}
      <View style={styles.leftSection}>
        {/* Profile Picture Container */}
        <View style={styles.avatarContainer}>
          <UserAvatar
            profilePicture={profilePicture}
            username={username}
            size={dpSize}
            showLevelBadge={false}
          />
          {cameraIcon}
        </View>
        
        {/* Username below DP */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 8, gap: 4 }}>
          <Text style={[styles.usernameText, { marginTop: 0 }]} numberOfLines={1}>
            {username && username.length > 10 ? `${username.substring(0, 10)}...` : username}
          </Text>
          {badge === 'verified' && <CofauVerifiedBadge size={14} />}
        </View>
      </View>

      {/* Right side: Badge + Title */}
      <View style={styles.badgeContainer}>
        <Image
          source={getCategoryBadge()}
          style={{
            width: badgeSize,
            height: badgeSize,
            resizeMode: 'contain',
          }}
        />
        <View style={styles.badgeTitleRow}>
          <Text style={styles.badgeTitle}>
            {getBadgeTitle()}
          </Text>
          {/* Info button - only shown on own profile */}
          {isOwnProfile && (
            <TouchableOpacity 
              onPress={() => setShowLevelInfo(true)}
              style={styles.infoButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <View style={styles.infoIconContainer}>
                <Text style={styles.infoIcon}>i</Text>
              </View>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Level Info Modal */}
      <LevelInfoModal />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    width: '100%',
    paddingLeft: 15,
    paddingRight: 15,
    paddingVertical: 10,
  },
  leftSection: {
    alignItems: 'center',
  },
  avatarContainer: {
    position: 'relative',
  },
  usernameText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#444',
    marginTop: 8,
    maxWidth: 100,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  badgeContainer: {
    alignItems: 'center',
    marginTop: -20,
    marginLeft: 50
  },
  badgeTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -15,
    paddingLeft: 8,
  },
  badgeTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#444',
    letterSpacing: 0.5,
  },
  infoButton: {
    marginLeft: 6,
  },
  infoIconContainer: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#E0E0E0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoIcon: {
    fontSize: 10,
    fontWeight: '700',
    color: '#666',
    fontStyle: 'italic',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    marginHorizontal: 30,
    width: '85%',
    maxWidth: 350,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 8,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#333',
    marginBottom: 20,
  },
  levelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingVertical: 4,
  },
  modalBadgeIcon: {
    width: 44,
    height: 44,
    resizeMode: 'contain',
    marginRight: 14,
  },
  levelTextContainer: {
    flex: 1,
  },
  levelName: {
    fontSize: 15,
    fontWeight: '500',
    color: '#333',
    marginBottom: 2,
  },
  levelPoints: {
    fontSize: 13,
    color: '#666',
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
    marginBottom: 20,
    lineHeight: 20,
  },
  closeButtonWrapper: {
    borderRadius: 8,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  closeButton: {
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  closeButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});