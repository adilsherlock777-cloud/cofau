import React, { useState, useEffect } from "react";
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    FlatList,
    ActivityIndicator,
    TextInput,
    Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../context/AuthContext";
import { getFollowers, getFollowing } from "../utils/api";
import { normalizeProfilePicture } from "../utils/imageUrlFix";
import UserAvatar from "./UserAvatar";

export default function ShareToUsersModal({ visible, onClose, post, onShare }) {
    const { user, token } = useAuth();
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedUsers, setSelectedUsers] = useState([]);

    useEffect(() => {
        if (visible && user?.id) {
            fetchUsers();
        } else {
            setUsers([]);
            setSelectedUsers([]);
            setSearchQuery("");
        }
    }, [visible, user?.id]);

    const fetchUsers = async () => {
        if (!user?.id || !token) return;

        setLoading(true);
        try {
            // Fetch both followers and following
            const [followers, following] = await Promise.all([
                getFollowers(user.id).catch(() => []),
                getFollowing(user.id).catch(() => []),
            ]);

            // Combine and deduplicate users
            const allUsersMap = new Map();

            // Add followers
            (followers || []).forEach((follower) => {
                const id = follower.id || follower.user_id || follower._id;
                if (id && id !== user.id) {
                    allUsersMap.set(id, {
                        id,
                        user_id: id,
                        full_name: follower.full_name || follower.username || "Unknown",
                        username: follower.username || follower.full_name || "Unknown",
                        profile_picture: follower.profile_picture || follower.profile_picture_url,
                        type: "follower",
                    });
                }
            });

            // Add following
            (following || []).forEach((followingUser) => {
                const id = followingUser.id || followingUser.user_id || followingUser._id;
                if (id && id !== user.id) {
                    // If user is in both, mark as "both"
                    if (allUsersMap.has(id)) {
                        allUsersMap.get(id).type = "both";
                    } else {
                        allUsersMap.set(id, {
                            id,
                            user_id: id,
                            full_name: followingUser.full_name || followingUser.username || "Unknown",
                            username: followingUser.username || followingUser.full_name || "Unknown",
                            profile_picture: followingUser.profile_picture || followingUser.profile_picture_url,
                            type: "following",
                        });
                    }
                }
            });

            const allUsers = Array.from(allUsersMap.values());
            setUsers(allUsers);
        } catch (error) {
            console.error("❌ Error fetching users:", error);
        } finally {
            setLoading(false);
        }
    };

    const filteredUsers = users.filter((user) => {
        const query = searchQuery.toLowerCase();
        return (
            user.username.toLowerCase().includes(query) ||
            user.full_name.toLowerCase().includes(query)
        );
    });

    const toggleUserSelection = (userId) => {
        setSelectedUsers((prev) => {
            if (prev.includes(userId)) {
                return prev.filter((id) => id !== userId);
            } else {
                return [...prev, userId];
            }
        });
    };

    const handleSend = () => {
        if (selectedUsers.length === 0) return;

        if (onShare) {
            onShare(selectedUsers);
        }
        setSelectedUsers([]);
        onClose();
    };

    const renderUserItem = ({ item }) => {
        const isSelected = selectedUsers.includes(item.id);
        const profilePic = normalizeProfilePicture(item.profile_picture);

        return (
            <TouchableOpacity
                style={styles.userItem}
                onPress={() => toggleUserSelection(item.id)}
            >
                <UserAvatar
                    userId={item.id}
                    profilePicture={profilePic}
                    username={item.username}
                    size={50}
                    showLevelBadge={false}
                />
                <View style={styles.userInfo}>
                    <Text style={styles.username}>{item.username}</Text>
                    <Text style={styles.fullName}>{item.full_name}</Text>
                    {item.type === "both" && (
                        <Text style={styles.typeLabel}>Following each other</Text>
                    )}
                </View>
                <View style={styles.checkboxContainer}>
                    {isSelected ? (
                        <View style={styles.checkboxSelected}>
                            <Ionicons name="checkmark" size={20} color="#fff" />
                        </View>
                    ) : (
                        <View style={styles.checkboxUnselected} />
                    )}
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <Modal
            visible={visible}
            transparent={true}
            animationType="slide"
            onRequestClose={onClose}
        >
            <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                    {/* Header */}
                    <View style={styles.header}>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <Ionicons name="close" size={28} color="#000" />
                        </TouchableOpacity>
                        <Text style={styles.headerTitle}>Share to</Text>
                        <TouchableOpacity
                            onPress={handleSend}
                            style={[
                                styles.sendButton,
                                selectedUsers.length === 0 && styles.sendButtonDisabled,
                            ]}
                            disabled={selectedUsers.length === 0}
                        >
                            <Text
                                style={[
                                    styles.sendButtonText,
                                    selectedUsers.length === 0 && styles.sendButtonTextDisabled,
                                ]}
                            >
                                Send{selectedUsers.length > 0 ? ` (${selectedUsers.length})` : ""}
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {/* Search Bar */}
                    <View style={styles.searchContainer}>
                        <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
                        <TextInput
                            style={styles.searchInput}
                            placeholder="Search..."
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            placeholderTextColor="#999"
                        />
                        {searchQuery.length > 0 && (
                            <TouchableOpacity onPress={() => setSearchQuery("")}>
                                <Ionicons name="close-circle" size={20} color="#666" />
                            </TouchableOpacity>
                        )}
                    </View>

                    {/* Users List */}
                    {loading ? (
                        <View style={styles.loadingContainer}>
                            <ActivityIndicator size="large" color="#1B7C82" />
                            <Text style={styles.loadingText}>Loading users...</Text>
                        </View>
                    ) : filteredUsers.length === 0 ? (
                        <View style={styles.emptyContainer}>
                            <Ionicons name="people-outline" size={60} color="#ccc" />
                            <Text style={styles.emptyText}>
                                {searchQuery ? "No users found" : "No users to share with"}
                            </Text>
                            <Text style={styles.emptySubtext}>
                                {searchQuery
                                    ? "Try a different search term"
                                    : "Follow users to share posts with them"}
                            </Text>
                        </View>
                    ) : (
                        <FlatList
                            data={filteredUsers}
                            keyExtractor={(item) => item.id}
                            renderItem={renderUserItem}
                            contentContainerStyle={styles.listContent}
                        />
                    )}
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        justifyContent: "flex-end",
    },
    modalContent: {
        backgroundColor: "#fff",
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        maxHeight: "90%",
        paddingTop: 10,
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: "#f0f0f0",
    },
    closeButton: {
        padding: 4,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: "600",
        color: "#000",
    },
    sendButton: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        backgroundColor: "#1B7C82",
        borderRadius: 20,
    },
    sendButtonDisabled: {
        backgroundColor: "#ccc",
    },
    sendButtonText: {
        color: "#fff",
        fontWeight: "600",
        fontSize: 14,
    },
    sendButtonTextDisabled: {
        color: "#999",
    },
    searchContainer: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#f5f5f5",
        marginHorizontal: 16,
        marginVertical: 12,
        paddingHorizontal: 12,
        borderRadius: 10,
        height: 40,
    },
    searchIcon: {
        marginRight: 8,
    },
    searchInput: {
        flex: 1,
        fontSize: 16,
        color: "#000",
    },
    loadingContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        paddingVertical: 60,
    },
    loadingText: {
        marginTop: 12,
        color: "#666",
        fontSize: 14,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        paddingVertical: 60,
    },
    emptyText: {
        marginTop: 16,
        fontSize: 18,
        fontWeight: "600",
        color: "#666",
    },
    emptySubtext: {
        marginTop: 8,
        fontSize: 14,
        color: "#999",
        textAlign: "center",
        paddingHorizontal: 40,
    },
    listContent: {
        paddingBottom: 20,
    },
    userItem: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: "#f0f0f0",
    },
    userInfo: {
        flex: 1,
        marginLeft: 12,
    },
    username: {
        fontSize: 16,
        fontWeight: "600",
        color: "#000",
    },
    fullName: {
        fontSize: 14,
        color: "#666",
        marginTop: 2,
    },
    typeLabel: {
        fontSize: 12,
        color: "#1B7C82",
        marginTop: 2,
    },
    checkboxContainer: {
        marginLeft: 12,
    },
    checkboxSelected: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: "#1B7C82",
        justifyContent: "center",
        alignItems: "center",
    },
    checkboxUnselected: {
        width: 24,
        height: 24,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: "#ccc",
    },
});

