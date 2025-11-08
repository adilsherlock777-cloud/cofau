import React from 'react';
import { TouchableOpacity, Text, StyleSheet, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function MapButton({ restaurantName, mapsUrl }) {
  const handlePress = () => {
    Linking.openURL(mapsUrl);
  };

  return (
    <TouchableOpacity style={styles.button} onPress={handlePress}>
      <Ionicons name="location-outline" size={16} color="#666" />
      <Text style={styles.text}>{restaurantName}</Text>
      <Ionicons name="chevron-forward" size={16} color="#666" />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    gap: 6,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 13,
    color: '#333',
    fontWeight: '500',
    flex: 1,
  },
});