import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function RatingBar({ current, total, label }) {
  const percentage = (current / total) * 100;

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.barContainer}>
        <View style={styles.barBackground}>
          <View style={[styles.barForeground, { width: `${percentage}%` }]} />
        </View>
        <Text style={styles.points}>{current}/{total}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 4,
  },
  label: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  barContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  barBackground: {
    flex: 1,
    height: 8,
    backgroundColor: '#E5E5E5',
    borderRadius: 4,
    overflow: 'hidden',
  },
  barForeground: {
    height: '100%',
    backgroundColor: '#FFD700',
    borderRadius: 4,
  },
  points: {
    fontSize: 11,
    fontWeight: '600',
    color: '#333',
    marginLeft: 8,
  },
});