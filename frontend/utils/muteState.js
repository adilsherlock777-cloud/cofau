// Shared mutable mute state across feed components
// This avoids prop drilling and prevents FlatList re-renders on mute toggle
export const muteState = { isMuted: true };
