import React from 'react';
import { View, StyleSheet } from 'react-native';
import HappeningPlaces from '../../components/HappeningPlaces';

export default function HappeningScreen() {
  return (
    <View style={styles.container}>
      <HappeningPlaces />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
});