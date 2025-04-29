// src/discord/verify.js - Discord request signature verification

// Import the SubtleCrypto interface if in a non-browser environment (like Cloudflare Workers)
// In standard Workers, `crypto.subtle` is available globally.
// If using Node.js for local testing, you might need `require('crypto').webcrypto.subtle`.

/**
 * Verifies the signature of an incoming Discord interaction request.
 * @param {string} rawBody - The raw request body as a string.
 * @param {string|null} signature - The value of the 'x-signature-ed25519' header.
 * @param {string|null} timestamp - The value of the 'x-signature-timestamp' header.
 * @param {string} publicKey - The application's public key from the Discord Developer Portal.
 * @returns {Promise<boolean>} - True if the signature is valid, false otherwise.
 */
export async function verifyDiscordRequest(rawBody, signature, timestamp, publicKey) {
  if (!signature || !timestamp || !publicKey || !rawBody) {
    console.warn('Missing signature, timestamp, publicKey, or body for verification.');
    return false;
  }

  try {
    const signatureBytes = hexToUint8Array(signature);
    const publicKeyBytes = hexToUint8Array(publicKey);
    const message = new TextEncoder().encode(timestamp + rawBody);

    // Import the public key as a CryptoKey
    const cryptoKey = await crypto.subtle.importKey(
      'raw', // Key format
      publicKeyBytes, // Raw key bytes
      { name: 'Ed25519' }, // Algorithm identifier for Ed25519
      true, // whether the key is extractable (ignored for Ed25519 verify)
      ['verify'] // Key usage
    );

    // Use the SubtleCrypto API to verify the signature with the imported CryptoKey
    const isValid = await crypto.subtle.verify(
      'Ed25519',      // Algorithm name must match the key's algorithm
      cryptoKey,      // The imported CryptoKey object
      signatureBytes, // The signature to verify
      message         // The data that was signed (timestamp + body)
    );

    if (!isValid) {
        console.warn('Invalid Discord signature detected.');
    } else {
        console.log('Discord signature verified successfully.');
    }

    return isValid;

  } catch (error) {
    console.error('Error during signature verification:', error);
    return false;
  }
}

/**
 * Converts a hexadecimal string to a Uint8Array.
 * @param {string} hexString - The hexadecimal string.
 * @returns {Uint8Array} - The corresponding Uint8Array.
 */
function hexToUint8Array(hexString) {
  if (hexString.length % 2 !== 0) {
    throw new Error('Invalid hex string length.');
  }
  const bytes = new Uint8Array(hexString.length / 2);
  for (let i = 0; i < hexString.length; i += 2) {
    bytes[i / 2] = parseInt(hexString.substring(i, i + 2), 16);
  }
  return bytes;
}
