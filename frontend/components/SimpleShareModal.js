import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Modal,
    Alert,
    ActivityIndicator,
    Dimensions,
    Share as RNShare,
    Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Video } from 'expo-av';
// Using native Share API which supports URL previews
import { normalizeMediaUrl, BACKEND_URL } from '../utils/imageUrlFix';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function SimpleShareModal({ visible, onClose, post }) {
    const [loading, setLoading] = useState(false);
    const [sharingPlatform, setSharingPlatform] = useState(null);

    if (!post) return null;

    const mediaUrl = normalizeMediaUrl(post.media_url || post.image_url);
    const thumbnailUrl = post.thumbnail_url ? normalizeMediaUrl(post.thumbnail_url) : null;
    const isVideo = post.media_type === 'video' || mediaUrl?.toLowerCase().endsWith('.mp4');
    const shareUrl = `${BACKEND_URL}/share/${post.id}`;


    // Share to WhatsApp
    const shareToWhatsApp = async () => {
        try {
            setLoading(true);
            setSharingPlatform('whatsapp');

            // Build message with details
            let message = `📷 ${post.username || 'User'} shared a post on Cofau!\n\n`;
            if (post.review_text) {
                message += `${post.review_text}\n\n`;
            }
            if (post.rating) {
                message += `⭐ Rating: ${post.rating}/10\n`;
            }
            if (post.location_name) {
                message += `📍 Location: ${post.location_name}\n`;
            }
            message += `\nView on Cofau: ${shareUrl}`;

            // Share with share URL - WhatsApp will fetch Open Graph meta tags for large preview
            // The backend /share/{post_id} endpoint provides optimized OG tags with 1920x1080 dimensions
            const shareContent = {
                message: message,
                url: shareUrl, // Use share URL which has Open Graph meta tags for large preview
                title: `${post.username} shared a post on Cofau`,
            };

            await RNShare.share(shareContent);

            onClose();
        } catch (error) {
            console.error('WhatsApp share error:', error);
            Alert.alert('Error', 'Failed to share to WhatsApp');
        } finally {
            setLoading(false);
            setSharingPlatform(null);
        }
    };

    // Share to Instagram
    const shareToInstagram = async () => {
        try {
            setLoading(true);
            setSharingPlatform('instagram');

            // Build message with details
            let message = `📷 ${post.username || 'User'} shared a post on Cofau!\n\n`;
            if (post.review_text) {
                message += `${post.review_text}\n\n`;
            }
            if (post.rating) {
                message += `⭐ Rating: ${post.rating}/10\n`;
            }
            if (post.location_name) {
                message += `📍 Location: ${post.location_name}\n`;
            }
            message += `\nView on Cofau: ${shareUrl}`;

            // Share with share URL - Instagram will fetch Open Graph meta tags for large preview
            // The backend /share/{post_id} endpoint provides optimized OG tags with 1920x1080 dimensions
            const shareContent = {
                message: message,
                url: shareUrl, // Use share URL which has Open Graph meta tags for large preview
                title: `${post.username} shared a post on Cofau`,
            };

            await RNShare.share(shareContent);

            onClose();
        } catch (error) {
            console.error('Instagram share error:', error);
            Alert.alert('Error', 'Failed to share to Instagram');
        } finally {
            setLoading(false);
            setSharingPlatform(null);
        }
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={onClose}
        >
            <TouchableOpacity
                style={styles.modalOverlay}
                activeOpacity={1}
                onPress={onClose}
            >
                <TouchableOpacity
                    style={styles.modalCard}
                    activeOpacity={1}
                    onPress={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>Share Post</Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <Ionicons name="close" size={24} color="#333" />
                        </TouchableOpacity>
                    </View>

                    {/* Post Preview */}
                    <View style={styles.postPreview}>
                        {/* Post Image/Video */}
                        <View style={styles.imageContainer}>
                            {isVideo ? (
                                <Video
                                    source={{ uri: thumbnailUrl || mediaUrl }}
                                    style={styles.postMedia}
                                    resizeMode="cover"
                                    useNativeControls={false}
                                    isLooping={false}
                                    shouldPlay={false}
                                />
                            ) : (
                                <Image
                                    source={{ uri: mediaUrl }}
                                    style={styles.postMedia}
                                    contentFit="cover"
                                />
                            )}
                        </View>

                        {/* Post Details */}
                        <View style={styles.postInfo}>
                            {post.rating && (
                                <View style={styles.infoRow}>
                                    <Ionicons name="star" size={18} color="#FFD700" />
                                    <Text style={styles.infoText}>Rating: {post.rating}/10</Text>
                                </View>
                            )}

                            {post.location_name && (
                                <View style={styles.infoRow}>
                                    <Ionicons name="location" size={18} color="#FF6B6B" />
                                    <Text style={styles.infoText}>{post.location_name}</Text>
                                </View>
                            )}

                            {post.review_text && (
                                <Text style={styles.reviewText} numberOfLines={3}>
                                    {post.review_text}
                                </Text>
                            )}

                            <View style={styles.linkRow}>
                                <Ionicons name="link" size={16} color="#999" />
                                <Text style={styles.linkText}>View on Cofau: {shareUrl}</Text>
                            </View>
                        </View>
                    </View>

                    {/* Share Options */}
                    <View style={styles.shareOptions}>
                        {/* WhatsApp */}
                        <TouchableOpacity
                            style={[
                                styles.shareOption,
                                sharingPlatform === 'whatsapp' && styles.shareOptionActive,
                            ]}
                            onPress={shareToWhatsApp}
                            disabled={loading}
                        >
                            {loading && sharingPlatform === 'whatsapp' ? (
                                <ActivityIndicator color="#FFF" size="small" />
                            ) : (
                                <>
                                    <View style={[styles.shareIconCircle, { backgroundColor: '#25D366' }]}>
                                        <Ionicons name="logo-whatsapp" size={32} color="#FFF" />
                                    </View>
                                    <Text style={styles.shareLabel}>WhatsApp</Text>
                                </>
                            )}
                        </TouchableOpacity>

                        {/* Instagram */}
                        <TouchableOpacity
                            style={[
                                styles.shareOption,
                                sharingPlatform === 'instagram' && styles.shareOptionActive,
                            ]}
                            onPress={shareToInstagram}
                            disabled={loading}
                        >
                            {loading && sharingPlatform === 'instagram' ? (
                                <ActivityIndicator color="#FFF" size="small" />
                            ) : (
                                <>
                                    <View style={[styles.shareIconCircle, { backgroundColor: '#E4405F' }]}>
                                        <Ionicons name="logo-instagram" size={32} color="#FFF" />
                                    </View>
                                    <Text style={styles.shareLabel}>Instagram</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </TouchableOpacity>
        </Modal>
    );
}

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalCard: {
        backgroundColor: '#FFF',
        borderRadius: 20,
        width: SCREEN_WIDTH * 0.9,
        maxWidth: 400,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '600',
        color: '#333',
    },
    closeButton: {
        padding: 4,
    },
    postPreview: {
        padding: 20,
    },
    imageContainer: {
        borderRadius: 12,
        overflow: 'hidden',
        marginBottom: 16,
        backgroundColor: '#F0F0F0',
    },
    postMedia: {
        width: '100%',
        aspectRatio: 1,
    },
    postInfo: {
        gap: 12,
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    infoText: {
        fontSize: 14,
        color: '#333',
        fontWeight: '500',
    },
    reviewText: {
        fontSize: 14,
        color: '#666',
        lineHeight: 20,
        marginTop: 4,
    },
    linkRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginTop: 4,
    },
    linkText: {
        fontSize: 12,
        color: '#999',
        flex: 1,
    },
    shareOptions: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        padding: 20,
        paddingTop: 10,
        borderTopWidth: 1,
        borderTopColor: '#F0F0F0',
    },
    shareOption: {
        alignItems: 'center',
        gap: 12,
        padding: 12,
        borderRadius: 12,
        minWidth: 100,
    },
    shareOptionActive: {
        backgroundColor: '#F5F5F5',
    },
    shareIconCircle: {
        width: 64,
        height: 64,
        borderRadius: 32,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 4,
    },
    shareLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#333',
    },
});

