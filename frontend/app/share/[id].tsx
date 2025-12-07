// app/share/[id].tsx
// Public share page for posts - returns HTML with Open Graph tags for social media previews

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Head } from 'expo-router/head';
import axios from 'axios';
import { Image } from 'expo-image';
import { normalizeMediaUrl, normalizeProfilePicture, BACKEND_URL } from '../../utils/imageUrlFix';

const API_URL = `${BACKEND_URL}/api`;

interface Post {
  id: string;
  username: string;
  review_text?: string;
  description?: string;
  rating?: number;
  location_name?: string;
  media_url?: string;
  image_url?: string;
  user_profile_picture?: string;
  created_at?: string;
}

export default function SharePage() {
  const { id } = useLocalSearchParams();
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPost();
  }, [id]);

  const fetchPost = async () => {
    try {
      setLoading(true);
      setError(null);

      let response;

      // Try public post endpoint
      try {
        response = await axios.get(`${API_URL}/posts/${id}`);
      } catch (e: any) {
        // Fallback — use feed and locate post
        const feedResponse = await axios.get(`${API_URL}/feed?limit=100&skip=0`);
        const foundPost = feedResponse.data.find((p: Post) => p.id === id);

        if (foundPost) response = { data: foundPost };
        else throw new Error('Post not found');
      }

      setPost(response.data);
    } catch (err: any) {
      setError('Post not found');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Head>
          <title>Loading… | Cofau</title>
        </Head>
        <ActivityIndicator size="large" color="#4dd0e1" />
        <Text style={styles.loadingText}>Loading post...</Text>
      </View>
    );
  }

  if (error || !post) {
    return (
      <View style={styles.container}>
        <Head>
          <title>Post Not Found | Cofau</title>
        </Head>
        <Text style={styles.errorText}>{error || 'Post not found'}</Text>
        <Text style={styles.errorSubtext}>This post may have been deleted or is not available.</Text>
      </View>
    );
  }

  // ============================================================
  // PREPARE OG TAG DATA
  // ============================================================

  const imageUrl = normalizeMediaUrl(post.media_url || post.image_url);
  const profilePic = normalizeProfilePicture(post.user_profile_picture);
  const description = post.review_text || post.description || '';

  // OPTION C: Your chosen OG format
  const ogTitle = `⭐ ${post.rating}/10 · 📍 ${post.location_name || ''} — ${post.username}'s Cofau Review`;
  const ogDescription = `${description} · 📍 ${post.location_name || ''}`;

  const frontendUrl =
    Platform.OS === 'web' && typeof window !== 'undefined'
      ? `${window.location.protocol}//${window.location.host}`
      : 'https://cofau.com';

  const fullShareUrl = `${frontendUrl}/share/${id}`;

  // ============================================================
  // RENDER SHARE PAGE
  // ============================================================

  return (
    <View style={styles.container}>
      <Head>
        {/* Browser Title */}
        <title>{ogTitle}</title>

        {/* Description */}
        <meta name="description" content={ogDescription} />

        {/* OPEN GRAPH TAGS */}
        <meta property="og:title" content={ogTitle} />
        <meta property="og:description" content={ogDescription} />
        <meta property="og:type" content="article" />
        <meta property="og:url" content={fullShareUrl} />

        {imageUrl && <meta property="og:image" content={imageUrl} />}
        {imageUrl && <meta property="og:image:width" content="1200" />}
        {imageUrl && <meta property="og:image:height" content="630" />}
        <meta property="og:image:type" content="image/jpeg" />
        <meta property="og:site_name" content="Cofau" />

        {/* TWITTER CARD */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={ogTitle} />
        <meta name="twitter:description" content={ogDescription} />
        {imageUrl && <meta name="twitter:image" content={imageUrl} />}

        {/* Required */}
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta httpEquiv="Content-Type" content="text/html; charset=utf-8" />
      </Head>

      {/* WEB PREVIEW BOX */}
      {Platform.OS === 'web' && (
        <View style={styles.webContainer}>
          <View style={styles.postCard}>
            {imageUrl && (
              <Image source={{ uri: imageUrl }} style={styles.postImage} contentFit="cover" />
            )}

            <View style={styles.postContent}>
              <View style={styles.userInfo}>
                {profilePic && (
                  <Image source={{ uri: profilePic }} style={styles.avatar} contentFit="cover" />
                )}
                <Text style={styles.username}>{post.username}</Text>
              </View>

              {description && <Text style={styles.description}>{description}</Text>}

              {post.rating && (
                <View style={styles.ratingRow}>
                  <Text style={styles.ratingLabel}>Rating:</Text>
                  <Text style={styles.ratingValue}>{post.rating}/10</Text>
                </View>
              )}

              {post.location_name && (
                <View style={styles.locationRow}>
                  <Text style={styles.locationLabel}>📍</Text>
                  <Text style={styles.locationText}>{post.location_name}</Text>
                </View>
              )}

              <View style={styles.ctaContainer}>
                <Text style={styles.ctaText}>View this post and more on the Cofau app!</Text>
                <Text style={styles.ctaSubtext}>
                  Download Cofau to discover amazing places and share your experiences.
                </Text>
              </View>
            </View>
          </View>
        </View>
      )}

      {/* MOBILE DEVICE VIEW */}
      {Platform.OS !== 'web' && (
        <View style={styles.mobileContainer}>
          <Text style={styles.mobileText}>Opening in Cofau app...</Text>
          <ActivityIndicator size="large" color="#4dd0e1" style={{ marginTop: 20 }} />
        </View>
      )}
    </View>
  );
}

// ============================================================
// STYLES
// ============================================================

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center' },

  loadingText: { marginTop: 16, fontSize: 16, color: '#666' },

  errorText: { fontSize: 18, fontWeight: '600', color: '#333', marginBottom: 8 },
  errorSubtext: { fontSize: 14, color: '#666', textAlign: 'center', paddingHorizontal: 32 },

  webContainer: { width: '100%', maxWidth: 600, padding: 20 },

  postCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },

  postImage: { width: '100%', height: 400, backgroundColor: '#f0f0f0' },

  postContent: { padding: 20 },

  userInfo: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },

  avatar: { width: 48, height: 48, borderRadius: 24, marginRight: 12 },

  username: { fontSize: 18, fontWeight: '600', color: '#333' },

  description: { fontSize: 16, color: '#333', lineHeight: 24, marginBottom: 12 },

  ratingRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  ratingLabel: { fontSize: 14, color: '#666', marginRight: 8 },
  ratingValue: { fontSize: 16, fontWeight: '600', color: '#FFD700' },

  locationRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  locationLabel: { fontSize: 16, marginRight: 8 },
  locationText: { fontSize: 14, color: '#4ECDC4', fontWeight: '500' },

  ctaContainer: { marginTop: 20, padding: 16, backgroundColor: '#E8F9FA', borderRadius: 8 },
  ctaText: { fontSize: 16, fontWeight: '600', color: '#333', marginBottom: 8 },
  ctaSubtext: { fontSize: 14, color: '#666' },

  mobileContainer: { padding: 32, alignItems: 'center' },
  mobileText: { fontSize: 16, color: '#666' },
});

export {};
