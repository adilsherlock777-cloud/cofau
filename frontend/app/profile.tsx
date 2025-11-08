import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';

export default function ProfileScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('Photo');
  const [bio, setBio] = useState('');

  // Dummy data
  const postsCount = 152;
  const followersCount = 556;
  const level = 3;
  const currentPoints = 85;
  const totalPoints = 100;

  // Generate dummy gradient photos (3 per row)
  const photoGridItems = Array(12).fill(null);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>PROFILE</Text>
        <View style={styles.pointsBadge}>
          <Text style={styles.pointsText}>{currentPoints}/{totalPoints}</Text>
        </View>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Top Profile Section */}
        <View style={styles.topSection}>
          {/* Avatar */}
          <View style={styles.avatarContainer}>
            <View style={styles.avatar}>
              <Text style={styles.avatarLetter}>S</Text>
            </View>
          </View>

          {/* Badge Icon */}
          <View style={styles.badgeContainer}>
            <LinearGradient
              colors={['#FFD700', '#FFA500']}
              style={styles.badge}
            >
              <Text style={styles.badgeText}>BADGE</Text>
            </LinearGradient>
          </View>
        </View>

        {/* Stats Boxes */}
        <View style={styles.statsContainer}>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{postsCount}</Text>
            <Text style={styles.statLabel}>POSTS</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{followersCount}</Text>
            <Text style={styles.statLabel}>FOLLOWERS</Text>
          </View>
        </View>

        {/* BIO Section */}
        <View style={styles.bioSection}>
          <Text style={styles.bioLabel}>BIO:</Text>
          <TextInput
            style={styles.bioInput}
            placeholder="Write your bio here..."
            placeholderTextColor="#999"
            value={bio}
            onChangeText={setBio}
            multiline
          />
        </View>

        {/* Tabs */}
        <View style={styles.tabsContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'Photo' && styles.activeTab]}
            onPress={() => setActiveTab('Photo')}
          >
            <Text style={[styles.tabText, activeTab === 'Photo' && styles.activeTabText]}>
              Photo
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'Video' && styles.activeTab]}
            onPress={() => setActiveTab('Video')}
          >
            <Text style={[styles.tabText, activeTab === 'Video' && styles.activeTabText]}>
              Video
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'Collabs' && styles.activeTab]}
            onPress={() => setActiveTab('Collabs')}
          >
            <Text style={[styles.tabText, activeTab === 'Collabs' && styles.activeTabText]}>
              Collabs
            </Text>
          </TouchableOpacity>
        </View>

        {/* Photo Grid */}
        <View style={styles.photoGrid}>
          {photoGridItems.map((_, index) => (
            <TouchableOpacity key={index} style={styles.gridItem}>
              <LinearGradient
                colors={['#66D9E8', '#F093FB', '#F5576C']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.gridItemGradient}
              />
            </TouchableOpacity>
          ))}
        </View>

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
          onPress={() => router.push('/chat')}
        >
          <Ionicons name="notifications-outline" size={26} color="#999" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.navButton}
          onPress={() => router.push('/profile')}
        >
          <Ionicons name="person" size={26} color="#333" />
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
    backgroundColor: '#FFF',
    paddingVertical: 16,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    letterSpacing: 1,
  },
  pointsBadge: {
    backgroundColor: '#F0F0F0',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  pointsText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
  },
  scrollView: {
    flex: 1,
  },
  topSection: {
    backgroundColor: '#FFF',
    paddingVertical: 32,
    alignItems: 'center',
    position: 'relative',
  },
  avatarContainer: {
    alignItems: 'center',
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#66D9E8',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  avatarLetter: {
    fontSize: 56,
    fontWeight: 'bold',
    color: '#FFF',
  },
  badgeContainer: {
    position: 'absolute',
    right: 40,
    top: 40,
  },
  badge: {
    width: 80,
    height: 70,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    transform: [{ rotate: '45deg' }],
  },
  badgeText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#FFF',
    transform: [{ rotate: '-45deg' }],
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 24,
    gap: 16,
    backgroundColor: '#FFF',
  },
  statBox: {
    flex: 1,
    backgroundColor: '#F8F8F8',
    paddingVertical: 24,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  statNumber: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 13,
    color: '#999',
    fontWeight: '600',
    letterSpacing: 1,
  },
  bioSection: {
    backgroundColor: '#FFF',
    paddingHorizontal: 16,
    paddingVertical: 20,
    marginTop: 1,
  },
  bioLabel: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  bioInput: {
    fontSize: 14,
    color: '#333',
    minHeight: 40,
    paddingVertical: 8,
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 24,
    borderBottomWidth: 2,
    borderBottomColor: '#E5E5E5',
  },
  tab: {
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#333',
  },
  tabText: {
    fontSize: 16,
    color: '#999',
    fontWeight: '500',
  },
  activeTabText: {
    color: '#333',
    fontWeight: 'bold',
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 2,
    backgroundColor: '#FFF',
  },
  gridItem: {
    width: '33.333%',
    aspectRatio: 1,
    padding: 2,
  },
  gridItemGradient: {
    flex: 1,
    borderRadius: 4,
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