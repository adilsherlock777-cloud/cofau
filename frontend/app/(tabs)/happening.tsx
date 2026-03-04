import React from 'react';
import { View, StyleSheet } from 'react-native';
import LeaderboardScreen from './leaderboard';

export default function HappeningScreen() {
  return (
    <View style={styles.container}>
      <LeaderboardScreen />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
});
