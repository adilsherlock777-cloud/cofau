import React from 'react';
import { View, Image, Text, StyleSheet } from 'react-native';
import UserAvatar from './UserAvatar';

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
 */
export default function ProfileBadge({
  profilePicture,
  username,
  level = 1,
  dpSize = 115,
  badgeSize = 80,
  cameraIcon = null
}) {

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
        <UserAvatar
          profilePicture={profilePicture}
          username={username}
          size={dpSize}
          showLevelBadge={false}
        />
        {cameraIcon}
      </View>
      
      {/* Username below DP */}
      <Text style={styles.usernameText} numberOfLines={1}>
        {username}
      </Text>
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
      <Text style={styles.badgeTitle}>
        {getBadgeTitle()}
      </Text>
    </View>
  </View>
);
}

const styles = StyleSheet.create({
  container: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  width: '100%',
  paddingLeft: 10,
  paddingRight: 25,
  paddingVertical: 10,
},
  leftSection: {
    alignItems: 'center',
  },
  avatarContainer: {
    position: 'relative',
  },
  usernameText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginTop: 8,
    maxWidth: 100,
    textAlign: 'center',
  },
  badgeContainer: {
  alignItems: 'center',
  marginRight: -50,
},
  badgeTitle: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 6,
    color: '#444',
    letterSpacing: 0.5,
  },
});
