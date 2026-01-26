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
