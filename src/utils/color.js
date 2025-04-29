// src/utils/color.js - Color utility functions

/**
 * Converts a hex color string (e.g., '#RRGGBB', '#RGB') or common color name
 * to its integer representation used by Discord embeds.
 * @param {string} colorString - The hex color string or color name.
 * @returns {number} - The integer representation of the color, or a default color (Discord Blurple).
 */
export function hexColorToInt(colorString) {
    const defaultColor = 0x7289DA; // Discord Blurple

    if (!colorString || typeof colorString !== 'string') {
        return defaultColor;
    }

    // Common color names mapping (add more as needed)
    const colorNameMap = {
        red: 0xED4245,
        orange: 0xE67E22,
        yellow: 0xFEE75C,
        green: 0x57F287,
        blue: 0x3498DB,
        purple: 0x9B59B6,
        pink: 0xE91E63,
        white: 0xFFFFFF,
        black: 0x000000,
        grey: 0x95A5A6,
        blurple: 0x5865F2,
        // Add aliases if desired
        gray: 0x95A5A6,
    };

    const lowerCaseColor = colorString.toLowerCase().trim();

    // Check if it's a known color name
    if (colorNameMap[lowerCaseColor]) {
        return colorNameMap[lowerCaseColor];
    }

    // Check if it's a hex string
    let hex = lowerCaseColor.startsWith('#') ? lowerCaseColor.substring(1) : lowerCaseColor;

    // Handle shorthand hex (e.g., #RGB -> #RRGGBB)
    if (hex.length === 3) {
        hex = hex.split('').map(char => char + char).join('');
    }

    // Must be 6 hex digits
    if (hex.length !== 6 || !/^[0-9a-f]{6}$/.test(hex)) {
        console.warn(`Invalid color string provided: "${colorString}". Using default color.`);
        return defaultColor;
    }

    try {
        return parseInt(hex, 16);
    } catch (error) {
        console.error(`Error parsing hex color "${hex}":`, error);
        return defaultColor;
    }
}
