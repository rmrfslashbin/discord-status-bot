
/**
 * Visual themes for status dashboard
 */
export const statusThemes = {
  work: {
    color: 0x4287f5,         // Blue
    emoji_prefix: "💼",
    accent_bar: "━━━━ WORKING ━━━━",
    progress_filled: "█",     // Filled block for progress bars
    progress_empty: "░"       // Empty block for progress bars
  },
  gaming: {
    color: 0x9c59b6,         // Purple
    emoji_prefix: "🎮",
    accent_bar: "━━━━ GAMING ━━━━",
    progress_filled: "█",
    progress_empty: "░"
  },
  social: {
    color: 0xf1c40f,         // Yellow
    emoji_prefix: "👋",
    accent_bar: "━━━━ SOCIALIZING ━━━━",
    progress_filled: "█",
    progress_empty: "░"
  },
  rest: {
    color: 0x2ecc71,         // Green
    emoji_prefix: "😌",
    accent_bar: "━━━━ RESTING ━━━━",
    progress_filled: "█",
    progress_empty: "░"
  },
  creative: {
    color: 0xe74c3c,         // Red
    emoji_prefix: "🎨",
    accent_bar: "━━━━ CREATING ━━━━",
    progress_filled: "█",
    progress_empty: "░"
  },
  learning: { // Added learning theme
    color: 0x3498DB,         // Different Blue
    emoji_prefix: "📚",
    accent_bar: "━━━━ LEARNING ━━━━",
    progress_filled: "█",
    progress_empty: "░"
  },
  default: {
    color: 0x7289da,         // Discord blue
    emoji_prefix: "📊",
    accent_bar: "━━━━ STATUS ━━━━",
    progress_filled: "█",
    progress_empty: "░"
  }
};

/**
 * Helper function to create a text-based progress bar.
 * @param {number} value - Current value (assumed 1-5).
 * @param {number} [max=5] - Maximum value.
 * @param {Object} [theme=statusThemes.default] - The theme object containing progress bar characters.
 * @param {number} [barLength=10] - Total length of the progress bar string.
 * @returns {string} - The formatted progress bar string.
 */
export function createProgressBar(value, max = 5, theme = statusThemes.default, barLength = 10) {
  const { progress_filled = '█', progress_empty = '░' } = theme; // Default characters
  const numValue = parseInt(value, 10);

  if (isNaN(numValue) || numValue < 0) {
      return progress_empty.repeat(barLength); // Empty bar if invalid
  }
  // Ensure value doesn't exceed max for calculation
  const clampedValue = Math.min(numValue, max);
  const filledLength = Math.round((clampedValue / max) * barLength);
  const emptyLength = Math.max(0, barLength - filledLength); // Ensure non-negative

  return progress_filled.repeat(filledLength) + progress_empty.repeat(emptyLength);
}

/**
 * Get trend indicator emoji based on the trend string.
 * @param {string} trend - The trend string ('increasing', 'decreasing', 'stable', 'new', 'improved', 'worsened', 'unchanged').
 * @returns {string} - The corresponding emoji.
 */
export function getTrendIndicator(trend) {
  switch (trend) {
    case 'increasing':
    case 'improved':
      return '↗️';
    case 'decreasing':
    case 'worsened':
      return '↘️';
    case 'stable':
    case 'unchanged':
      return '⟳';
    case 'new':
      return '✨';
    default:
      return ''; // No indicator if trend is unknown or not applicable
  }
}

/**
 * Convert numeric rating (1-5) to a block string representation.
 * @param {number} rating - The rating number (1-5).
 * @returns {string} - String of filled/empty blocks or 'N/A'.
 */
export function ratingToBlocks(rating) {
    const numRating = parseInt(rating, 10);
    if (isNaN(numRating) || numRating < 1 || numRating > 5) {
      return '□□□□□'; // Default to empty if invalid
    }
    const filled = '■'; // Filled block
    const empty = '□'; // Empty block
    return filled.repeat(numRating) + empty.repeat(5 - numRating);
}
