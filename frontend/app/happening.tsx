import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import HappeningCard from '../components/HappeningCard';

export default function HappeningScreen() {
  const router = useRouter();

  // Static dummy data for restaurants
  const restaurants = [
    {
      id: 1,
      rank: 1,
      name: 'Empire Restaurant',
      uploads: '10K uploaded',
      extra: '+35+',
      thumbnails: 3,
    },
    {
      id: 2,
      rank: 2,
      name: 'Thalaserry Restaurant',
      uploads: '8K uploaded',
      extra: '+20+',
      thumbnails: 3,
    },
    {
      id: 3,
      rank: 3,
      name: 'Sushi Restaurant',
      uploads: '2K uploaded',
      extra: '+5+',
      thumbnails: 3,
    },
    {
      id: 4,
      rank: 4,
      name: 'Pizza Palace',
      uploads: '5K uploaded',
      extra: '+12+',
      thumbnails: 3,
    },
    {
      id: 5,
      rank: 5,
      name: 'Burger Junction',
      uploads: '6K uploaded',
      extra: '+18+',
      thumbnails: 3,
    },
    {
      id: 6,
      rank: 6,
      name: 'Thai Corner',
      uploads: '4K uploaded',
      extra: '+9+',
      thumbnails: 3,
    },
  ];

  return (
    <View style={styles.container}>
      {/* Gradient Header */}
      <LinearGradient
        colors={['#FFB88C', '#DE6262', '#4FB3C5']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.header}
      >
        <Text style={styles.headerTitle}>Cofau</Text>
        <Text style={styles.headerSubtitle}>Happening Place Near You</Text>
      </LinearGradient>

      {/* Restaurant List */}
      <ScrollView 
        style={styles.scrollView} 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {restaurants.map((restaurant) => (
          <HappeningCard key={restaurant.id} restaurant={restaurant} />
        ))}
        
        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Bottom Navigation */}
      <View style={styles.bottomNav}>
        <TouchableOpacity
          style={styles.navButton}
          onPress={() => router.push('/feed')}
        >
          <Ionicons name="home-outline" size={26} color="#999" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.navButton}
          onPress={() => router.push('/search')}
        >
          <Ionicons name="search-outline" size={26} color="#999" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.navButton}
          onPress={() => router.push('/add-post')}
        >
          <Ionicons name="add-circle-outline" size={32} color="#999" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.navButton}
          onPress={() => router.push('/happening')}
        >
          <Ionicons name="flame" size={26} color="#FF6B6B" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.navButton}
          onPress={() => router.push('/profile')}
        >
          <Ionicons name="person-outline" size={26} color="#999" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 18,
    color: '#FFF',
    fontWeight: '500',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 20,
  },
  bottomSpacer: {
    height: 20,
  },
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  navButton: {
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
});