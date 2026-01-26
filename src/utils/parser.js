/**
 * Parser utilities for addresses and parameters
 */

import { proxyIPs } from '../config/defaults.js';

/**
 * Parses SOCKS5 address string into components.
 * @param {string} address - SOCKS5 address string (format: 'username:password@host:port' or 'host:port')
 * @returns {{username: string|undefined, password: string|undefined, hostname: string, port: number}} Parsed address information
 * @throws {Error} If address format is invalid
 */
export function socks5AddressParser(address) {
	let [latter, former] = address.split("@").reverse();
	let username, password, hostname, port;
	if (former) {
		const formers = former.split(":");
		if (formers.length !== 2) {
			throw new Error('Invalid SOCKS address format');
		}
		[username, password] = formers;
	}
	const latters = latter.split(":");
	port = Number(latters.pop());
	if (isNaN(port)) {
		throw new Error('Invalid SOCKS address format');
	}
	hostname = latters.join(":");
	const regex = /^\[.*\]$/;
	if (hostname.includes(":") && !regex.test(hostname)) {
		throw new Error('Invalid SOCKS address format');
	}
	return {
		username,
		password,
		hostname,
		port,
	};
}

/**
 * Handles proxy configuration and returns standardized proxy settings.
 * @param {string} PROXYIP - Proxy IP configuration from environment
 * @returns {{ip: string, port: string}} Standardized proxy configuration
 */
export function handleProxyConfig(PROXYIP) {
	if (PROXYIP) {
		const proxyAddresses = PROXYIP.split(',').map(addr => addr.trim());
		const selectedProxy = selectRandomAddress(proxyAddresses);
		const [ip, port = '443'] = selectedProxy.split(':');
		return { ip, port };
	} else {
		// Use default from proxyIPs
		const defaultProxy = proxyIPs[Math.floor(Math.random() * proxyIPs.length)];
		const port = defaultProxy.includes(':') ? defaultProxy.split(':')[1] : '443';
		const ip = defaultProxy.split(':')[0];
		return { ip, port };
	}
}

/**
 * Selects a random address from a comma-separated string or array of addresses.
 * @param {string|string[]} addresses - Comma-separated string or array of addresses
 * @returns {string} Selected address
 */
export function selectRandomAddress(addresses) {
	const addressArray = typeof addresses === 'string' ?
		addresses.split(',').map(addr => addr.trim()) :
		addresses;
	return addressArray[Math.floor(Math.random() * addressArray.length)];
}

/**
 * Parses encoded query parameters from URL pathname.
 * Handles parameters encoded with %3F (?) in the path.
 * @param {string} pathname - URL path
 * @returns {Object} Parsed parameters object
 */
export function parseEncodedQueryParams(pathname) {
	const params = {};
	if (pathname.includes('%3F')) {
		const encodedParamsMatch = pathname.match(/%3F(.+)$/);
		if (encodedParamsMatch) {
			const encodedParams = encodedParamsMatch[1];
			const paramPairs = encodedParams.split('&');

			for (const pair of paramPairs) {
				const [key, value] = pair.split('=');
				if (value) params[key] = decodeURIComponent(value);
			}
		}
	}
	return params;
}

/**
 * Decodes proxy address with Base64 encoded username:password.
 * @param {string} address - Address string (may contain Base64 encoded credentials)
 * @returns {string} Decoded address string
 */
function decodeProxyAddress(address) {
	if (!address.includes('@')) return address;

	const atIndex = address.lastIndexOf('@');
	let userPass = address.substring(0, atIndex).replace(/%3D/gi, '=');
	const hostPort = address.substring(atIndex + 1);

	// Try Base64 decode if it looks like Base64 and doesn't contain ':'
	if (/^[A-Za-z0-9+/]+=*$/.test(userPass) && !userPass.includes(':')) {
		try {
			userPass = atob(userPass);
		} catch (e) {
			// Not valid Base64, keep original
		}
	}

	return `${userPass}@${hostPort}`;
}

/**
 * Parses path-based proxy parameters.
 * Supports formats: /proxyip=, /proxyip., /socks5=, /socks://, /socks5://, /http=, /http://
 * @param {string} pathname - URL pathname
 * @returns {{proxyip: string|null, socks5: string|null, http: string|null, globalProxy: boolean}} Parsed parameters
 */
export function parsePathProxyParams(pathname) {
	const result = {
		proxyip: null,
		socks5: null,
		http: null,
		globalProxy: false
	};

	// 1. Match /proxyip=host:port, /proxyip.domain.com, /pyip=, /ip=
	const proxyipMatch = pathname.match(/^\/(proxyip[.=]|pyip=|ip=)([^/?#]+)/i);
	if (proxyipMatch) {
		const prefix = proxyipMatch[1].toLowerCase();
		const value = proxyipMatch[2];
		result.proxyip = prefix === 'proxyip.' ? `proxyip.${value}` : value;
		return result;
	}

	// 2. Match /socks://base64@host:port or /socks5://user:pass@host:port
	const socksUrlMatch = pathname.match(/^\/(socks5?):\/\/?([^/?#]+)/i);
	if (socksUrlMatch) {
		result.socks5 = decodeProxyAddress(socksUrlMatch[2]);
		result.globalProxy = true;
		return result;
	}

	// 3. Match /socks5=, /socks=, /s5=, /gs5=, /gsocks5=
	const socksEqMatch = pathname.match(/^\/(g?s5|g?socks5?)=([^/?#]+)/i);
	if (socksEqMatch) {
		const type = socksEqMatch[1].toLowerCase();
		result.socks5 = socksEqMatch[2];
		// g prefix enables global proxy mode
		if (type.startsWith('g')) {
			result.globalProxy = true;
		}
		return result;
	}

	// 4. Match /http://user:pass@host:port
	const httpUrlMatch = pathname.match(/^\/http:\/\/?([^/?#]+)/i);
	if (httpUrlMatch) {
		result.http = decodeProxyAddress(httpUrlMatch[1]);
		result.globalProxy = true;
		return result;
	}

	// 5. Match /http=user:pass@host:port or /ghttp= (global mode)
	const httpEqMatch = pathname.match(/^\/(g?http)=([^/?#]+)/i);
	if (httpEqMatch) {
		const type = httpEqMatch[1].toLowerCase();
		result.http = httpEqMatch[2];
		// g prefix enables global proxy mode
		if (type.startsWith('g')) {
			result.globalProxy = true;
		}
		return result;
	}

	return result;
}
