import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://api.cofau.com';
const API_URL = `${BACKEND_URL}/api`;
const SCREEN_WIDTH = Dimensions.get('window').width;

export default function RestaurantDashboard() {
  const router = useRouter();
  const { token, user } = useAuth() as any;
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState({
    total_posts: 0,
    followers_count: 0,
    customer_reviews: 0,
    profile_visits: 0,
    search_appearances: 0,
    post_clicks: 0,
    profile_views: 0,
  });

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      
      // TODO: Replace with actual API endpoint when backend is ready
      // const response = await axios.get(`${API_URL}/restaurant/analytics`, {
      //   headers: { Authorization: `Bearer ${token}` }
      // });
      // setAnalytics(response.data);
      
      // Mock data for now - replace with API call later
      setTimeout(() => {
        setAnalytics({
          total_posts: 12,
          followers_count: 248,
          customer_reviews: 45,
          profile_visits: 1520,
          search_appearances: 3200,
          post_clicks: 890,
          profile_views: 2100,
        });
        setLoading(false);
      }, 1000);
      
    } catch (error) {
      console.error('Error fetching analytics:', error);
      setLoading(false);
    }
  };

  const StatCard = ({ 
    icon, 
    label, 
    value, 
    color, 
    subtitle 
  }: { 
    icon: string; 
    label: string; 
    value: number; 
    color: string;
    subtitle?: string;
  }) => (
    <View style={styles.statCard}>
      <View style={[styles.statIconContainer, { backgroundColor: color + '20' }]}>
        <Ionicons name={icon as any} size={24} color={color} />
      </View>
      <Text style={styles.statValue}>{value.toLocaleString()}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      {subtitle && <Text style={styles.statSubtitle}>{subtitle}</Text>}
    </View>
  );

  const LargeStatCard = ({ 
    icon, 
    label, 
    value, 
    color,
    trend,
  }: { 
    icon: string; 
    label: string; 
    value: number; 
    color: string;
    trend?: string;
  }) => (
    <View style={styles.largeStatCard}>
      <View style={styles.largeStatLeft}>
        <View style={[styles.largeStatIconContainer, { backgroundColor: color + '20' }]}>
          <Ionicons name={icon as any} size={28} color={color} />
        </View>
        <View style={styles.largeStatInfo}>
          <Text style={styles.largeStatLabel}>{label}</Text>
          {trend && (
            <View style={styles.trendContainer}>
              <Ionicons name="trending-up" size={14} color="#4CAF50" />
              <Text style={styles.trendText}>{trend}</Text>
            </View>
          )}
        </View>
      </View>
      <Text style={styles.largeStatValue}>{value.toLocaleString()}</Text>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#E94A37" />
        <Text style={styles.loadingText}>Loading analytics...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient
        colors={['#E94A37', '#F2CF68', '#1B7C82']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.header}
      >
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Restaurant Dashboard</Text>
        <TouchableOpacity
          style={styles.refreshButton}
          onPress={fetchAnalytics}
        >
          <Ionicons name="refresh" size={24} color="#fff" />
        </TouchableOpacity>
      </LinearGradient>

      <ScrollView 
        style={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Analytics Header */}
        <View style={styles.analyticsHeader}>
          <Ionicons name="analytics" size={28} color="#E94A37" />
          <Text style={styles.analyticsTitle}>Analytics Overview</Text>
        </View>
        <Text style={styles.analyticsSubtitle}>
          Track your restaurant's performance
        </Text>

        {/* Primary Stats - 3 Column Grid */}
        <View style={styles.sectionTitle}>
          <Ionicons name="stats-chart" size={20} color="#333" />
          <Text style={styles.sectionTitleText}>Key Metrics</Text>
        </View>
        
        <View style={styles.statsGrid}>
          <StatCard
            icon="images"
            label="Total Posts"
            value={analytics.total_posts}
            color="#E94A37"
          />
          <StatCard
            icon="people"
            label="Followers"
            value={analytics.followers_count}
            color="#1B7C82"
          />
          <StatCard
            icon="star"
            label="Reviews"
            value={analytics.customer_reviews}
            color="#F2CF68"
          />
        </View>

        {/* Engagement Stats - Large Cards */}
        <View style={styles.sectionTitle}>
          <Ionicons name="eye" size={20} color="#333" />
          <Text style={styles.sectionTitleText}>Visibility & Engagement</Text>
        </View>

        <LargeStatCard
          icon="eye"
          label="Profile Views"
          value={analytics.profile_views}
          color="#9C27B0"
          trend="+12% this week"
        />

        <LargeStatCard
          icon="footsteps"
          label="Profile Visits"
          value={analytics.profile_visits}
          color="#2196F3"
          trend="+8% this week"
        />

        <LargeStatCard
          icon="search"
          label="Search Appearances"
          value={analytics.search_appearances}
          color="#FF9800"
          trend="+15% this week"
        />

        <LargeStatCard
          icon="hand-left"
          label="Post Clicks"
          value={analytics.post_clicks}
          color="#4CAF50"
          trend="+5% this week"
        />

        {/* Info Card */}
        <View style={styles.infoCard}>
          <Ionicons name="information-circle" size={24} color="#1B7C82" />
          <View style={styles.infoContent}>
            <Text style={styles.infoTitle}>How to improve?</Text>
            <Text style={styles.infoText}>
              Post regularly, respond to reviews, and keep your menu updated to increase visibility and engagement.
            </Text>
          </View>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Bottom Navigation */}
      <View style={styles.navBar}>
        <TouchableOpacity style={styles.navItem} onPress={() => router.push('/feed')}>
          <Ionicons name="home-outline" size={20} color="#000" />
          <Text style={styles.navLabel}>Home</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => router.push('/explore')}>
          <Ionicons name="compass-outline" size={20} color="#000" />
          <Text style={styles.navLabel}>Explore</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.centerNavItem} onPress={() => router.push('/leaderboard')}>
          <View style={styles.centerIconCircle}>
            <Ionicons name="camera" size={22} color="#000" />
          </View>
          <Text style={styles.navLabel}>Top Posts</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => router.push('/happening')}>
          <Ionicons name="location-outline" size={20} color="#000" />
          <Text style={styles.navLabel}>Happening</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => router.push('/profile')}>
          <Ionicons name="person" size={20} color="#000" />
          <Text style={styles.navLabel}>Profile</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 20,
    paddingHorizontal: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  refreshButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    flex: 1,
    paddingHorizontal: 16,
  },
  analyticsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    gap: 10,
  },
  analyticsTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333',
  },
  analyticsSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
    marginBottom: 20,
  },
  sectionTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 12,
    gap: 8,
  },
  sectionTitleText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  statIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '700',
    color: '#333',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  statSubtitle: {
    fontSize: 10,
    color: '#999',
    marginTop: 4,
  },
  largeStatCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  largeStatLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  largeStatIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  largeStatInfo: {
    gap: 4,
  },
  largeStatLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  largeStatValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333',
  },
  trendContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  trendText: {
    fontSize: 12,
    color: '#4CAF50',
    fontWeight: '500',
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: '#E8F5F5',
    borderRadius: 16,
    padding: 16,
    marginTop: 24,
    gap: 12,
    borderWidth: 1,
    borderColor: '#1B7C82',
  },
  infoContent: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1B7C82',
    marginBottom: 4,
  },
  infoText: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
  },
  navBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 8,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#E8E8E8',
    backgroundColor: '#FFFFFF',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  navItem: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  centerNavItem: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginTop: -30,
  },
  centerIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  navLabel: {
    fontSize: 11,
    color: '#000',
    marginTop: 2,
    textAlign: 'center',
    fontWeight: '500',
  },
});