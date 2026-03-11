import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const LEVEL_TABLE = [
  { level: 1, required_points: 1250 },
  { level: 2, required_points: 2500 },
  { level: 3, required_points: 3750 },
  { level: 4, required_points: 5000 },
  { level: 5, required_points: 5750 },
  { level: 6, required_points: 6500 },
  { level: 7, required_points: 7250 },
  { level: 8, required_points: 8000 },
  { level: 9, required_points: 9000 },
  { level: 10, required_points: 10000 },
  { level: 11, required_points: 11000 },
  { level: 12, required_points: 12000 },
];

const getBadgeColor = (level) => {
  if (level >= 1 && level <= 4) return '#FF5C5C';
  if (level >= 5 && level <= 8) return '#F2CF68';
  if (level >= 9 && level <= 12) return '#E94A37';
  return '#FF5C5C';
};

const getLevelTitle = (level) => {
  if (level <= 4) return 'Reviewer';
  if (level <= 8) return 'Top Reviewer';
  return 'Influencer';
};

export default function PointsEarnedAnimation({
  visible,
  pointsEarned,
  onClose,
  levelData,
}) {
  const slideAnim = useRef(new Animated.Value(-120)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const pointsScaleAnim = useRef(new Animated.Value(0)).current;
  const [show, setShow] = useState(false);

  const level = levelData?.level || 1;
  const currentPoints = levelData?.currentPoints || 0;
  const totalPoints = levelData?.total_points || 0;

  // Calculate progress
  const currentLevelData = LEVEL_TABLE.find((l) => l.level === level);
  const prevLevelData = LEVEL_TABLE.find((l) => l.level === level - 1);
  const currentThreshold = currentLevelData?.required_points || 1250;
  const prevThreshold = prevLevelData?.required_points || 0;
  const pointsNeededForLevel = currentThreshold - prevThreshold;
  const progressBefore = pointsNeededForLevel > 0
    ? Math.min(Math.max((currentPoints - pointsEarned) / pointsNeededForLevel, 0), 1)
    : 0;
  const progressAfter = pointsNeededForLevel > 0
    ? Math.min(currentPoints / pointsNeededForLevel, 1)
    : 0;

  useEffect(() => {
    if (visible) {
      setShow(true);
      progressAnim.setValue(progressBefore);
      pointsScaleAnim.setValue(0);

      // Slide in from top
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 60,
          useNativeDriver: true,
          tension: 50,
          friction: 8,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start(() => {
        // Animate progress bar filling
        Animated.timing(progressAnim, {
          toValue: progressAfter,
          duration: 800,
          useNativeDriver: false,
        }).start();

        // Pop in the +points text
        Animated.spring(pointsScaleAnim, {
          toValue: 1,
          useNativeDriver: true,
          tension: 100,
          friction: 6,
          delay: 200,
        }).start();
      });

      // Auto dismiss after 3 seconds
      const timer = setTimeout(() => {
        Animated.parallel([
          Animated.timing(slideAnim, {
            toValue: -120,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(opacityAnim, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
        ]).start(() => {
          setShow(false);
          if (onClose) onClose();
        });
      }, 3000);

      return () => clearTimeout(timer);
    } else {
      slideAnim.setValue(-120);
      opacityAnim.setValue(0);
      setShow(false);
    }
  }, [visible]);

  if (!visible && !show) return null;

  const badgeColor = getBadgeColor(level);
  const levelTitle = getLevelTitle(level);

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ translateY: slideAnim }],
          opacity: opacityAnim,
        },
      ]}
      pointerEvents="none"
    >
      <View style={styles.card}>
        {/* Level Badge */}
        <View style={[styles.badge, { backgroundColor: badgeColor }]}>
          <Text style={styles.badgeText}>{level}</Text>
        </View>

        {/* Content */}
        <View style={styles.content}>
          {/* Top row: title + points earned */}
          <View style={styles.topRow}>
            <Text style={styles.levelTitle}>{levelTitle}</Text>
            <Animated.Text
              style={[
                styles.pointsText,
                { transform: [{ scale: pointsScaleAnim }] },
              ]}
            >
              +{pointsEarned} pts
            </Animated.Text>
          </View>

          {/* Progress bar */}
          <View style={styles.progressBarBg}>
            <Animated.View style={[styles.progressBarFill, { width: progressWidth }]}>
              <LinearGradient
                colors={['#FF9A4D', '#FF5C5C']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.progressGradient}
              />
            </Animated.View>
          </View>

          {/* Points text */}
          <Text style={styles.progressText}>
            {totalPoints}/{currentThreshold} pts
          </Text>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    alignItems: 'center',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    width: SCREEN_WIDTH - 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  badge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  badgeText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  levelTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  pointsText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FF5C5C',
  },
  progressBarBg: {
    height: 8,
    backgroundColor: '#E8E8E8',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressGradient: {
    flex: 1,
  },
  progressText: {
    fontSize: 11,
    color: '#888',
    fontWeight: '600',
    marginTop: 4,
    textAlign: 'right',
  },
});
