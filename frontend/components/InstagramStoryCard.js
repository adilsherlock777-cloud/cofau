import React, { forwardRef } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Story dimensions (9:16 aspect ratio for Instagram Stories)
const STORY_WIDTH = SCREEN_WIDTH * 0.9;
const STORY_HEIGHT = STORY_WIDTH * (16 / 9);

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
                    blurRadius={25}
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
                        <Ionicons name="star" size={20} color="#FFD700" />
                        <Text style={storyCardStyles.infoBoxLabel}>Rating</Text>
                        <Text style={storyCardStyles.infoBoxValue}>
                            {post?.rating ? `${post.rating}/10` : '-'}
                        </Text>
                    </View>

                    {/* Divider */}
                    <View style={storyCardStyles.divider} />

                    {/* Review Box */}
                    <View style={[storyCardStyles.infoBox, storyCardStyles.reviewBox]}>
                        <Ionicons name="chatbubble-ellipses" size={20} color="#4CAF50" />
                        <Text style={storyCardStyles.infoBoxLabel}>Review</Text>
                        <Text style={storyCardStyles.infoBoxValue} numberOfLines={2}>
                            {post?.review_text || post?.description || '-'}
                        </Text>
                    </View>

                    {/* Divider */}
                    <View style={storyCardStyles.divider} />

                    {/* Location Box */}
                    <View style={storyCardStyles.infoBox}>
                        <Ionicons name="location" size={20} color="#E53935" />
                        <Text style={storyCardStyles.infoBoxLabel}>Location</Text>
                        <Text style={storyCardStyles.infoBoxValue} numberOfLines={2}>
                            {post?.location_name || '-'}
                        </Text>
                    </View>
                </View>
            </View>
        </View>
    );
});

const STORY_WIDTH = Dimensions.get('window').width;
const STORY_HEIGHT = STORY_WIDTH * (16 / 9);
const CARD_WIDTH = STORY_WIDTH * 0.85;

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
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
    },
    card: {
        position: 'absolute',
        top: '8%',
        left: (STORY_WIDTH - CARD_WIDTH) / 2,
        width: CARD_WIDTH,
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.4,
        shadowRadius: 16,
        elevation: 10,
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
        bottom: 12,
        right: 12,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
    },
    watermarkText: {
        fontSize: 18,
        fontWeight: '700',
        color: '#FFFFFF',
        fontFamily: Platform.OS === 'ios' ? 'Lobster-Regular' : 'Lobster-Regular',
        // If Lobster font is not loaded, use a fallback
        // You may need to load the font separately
    },
    infoBoxesContainer: {
        flexDirection: 'row',
        paddingVertical: 16,
        paddingHorizontal: 8,
        backgroundColor: '#FFFFFF',
    },
    infoBox: {
        flex: 1,
        alignItems: 'center',
        paddingHorizontal: 4,
    },
    reviewBox: {
        flex: 1.5,
    },
    infoBoxLabel: {
        fontSize: 11,
        fontWeight: '600',
        color: '#888',
        marginTop: 4,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    infoBoxValue: {
        fontSize: 12,
        fontWeight: '600',
        color: '#333',
        marginTop: 4,
        textAlign: 'center',
    },
    divider: {
        width: 1,
        backgroundColor: '#E0E0E0',
        marginVertical: 4,
    },
});

export default InstagramStoryCard;