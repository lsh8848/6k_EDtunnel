# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

EDtunnel is a Cloudflare Worker/Pages-based VLESS proxy tool that implements WebSocket transport protocol for tunneling traffic. It runs on Cloudflare's serverless infrastructure and provides a web-based proxy service with multi-protocol support.

## Development Commands

```bash
# Local development
npm run dev          # Development with Wrangler (remote mode)
npm run dev-local    # Local development with src/index.js

# Production
npm run build        # Dry-run deployment check
npm run deploy       # Deploy to Cloudflare Workers
npm run bundle       # Bundle src/index.js to dist/bundle.js
npm run obfuscate    # Bundle + obfuscate → _worker.js
```

## Core Architecture

### Source Structure (src/)

```
src/
├── index.js              # Entry point, exports fetch handler
├── config/
│   ├── constants.js      # Protocol constants, ports, DNS servers
│   └── defaults.js       # Default UUID and configuration
├── handlers/
│   ├── main.js           # Main request router
│   ├── http.js           # HTTP request handling
│   └── websocket.js      # WebSocket upgrade and VLESS processing
├── protocol/
│   ├── vless.js          # VLESS protocol parsing
│   └── dns.js            # DNS query handling over UDP
├── proxy/
│   ├── tcp.js            # TCP connection management
│   ├── stream.js         # Stream processing utilities
│   └── socks5.js         # SOCKS5 proxy client
├── generators/
│   ├── config-page.js    # Web UI configuration page
│   └── subscription.js   # VLESS/Clash subscription generation
└── utils/
    ├── encoding.js       # Base64 encoding/decoding
    ├── validation.js     # UUID validation
    ├── parser.js         # Configuration parsing
    └── websocket.js      # WebSocket utilities
```

### Production Files

- **`_worker.js`** - Obfuscated bundle for Cloudflare deployment
- **`wrangler.toml`** - Cloudflare Worker configuration

### Request Flow

1. `src/index.js` → exports `fetch` handler
2. `handlers/main.js` → routes by URL path (`/cf`, `/{uuid}`, `/sub/{uuid}`)
3. `handlers/websocket.js` → WebSocket upgrade for VLESS tunneling
4. `protocol/vless.js` → parse VLESS header, extract destination
5. `proxy/tcp.js` or `proxy/socks5.js` → establish outbound connection

## Configuration

Environment variables (set in `wrangler.toml` or Cloudflare Dashboard):

| Variable | Description |
|----------|-------------|
| `UUID` | User authentication (comma-separated for multiple) |
| `PROXYIP` | Proxy server addresses (comma-separated, with optional port) |
| `SOCKS5` | SOCKS5 proxy (`user:pass@host:port`) |
| `SOCKS5_RELAY` | Enable SOCKS5 relay (`true`/`false`) |

URL query parameters can override: `proxyip`, `socks5`, `socks5_relay` (UUID cannot be overridden for security).

## Key Implementation Details

- Uses Cloudflare's `cloudflare:sockets` for TCP connections
- VLESS protocol version 0 with WebSocket transport
- Multi-proxy load balancing via random selection
- Subscription formats: VLESS links, Clash YAML, Base64 encoded
