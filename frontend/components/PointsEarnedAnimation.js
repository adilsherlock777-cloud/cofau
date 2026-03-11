import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions, Modal, StatusBar } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';

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
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const pointsScaleAnim = useRef(new Animated.Value(0)).current;
  const checkAnim = useRef(new Animated.Value(0)).current;
  const [show, setShow] = useState(false);

  const level = levelData?.level || 1;
  const currentPoints = levelData?.currentPoints || 0;
  const totalPoints = levelData?.total_points || 0;

  const currentLevelData = LEVEL_TABLE.find((l) => l.level === level);
  const prevLevelData = LEVEL_TABLE.find((l) => l.level === level - 1);
  const currentThreshold = currentLevelData?.required_points || 1250;
  const prevThreshold = prevLevelData?.required_points || 0;
  const pointsNeededForLevel = currentThreshold - prevThreshold;
  const progressAfter = pointsNeededForLevel > 0
    ? Math.min(currentPoints / pointsNeededForLevel, 1)
    : 0;
  const progressBefore = pointsNeededForLevel > 0
    ? Math.min(Math.max((currentPoints - pointsEarned) / pointsNeededForLevel, 0), 1)
    : 0;

  useEffect(() => {
    if (visible) {
      setShow(true);
      progressAnim.setValue(progressBefore);
      pointsScaleAnim.setValue(0);
      checkAnim.setValue(0);

      // Fade in white screen + scale up card
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          useNativeDriver: true,
          tension: 60,
          friction: 7,
        }),
      ]).start(() => {
        // Checkmark pop
        Animated.spring(checkAnim, {
          toValue: 1,
          useNativeDriver: true,
          tension: 120,
          friction: 5,
        }).start();

        // Animate progress bar after a beat
        setTimeout(() => {
          Animated.timing(progressAnim, {
            toValue: progressAfter,
            duration: 800,
            useNativeDriver: false,
          }).start();

          Animated.spring(pointsScaleAnim, {
            toValue: 1,
            useNativeDriver: true,
            tension: 100,
            friction: 6,
          }).start();
        }, 400);
      });

      // Auto dismiss after 3 seconds
      const timer = setTimeout(() => {
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(scaleAnim, {
            toValue: 0.8,
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
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.8);
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
    <Modal visible={visible && show} transparent animationType="none">
      <StatusBar barStyle="dark-content" />
      <Animated.View style={[styles.fullScreen, { opacity: fadeAnim }]}>
        <Animated.View
          style={[
            styles.card,
            { transform: [{ scale: scaleAnim }] },
          ]}
        >
          {/* Success checkmark */}
          <Animated.View style={[styles.checkCircle, { transform: [{ scale: checkAnim }] }]}>
            <MaterialCommunityIcons name="check" size={32} color="#fff" />
          </Animated.View>

          <Text style={styles.successTitle}>Post Uploaded!</Text>

          {/* Level info card */}
          <View style={styles.levelCard}>
            {/* Badge + title row */}
            <View style={styles.levelRow}>
              <View style={[styles.badge, { backgroundColor: badgeColor }]}>
                <Text style={styles.badgeText}>{level}</Text>
              </View>
              <View style={styles.levelInfo}>
                <Text style={styles.levelTitle}>{levelTitle}</Text>
                <Text style={styles.levelSubtitle}>Level {level}</Text>
              </View>
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

            <Text style={styles.progressText}>
              {totalPoints} / {currentThreshold} pts
            </Text>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fullScreen: {
    flex: 1,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    alignItems: 'center',
    width: SCREEN_WIDTH - 60,
  },
  checkCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  successTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 28,
  },
  levelCard: {
    width: '100%',
    backgroundColor: '#F8F8F8',
    borderRadius: 16,
    padding: 18,
  },
  levelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  badge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  levelInfo: {
    flex: 1,
    marginLeft: 12,
  },
  levelTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  levelSubtitle: {
    fontSize: 12,
    color: '#888',
    fontWeight: '500',
    marginTop: 1,
  },
  pointsText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FF5C5C',
  },
  progressBarBg: {
    height: 10,
    backgroundColor: '#E0E0E0',
    borderRadius: 5,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 5,
    overflow: 'hidden',
  },
  progressGradient: {
    flex: 1,
  },
  progressText: {
    fontSize: 12,
    color: '#888',
    fontWeight: '600',
    marginTop: 6,
    textAlign: 'right',
  },
});
