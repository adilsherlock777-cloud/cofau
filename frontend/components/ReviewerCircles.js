import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function ReviewerCircles({ reviewers }) {
  const pastelColors = [
    '#D4A5D4', // Purple
    '#FFB380', // Orange
    '#80D4A5', // Green
    '#A5B4FF', // Blue
    '#FFD4A5', // Peach
    '#FFA5D4', // Pink
  ];

  return (
    <View style={styles.container}>
      {reviewers.map((reviewer, index) => (
        <View
          key={index}
          style={[
            styles.circle,
            { backgroundColor: pastelColors[index % pastelColors.length] },
          ]}
        >
          <Text style={styles.letter}>{reviewer.letter}</Text>
          {reviewer.count && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{reviewer.count}</Text>
            </View>
          )}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 12,
  },
  circle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    position: 'relative',
  },
  letter: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFF',
  },
  badge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    backgroundColor: '#FFF',
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#333',
  },
});