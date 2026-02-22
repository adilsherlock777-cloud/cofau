import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import axios from "axios";

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || "https://api.cofau.com";

interface ReviewModalProps {
  visible: boolean;
  onClose: () => void;
  order: any;
  token: string;
  onReviewAdded: () => void;
}

export const ReviewModal: React.FC<ReviewModalProps> = ({
  visible,
  onClose,
  order,
  token,
  onReviewAdded,
}) => {
  const [rating, setRating] = useState<number>(0);
  const [reviewText, setReviewText] = useState("");
  const [isComplaint, setIsComplaint] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (rating === 0) {
      Alert.alert("Rating Required", "Please select a rating before submitting.");
      return;
    }

    if (!reviewText.trim()) {
      Alert.alert("Review Required", "Please write your review or complaint.");
      return;
    }

    setSubmitting(true);
    try {

      const response = await axios.post(
        `${BACKEND_URL}/api/orders/${order.id}/review`,
        {
          rating,
          review_text: reviewText,
          is_complaint: isComplaint,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      Alert.alert("Success", "Your review has been submitted successfully!");
      onReviewAdded();
      handleClose();
    } catch (error: any) {
      console.error("Error submitting review:", error);
      console.error("Error response:", error.response?.data);
      console.error("Error status:", error.response?.status);

      let errorMessage = "Failed to submit review. Please try again.";

      if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.response?.data?.detail) {
        errorMessage = error.response.data.detail;
      } else if (error.message) {
        errorMessage = error.message;
      }

      Alert.alert("Error", errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setRating(0);
    setReviewText("");
    setIsComplaint(false);
    onClose();
  };

  if (!order) return null;

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.modalOverlay}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {isComplaint ? "Submit Complaint" : "Add Review"}
                </Text>
                <TouchableOpacity onPress={handleClose}>
                  <Ionicons name="close" size={24} color="#333" />
                </TouchableOpacity>
              </View>

              <ScrollView
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
            {/* Order Details */}
            <View style={styles.orderDetailsSection}>
              <Text style={styles.sectionLabel}>Order Details</Text>
              <Text style={styles.orderDishName}>{order.dish_name}</Text>
              {order.restaurant_name && (
                <View style={styles.restaurantRow}>
                  <Ionicons name="restaurant" size={14} color="#666" />
                  <Text style={styles.restaurantText}>{order.restaurant_name}</Text>
                </View>
              )}
            </View>

            {/* Type Selector */}
            <View style={styles.typeSelectorSection}>
              <TouchableOpacity
                style={[
                  styles.typeButton,
                  !isComplaint && styles.typeButtonActive,
                ]}
                onPress={() => setIsComplaint(false)}
              >
                <Ionicons
                  name="star"
                  size={20}
                  color={!isComplaint ? "#FFF" : "#666"}
                />
                <Text
                  style={[
                    styles.typeButtonText,
                    !isComplaint && styles.typeButtonTextActive,
                  ]}
                >
                  Review
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.typeButton,
                  isComplaint && styles.typeButtonActive,
                ]}
                onPress={() => setIsComplaint(true)}
              >
                <Ionicons
                  name="warning"
                  size={20}
                  color={isComplaint ? "#FFF" : "#666"}
                />
                <Text
                  style={[
                    styles.typeButtonText,
                    isComplaint && styles.typeButtonTextActive,
                  ]}
                >
                  Complaint
                </Text>
              </TouchableOpacity>
            </View>

            {/* Rating */}
            <View style={styles.ratingSection}>
              <Text style={styles.sectionLabel}>Rating</Text>
              <View style={styles.starsRow}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <TouchableOpacity
                    key={star}
                    onPress={() => setRating(star)}
                    hitSlop={{ top: 10, bottom: 10, left: 5, right: 5 }}
                  >
                    <Ionicons
                      name={star <= rating ? "star" : "star-outline"}
                      size={40}
                      color={star <= rating ? "#FFD700" : "#CCC"}
                    />
                  </TouchableOpacity>
                ))}
              </View>
              {rating > 0 && (
                <Text style={styles.ratingLabel}>
                  {rating === 1
                    ? "Poor"
                    : rating === 2
                    ? "Fair"
                    : rating === 3
                    ? "Good"
                    : rating === 4
                    ? "Very Good"
                    : "Excellent"}
                </Text>
              )}
            </View>

            {/* Review Text */}
            <View style={styles.reviewTextSection}>
              <Text style={styles.sectionLabel}>
                {isComplaint ? "Describe your complaint" : "Write your review"}
              </Text>
              <TextInput
                style={styles.reviewInput}
                placeholder={
                  isComplaint
                    ? "Tell us what went wrong..."
                    : "Share your experience..."
                }
                placeholderTextColor="#999"
                multiline
                numberOfLines={6}
                value={reviewText}
                onChangeText={setReviewText}
                textAlignVertical="top"
              />
            </View>

            {/* Submit Button */}
            <TouchableOpacity
              style={[
                styles.submitButton,
                submitting && styles.submitButtonDisabled,
              ]}
              onPress={handleSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={20} color="#FFF" />
                  <Text style={styles.submitButtonText}>Submit</Text>
                </>
              )}
            </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: "85%",
    minHeight: "60%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#222",
  },
  orderDetailsSection: {
    backgroundColor: "#F8F8F8",
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#666",
    marginBottom: 8,
  },
  orderDishName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#222",
    marginBottom: 8,
  },
  restaurantRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  restaurantText: {
    fontSize: 14,
    color: "#666",
  },
  typeSelectorSection: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 24,
  },
  typeButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F0F0F0",
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
    borderWidth: 2,
    borderColor: "transparent",
  },
  typeButtonActive: {
    backgroundColor: "#FF8C00",
    borderColor: "#FF8C00",
  },
  typeButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#666",
  },
  typeButtonTextActive: {
    color: "#FFF",
  },
  ratingSection: {
    marginBottom: 24,
  },
  starsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginTop: 8,
  },
  ratingLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FF8C00",
    textAlign: "center",
    marginTop: 12,
  },
  reviewTextSection: {
    marginBottom: 24,
  },
  reviewInput: {
    backgroundColor: "#F8F8F8",
    borderRadius: 12,
    padding: 16,
    fontSize: 15,
    color: "#222",
    minHeight: 120,
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  submitButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FF8C00",
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
    marginBottom: 20,
  },
  submitButtonDisabled: {
    backgroundColor: "#CCC",
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFF",
  },
});
