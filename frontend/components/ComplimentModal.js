import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const SCREEN_WIDTH = Dimensions.get('window').width;

const COMPLIMENT_TYPES = [
  {
    type: 'thank_you',
    name: 'Thank You',
    icon: '🙏',
    color: '#FFA500',
  },
  {
    type: 'youre_cool',
    name: "You're Cool",
    icon: '❄️',
    color: '#4FC3F7',
  },
  {
    type: 'hot_stuff',
    name: 'Hot Stuff',
    icon: '🔥',
    color: '#FF5252',
  },
  {
    type: 'youre_funny',
    name: "You're Funny",
    icon: '😄',
    color: '#66BB6A',
  },
  {
    type: 'write_more',
    name: 'Write More',
    icon: '📖',
    color: '#8D6E63',
  },
];

export default function ComplimentModal({ visible, onClose, onSend, loading }) {
  const [selectedType, setSelectedType] = useState(null);

  const handleSend = () => {
    if (selectedType) {
      onSend(selectedType);
      setSelectedType(null);
    }
  };

  const handleCancel = () => {
    setSelectedType(null);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={handleCancel}
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={handleCancel}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={(e) => e.stopPropagation()}
          style={styles.modalContainer}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={handleCancel} style={styles.headerButton}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Compliment</Text>
            <TouchableOpacity
              onPress={handleSend}
              style={styles.headerButton}
              disabled={!selectedType || loading}
            >
              <Text
                style={[
                  styles.sendText,
                  (!selectedType || loading) && styles.sendTextDisabled,
                ]}
              >
                Send
              </Text>
            </TouchableOpacity>
          </View>

          {/* Compliment Options */}
          <View style={styles.optionsContainer}>
            {COMPLIMENT_TYPES.map((compliment, index) => {
              const isSelected = selectedType === compliment.type;
              return (
                <TouchableOpacity
                  key={compliment.type}
                  style={[
                    styles.optionItem,
                    isSelected && styles.optionItemSelected,
                    index === COMPLIMENT_TYPES.length - 1 && styles.lastOption,
                  ]}
                  onPress={() => setSelectedType(compliment.type)}
                  activeOpacity={0.7}
                >
                  <View
                    style={[
                      styles.iconContainer,
                      { backgroundColor: isSelected ? compliment.color : '#F5F5F5' },
                    ]}
                  >
                    <Text style={styles.iconText}>{compliment.icon}</Text>
                  </View>
                  <Text
                    style={[
                      styles.optionText,
                      isSelected && styles.optionTextSelected,
                    ]}
                  >
                    {compliment.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#F5F5F5',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 40,
    maxHeight: '70%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  headerButton: {
    minWidth: 60,
  },
  cancelText: {
    fontSize: 16,
    color: '#000',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
  },
  sendText: {
    fontSize: 16,
    color: '#007AFF',
    textAlign: 'right',
  },
  sendTextDisabled: {
    color: '#999',
  },
  optionsContainer: {
    paddingTop: 8,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  optionItemSelected: {
    backgroundColor: '#F8F8F8',
  },
  lastOption: {
    borderBottomWidth: 0,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  iconText: {
    fontSize: 24,
  },
  optionText: {
    fontSize: 16,
    color: '#666',
  },
  optionTextSelected: {
    color: '#000',
    fontWeight: '600',
  },
});

