import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';

interface LocationPickerProps {
  onLocationSelect: (latitude: number, longitude: number) => void;
  initialLocation?: { latitude: number; longitude: number } | null;
}

const LocationPicker: React.FC<LocationPickerProps> = ({ 
  onLocationSelect, 
  initialLocation 
}) => {
  const mapRef = useRef(null);
  const [marker, setMarker] = useState(initialLocation || null);
  const [isLoading, setIsLoading] = useState(false);

  const handleMapPress = (event: any) => {
    const { latitude, longitude } = event.nativeEvent.coordinate;
    setMarker({ latitude, longitude });
    onLocationSelect(latitude, longitude);
  };

  const useMyLocation = async () => {
    setIsLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please enable location access.');
        setIsLoading(false);
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const { latitude, longitude } = location.coords;
      
      setMarker({ latitude, longitude });
      onLocationSelect(latitude, longitude);
      
      mapRef.current?.animateToRegion({
        latitude,
        longitude,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      }, 500);
      
    } catch (error) {
      Alert.alert('Error', 'Could not get your location.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={{
          latitude: 12.9716,
          longitude: 77.5946,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
        onPress={handleMapPress}
      >
        {marker && (
          <Marker
            coordinate={marker}
            title="Restaurant Location"
            pinColor="#E94A37"
          />
        )}
      </MapView>
      
      {/* Use My Location Button */}
      <TouchableOpacity style={styles.myLocationBtn} onPress={useMyLocation} disabled={isLoading}>
        {isLoading ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <>
            <Ionicons name="locate" size={16} color="#fff" />
            <Text style={styles.myLocationText}>Use My Location</Text>
          </>
        )}
      </TouchableOpacity>
      
      {/* Hint */}
      {!marker && (
        <Text style={styles.hint}>👆 Tap on the map to drop a pin</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  map: {
    width: '100%',
    height: 200,
  },
  myLocationBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF5733',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    gap: 6,
  },
  myLocationText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  hint: {
    position: 'absolute',
    bottom: 10,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    color: '#FFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    fontSize: 12,
  },
});

export default LocationPicker;