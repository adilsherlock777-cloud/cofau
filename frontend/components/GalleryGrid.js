import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';

export default function GalleryGrid({ items }) {
  const router = useRouter();
  const [likedItems, setLikedItems] = useState({});

  const handleImagePress = (itemId) => {
    router.push('/post-details');
  };

  const handleHeartPress = (itemId, event) => {
    event.stopPropagation();
    setLikedItems(prev => ({
      ...prev,
      [itemId]: !prev[itemId]
    }));
  };

  // Gradient color variations for diversity
  const gradientVariations = [
    ['#66D9E8', '#F093FB', '#F5576C'], // Cyan to Pink
    ['#F093FB', '#F5576C', '#FF8A80'], // Pink to Red
    ['#66D9E8', '#96E6B3', '#F5576C'], // Cyan to Green to Pink
    ['#A8EDEA', '#FED6E3', '#F093FB'], // Light variations
    ['#4FACFE', '#00F2FE', '#43E97B'], // Blue to Cyan to Green
    ['#FA709A', '#FEE140', '#30CFD0'], // Pink to Yellow to Cyan
  ];

  return (
    <View style={styles.grid}>
      {items.map((item, index) => {
        const colors = gradientVariations[index % gradientVariations.length];
        return (
          <TouchableOpacity
            key={item.id}
            style={styles.gridItem}
            onPress={() => handleImagePress(item.id)}
            activeOpacity={0.9}
          >
            <LinearGradient
              colors={colors}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.imageGradient}
            >
              {/* Heart Icon Overlay */}
              <TouchableOpacity
                style={styles.heartContainer}
                onPress={(e) => handleHeartPress(item.id, e)}
                activeOpacity={0.7}
              >
                <View style={styles.heartBackground}>
                  <Ionicons
                    name={likedItems[item.id] ? 'heart' : 'heart-outline'}
                    size={18}
                    color={likedItems[item.id] ? '#FF3B5C' : '#FFF'}
                  />
                </View>
              </TouchableOpacity>
            </LinearGradient>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  gridItem: {
    width: '33.333%',
    aspectRatio: 1,
    padding: 1,
  },
  imageGradient: {
    flex: 1,
    position: 'relative',
  },
  heartContainer: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  heartBackground: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
});