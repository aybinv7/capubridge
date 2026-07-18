# Network inspector

Status: Beta

Network inspection captures supported HTTP request lifecycles from the selected target. History and payload retention are bounded to keep long sessions responsive.

## Requests

The request list exposes available URL, method, status, resource type, size, timing, request data, response data, redirects, and terminal failure information.

Filtering and selection operate on the bounded captured history. Target navigation, backgrounding, and disconnect clear or transition state explicitly instead of leaving stale success data.

## Request details

Available request data is grouped into headers, payload, response, and timing views. Bodies that exceed the retention budget are truncated with an explicit state rather than retained without limit.

## Mocking

Request mocking is experimental. When enabled, rules are synchronized to the real mock server and target interception path. Start, synchronization, stop, and failure states are visible.

## Not shipped

WebSocket frame inspection and network throttling are hidden because their complete target workflows are not yet implemented. They must not appear as active production controls.
