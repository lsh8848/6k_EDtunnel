/**
 * Main request handler and routing
 */

import { createRequestConfig, defaultUserID, proxyIPs } from '../config/defaults.js';
import { handleDefaultPath } from './http.js';
import { protocolOverWSHandler } from './websocket.js';
import { getConfig } from '../generators/config-page.js';
import { genSub } from '../generators/subscription.js';
import { handleProxyConfig, socks5AddressParser, selectRandomAddress, parseEncodedQueryParams } from '../utils/parser.js';
import { isValidUUID } from '../utils/validation.js';

// Validate default user ID at startup
if (!isValidUUID(defaultUserID)) {
	throw new Error('uuid is not valid');
}

/**
 * Main request handler for the Cloudflare Worker.
 * Processes incoming requests and routes them appropriately.
 * @param {import("@cloudflare/workers-types").Request} request - The incoming request object
 * @param {Object} env - Environment variables containing configuration
 * @param {import("@cloudflare/workers-types").ExecutionContext} ctx - Execution context
 * @param {Function} connect - Cloudflare socket connect function
 * @returns {Promise<Response>} Response object
 */
export async function handleRequest(request, env, ctx, connect) {
	try {
		const { UUID, PROXYIP, SOCKS5, SOCKS5_RELAY } = env;
		const url = new URL(request.url);

		// Create request-specific configuration
		const requestConfig = createRequestConfig(env);

		// Get URL parameters
		let urlPROXYIP = url.searchParams.get('proxyip');
		let urlSOCKS5 = url.searchParams.get('socks5');
		let urlSOCKS5_RELAY = url.searchParams.get('socks5_relay');

		// Check for encoded parameters in path
		if (!urlPROXYIP && !urlSOCKS5 && !urlSOCKS5_RELAY) {
			const encodedParams = parseEncodedQueryParams(url.pathname);
			urlPROXYIP = urlPROXYIP || encodedParams.proxyip;
			urlSOCKS5 = urlSOCKS5 || encodedParams.socks5;
			urlSOCKS5_RELAY = urlSOCKS5_RELAY || encodedParams.socks5_relay;
		}

		// Validate proxyip format
		if (urlPROXYIP) {
			const proxyPattern = /^([a-zA-Z0-9][-a-zA-Z0-9.]*(\.[a-zA-Z0-9][-a-zA-Z0-9.]*)+|\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}|\[[0-9a-fA-F:]+\]):\d{1,5}$/;
			const proxyAddresses = urlPROXYIP.split(',').map(addr => addr.trim());
			const isValid = proxyAddresses.every(addr => proxyPattern.test(addr));
			if (!isValid) {
				console.warn('Invalid proxyip format:', urlPROXYIP);
				urlPROXYIP = null;
			}
		}

		// Validate socks5 format
		if (urlSOCKS5) {
			const socks5Pattern = /^(([^:@]+:[^:@]+@)?[a-zA-Z0-9][-a-zA-Z0-9.]*(\.[a-zA-Z0-9][-a-zA-Z0-9.]*)+|\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}):\d{1,5}$/;
			const socks5Addresses = urlSOCKS5.split(',').map(addr => addr.trim());
			const isValid = socks5Addresses.every(addr => socks5Pattern.test(addr));
			if (!isValid) {
				console.warn('Invalid socks5 format:', urlSOCKS5);
				urlSOCKS5 = null;
			}
		}

		// Apply URL parameters to request config
		requestConfig.socks5Address = urlSOCKS5 || requestConfig.socks5Address;
		requestConfig.socks5Relay = urlSOCKS5_RELAY === 'true' || requestConfig.socks5Relay;

		// Log parameters for debugging
		console.log('Config params:', requestConfig.userID, requestConfig.socks5Address, requestConfig.socks5Relay, urlPROXYIP);

		// Handle proxy configuration
		const proxyConfig = handleProxyConfig(urlPROXYIP || PROXYIP);
		requestConfig.proxyIP = proxyConfig.ip;
		requestConfig.proxyPort = proxyConfig.port;

		// Log final proxy settings
		console.log('Using proxy:', requestConfig.proxyIP, requestConfig.proxyPort);

		// Parse SOCKS5 configuration if provided
		if (requestConfig.socks5Address) {
			try {
				const selectedSocks5 = selectRandomAddress(requestConfig.socks5Address);
				requestConfig.parsedSocks5Address = socks5AddressParser(selectedSocks5);
				requestConfig.enableSocks = true;
			} catch (err) {
				console.log(err.toString());
				requestConfig.enableSocks = false;
			}
		}

		const userIDs = requestConfig.userID.includes(',') ? requestConfig.userID.split(',').map(id => id.trim()) : [requestConfig.userID];
		const host = request.headers.get('Host');
		const requestedPath = url.pathname.substring(1); // Remove leading slash
		const matchingUserID = userIDs.length === 1 ?
			(requestedPath === userIDs[0] ||
				requestedPath === `sub/${userIDs[0]}` ||
				requestedPath === `bestip/${userIDs[0]}` ? userIDs[0] : null) :
			userIDs.find(id => {
				const patterns = [id, `sub/${id}`, `bestip/${id}`];
				return patterns.some(pattern => requestedPath.startsWith(pattern));
			});

		// Non-WebSocket requests
		if (request.headers.get('Upgrade') !== 'websocket') {
			if (url.pathname === '/cf') {
				return new Response(JSON.stringify(request.cf, null, 4), {
					status: 200,
					headers: { "Content-Type": "application/json;charset=utf-8" },
				});
			}

			if (matchingUserID) {
				if (url.pathname === `/${matchingUserID}` || url.pathname === `/sub/${matchingUserID}`) {
					const isSubscription = url.pathname.startsWith('/sub/');
					// Priority: URL parameter > environment variable > default
					const proxyAddresses = urlPROXYIP
						? urlPROXYIP.split(',').map(addr => addr.trim())
						: (PROXYIP ? PROXYIP.split(',').map(addr => addr.trim()) : proxyIPs);
					const content = isSubscription ?
						genSub(matchingUserID, host, proxyAddresses) :
						getConfig(matchingUserID, host, proxyAddresses);

					return new Response(content, {
						status: 200,
						headers: {
							"Content-Type": isSubscription ?
								"text/plain;charset=utf-8" :
								"text/html; charset=utf-8"
						},
					});
				} else if (url.pathname === `/bestip/${matchingUserID}`) {
					return fetch(`https://bestip.06151953.xyz/auto?host=${host}&uuid=${matchingUserID}&path=/`, { headers: request.headers });
				}
			}
			return handleDefaultPath(url, request);
		} else {
			// WebSocket upgrade request
			return await protocolOverWSHandler(request, requestConfig, connect);
		}
	} catch (err) {
		return new Response(err.toString());
	}
}
