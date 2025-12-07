// app/story/create.tsx
import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TextInput,
  TouchableOpacity,
  Alert,
  ScrollView,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { BACKEND_URL } from '../../utils/imageUrlFix';

export default function CreateStory() {
  const router = useRouter();
  const params = useLocalSearchParams();

  // Media from the post
  const mediaUrl = useMemo(() => params.mediaUrl || params.imageUrl, [params]);

  // Default caption from the post
  const [caption, setCaption] = useState(
    `${params.review || ''}\nRating: ${params.rating}/10\n📍 ${params.location || ''}`
  );

  // ============================
  // POST STORY TO BACKEND
  // ============================
  async function handlePostStory() {
    try {
      if (!params.postId) {
        Alert.alert("Error", "Missing post ID.");
        return;
      }

      if (!params.token) {
        Alert.alert("Error", "User authentication token missing.");
        return;
      }

      const response = await fetch(`${BACKEND_URL}/api/stories/from-post`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${params.token}`, // MUST be provided from ShareModal
        },
        body: JSON.stringify({
          post_id: params.postId,
          caption,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Failed to create story");
      }

      Alert.alert("Success", "Your story has been posted!", [
        { text: "OK", onPress: () => router.back() },
      ]);

    } catch (error) {
      console.error("❌ Error posting story:", error);
      Alert.alert("Error", error.message || "Unable to post story.");
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={28} color="#333" />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Create Story</Text>

        <View style={{ width: 28 }} />
      </View>

      {/* Story Preview */}
      <View style={styles.storyPreview}>
        {mediaUrl ? (
          <Image source={{ uri: mediaUrl }} style={styles.storyImage} />
        ) : (
          <View style={styles.placeholderBox}>
            <Text style={styles.placeholderText}>No Image</Text>
          </View>
        )}
      </View>

      {/* Caption Input */}
      <Text style={styles.sectionLabel}>Caption</Text>
      <TextInput
        style={styles.captionInput}
        multiline
        value={caption}
        onChangeText={setCaption}
      />

      {/* Post Button */}
      <TouchableOpacity style={styles.postButton} onPress={handlePostStory}>
        <Text style={styles.postButtonText}>Post Story</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#FFF',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '600',
  },
  storyPreview: {
    width: '100%',
    height: 400,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#EEE',
    marginBottom: 20,
  },
  storyImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  placeholderBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    color: '#666',
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  captionInput: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    padding: 12,
    minHeight: 120,
    fontSize: 14,
    textAlignVertical: 'top',
    marginBottom: 20,
  },
  postButton: {
    backgroundColor: '#4dd0e1',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  postButtonText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '600',
  },
});
