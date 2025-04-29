
/**
 * Common emoji mappings for different status indicators
 * Used for suggestions and default mappings (currently not used for suggestions, but available)
 */
export const emojiSuggestions = {
  // Mood states
  "mood": ["😊", "😃", "😇", "🙂", "😌", "😎", "🙃"],
  "happy": ["😊", "😁", "😄", "🥰", "🤗"],
  "sad": ["😔", "😢", "😞", "🥺", "😟"],
  "angry": ["😠", "😡", "🤬", "😤", "😒"],
  "excited": ["🤩", "😝", "🥳", "😁", "😆"],
  "tired": ["😴", "🥱", "😪", "💤", "🛌"], // Matches personal state

  // Physical states
  "energy": ["⚡", "🔋", "⚡️", "💫", "✨"],
  "focus": ["🧠", "🔍", "👁️", "🎯", "💭"],
  "hunger": ["🍽️", "🍴", "🍲", "🥘", "🍚"], // Matches personal state
  "thirst": ["🥤", "💧", "🧃", "🥛", "🫖"], // Matches personal state

  // Activity states
  "gaming": ["🎮", "🎯", "🎲", "🎪", "👾"], // Matches personal state
  "working": ["💼", "💻", "👩‍💻", "👨‍💻", "📊"],
  "studying": ["📚", "📝", "🧩", "🔬", "📓"],
  "creative": ["🎨", "🖌️", "✏️", "🎹", "🎬"],
  "social": ["👋", "🗣️", "👥", "🤝", "🫂"], // Matches personal state (connection)
  "relaxing": ["🧘", "🛀", "🏖️", "🏝️", "☕"], // Matches personal state (relaxation)

  // Availability states
  "available": ["✅", "👍", "🟢", "🆗", "👌"],
  "busy": ["⛔", "🔴", "🚫", "❌", "⏱️"],
  "afk": ["🚶", "💤", "🏃", "🚪", "🌙"],

  // Personal states (from Phase 0)
  "arousal": ["😈", "🔥", "🌶️", "💋", "❤️‍🔥", "😏"], // Matches personal state
  "connection": ["🫂", "🤝", "👥", "💬"], // Matches personal state
  "stimulation": ["🧠", "💡", "🤔", "🧩"], // Matches personal state (mental)
  "entertainment": ["🎮", "🎬", "📺", "🎵"], // Matches personal state

  // Other common states
  "stressed": ["😫", "😖", "🥵", "😰", "🤯"],
  "sick": ["🤒", "🤢", "🤧", "🤕", "😷"]
};

/**
 * Get emoji suggestions for a specific state (currently unused, for future autocomplete).
 * @param {string} stateName - State name to get suggestions for.
 * @returns {Array} - Array of suggested emojis or default suggestions.
 */
export function getEmojiSuggestions(stateName) {
  const lowerName = stateName.toLowerCase();

  // Check for exact match
  if (emojiSuggestions[lowerName]) {
    return emojiSuggestions[lowerName];
  }

  // Check for partial matches (simple substring check)
  for (const [key, suggestions] of Object.entries(emojiSuggestions)) {
    if (lowerName.includes(key) || key.includes(lowerName)) {
      return suggestions;
    }
  }

  // Default to mood emojis if no match
  return emojiSuggestions["mood"];
}
