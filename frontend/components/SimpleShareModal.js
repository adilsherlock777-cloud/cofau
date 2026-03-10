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
import * as FileSystem from 'expo-file-system';
import { captureRef } from 'react-native-view-shot';
import * as MediaLibrary from 'expo-media-library';
import * as Linking from 'expo-linking';
import { LinearGradient } from 'expo-linear-gradient';
import MaskedView from '@react-native-masked-view/masked-view';
import { normalizeMediaUrl, normalizeProfilePicture, BACKEND_URL } from '../utils/imageUrlFix';
import UserAvatar from './UserAvatar';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Story card dimensions (9:16 aspect ratio for Instagram Stories)
const STORY_WIDTH = SCREEN_WIDTH;
const STORY_HEIGHT = STORY_WIDTH * (16 / 9);

// Food image dimensions inside the story (big but proper ratio)
const IMAGE_MARGIN = 16;
const IMAGE_WIDTH = STORY_WIDTH - IMAGE_MARGIN * 2;
const IMAGE_HEIGHT = IMAGE_WIDTH * (5 / 4); // 4:5 aspect ratio - tall & big

// =====================================================
// INSTAGRAM STORY CARD - Premium design with blur bg,
// big food image, and floating glassmorphism UI elements
// =====================================================
const InstagramStoryCard = React.forwardRef(({ post }, ref) => {
    const mediaUrl = normalizeMediaUrl(post?.media_url || post?.image_url);
    const thumbnailUrl = post?.thumbnail_url ? normalizeMediaUrl(post.thumbnail_url) : null;
    const isVideoPost = post?.media_type === 'video' || mediaUrl?.toLowerCase().endsWith('.mp4');
    const displayImageUrl = isVideoPost ? (thumbnailUrl || null) : mediaUrl;

    const reviewText = post?.review_text || post?.description || '';
    const truncatedReview = reviewText.length > 90 ? reviewText.substring(0, 87) + '...' : reviewText;

    return (
        <View
            ref={ref}
            style={storyCardStyles.container}
            collapsable={false}
        >
            {/* Blurred Background - same image but blurred */}
            {displayImageUrl && (
                <Image
                    source={{ uri: displayImageUrl }}
                    style={storyCardStyles.blurredBackground}
                    contentFit="cover"
                    blurRadius={35}
                />
            )}

            {/* Dark Overlay on blur for depth */}
            <View style={storyCardStyles.darkOverlay} />

            {/* Main Food Image - big, proper ratio, rounded */}
            <View style={storyCardStyles.foodImageWrapper}>
                {displayImageUrl ? (
                    <Image
                        source={{ uri: displayImageUrl }}
                        style={storyCardStyles.foodImage}
                        contentFit="cover"
                    />
                ) : (
                    <View style={storyCardStyles.placeholderImage}>
                        <Ionicons name="image-outline" size={80} color="rgba(255,255,255,0.3)" />
                    </View>
                )}

                {/* Bottom gradient on food image for text readability */}
                <LinearGradient
                    colors={['transparent', 'rgba(0,0,0,0.6)', 'rgba(0,0,0,0.85)']}
                    locations={[0.4, 0.75, 1]}
                    style={storyCardStyles.imageBottomGradient}
                />

                {/* Username pill - top left of image */}
                {post?.username && (
                    <View style={storyCardStyles.usernamePill}>
                        <UserAvatar
                            profilePicture={normalizeProfilePicture(post?.user_profile_picture)}
                            username={post.username}
                            size={34}
                            showLevelBadge={false}
                        />
                        <Text style={storyCardStyles.usernameText} numberOfLines={1}>
                            @{post.username}
                        </Text>
                    </View>
                )}

                {/* Dish name + Restaurant - bottom of image, over gradient */}
                <View style={storyCardStyles.imageBottomInfo}>
                    {post?.dish_name && (
                        <Text style={storyCardStyles.dishName} numberOfLines={2}>
                            {post.dish_name}
                        </Text>
                    )}
                    {post?.tagged_restaurant?.restaurant_name && (
                        <View style={storyCardStyles.restaurantRow}>
                            <Ionicons name="restaurant-outline" size={13} color="rgba(255,255,255,0.7)" />
                            <Text style={storyCardStyles.restaurantName} numberOfLines={1}>
                                {post.tagged_restaurant.restaurant_name}
                            </Text>
                        </View>
                    )}
                </View>
            </View>

            {/* Floating glass info box below the image */}
            <View style={storyCardStyles.glassSection}>
                <View style={storyCardStyles.glassInfoBox}>
                    {/* Rating + Review row */}
                    <View style={storyCardStyles.ratingReviewRow}>
                        <View style={storyCardStyles.ratingChip}>
                            <Ionicons name="star" size={14} color="#FFD700" />
                            <Text style={storyCardStyles.ratingValue}>
                                {post?.rating ? `${post.rating}/10` : '-'}
                            </Text>
                        </View>
                        {truncatedReview ? (
                            <>
                                <Text style={storyCardStyles.ratingReviewDash}>—</Text>
                                <Text style={storyCardStyles.reviewText} numberOfLines={2}>
                                    "{truncatedReview}"
                                </Text>
                            </>
                        ) : null}
                    </View>

                    {/* Divider + Location */}
                    {post?.location_name && (
                        <>
                            <View style={storyCardStyles.glassDivider} />
                            <View style={storyCardStyles.locationRow}>
                                <Ionicons name="location" size={14} color="#FF6B6B" />
                                <Text style={storyCardStyles.locationText} numberOfLines={1}>
                                    {post.location_name}
                                </Text>
                            </View>
                        </>
                    )}
                </View>

                {/* Found it on Cofau branding badge */}
                <View style={storyCardStyles.foundOnRow}>
                    <Text style={storyCardStyles.foundOnText}>Found it on</Text>
                    <View style={storyCardStyles.cofauBadge}>
                        <MaskedView maskElement={<Text style={storyCardStyles.cofauBadgeText}>Cofau</Text>}>
                            <LinearGradient colors={['#FF2E2E', '#FF7A18']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                                <Text style={[storyCardStyles.cofauBadgeText, { opacity: 0 }]}>Cofau</Text>
                            </LinearGradient>
                        </MaskedView>
                    </View>
                </View>
            </View>
        </View>
    );
});

// =====================================================
// STORY CARD STYLES - Premium glassmorphism design
// =====================================================
const storyCardStyles = StyleSheet.create({
    container: {
        width: STORY_WIDTH,
        height: STORY_HEIGHT,
        position: 'absolute',
        left: -9999,
        top: 0,
        backgroundColor: '#0a0a0a',
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
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
    },
    // Food image
    foodImageWrapper: {
        position: 'absolute',
        top: STORY_HEIGHT * 0.04,
        left: IMAGE_MARGIN,
        width: IMAGE_WIDTH,
        height: IMAGE_HEIGHT,
        borderRadius: 20,
        overflow: 'hidden',
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
        backgroundColor: '#1a1a1a',
    },
    imageBottomGradient: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: '45%',
    },
    // Username pill - top left of image
    usernamePill: {
        position: 'absolute',
        top: 14,
        left: 14,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.35)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.2)',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 50,
        gap: 6,
        maxWidth: '60%',
    },
    usernameText: {
        color: '#FFF',
        fontSize: 12,
        fontWeight: '700',
        letterSpacing: 0.3,
    },
    // Dish name on bottom of image
    imageBottomInfo: {
        position: 'absolute',
        bottom: 16,
        left: 16,
        right: 16,
    },
    dishName: {
        fontSize: 24,
        fontWeight: '800',
        color: '#FFFFFF',
        letterSpacing: -0.3,
        textShadowColor: 'rgba(0,0,0,0.6)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 6,
    },
    restaurantRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        marginTop: 4,
    },
    restaurantName: {
        fontSize: 13,
        fontWeight: '500',
        color: 'rgba(255,255,255,0.8)',
        letterSpacing: 0.2,
    },
    // Glass elements section below image
    glassSection: {
        position: 'absolute',
        top: STORY_HEIGHT * 0.04 + IMAGE_HEIGHT + 14,
        left: IMAGE_MARGIN,
        right: IMAGE_MARGIN,
    },
    // Unified glass info box
    glassInfoBox: {
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.18)',
        borderRadius: 16,
        paddingHorizontal: 14,
        paddingVertical: 12,
        marginBottom: 12,
    },
    ratingReviewRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    ratingChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: 'rgba(255, 255, 255, 0.12)',
        borderRadius: 50,
        paddingHorizontal: 10,
        paddingVertical: 5,
    },
    ratingValue: {
        fontSize: 14,
        fontWeight: '800',
        color: '#FFFFFF',
    },
    ratingReviewDash: {
        fontSize: 14,
        color: 'rgba(255, 255, 255, 0.4)',
        marginHorizontal: 8,
        marginTop: 3,
    },
    reviewText: {
        flex: 1,
        fontSize: 13,
        fontWeight: '500',
        color: 'rgba(255, 255, 255, 0.85)',
        lineHeight: 18,
        fontStyle: 'italic',
        marginTop: 3,
    },
    glassDivider: {
        height: 1,
        backgroundColor: 'rgba(255, 255, 255, 0.12)',
        marginVertical: 10,
    },
    locationRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    locationText: {
        flex: 1,
        fontSize: 13,
        fontWeight: '600',
        color: 'rgba(255, 255, 255, 0.85)',
    },
    // Branding
    foundOnRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
    },
    foundOnText: {
        fontSize: 12,
        fontWeight: '600',
        color: 'rgba(255, 255, 255, 0.45)',
        letterSpacing: 0.5,
    },
    cofauBadge: {
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 12,
        paddingVertical: 5,
        borderRadius: 50,
    },
    cofauBadgeText: {
        fontSize: 14,
        fontWeight: '700',
        fontFamily: 'Lobster',
        letterSpacing: 0.5,
        color: '#000',
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

            const dishLine = post.dish_name ? `🍽 *${post.dish_name}*\n` : '';
            const ratingLine = post.rating ? `⭐ ${post.rating}/10\n` : '';
            const locationLine = post.location_name ? `📍 ${post.location_name}\n` : '';
            const reviewLine = post.review_text ? `\n"${post.review_text}"\n` : '';

            let message = `Hey, Check out this dish on *Cofau*!\n\n`;
            message += dishLine;
            message += ratingLine;
            message += locationLine;
            message += reviewLine;
            message += `\n👉 ${shareUrl}`;

            const shareContent = {
                message: message,
                url: shareUrl,
                title: post.dish_name || `${post.username} shared a dish on Cofau`,
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

            const { status } = await MediaLibrary.requestPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission Required', 'Please allow access to save media.');
                return;
            }

            if (isVideo && mediaUrl) {
                // For videos: download the actual video file and share it
                const fileExt = mediaUrl.toLowerCase().includes('.mov') ? 'mov' : 'mp4';
                const localUri = `${FileSystem.cacheDirectory}cofau_share_${Date.now()}.${fileExt}`;

                const downloadResumable = FileSystem.createDownloadResumable(
                    mediaUrl,
                    localUri,
                    {}
                );
                const result = await downloadResumable.downloadAsync();

                if (!result || !result.uri) {
                    throw new Error('Video download failed');
                }

                await MediaLibrary.createAssetAsync(result.uri);

                await Sharing.shareAsync(result.uri, {
                    mimeType: fileExt === 'mov' ? 'video/quicktime' : 'video/mp4',
                    dialogTitle: 'Share to Instagram Story',
                    UTI: fileExt === 'mov' ? 'com.apple.quicktime-movie' : 'public.mpeg-4',
                });
            } else {
                // For images: capture the story card as a styled image
                const uri = await captureRef(storyCardRef, {
                    format: 'png',
                    quality: 1,
                    result: 'tmpfile',
                });

                await MediaLibrary.createAssetAsync(uri);

                await Sharing.shareAsync(uri, {
                    mimeType: 'image/png',
                    dialogTitle: 'Share to Instagram Story',
                    UTI: 'public.png',
                });
            }

            onClose();
        } catch (error) {
            console.error('Instagram Story share error:', error);
            // Fallback: share as image if video download fails
            if (isVideo) {
                try {
                    const uri = await captureRef(storyCardRef, {
                        format: 'png',
                        quality: 1,
                        result: 'tmpfile',
                    });
                    await MediaLibrary.createAssetAsync(uri);
                    await Sharing.shareAsync(uri, {
                        mimeType: 'image/png',
                        dialogTitle: 'Share to Instagram Story',
                        UTI: 'public.png',
                    });
                    onClose();
                    return;
                } catch {}
            }
            Alert.alert('Error', 'Failed to share. Please try again.');
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

            const dishLine = post.dish_name ? `🍽 ${post.dish_name}\n` : '';
            const ratingLine = post.rating ? `⭐ ${post.rating}/10\n` : '';
            const locationLine = post.location_name ? `📍 ${post.location_name}\n` : '';
            const reviewLine = post.review_text ? `\n"${post.review_text}"\n` : '';

            let message = `Hey, Check out this dish on Cofau!\n\n`;
            message += dishLine;
            message += ratingLine;
            message += locationLine;
            message += reviewLine;
            message += `\n👉 ${shareUrl}`;

            const shareContent = {
                message: message,
                url: shareUrl,
                title: post.dish_name || `${post.username} shared a dish on Cofau`,
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