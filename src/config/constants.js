/**
 * WebSocket ready state constants
 */
export const WS_READY_STATE_OPEN = 1;
export const WS_READY_STATE_CLOSING = 2;

/**
 * HTTP and HTTPS port sets for subscription generation
 */
export const HttpPort = new Set([80, 8080, 8880, 2052, 2086, 2095, 2082]);
export const HttpsPort = new Set([443, 8443, 2053, 2096, 2087, 2083]);

/**
 * Byte to hex lookup table for UUID conversion
 */
export const byteToHex = Array.from({ length: 256 }, (_, i) => (i + 0x100).toString(16).slice(1));

/**
 * Base64 encoded strings for protocol configuration
 */
export const at = 'QA==';
export const pt = 'dmxlc3M=';
export const ed = 'RUR0dW5uZWw=';
