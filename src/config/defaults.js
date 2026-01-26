/**
 * Default configuration values
 */

/**
 * Default user ID (UUID format)
 * Generate UUID: [Windows] Press "Win + R", input cmd and run: Powershell -NoExit -Command "[guid]::NewGuid()"
 */
export const defaultUserID = 'd342d11e-d424-4583-b36e-524ab1f0afa4';

/**
 * Default Trojan password
 * If empty, uses the UUID as password
 */
export const defaultTrojanPassword = '';

/**
 * Array of proxy server addresses with ports
 * Format: ['hostname:port', 'hostname:port']
 */
export const proxyIPs = ['cdn.xn--b6gac.eu.org:443', 'cdn-all.xn--b6gac.eu.org:443'];

/**
 * Default SOCKS5 proxy configuration
 * Format: 'username:password@host:port' or 'host:port'
 */
export const defaultSocks5Address = '';

/**
 * Default SOCKS5 relay mode
 * When true: All traffic is proxied through SOCKS5
 * When false: Only Cloudflare IPs use SOCKS5
 */
export const defaultSocks5Relay = false;

/**
 * Creates a request configuration object with default values
 * @param {Object} env - Environment variables
 * @param {string} env.UUID - User ID for authentication
 * @param {string} env.SOCKS5 - SOCKS5 proxy configuration
 * @param {string} env.SOCKS5_RELAY - SOCKS5 relay mode flag
 * @param {string} env.TROJAN_PASSWORD - Trojan password (optional, uses UUID if not set)
 * @returns {Object} Request configuration
 */
export function createRequestConfig(env = {}) {
	const { UUID, SOCKS5, SOCKS5_RELAY, TROJAN_PASSWORD } = env;
	const userID = UUID || defaultUserID;
	return {
		userID: userID,
		trojanPassword: TROJAN_PASSWORD || defaultTrojanPassword || userID,
		socks5Address: SOCKS5 || defaultSocks5Address,
		socks5Relay: SOCKS5_RELAY === 'true' || defaultSocks5Relay,
		proxyIP: null,
		proxyPort: null,
		// Proxy type: 'socks5' | 'http' | null
		proxyType: null,
		parsedProxyAddress: null
	};
}
