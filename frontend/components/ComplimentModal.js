import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

// Updated compliment types matching your requirements
const COMPLIMENT_TYPES = [
  {
    type: 'amazing_taste',
    name: "You've got amazing taste!",
    icon: '✨',
    color: '#FF6B6B',
  },
  {
    type: 'on_point',
    name: 'Your food choices are always on point.',
    icon: '🎯',
    color: '#4ECDC4',
  },
  {
    type: 'never_miss',
    name: 'Your recommendations never miss!',
    icon: '🔥',
    color: '#FF9F43',
  },
  {
    type: 'top_tier',
    name: 'Top-tier food spotting!',
    icon: '🏆',
    color: '#F9CA24',
  },
  {
    type: 'knows_good_food',
    name: 'You really know good food.',
    icon: '👨‍🍳',
    color: '#6C5CE7',
  },
];

const MAX_CUSTOM_LENGTH = 250;

interface ComplimentModalProps {
  visible: boolean;
  onClose: () => void;
  onSend: (complimentType: string, customMessage?: string) => Promise<void>;
  loading?: boolean;
}

export default function ComplimentModal({
  visible,
  onClose,
  onSend,
  loading = false,
}: ComplimentModalProps) {
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [customMessage, setCustomMessage] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);

  const handleSendCompliment = async (type: string) => {
    setSelectedType(type);
    await onSend(type, undefined);
    setSelectedType(null);
  };

  const handleSendCustomCompliment = async () => {
    if (!customMessage.trim()) return;
    setSelectedType('custom');
    await onSend('custom', customMessage.trim());
    setSelectedType(null);
    setCustomMessage('');
    setShowCustomInput(false);
  };

  const handleClose = () => {
    setCustomMessage('');
    setShowCustomInput(false);
    setSelectedType(null);
    onClose();
  };

  const remainingChars = MAX_CUSTOM_LENGTH - customMessage.length;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={handleClose}
    >
      <Pressable style={styles.backdrop} onPress={handleClose}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardAvoid}
        >
          <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.handleBar} />
              <Text style={styles.headerTitle}>Send a Compliment</Text>
              <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            {/* Subtitle */}
            <Text style={styles.subtitle}>
              Choose a compliment or write your own!
            </Text>

            {/* Compliment Options */}
            <ScrollView
              style={styles.optionsContainer}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {COMPLIMENT_TYPES.map((compliment) => {
                const isSelected = selectedType === compliment.type;
                const isDisabled = loading;

                return (
                  <TouchableOpacity
                    key={compliment.type}
                    style={[
                      styles.complimentOption,
                      isSelected && styles.complimentOptionSelected,
                      isDisabled && styles.complimentOptionDisabled,
                    ]}
                    onPress={() => handleSendCompliment(compliment.type)}
                    disabled={isDisabled}
                    activeOpacity={0.7}
                  >
                    <View
                      style={[
                        styles.iconContainer,
                        { backgroundColor: compliment.color + '20' },
                      ]}
                    >
                      <Text style={styles.iconEmoji}>{compliment.icon}</Text>
                    </View>

                    <View style={styles.complimentInfo}>
                      <Text style={styles.complimentName}>{compliment.name}</Text>
                    </View>

                    {isSelected && loading ? (
                      <ActivityIndicator size="small" color={compliment.color} />
                    ) : (
                      <View
                        style={[
                          styles.sendIndicator,
                          { backgroundColor: compliment.color },
                        ]}
                      >
                        <Ionicons name="send" size={14} color="#fff" />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}

              {/* Custom Message Section */}
              <View style={styles.customSection}>
                <TouchableOpacity
                  style={[
                    styles.customToggle,
                    showCustomInput && styles.customToggleActive,
                  ]}
                  onPress={() => setShowCustomInput(!showCustomInput)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.iconContainer, { backgroundColor: '#E91E6320' }]}>
                    <Text style={styles.iconEmoji}>💬</Text>
                  </View>
                  <View style={styles.complimentInfo}>
                    <Text style={styles.complimentName}>Write a custom message</Text>
                    <Text style={styles.customSubtext}>Add your personal touch</Text>
                  </View>
                  <Ionicons
                    name={showCustomInput ? 'chevron-up' : 'chevron-down'}
                    size={20}
                    color="#666"
                  />
                </TouchableOpacity>

                {showCustomInput && (
                  <View style={styles.customInputContainer}>
                    <TextInput
                      style={styles.customInput}
                      placeholder="Write something nice..."
                      placeholderTextColor="#999"
                      value={customMessage}
                      onChangeText={(text) => {
                        if (text.length <= MAX_CUSTOM_LENGTH) {
                          setCustomMessage(text);
                        }
                      }}
                      multiline
                      maxLength={MAX_CUSTOM_LENGTH}
                      autoFocus
                    />
                    <View style={styles.customInputFooter}>
                      <Text
                        style={[
                          styles.charCount,
                          remainingChars < 50 && styles.charCountWarning,
                          remainingChars < 20 && styles.charCountDanger,
                        ]}
                      >
                        {remainingChars} characters remaining
                      </Text>
                      <TouchableOpacity
                        style={[
                          styles.sendCustomButton,
                          (!customMessage.trim() || loading) && styles.sendCustomButtonDisabled,
                        ]}
                        onPress={handleSendCustomCompliment}
                        disabled={!customMessage.trim() || loading}
                        activeOpacity={0.7}
                      >
                        {selectedType === 'custom' && loading ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <>
                            <Ionicons name="send" size={16} color="#fff" />
                            <Text style={styles.sendCustomButtonText}>Send</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>

              {/* Bottom spacing */}
              <View style={{ height: 20 }} />
            </ScrollView>

            {/* Footer */}
            <View style={styles.footer}>
              <LinearGradient
                colors={['#E94A37', '#F2CF68', '#1B7C82']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.footerGradient}
              >
                <Text style={styles.footerText}>
                  💝 Spread kindness, one compliment at a time!
                </Text>
              </LinearGradient>
            </View>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  keyboardAvoid: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 30,
    maxHeight: '85%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 5,
  },
  header: {
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  handleBar: {
    width: 40,
    height: 4,
    backgroundColor: '#DDD',
    borderRadius: 2,
    marginBottom: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    position: 'absolute',
    right: 16,
    top: 20,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  optionsContainer: {
    paddingHorizontal: 16,
    maxHeight: 400,
  },
  complimentOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  complimentOptionSelected: {
    borderColor: '#4dd0e1',
    backgroundColor: '#E0F7FA',
  },
  complimentOptionDisabled: {
    opacity: 0.6,
  },
  iconContainer: {
    width: 46,
    height: 46,
    borderRadius: 23,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  iconEmoji: {
    fontSize: 24,
  },
  complimentInfo: {
    flex: 1,
  },
  complimentName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    lineHeight: 20,
  },
  sendIndicator: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  customSection: {
    marginTop: 6,
  },
  customToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF5F8',
    borderRadius: 12,
    padding: 14,
    borderWidth: 2,
    borderColor: '#E91E6330',
  },
  customToggleActive: {
    borderColor: '#E91E63',
    backgroundColor: '#FCE4EC',
  },
  customSubtext: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  customInputContainer: {
    backgroundColor: '#FAFAFA',
    borderRadius: 12,
    padding: 14,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  customInput: {
    backgroundColor: '#FFF',
    borderRadius: 10,
    padding: 14,
    fontSize: 15,
    color: '#333',
    minHeight: 100,
    maxHeight: 150,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  customInputFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
  charCount: {
    fontSize: 12,
    color: '#999',
  },
  charCountWarning: {
    color: '#FFA500',
  },
  charCountDanger: {
    color: '#FF5252',
  },
  sendCustomButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E91E63',
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 18,
    gap: 6,
  },
  sendCustomButtonDisabled: {
    backgroundColor: '#CCC',
  },
  sendCustomButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  footerGradient: {
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '600',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});