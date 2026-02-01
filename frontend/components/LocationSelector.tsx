import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import * as Location from "expo-location";

interface LocationData {
  latitude: number;
  longitude: number;
  address?: string;
  house_number?: string;
  street_address?: string;
  pincode?: string;
}

interface LocationSelectorProps {
  visible: boolean;
  onClose: () => void;
  onSave: (location: LocationData) => void;
  initialLocation?: LocationData;
}

export const LocationSelector: React.FC<LocationSelectorProps> = ({
  visible,
  onClose,
  onSave,
  initialLocation,
}) => {
  const [step, setStep] = useState<"map" | "form">("map");
  const [loading, setLoading] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<{
    latitude: number;
    longitude: number;
    address: string;
  } | null>(null);
  const [region, setRegion] = useState({
    latitude: 12.9716,
    longitude: 77.5946,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  });

  // Form fields
  const [houseNumber, setHouseNumber] = useState("");
  const [streetAddress, setStreetAddress] = useState("");
  const [pincode, setPincode] = useState("");

  useEffect(() => {
    if (visible) {
      getCurrentLocation();
      if (initialLocation) {
        setHouseNumber(initialLocation.house_number || "");
        setStreetAddress(initialLocation.street_address || "");
        setPincode(initialLocation.pincode || "");
      }
    }
  }, [visible]);

  const getCurrentLocation = async () => {
    try {
      setLoading(true);
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== "granted") {
        Alert.alert("Permission Denied", "Location permission is required to use this feature");
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      const { latitude, longitude } = location.coords;

      setRegion({
        latitude,
        longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });

      // Get address from coordinates
      const address = await getAddressFromCoords(latitude, longitude);
      setSelectedLocation({ latitude, longitude, address });
    } catch (error) {
      console.error("Error getting location:", error);
      Alert.alert("Error", "Failed to get current location");
    } finally {
      setLoading(false);
    }
  };

  const getAddressFromCoords = async (latitude: number, longitude: number): Promise<string> => {
    try {
      const [result] = await Location.reverseGeocodeAsync({ latitude, longitude });
      if (result) {
        const parts = [
          result.name,
          result.street,
          result.district,
          result.city,
          result.region,
        ].filter(Boolean);
        return parts.join(", ");
      }
      return "Unknown location";
    } catch (error) {
      console.error("Error reverse geocoding:", error);
      return "Unknown location";
    }
  };

  const handleMapPress = async (event: any) => {
    const { latitude, longitude } = event.nativeEvent.coordinate;
    const address = await getAddressFromCoords(latitude, longitude);
    setSelectedLocation({ latitude, longitude, address });
  };

  const handleConfirmLocation = () => {
    if (selectedLocation) {
      setStep("form");
    } else {
      Alert.alert("Select Location", "Please select a location on the map");
    }
  };

  const handleSave = () => {
    if (!selectedLocation) {
      Alert.alert("Error", "Please select a location");
      return;
    }

    if (!houseNumber.trim() || !streetAddress.trim() || !pincode.trim()) {
      Alert.alert("Missing Information", "Please fill in all address fields");
      return;
    }

    if (pincode.length !== 6 || !/^\d+$/.test(pincode)) {
      Alert.alert("Invalid Pincode", "Please enter a valid 6-digit pincode");
      return;
    }

    const locationData: LocationData = {
      latitude: selectedLocation.latitude,
      longitude: selectedLocation.longitude,
      address: selectedLocation.address,
      house_number: houseNumber.trim(),
      street_address: streetAddress.trim(),
      pincode: pincode.trim(),
    };

    onSave(locationData);
    handleClose();
  };

  const handleClose = () => {
    setStep("map");
    setSelectedLocation(null);
    setHouseNumber("");
    setStreetAddress("");
    setPincode("");
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {step === "map" ? "Select Location" : "Enter Address Details"}
          </Text>
          <View style={styles.backButton} />
        </View>

        {step === "map" ? (
          <>
            {/* Map View */}
            <View style={styles.mapContainer}>
              {loading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color="#FF7A18" />
                  <Text style={styles.loadingText}>Getting your location...</Text>
                </View>
              ) : (
                <MapView
                  provider={PROVIDER_GOOGLE}
                  style={styles.map}
                  region={region}
                  onPress={handleMapPress}
                  showsUserLocation
                  showsMyLocationButton
                >
                  {selectedLocation && (
                    <Marker
                      coordinate={{
                        latitude: selectedLocation.latitude,
                        longitude: selectedLocation.longitude,
                      }}
                      title="Selected Location"
                    />
                  )}
                </MapView>
              )}

              {/* Center Pin Indicator */}
              <View style={styles.centerMarker}>
                <Ionicons name="location" size={40} color="#FF7A18" />
              </View>
            </View>

            {/* Address Display */}
            {selectedLocation && (
              <View style={styles.addressContainer}>
                <Ionicons name="location" size={20} color="#4CAF50" />
                <Text style={styles.addressText}>{selectedLocation.address}</Text>
              </View>
            )}

            {/* Confirm Button */}
            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={styles.confirmButton}
                onPress={handleConfirmLocation}
                disabled={!selectedLocation}
              >
                <Text style={styles.confirmButtonText}>Confirm Location</Text>
                <Ionicons name="arrow-forward" size={20} color="#FFF" />
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <>
            {/* Address Form */}
            <ScrollView style={styles.formContainer} showsVerticalScrollIndicator={false}>
              <View style={styles.formSection}>
                <Text style={styles.label}>
                  House/Flat/Building Number <Text style={styles.required}>*</Text>
                </Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g., 123, Apartment Name"
                  value={houseNumber}
                  onChangeText={setHouseNumber}
                  placeholderTextColor="#999"
                />
              </View>

              <View style={styles.formSection}>
                <Text style={styles.label}>
                  Street Address <Text style={styles.required}>*</Text>
                </Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g., MG Road"
                  value={streetAddress}
                  onChangeText={setStreetAddress}
                  placeholderTextColor="#999"
                />
              </View>

              <View style={styles.formSection}>
                <Text style={styles.label}>
                  Pincode <Text style={styles.required}>*</Text>
                </Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g., 560001"
                  value={pincode}
                  onChangeText={setPincode}
                  keyboardType="numeric"
                  maxLength={6}
                  placeholderTextColor="#999"
                />
              </View>

              <View style={styles.selectedLocationInfo}>
                <Ionicons name="map" size={20} color="#4CAF50" />
                <Text style={styles.selectedLocationText}>
                  {selectedLocation?.address}
                </Text>
              </View>
            </ScrollView>

            {/* Save Button */}
            <View style={styles.buttonContainer}>
              <TouchableOpacity style={styles.confirmButton} onPress={handleSave}>
                <Text style={styles.confirmButtonText}>Save Address</Text>
                <Ionicons name="checkmark" size={20} color="#FFF" />
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFF",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 16,
    backgroundColor: "#FFF",
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#333",
  },
  mapContainer: {
    flex: 1,
    position: "relative",
  },
  map: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F5F5F5",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#666",
  },
  centerMarker: {
    position: "absolute",
    top: "50%",
    left: "50%",
    marginLeft: -20,
    marginTop: -40,
  },
  addressContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#FFF",
    borderTopWidth: 1,
    borderTopColor: "#F0F0F0",
    gap: 10,
  },
  addressText: {
    flex: 1,
    fontSize: 14,
    color: "#333",
    lineHeight: 20,
  },
  buttonContainer: {
    padding: 16,
    backgroundColor: "#FFF",
    borderTopWidth: 1,
    borderTopColor: "#F0F0F0",
  },
  confirmButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FF7A18",
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
    shadowColor: "#FF7A18",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFF",
  },
  formContainer: {
    flex: 1,
    padding: 16,
  },
  formSection: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    marginBottom: 8,
  },
  required: {
    color: "#FF6B6B",
  },
  input: {
    backgroundColor: "#F5F5F5",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: "#333",
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  selectedLocationInfo: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#F0F8F5",
    padding: 16,
    borderRadius: 12,
    gap: 10,
    marginTop: 8,
  },
  selectedLocationText: {
    flex: 1,
    fontSize: 13,
    color: "#666",
    lineHeight: 20,
  },
});
