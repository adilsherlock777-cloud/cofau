import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
  ActivityIndicator,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import axios from 'axios';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://api.cofau.com';

interface MenuUploadModalProps {
  visible: boolean;
  onClose: () => void;
  token: string;
  onSuccess: () => void;
}

interface ExtractedItem {
  id: string;
  name: string;
  price: number | null;
  category: string | null;
  description: string | null;
  confidence: number;
  needs_review: boolean;
  status?: string;
  image_url?: string;
  extraction_id?: string;
  created_at?: string;
  updated_at?: string;
}

export const MenuUploadModal: React.FC<MenuUploadModalProps> = ({
  visible,
  onClose,
  token,
  onSuccess,
}) => {
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [extractedItems, setExtractedItems] = useState<ExtractedItem[]>([]);
  const [showReview, setShowReview] = useState(false);
  const [editingItem, setEditingItem] = useState<ExtractedItem | null>(null);

  // Debug: Monitor visibility changes
  React.useEffect(() => {
  }, [visible, token]);

  // Debug: Component render

  const pickImages = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'We need camera roll permissions to upload menu images.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets) {
      const imageUris = result.assets.map((asset) => asset.uri);
      setSelectedImages(imageUris);
    }
  };

  const uploadMenuImages = async () => {
    if (selectedImages.length === 0) {
      Alert.alert('No Images', 'Please select at least one menu image to upload.');
      return;
    }

    setUploading(true);
    setExtracting(true);

    try {
      const formData = new FormData();

      selectedImages.forEach((uri, index) => {
        const filename = uri.split('/').pop() || `menu_${index}.jpg`;
        const match = /\.(\w+)$/.exec(filename);
        const type = match ? `image/${match[1]}` : 'image/jpeg';

        formData.append('files', {
          uri,
          name: filename,
          type,
        } as any);
      });

      const response = await axios.post(
        `${BACKEND_URL}/api/restaurant/menu/upload`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      setExtractedItems(response.data.items || []);
      setShowReview(true);

      Alert.alert(
        'Success!',
        `Extracted ${response.data.total_items} items. ${response.data.needs_review_count} items need review.`,
        [{ text: 'Review Items', onPress: () => {} }]
      );
    } catch (error: any) {
      console.error('❌ Error uploading menu:', error.response?.data || error.message);
      Alert.alert(
        'Upload Failed',
        error.response?.data?.detail || 'Failed to upload menu images. Please try again.'
      );
    } finally {
      setUploading(false);
      setExtracting(false);
    }
  };

  const updateMenuItem = async (item: ExtractedItem) => {
    try {
      const response = await axios.put(
        `${BACKEND_URL}/api/restaurant/menu/items/${item.id}`,
        {
          name: item.name,
          price: item.price,
          category: item.category,
          description: item.description,
          needs_review: false,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      // Update local state with the response from backend
      setExtractedItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...response.data, needs_review: false } : i))
      );
      setEditingItem(null);
      Alert.alert('Success', 'Item updated successfully!');
    } catch (error: any) {
      console.error('❌ Error updating item:', error);
      Alert.alert('Error', 'Failed to update item. Please try again.');
    }
  };

  const publishAllItems = async () => {
    try {
      setUploading(true);
      await axios.post(
        `${BACKEND_URL}/api/restaurant/menu/publish-all`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      Alert.alert('Success!', 'Menu published successfully!', [
        {
          text: 'OK',
          onPress: () => {
            onSuccess();
            resetModal();
          },
        },
      ]);
    } catch (error: any) {
      console.error('❌ Error publishing menu:', error);
      Alert.alert('Error', 'Failed to publish menu. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const resetModal = () => {
    setSelectedImages([]);
    setExtractedItems([]);
    setShowReview(false);
    setEditingItem(null);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={resetModal}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={resetModal} style={styles.closeButton}>
            <Ionicons name="close" size={28} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {showReview ? 'Review Menu Items' : 'Upload Menu'}
          </Text>
          <View style={{ width: 28 }} />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {!showReview ? (
            /* Upload Screen */
            <>
              <View style={styles.infoCard}>
                <Ionicons name="information-circle" size={24} color="#FF8C00" />
                <Text style={styles.infoText}>
                  Upload photos of your menu and AI will automatically extract dish names, prices,
                  and categories!
                </Text>
              </View>

              {/* Image Picker */}
              <TouchableOpacity style={styles.uploadButton} onPress={pickImages}>
                <Ionicons name="images-outline" size={32} color="#FF8C00" />
                <Text style={styles.uploadButtonText}>Select Menu Photos</Text>
                <Text style={styles.uploadButtonSubtext}>
                  You can select multiple images
                </Text>
              </TouchableOpacity>

              {/* Selected Images Preview */}
              {selectedImages.length > 0 && (
                <View style={styles.imagesPreview}>
                  <Text style={styles.sectionTitle}>
                    Selected Images ({selectedImages.length})
                  </Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {selectedImages.map((uri, index) => (
                      <View key={index} style={styles.imagePreviewContainer}>
                        <Image source={{ uri }} style={styles.imagePreview} />
                        <TouchableOpacity
                          style={styles.removeImageButton}
                          onPress={() =>
                            setSelectedImages((prev) => prev.filter((_, i) => i !== index))
                          }
                        >
                          <Ionicons name="close-circle" size={24} color="#FF3B30" />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </ScrollView>
                </View>
              )}

              {/* Upload Button */}
              {selectedImages.length > 0 && (
                <TouchableOpacity
                  style={[styles.extractButton, uploading && styles.extractButtonDisabled]}
                  onPress={uploadMenuImages}
                  disabled={uploading}
                >
                  {uploading ? (
                    <>
                      <ActivityIndicator size="small" color="#FFF" />
                      <Text style={styles.extractButtonText}>
                        {extracting ? 'Extracting menu items...' : 'Uploading...'}
                      </Text>
                    </>
                  ) : (
                    <>
                      <Ionicons name="cloud-upload" size={20} color="#FFF" />
                      <Text style={styles.extractButtonText}>Upload & Extract Menu</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </>
          ) : (
            /* Review Screen */
            <>
              <View style={styles.statsCard}>
                <View style={styles.statItem}>
                  <Text style={styles.statNumber}>{extractedItems.length}</Text>
                  <Text style={styles.statLabel}>Total Items</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statNumber}>
                    {extractedItems.filter((i) => i.needs_review).length}
                  </Text>
                  <Text style={styles.statLabel}>Need Review</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statNumber}>
                    {new Set(extractedItems.map((i) => i.category)).size}
                  </Text>
                  <Text style={styles.statLabel}>Categories</Text>
                </View>
              </View>

              {/* Extracted Items List */}
              {extractedItems.map((item, index) => (
                <View
                  key={index}
                  style={[styles.itemCard, item.needs_review && styles.itemCardNeedsReview]}
                >
                  <View style={styles.itemHeader}>
                    <Text style={styles.itemName}>{item.name}</Text>
                    {item.needs_review && (
                      <View style={styles.needsReviewBadge}>
                        <Ionicons name="alert-circle" size={16} color="#FF9800" />
                        <Text style={styles.needsReviewText}>Review</Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.itemDetails}>
                    <Text style={styles.itemDetailLabel}>Price:</Text>
                    <Text style={styles.itemDetailValue}>
                      {item.price ? `₹${item.price}` : 'Not specified'}
                    </Text>
                  </View>

                  <View style={styles.itemDetails}>
                    <Text style={styles.itemDetailLabel}>Category:</Text>
                    <Text style={styles.itemDetailValue}>
                      {item.category || 'Uncategorized'}
                    </Text>
                  </View>

                  {item.description && (
                    <View style={styles.itemDetails}>
                      <Text style={styles.itemDetailLabel}>Description:</Text>
                      <Text style={styles.itemDescription}>{item.description}</Text>
                    </View>
                  )}

                  <View style={styles.itemDetails}>
                    <Text style={styles.itemDetailLabel}>Confidence:</Text>
                    <View style={styles.confidenceBar}>
                      <View
                        style={[
                          styles.confidenceFill,
                          { width: `${item.confidence * 100}%` },
                        ]}
                      />
                    </View>
                    <Text style={styles.confidenceText}>{Math.round(item.confidence * 100)}%</Text>
                  </View>

                  <TouchableOpacity
                    style={styles.editButton}
                    onPress={() => setEditingItem(item)}
                  >
                    <Ionicons name="create-outline" size={18} color="#FF8C00" />
                    <Text style={styles.editButtonText}>Edit</Text>
                  </TouchableOpacity>
                </View>
              ))}

              {/* Publish Button */}
              <TouchableOpacity
                style={[styles.publishButton, uploading && styles.publishButtonDisabled]}
                onPress={publishAllItems}
                disabled={uploading}
              >
                {uploading ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle" size={20} color="#FFF" />
                    <Text style={styles.publishButtonText}>Publish Menu</Text>
                  </>
                )}
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </View>

      {/* Edit Item Modal */}
      {editingItem && (
        <Modal visible={true} animationType="slide" transparent>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.editModalOverlay}
          >
            <TouchableOpacity
              style={styles.editModalOverlay}
              activeOpacity={1}
              onPress={() => setEditingItem(null)}
            >
              <TouchableOpacity
                activeOpacity={1}
                onPress={(e) => e.stopPropagation()}
                style={styles.editModalContent}
              >
                <ScrollView
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                >
                  <Text style={styles.editModalTitle}>Edit Menu Item</Text>

                  <TextInput
                    style={styles.input}
                    value={editingItem.name}
                    onChangeText={(text) => setEditingItem({ ...editingItem, name: text })}
                    placeholder="Dish Name"
                    placeholderTextColor="#999"
                  />

                  <TextInput
                    style={styles.input}
                    value={editingItem.price?.toString() || ''}
                    onChangeText={(text) =>
                      setEditingItem({ ...editingItem, price: parseFloat(text) || null })
                    }
                    placeholder="Price (₹)"
                    keyboardType="numeric"
                    placeholderTextColor="#999"
                  />

                  <TextInput
                    style={styles.input}
                    value={editingItem.category || ''}
                    onChangeText={(text) => setEditingItem({ ...editingItem, category: text })}
                    placeholder="Category"
                    placeholderTextColor="#999"
                  />

                  <TextInput
                    style={[styles.input, styles.textArea]}
                    value={editingItem.description || ''}
                    onChangeText={(text) => setEditingItem({ ...editingItem, description: text })}
                    placeholder="Description (optional)"
                    multiline
                    numberOfLines={3}
                    placeholderTextColor="#999"
                    textAlignVertical="top"
                  />

                  <View style={styles.editModalButtons}>
                    <TouchableOpacity
                      style={styles.cancelButton}
                      onPress={() => setEditingItem(null)}
                    >
                      <Text style={styles.cancelButtonText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.saveButton}
                      onPress={() => updateMenuItem(editingItem)}
                    >
                      <Text style={styles.saveButtonText}>Save</Text>
                    </TouchableOpacity>
                  </View>
                </ScrollView>
              </TouchableOpacity>
            </TouchableOpacity>
          </KeyboardAvoidingView>
        </Modal>
      )}
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    paddingTop: 50,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  closeButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: '#FFF9E6',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
    gap: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  uploadButton: {
    backgroundColor: '#FFF',
    padding: 32,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FF8C00',
    borderStyle: 'dashed',
    marginBottom: 24,
  },
  uploadButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FF8C00',
    marginTop: 12,
  },
  uploadButtonSubtext: {
    fontSize: 13,
    color: '#999',
    marginTop: 4,
  },
  imagesPreview: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 12,
  },
  imagePreviewContainer: {
    marginRight: 12,
    position: 'relative',
  },
  imagePreview: {
    width: 120,
    height: 120,
    borderRadius: 12,
    backgroundColor: '#F0F0F0',
  },
  removeImageButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#FFF',
    borderRadius: 12,
  },
  extractButton: {
    backgroundColor: '#FF8C00',
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  extractButtonDisabled: {
    opacity: 0.6,
  },
  extractButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
  statsCard: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FF8C00',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  itemCard: {
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  itemCardNeedsReview: {
    borderColor: '#FF9800',
    backgroundColor: '#FFF9E6',
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A1A',
    flex: 1,
  },
  needsReviewBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFE4A0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  needsReviewText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FF9800',
  },
  itemDetails: {
    flexDirection: 'row',
    marginBottom: 8,
    alignItems: 'center',
  },
  itemDetailLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
    width: 90,
  },
  itemDetailValue: {
    fontSize: 13,
    color: '#1A1A1A',
    flex: 1,
  },
  itemDescription: {
    fontSize: 13,
    color: '#666',
    flex: 1,
    lineHeight: 18,
  },
  confidenceBar: {
    flex: 1,
    height: 6,
    backgroundColor: '#E0E0E0',
    borderRadius: 3,
    overflow: 'hidden',
    marginRight: 8,
  },
  confidenceFill: {
    height: '100%',
    backgroundColor: '#4CAF50',
  },
  confidenceText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4CAF50',
    width: 40,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    paddingVertical: 8,
    gap: 6,
  },
  editButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FF8C00',
  },
  publishButton: {
    backgroundColor: '#4CAF50',
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    marginBottom: 32,
  },
  publishButtonDisabled: {
    opacity: 0.6,
  },
  publishButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
  editModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  editModalContent: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  editModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 20,
    textAlign: 'center',
  },
  input: {
    backgroundColor: '#F5F5F5',
    padding: 14,
    borderRadius: 10,
    fontSize: 15,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  editModalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  cancelButton: {
    flex: 1,
    padding: 14,
    borderRadius: 10,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#666',
  },
  saveButton: {
    flex: 1,
    padding: 14,
    borderRadius: 10,
    backgroundColor: '#FF8C00',
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFF',
  },
});
