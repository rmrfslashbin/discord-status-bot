// src/utils/time.js - Time utility functions

/**
 * Placeholder: Convert ISO timestamp to user's timezone.
 * Requires a robust timezone library compatible with CF Workers.
 * @param {string} isoTimestamp - ISO 8601 timestamp string.
 * @param {string} timezone - IANA timezone identifier (e.g., 'America/New_York').
 * @returns {string} - Formatted date/time string in the user's timezone.
 */
export function convertToUserTimezone(isoTimestamp, timezone) {
    // TODO: Implement proper timezone conversion.
    // Intl.DateTimeFormat might work in Workers but needs testing.
    // Libraries like Luxon or date-fns might be too large or have dependencies.
    console.warn(`Timezone conversion not fully implemented. Timezone: ${timezone}`);
    try {
        // Basic fallback using system's locale settings (might not be accurate)
        return new Date(isoTimestamp).toLocaleString();
    } catch (e) {
        return isoTimestamp; // Return original if parsing fails
    }
}

/**
 * Placeholder: Get relative time string (e.g., "5 minutes ago").
 * @param {string} isoTimestamp - ISO 8601 timestamp string.
 * @param {string} [timezone] - Optional timezone (currently unused in this placeholder).
 * @returns {string} - Relative time string.
 */
export function getRelativeTime(isoTimestamp, timezone) {
    // TODO: Implement proper relative time calculation.
    // Intl.RelativeTimeFormat might work but needs careful handling of units.
    console.warn("Relative time calculation not fully implemented.");
    try {
        const date = new Date(isoTimestamp);
        const now = new Date();
        const diffSeconds = Math.round((now - date) / 1000);

        if (diffSeconds < 60) return `${diffSeconds}s ago`;
        const diffMinutes = Math.round(diffSeconds / 60);
        if (diffMinutes < 60) return `${diffMinutes}m ago`;
        const diffHours = Math.round(diffMinutes / 60);
        if (diffHours < 24) return `${diffHours}h ago`;
        const diffDays = Math.round(diffHours / 24);
        return `${diffDays}d ago`;
    } catch (e) {
        return "unknown time ago";
    }
}
