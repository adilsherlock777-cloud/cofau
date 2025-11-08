import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { useRouter } from 'expo-router';
import { useAuth } from '../context/AuthContext';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://meal-snap-4.preview.emergentagent.com/api';
const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://meal-snap-4.preview.emergentagent.com';

export default function ProfileScreen() {
  const router = useRouter();
  const { token } = useAuth();
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      setError(true);
      return;
    }

    const fetchProfile = async () => {
      try {
        console.log('📡 Fetching profile from:', `${API_URL}/auth/me`);
        const response = await axios.get(`${API_URL}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        
        console.log('✅ Profile fetched:', response.data);
        
        let user = response.data.user || response.data;
        
        // Convert relative avatar URL to full URL
        if (user.avatar_url && user.avatar_url.startsWith('/api/static/uploads')) {
          user.avatar_url = `${BACKEND_URL}${user.avatar_url}`;
        }
        
        setUserData(user);
        setError(false);
      } catch (err) {
        console.error('❌ Profile fetch error:', err.response?.data || err.message);
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [token]);

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#4dd0e1" />
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
      </View>
    );
  }

  if (error || !userData) {
    return (
      <View style={styles.container}>
        <View style={styles.centered}>
          <Ionicons name="alert-circle-outline" size={64} color="#999" />
          <Text style={styles.errorText}>Unable to load profile.</Text>
        </View>
        
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
            <Ionicons name="person" size={28} color="#4dd0e1" />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Profile Header */}
        <View style={styles.header}>
          <Image 
            source={{ 
              uri: userData.avatar_url || userData.avatar || 'https://placehold.co/200x200/4dd0e1/white?text=User'
            }}
            style={styles.avatar}
          />
          <Text style={styles.name}>{userData.username || userData.name || 'User'}</Text>
          <Text style={styles.email}>{userData.email}</Text>
          
          {/* Level and Points */}
          <View style={styles.statsContainer}>
            <View style={styles.statBox}>
              <Ionicons name="star" size={24} color="#FFD700" />
              <Text style={styles.statLabel}>Level</Text>
              <Text style={styles.statValue}>{userData.level || 1}</Text>
            </View>
            
            <View style={styles.statBox}>
              <Ionicons name="trophy" size={24} color="#4dd0e1" />
              <Text style={styles.statLabel}>Points</Text>
              <Text style={styles.statValue}>{userData.points || 0}</Text>
            </View>
          </View>
        </View>
        
        {/* Add spacing at bottom for navigation */}
        <View style={styles.bottomSpacer} />
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
          <Ionicons name="person" size={28} color="#4dd0e1" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },

  scrollContent: {
    paddingBottom: 100,
  },

  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },

  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },

  errorText: {
    marginTop: 16,
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
  },

  header: {
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 20,
  },

  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    marginBottom: 16,
    backgroundColor: '#f0f0f0',
    borderWidth: 3,
    borderColor: '#4dd0e1',
  },

  name: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },

  email: {
    fontSize: 16,
    color: '#666',
    marginBottom: 24,
  },

  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginTop: 20,
    paddingHorizontal: 40,
  },

  statBox: {
    alignItems: 'center',
    backgroundColor: '#f9f9f9',
    padding: 20,
    borderRadius: 12,
    minWidth: 120,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },

  statLabel: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
    marginBottom: 4,
  },

  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },

  bottomSpacer: {
    height: 40,
  },

  navBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderColor: '#ccc',
    backgroundColor: '#fff',
  },
});
