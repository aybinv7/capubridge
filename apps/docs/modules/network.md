# Network Inspector

Monitor HTTP and WebSocket traffic from the target. Inspect requests, responses, headers, and bodies. Throttle the network and mock responses.

## Request list

The main view shows all recorded HTTP requests:![Screenshot showing the network request list with URL, status, type, size, and timing columns]
| Column | Description |
|--------|-------------|
| **Name** | Request URL or resource |
| **Status** | HTTP status code (color-coded) |
| **Type** | MIME type |
| **Size** | Response body size |
| **Time** | Total request duration |

### Filtering

Use the toolbar search to filter by URL, or use the filter chips:![Screenshot showing filter chips for document, script, xhr, fetch, stylesheet, image, font, and other types]

### Request grouping

Group requests by **domain** or **file** to reduce noise.

## Request detail

Click a request to open the detail panel:![Screenshot showing the request detail with Headers, Payload, Response, and Timing tabs]

### Headers tab

View request and response headers in a table.

### Payload tab

For POST and PUT requests, view the request body. Form data is parsed and displayed as key-value pairs.

### Response tab

View the response body with:

- **Pretty print** for JSON, HTML, XML
- **Raw** for other formats
- **Preview** for HTML and images

### Timing tab

Waterfall chart showing the breakdown of the request:![Screenshot showing the timing waterfall with DNS, Connect, SSL, TTFB, Content Download, and Total bars]

- **DNS** — DNS lookup
- **Connect** — TCP connection
- **SSL** — TLS handshake
- **TTFB** — Time to first byte
- **Content Download** — Response body download
- **Total** — End-to-end time

## Network throttling

Simulate slow network conditions.

### Presets

| Preset  | Download  | Upload    | Latency |
| ------- | --------- | --------- | ------- |
| Online  | Unlimited | Unlimited | 0ms     |
| Wi-Fi   | 4 Mbps    | 3 Mbps    | 2ms     |
| 3G      | 750 Kbps  | 250 Kbps  | 100ms   |
| 2G      | 50 Kbps   | 30 Kbps   | 200ms   |
| Offline | 0 Kbps    | 0 Kbps    | 0ms     |

### Custom

Set your own download speed, upload speed, and latency.

## WebSocket frames

Inspect WebSocket frames in real time:![Screenshot showing the WebSocket frame inspector]

- **Direction** — sent or received
- **Opcode** — text, binary, close, ping, pong
- **Data** — frame payload
- **Timestamp** — when the frame was sent/received

## Request mocking

Define mock rules to intercept and replace responses.![Screenshot showing the mock rules editor]
A mock rule consists of:![Screenshot showing the rule editor dialog]

1. **URL pattern** — regex or glob to match request URLs
2. **Method** — GET, POST, etc.
3. **Response** — static JSON, a file, or a generated response
4. **Delay** — optional response delay (ms)
   Rules are evaluated in order. First matching rule wins.
