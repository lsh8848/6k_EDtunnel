/**
 * TCP outbound connection management
 */

import { socks5Connect } from './socks5.js';
import { httpConnect } from './http.js';
import { remoteSocketToWS } from './stream.js';
import { safeCloseWebSocket } from '../utils/websocket.js';

/**
 * Handles outbound TCP connections for the proxy.
 * Establishes connection to remote server and manages data flow.
 * @param {{value: import("@cloudflare/workers-types").Socket | null}} remoteSocket - Remote socket wrapper
 * @param {number} addressType - Type of address (1=IPv4, 2=Domain, 3=IPv6)
 * @param {string} addressRemote - Remote server address
 * @param {number} portRemote - Remote server port
 * @param {Uint8Array} rawClientData - Raw data from client
 * @param {WebSocket} webSocket - WebSocket connection
 * @param {Uint8Array} protocolResponseHeader - Protocol response header
 * @param {Function} log - Logging function
 * @param {Object} config - Request configuration
 * @param {Function} connect - Cloudflare socket connect function
 */
export async function handleTCPOutBound(remoteSocket, addressType, addressRemote, portRemote, rawClientData, webSocket, protocolResponseHeader, log, config, connect) {
	async function connectAndWrite(address, port, useProxy = false) {
		/** @type {import("@cloudflare/workers-types").Socket} */
		let tcpSocket;

		// Use proxy if socks5Relay (global mode) is enabled, or if useProxy flag is set
		const shouldUseProxy = config.socks5Relay || useProxy;

		if (shouldUseProxy && config.proxyType && config.parsedProxyAddress) {
			if (config.proxyType === 'http') {
				// HTTP proxy handles initial data write internally
				tcpSocket = await httpConnect(addressType, address, port, log, config.parsedProxyAddress, connect, rawClientData);
				if (!tcpSocket) {
					throw new Error('HTTP proxy connection failed');
				}
				remoteSocket.value = tcpSocket;
				log(`connected to ${address}:${port} via HTTP proxy`);
				return tcpSocket;
			} else {
				// SOCKS5 proxy
				tcpSocket = await socks5Connect(addressType, address, port, log, config.parsedProxyAddress, connect);
			}
		} else {
			// Direct connection
			tcpSocket = connect({
				hostname: address,
				port: port,
			});
		}
		remoteSocket.value = tcpSocket;
		log(`connected to ${address}:${port}`);
		const writer = tcpSocket.writable.getWriter();
		await writer.write(rawClientData); // first write, normally TLS client hello
		writer.releaseLock();
		return tcpSocket;
	}

	// If the cf connect tcp socket has no incoming data, retry with redirect IP
	async function retry() {
		let tcpSocket;
		if (config.proxyType && config.parsedProxyAddress) {
			tcpSocket = await connectAndWrite(addressRemote, portRemote, true);
		} else {
			tcpSocket = await connectAndWrite(config.proxyIP || addressRemote, config.proxyPort || portRemote, false);
		}
		// No matter retry success or not, close websocket
		tcpSocket.closed.catch(error => {
			console.log('retry tcpSocket closed error', error);
		}).finally(() => {
			safeCloseWebSocket(webSocket);
		});
		remoteSocketToWS(tcpSocket, webSocket, protocolResponseHeader, null, log);
	}

	let tcpSocket = await connectAndWrite(addressRemote, portRemote);

	// When remoteSocket is ready, pass to websocket
	// remote --> ws
	remoteSocketToWS(tcpSocket, webSocket, protocolResponseHeader, retry, log);
}
