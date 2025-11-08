import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';

export default function HappeningCard({ restaurant }) {
  const router = useRouter();

  const handleCardPress = () => {
    // Navigate to restaurant details or post details
    router.push('/post-details');
  };

  // Different gradient combinations for variety
  const gradients = [
    ['#66D9E8', '#F093FB', '#F5576C'],
    ['#F093FB', '#F5576C', '#FF8A80'],
    ['#A8EDEA', '#FED6E3', '#F093FB'],
  ];

  return (
    <TouchableOpacity 
      style={styles.card} 
      onPress={handleCardPress}
      activeOpacity={0.9}
    >
      {/* Rank Number */}
      <View style={styles.rankContainer}>
        <Text style={styles.rankNumber}>{restaurant.rank}.</Text>
      </View>

      {/* Restaurant Info */}
      <View style={styles.infoContainer}>
        <Text style={styles.restaurantName}>{restaurant.name}</Text>
        <Text style={styles.uploadCount}>{restaurant.uploads}</Text>
        
        {/* Photo Thumbnails */}
        <View style={styles.thumbnailContainer}>
          {Array(restaurant.thumbnails).fill(null).map((_, index) => (
            <LinearGradient
              key={index}
              colors={gradients[index % gradients.length]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.thumbnail}
            />
          ))}
          
          {/* Extra Count Bubble */}
          <View style={styles.extraBubble}>
            <LinearGradient
              colors={['#FF6B6B', '#4ECDC4']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.extraGradient}
            >
              <Text style={styles.extraText}>{restaurant.extra}</Text>
            </LinearGradient>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  rankContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    minWidth: 30,
  },
  rankNumber: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#333',
  },
  infoContainer: {
    flex: 1,
  },
  restaurantName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  uploadCount: {
    fontSize: 13,
    color: '#999',
    marginBottom: 12,
  },
  thumbnailContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  thumbnail: {
    width: 70,
    height: 70,
    borderRadius: 8,
  },
  extraBubble: {
    marginLeft: 4,
  },
  extraGradient: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  extraText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FFF',
  },
});