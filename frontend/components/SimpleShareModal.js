import React, { useState, useRef } from 'react';
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
import * as Sharing from 'expo-sharing';
import { captureRef } from 'react-native-view-shot';
import * as MediaLibrary from 'expo-media-library';
import * as Linking from 'expo-linking';
import { normalizeMediaUrl, BACKEND_URL } from '../utils/imageUrlFix';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Story card dimensions (9:16 aspect ratio for Instagram Stories)
const STORY_WIDTH = SCREEN_WIDTH;
const STORY_HEIGHT = STORY_WIDTH * (16 / 9);
const CARD_WIDTH = STORY_WIDTH * 0.88;

// =====================================================
// INSTAGRAM STORY CARD - Beautiful card with blur background
// =====================================================
const InstagramStoryCard = React.forwardRef(({ post }, ref) => {
    const mediaUrl = normalizeMediaUrl(post?.media_url || post?.image_url);

    return (
        <View
            ref={ref}
            style={storyCardStyles.container}
            collapsable={false}
        >
            {/* Blurred Background Image */}
            {mediaUrl && (
                <Image
                    source={{ uri: mediaUrl }}
                    style={storyCardStyles.blurredBackground}
                    contentFit="cover"
                    blurRadius={30}
                />
            )}

            {/* Dark Overlay for better contrast */}
            <View style={storyCardStyles.darkOverlay} />

            {/* Main Card */}
            <View style={storyCardStyles.card}>
                {/* Food Image with Cofau Watermark */}
                <View style={storyCardStyles.imageWrapper}>
                    {mediaUrl ? (
                        <Image
                            source={{ uri: mediaUrl }}
                            style={storyCardStyles.foodImage}
                            contentFit="cover"
                        />
                    ) : (
                        <View style={storyCardStyles.placeholderImage}>
                            <Ionicons name="image-outline" size={60} color="#ccc" />
                        </View>
                    )}

                    {/* Cofau Watermark on Image */}
                    <View style={storyCardStyles.watermarkContainer}>
                        <Text style={storyCardStyles.watermarkText}>Cofau</Text>
                    </View>
                </View>

                {/* Three Info Boxes */}
                <View style={storyCardStyles.infoBoxesContainer}>
                    {/* Rating Box */}
                    <View style={storyCardStyles.infoBox}>
                        <Ionicons name="star" size={22} color="#FFD700" />
                        <Text style={storyCardStyles.infoBoxLabel}>Rating</Text>
                        <Text style={storyCardStyles.infoBoxValue}>
                            {post?.rating ? `${post.rating}/10` : '-'}
                        </Text>
                    </View>

                    {/* Divider */}
                    <View style={storyCardStyles.divider} />

                    {/* Review Box */}
                    <View style={[storyCardStyles.infoBox, storyCardStyles.reviewBox]}>
                        <Ionicons name="create" size={22} color="#1B7C82" />
                        <Text style={storyCardStyles.infoBoxLabel}>Review</Text>
                        <Text style={storyCardStyles.infoBoxValue}>
                            {post?.review_text || post?.description || '-'}
                        </Text>
                    </View>

                    {/* Divider */}
                    <View style={storyCardStyles.divider} />

                    {/* Location Box */}
                    <View style={storyCardStyles.infoBox}>
                        <Ionicons name="location" size={22} color="#E53935" />
                        <Text style={storyCardStyles.infoBoxLabel}>Location</Text>
                        <Text style={storyCardStyles.infoBoxValue}>
                            {post?.location_name || '-'}
                        </Text>
                    </View>
                </View>
            </View>
        </View>
    );
});

// =====================================================
// STORY CARD STYLES
// =====================================================
const storyCardStyles = StyleSheet.create({
    container: {
        width: STORY_WIDTH,
        height: STORY_HEIGHT,
        position: 'absolute',
        left: -9999,
        top: 0,
        backgroundColor: '#000',
    },
    blurredBackground: {
        position: 'absolute',
        width: '100%',
        height: '100%',
    },
    darkOverlay: {
        position: 'absolute',
        width: '100%',
        height: '100%',
        backgroundColor: 'rgba(0, 0, 0, 0.35)',
    },
    card: {
        position: 'absolute',
        top: '10%',
        left: (STORY_WIDTH - CARD_WIDTH) / 2,
        width: CARD_WIDTH,
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.5,
        shadowRadius: 20,
        elevation: 15,
    },
    imageWrapper: {
        width: '100%',
        aspectRatio: 1,
        position: 'relative',
    },
    foodImage: {
        width: '100%',
        height: '100%',
    },
    placeholderImage: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#E0E0E0',
    },
    watermarkContainer: {
        position: 'absolute',
        bottom: 16,
        right: 16,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 12,
    },
    watermarkText: {
        fontSize: 22,
        fontWeight: '700',
        color: '#FFFFFF',
        fontStyle: 'italic',
        letterSpacing: 1,
        // If you have Lobster font loaded, use:
        // fontFamily: 'Lobster_400Regular',
    },
    infoBoxesContainer: {
        flexDirection: 'row',
        paddingVertical: 20,
        paddingHorizontal: 12,
        backgroundColor: '#FFFFFF',
    },
    infoBox: {
        flex: 1,
        alignItems: 'center',
        paddingHorizontal: 6,
    },
    reviewBox: {
        flex: 1.4,
    },
    infoBoxLabel: {
        fontSize: 11,
        fontWeight: '700',
        color: '#999',
        marginTop: 6,
        textTransform: 'uppercase',
        letterSpacing: 0.8,
    },
    infoBoxValue: {
        fontSize: 13,
        fontWeight: '600',
        color: '#333',
        marginTop: 4,
        textAlign: 'center',
        lineHeight: 18,
    },
    divider: {
        width: 1,
        backgroundColor: '#E8E8E8',
        marginVertical: 8,
    },
});

// =====================================================
// MAIN COMPONENT
// =====================================================
export default function SimpleShareModal({ visible, onClose, post }) {
    const [loading, setLoading] = useState(false);
    const [sharingPlatform, setSharingPlatform] = useState(null);
    const storyCardRef = useRef(null);

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

            const shareContent = {
                message: message,
                url: shareUrl,
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

    // Share to Instagram Story - via Share Sheet
    const shareToInstagramStory = async () => {
        try {
            setLoading(true);
            setSharingPlatform('instagram-story');

            // Step 1: Capture the story card as an image
            const uri = await captureRef(storyCardRef, {
                format: 'png',
                quality: 1,
                result: 'tmpfile',
            });

            // Step 2: Save to camera roll
            const { status } = await MediaLibrary.requestPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission Required', 'Please allow access to save images.');
                return;
            }

            await MediaLibrary.createAssetAsync(uri);

            // Step 3: Open share sheet
            await Sharing.shareAsync(uri, {
                mimeType: 'image/png',
                dialogTitle: 'Share to Instagram Story',
                UTI: 'public.png',
            });

            onClose();
        } catch (error) {
            console.error('Instagram Story share error:', error);
            Alert.alert('Error', 'Failed to create story image. Please try again.');
        } finally {
            setLoading(false);
            setSharingPlatform(null);
        }
    };

    // Share to Instagram (general - via share sheet)
    const shareToInstagram = async () => {
        try {
            setLoading(true);
            setSharingPlatform('instagram');

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

            const shareContent = {
                message: message,
                url: shareUrl,
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
                    {/* Hidden Story Card for Instagram */}
                    <InstagramStoryCard ref={storyCardRef} post={post} />

                    {/* Header */}
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>Share Post</Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <Ionicons name="close" size={24} color="#333" />
                        </TouchableOpacity>
                    </View>

                    {/* Post Preview */}
                    <View style={styles.postPreview}>
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
                        {/* Instagram Story */}
                        <TouchableOpacity
                            style={[
                                styles.shareOption,
                                sharingPlatform === 'instagram-story' && styles.shareOptionActive,
                            ]}
                            onPress={shareToInstagramStory}
                            disabled={loading}
                        >
                            {loading && sharingPlatform === 'instagram-story' ? (
                                <ActivityIndicator color="#E1306C" size="small" />
                            ) : (
                                <>
                                    <View style={[styles.shareIconCircle, { backgroundColor: '#E1306C' }]}>
                                        <Ionicons name="add-circle" size={32} color="#FFF" />
                                    </View>
                                    <Text style={styles.shareLabel}>Instagram{'\n'}Story</Text>
                                </>
                            )}
                        </TouchableOpacity>

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
                                <ActivityIndicator color="#25D366" size="small" />
                            ) : (
                                <>
                                    <View style={[styles.shareIconCircle, { backgroundColor: '#25D366' }]}>
                                        <Ionicons name="logo-whatsapp" size={32} color="#FFF" />
                                    </View>
                                    <Text style={styles.shareLabel}>WhatsApp</Text>
                                </>
                            )}
                        </TouchableOpacity>

                        {/* Instagram DM */}
                        <TouchableOpacity
                            style={[
                                styles.shareOption,
                                sharingPlatform === 'instagram' && styles.shareOptionActive,
                            ]}
                            onPress={shareToInstagram}
                            disabled={loading}
                        >
                            {loading && sharingPlatform === 'instagram' ? (
                                <ActivityIndicator color="#E4405F" size="small" />
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

// =====================================================
// MODAL STYLES
// =====================================================
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
        gap: 8,
        padding: 8,
        borderRadius: 12,
        minWidth: 80,
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
        fontSize: 12,
        fontWeight: '600',
        color: '#333',
        textAlign: 'center',
    },
});