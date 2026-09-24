# Specification: Real-Time Streaming Infrastructure & WebSocket Hub

## ADDED Requirements

### Requirement: Unified Streaming Connection Manager
The system SHALL provide a centralized client-side streaming connection manager (`MarketDataStreamClient`) supporting WebSocket and Server-Sent Events (SSE) connections with subscription multiplexing, automatic reconnect with exponential backoff, heartbeat monitoring, and stale feed detection.

#### Scenario: Multiplexed topic subscriptions
- **GIVEN** multiple open panels requiring real-time updates (e.g. Quote Monitor tracking 20 tickers, Chart tracking AAPL, Time & Sales tracking AAPL)
- **WHEN** panels register their subscriptions
- **THEN** the streaming client SHALL multiplex all subscriptions over a single physical WebSocket/SSE connection.
- **AND** duplicate subscriptions for the same symbol/topic SHALL be deduplicated at the client hub.

#### Scenario: Automatic reconnection on disconnect
- **GIVEN** an active streaming session
- **WHEN** the network drops or the WebSocket disconnects
- **THEN** the client SHALL immediately mark active feeds with `quality: 'STALE'`
- **AND** it SHALL initiate exponential backoff reconnection attempts (1s, 2s, 4s, 8s, max 30s) while seamlessly falling back to background HTTP polling until reconnected.
- **AND** upon reconnection, all active subscriptions SHALL be automatically resubscribed.

### Requirement: Dynamic Unsubscription on Pane Teardown
The system SHALL track active panel subscriptions and immediately send unsubscription messages to the upstream server when a panel is closed or changes its instrument.

#### Scenario: Closing a streaming panel
- **GIVEN** a Time & Sales panel streaming tick prints for `"NVDA"`
- **WHEN** the user closes the panel or switches to another symbol
- **THEN** the subscription reference count for `"NVDA:trades"` SHALL decrement.
- **AND** if no other panel is subscribed to `"NVDA:trades"`, an unsubscription frame SHALL be dispatched to free network bandwidth and memory.

### Requirement: Throttled UI Dispatch and Memory Safety
The system SHALL batch high-frequency streaming events (e.g. tick trades and order book updates) into throttled animation frame intervals (e.g., 60 FPS or 50ms batching windows) to prevent React re-render thrashing.

#### Scenario: High-velocity market burst
- **GIVEN** a stock experiencing 500 trade prints per second during market open
- **WHEN** trade prints arrive at the streaming hub
- **THEN** the streaming client SHALL buffer prints and flush batched updates to the UI at throttled 50ms intervals.
- **AND** maximum in-memory buffer depth per panel SHALL be capped to prevent browser tab memory exhaustion.
