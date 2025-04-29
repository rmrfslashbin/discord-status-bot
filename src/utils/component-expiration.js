
/**
 * Check if a component interaction is expired based on a timestamp embedded in its custom ID.
 * @param {Array} params - Parameters parsed from the custom ID (expects timestamp as the second element).
 * @param {number} [maxAgeHours=24] - Maximum age in hours (default: 24).
 * @returns {boolean} - True if expired, false otherwise.
 */
export function isComponentExpired(params, maxAgeHours = 24) {
  // Get timestamp from params (usually the second parameter after the action)
  const timestampStr = params[1]; // e.g., customId = "action:param1:timestamp:param3" -> params = ["param1", "timestamp", "param3"]

  if (!timestampStr || isNaN(parseInt(timestampStr))) {
    console.warn('Component expiration check failed: No valid timestamp found in params[1].');
    return true; // No valid timestamp, consider expired
  }

  const timestamp = parseInt(timestampStr, 10);
  const componentTime = new Date(timestamp);
  const currentTime = new Date();

  // Calculate time difference in hours
  const diffHours = (currentTime - componentTime) / (1000 * 60 * 60);

  if (diffHours > maxAgeHours) {
      console.log(`Component interaction expired. Age: ${diffHours.toFixed(2)}h, Max: ${maxAgeHours}h`);
      return true;
  }

  return false;
}

/**
 * Higher-order function to wrap component handlers with an expiration check.
 * Assumes the timestamp is the second parameter in the custom ID params array.
 * @param {Function} handlerFunction - The original component handler function (async or sync).
 * @param {Function} handlerFunction - The original component handler function (async or sync), expected signature: (interaction, params, context).
 * @returns {Function} - Wrapped handler function that checks expiration first, signature: (interaction, params, context).
 */
export function withExpirationCheck(handlerFunction) {
  // The returned function now accepts the context object
  return async function(interaction, params, context) {
    // Check if component is expired
    if (isComponentExpired(params)) {
      // Return an ephemeral message indicating expiration
      // Note: This structure matches the expected response data format
      return {
        content: "This interaction has expired. Please use the components on the latest status message.",
        ephemeral: true
      };
    }

    // If not expired, call the original handler, passing context along
    return await handlerFunction(interaction, params, context);
  };
}
