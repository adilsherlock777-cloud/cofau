import React from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import MaskedView from '@react-native-masked-view/masked-view';
import { normalizeMediaUrl } from '../utils/imageUrlFix';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Story dimensions (9:16 aspect ratio for Instagram Stories)
const STORY_WIDTH = SCREEN_WIDTH;
const STORY_HEIGHT = STORY_WIDTH * (16 / 9);

// Food image dimensions (big but proper ratio)
const IMAGE_MARGIN = 16;
const IMAGE_WIDTH = STORY_WIDTH - IMAGE_MARGIN * 2;
const IMAGE_HEIGHT = IMAGE_WIDTH * (5 / 4); // 4:5 aspect ratio

// =====================================================
// INSTAGRAM STORY CARD - Premium design with blur bg,
// big food image, and floating glassmorphism UI elements
// =====================================================
const InstagramStoryCard = React.forwardRef(({ post }, ref) => {
    const mediaUrl = normalizeMediaUrl(post?.media_url || post?.image_url);

    const reviewText = post?.review_text || post?.description || '';
    const truncatedReview = reviewText.length > 90 ? reviewText.substring(0, 87) + '...' : reviewText;

    return (
        <View
            ref={ref}
            style={storyCardStyles.container}
            collapsable={false}
        >
            {/* Blurred Background */}
            {mediaUrl && (
                <Image
                    source={{ uri: mediaUrl }}
                    style={storyCardStyles.blurredBackground}
                    resizeMode="cover"
                    blurRadius={35}
                />
            )}

            {/* Dark Overlay on blur */}
            <View style={storyCardStyles.darkOverlay} />

            {/* Main Food Image - big, proper ratio, rounded */}
            <View style={storyCardStyles.foodImageWrapper}>
                {mediaUrl ? (
                    <Image
                        source={{ uri: mediaUrl }}
                        style={storyCardStyles.foodImage}
                        resizeMode="cover"
                    />
                ) : (
                    <View style={storyCardStyles.placeholderImage}>
                        <Ionicons name="image-outline" size={80} color="rgba(255,255,255,0.3)" />
                    </View>
                )}

                {/* Bottom gradient on food image */}
                <LinearGradient
                    colors={['transparent', 'rgba(0,0,0,0.6)', 'rgba(0,0,0,0.85)']}
                    locations={[0.4, 0.75, 1]}
                    style={storyCardStyles.imageBottomGradient}
                />

                {/* Dish name + Restaurant - bottom of image */}
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
    glassSection: {
        position: 'absolute',
        top: STORY_HEIGHT * 0.04 + IMAGE_HEIGHT + 14,
        left: IMAGE_MARGIN,
        right: IMAGE_MARGIN,
    },
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

export default InstagramStoryCard;
