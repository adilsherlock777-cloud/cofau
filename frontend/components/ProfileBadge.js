import React from 'react';
import { View, Image, StyleSheet } from 'react-native';
import UserAvatar from './UserAvatar';

// Import badge images
const ReviewerBadge = require('../assets/badges/reviewer.png');
const TopReviewerBadge = require('../assets/badges/top_reviewer.png');
const InfluencerBadge = require('../assets/badges/influencer.png');

/**
 * ProfileBadge Component
 * 
 * Displays user profile picture with full-size category badge
 * Only used on the main profile screen
 * 
 * @param {string} profilePicture - User's profile picture URL
 * @param {string} username - User's username (for avatar fallback)
 * @param {number} level - User's level (1-12)
 * @param {number} dpSize - Size of the DP and badge (default: 110)
 */
export default function ProfileBadge({ 
  profilePicture, 
  username, 
  level = 1, 
  dpSize = 110 
}) {
  
  /**
   * Get category badge based on user level
   * Level 1-4: Reviewer (blue checkmark)
   * Level 5-8: Top Reviewer (gold star)
   * Level 9-12: Influencer (phoenix)
   */
  const getCategoryBadge = () => {
    if (level <= 4) return ReviewerBadge;
    if (level <= 8) return TopReviewerBadge;
    return InfluencerBadge;
  };

  return (
    <View style={styles.container}>
      {/* Profile Picture (no small badge on profile screen) */}
      <UserAvatar
        profilePicture={profilePicture}
        username={username}
        size={dpSize}
        showLevelBadge={false} // Disable small badge
      />

      {/* Full-size Category Badge */}
      <Image
        source={getCategoryBadge()}
        style={{
          width: dpSize,
          height: dpSize,
          marginLeft: 10,
          resizeMode: 'contain',
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
