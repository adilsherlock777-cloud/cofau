import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import RatingBar from '../components/RatingBar';
import ReviewerCircles from '../components/ReviewerCircles';
import FeedCard from '../components/FeedCard';

export default function FeedScreen() {
  const router = useRouter();

  // Dummy data for reviewers
  const reviewers = [
    { letter: 'H', count: 5 },
    { letter: 'B', count: 2 },
    { letter: 'T', count: 7 },
    { letter: 'M', count: 3 },
    { letter: 'G', count: 1 },
    { letter: 'S', count: 4 },
  ];

  // Dummy feed posts
  const feedPosts = [
    {
      id: 1,
      username: 'ADIL',
      description: 'Amazing pasta with incredible flavors!',
      rating: 4.7,
      ratingLabel: 'Very Good Food',
      location: '2nd Road, Bangalore',
      mapsUrl: 'https://maps.google.com/?q=2nd+Road+Bangalore',
      likes: 565,
      comments: 768,
      shares: 45,
      popularPhotos: [1, 2, 3],
    },
    {
      id: 2,
      username: 'ADIL',
      description: 'Delicious food at a great location.',
      rating: 4.7,
      ratingLabel: 'Very Good Food',
      location: '2nd Road, Bangalore',
      mapsUrl: 'https://maps.google.com/?q=2nd+Road+Bangalore',
      likes: 432,
      comments: 654,
      shares: 32,
      popularPhotos: [1, 2, 3, 4],
    },
    {
      id: 3,
      username: 'SARAH',
      description: 'Perfect dinner spot with amazing ambiance.',
      rating: 4.9,
      ratingLabel: 'Excellent Food',
      location: 'MG Road, Mumbai',
      mapsUrl: 'https://maps.google.com/?q=MG+Road+Mumbai',
      likes: 892,
      comments: 923,
      shares: 76,
      popularPhotos: [1, 2, 3],
    },
  ];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Cofau</Text>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* User Header Section */}
        <View style={styles.userSection}>
          <View style={styles.userHeader}>
            <View style={styles.avatarLarge}>
              <Ionicons name="person" size={32} color="#FFF" />
            </View>
            <View style={styles.userInfo}>
              <View style={styles.levelRow}>
                <Text style={styles.levelText}>Level 3</Text>
              </View>
              <RatingBar current={85} total={100} label="" />
            </View>
          </View>
        </View>

        {/* Reviewer Circles */}
        <View style={styles.reviewerSection}>
          <ReviewerCircles reviewers={reviewers} />
        </View>

        {/* Feed Cards */}
        {feedPosts.map((post) => (
          <FeedCard key={post.id} post={post} />
        ))}

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Bottom Navigation */}
      <View style={styles.bottomNav}>
        <TouchableOpacity
          style={styles.navButton}
          onPress={() => router.push('/feed')}
        >
          <Ionicons name="home" size={24} color="#666" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.navButton}
          onPress={() => router.push('/search')}
        >
          <Ionicons name="search" size={24} color="#666" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.navButton}
          onPress={() => router.push('/add-post')}
        >
          <Ionicons name="add-circle" size={24} color="#666" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.navButton}
          onPress={() => router.push('/chat')}
        >
          <Ionicons name="chatbubble" size={24} color="#666" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.navButton}
          onPress={() => router.push('/profile')}
        >
          <Ionicons name="person" size={24} color="#666" />
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
    backgroundColor: '#3B5998',
    paddingVertical: 16,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFF',
  },
  scrollView: {
    flex: 1,
  },
  userSection: {
    backgroundColor: '#FFF',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  userHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarLarge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#66D9E8',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  userInfo: {
    flex: 1,
  },
  levelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  levelText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  reviewerSection: {
    backgroundColor: '#FFFEF0',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
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
  },
  navButton: {
    padding: 8,
  },
});