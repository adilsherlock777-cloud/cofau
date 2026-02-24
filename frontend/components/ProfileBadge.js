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
// Level thresholds matching backend
const LEVEL_TABLE = [
  { level: 1, required_points: 1250 },
  { level: 2, required_points: 2500 },
  { level: 3, required_points: 3750 },
  { level: 4, required_points: 5000 },
  { level: 5, required_points: 5750 },
  { level: 6, required_points: 6500 },
  { level: 7, required_points: 7250 },
  { level: 8, required_points: 8000 },
  { level: 9, required_points: 9000 },
  { level: 10, required_points: 10000 },
  { level: 11, required_points: 11000 },
  { level: 12, required_points: 12000 },
];

export default function ProfileBadge({
  profilePicture,
  username,
  level = 1,
  dpSize = 90,
  badgeSize = 120,
  cameraIcon = null,
  isOwnProfile = false,
  badge = null,
  totalPoints = 0,
  currentPoints = 0,
  onImagePress = null,
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

  return (
    <View style={styles.container}>
      {/* Left side: DP + Username stacked */}
      <View style={styles.leftSection}>
        {/* Profile Picture Container */}
        <View style={styles.avatarContainer}>
          {onImagePress ? (
            <TouchableOpacity onPress={onImagePress} activeOpacity={0.8}>
              <UserAvatar
                profilePicture={profilePicture}
                username={username}
                size={dpSize}
                showLevelBadge={false}
              />
            </TouchableOpacity>
          ) : (
            <UserAvatar
              profilePicture={profilePicture}
              username={username}
              size={dpSize}
              showLevelBadge={false}
            />
          )}
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

      {/* Level Info Modal - inlined to prevent unmount/remount on re-renders */}
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

            {/* Current Level Progress Bar */}
            {(() => {
              const currentLevel = level || 1;
              const pts = currentPoints || 0;
              const prevLevelData = LEVEL_TABLE.find(l => l.level === currentLevel - 1);
              const prevThreshold = prevLevelData?.required_points || 0;
              const currentLevelData = LEVEL_TABLE.find(l => l.level === currentLevel);
              const currentThreshold = currentLevelData?.required_points || 1250;
              const pointsNeededForLevel = currentThreshold - prevThreshold;
              const progressPercent = pointsNeededForLevel > 0
                ? Math.min((pts / pointsNeededForLevel) * 100, 100)
                : 0;

              return (
                <View style={styles.levelProgressSection}>
                  <Text style={styles.levelProgressLabel}>Level {currentLevel}</Text>
                  <View style={styles.levelProgressBarContainer}>
                    <View style={styles.levelProgressBar}>
                      <LinearGradient
                        colors={progressPercent <= 50 ? ['#FF9A4D', '#FF9A4D'] : ['#FF9A4D', '#FF5C5C']}
                        locations={[0, 1]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={[styles.levelProgressFill, { width: `${Math.max(progressPercent, 1)}%` }]}
                      />
                    </View>
                    <Text style={styles.levelProgressText}>
                      {totalPoints || 0}/{currentThreshold}
                    </Text>
                  </View>
                </View>
              );
            })()}

            <View style={styles.levelDivider} />

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
  // Level progress bar styles
  levelProgressSection: {
    marginBottom: 16,
  },
  levelProgressLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#333',
    marginBottom: 6,
  },
  levelProgressBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  levelProgressBar: {
    flex: 1,
    height: 8,
    backgroundColor: '#E8E8E8',
    borderRadius: 6,
    overflow: 'hidden',
  },
  levelProgressFill: {
    height: '100%',
    borderRadius: 4,
  },
  levelProgressText: {
    fontSize: 12,
    color: 'rgba(10, 10, 10, 1)',
    fontWeight: '600',
  },
  levelDivider: {
    height: 1,
    backgroundColor: '#E8E8E8',
    marginBottom: 16,
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