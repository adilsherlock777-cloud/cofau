import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { useRouter } from 'expo-router';
import { API_URL } from '../utils/api';
import { useAuth } from '../context/AuthContext';

export default function ProfileScreen() {
  const router = useRouter();
  const { user, token } = useAuth();
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;

    const fetchUser = async () => {
      try {
        const res = await axios.get(`${API_URL}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setUserData(res.data.user);
      } catch (err) {
        console.log("Error fetching profile:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, [token]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }

  if (!userData) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Unable to load profile.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        
        <View style={styles.header}>
          <Image 
            source={{ uri: userData.avatar || 'https://placehold.co/200x200' }}
            style={styles.avatar}
          />
          <Text style={styles.name}>{userData.username}</Text>
          <Text style={styles.email}>{userData.email}</Text>
        </View>

      </ScrollView>

      {/* Bottom Navigation */}
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => router.push('/feed')}>
          <Ionicons name="home-outline" size={28} color="#000" />
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push('/explore')}>
          <Ionicons name="compass-outline" size={28} color="#000" />
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push('/add-post')}>
          <Ionicons name="add-circle-outline" size={28} color="#000" />
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push('/happening')}>
          <Ionicons name="flame-outline" size={28} color="#000" />
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push('/profile')}>
          <Ionicons name="person-outline" size={28} color="#000" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },

  centered: { flex: 1, justifyContent: "center", alignItems: "center" },

  loadingText: { fontSize: 16, color: "#888" },
  errorText: { fontSize: 16, color: "red" },

  header: { alignItems: "center", marginTop: 40 },
  avatar: { width: 120, height: 120, borderRadius: 60, marginBottom: 16 },
  name: { fontSize: 24, fontWeight: "bold" },
  email: { fontSize: 16, color: "#666", marginTop: 4 },

  navBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderColor: '#ccc',
    backgroundColor: '#fff',
  },
});
