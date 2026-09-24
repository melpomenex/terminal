# Specification: Server Architecture, Caching, Rate Limiting & Standardized Error Handling

## ADDED Requirements

### Requirement: Standardized API Gateway & Backend Architecture
The system SHALL organize all backend services beneath a versioned `/api/v2/*` gateway supporting caching policies, rate limiting, request deduplication, and secure secret proxying.

#### Scenario: Dataset-specific caching policies
- **GIVEN** backend API gateway
- **WHEN** requests are processed
- **THEN** it SHALL apply appropriate TTL caching headers:
  - Live Quotes / Streaming: Sub-second / In-memory event bus
  - Options Chains: 30 - 60 seconds
  - Intraday Bars: 60 seconds
  - Daily Historical Bars: 12 - 24 hours
  - Standardized Financial Statements (`FA`): 24 hours (immutable per fiscal quarter)
  - Transcripts (`TRAN`): 7 days (immutable post-call)
  - SEC EDGAR Submissions (`FLNG`): 15 minutes
  - Instrument Metadata & Security Master: 7 days.

### Requirement: Upstream Rate Limiting & Request Throttling
The system SHALL throttle upstream external requests (e.g. SEC EDGAR $\le 10$ req/sec, Polygon, Finnhub, Twelve Data) using token bucket rate limiters to prevent 429 errors.

#### Scenario: High-volume concurrent panel requests
- **GIVEN** 20 open panels requesting data simultaneously on workspace load
- **WHEN** outbound HTTP requests are dispatched
- **THEN** the request scheduler SHALL queue and space requests to remain strictly within vendor rate limits.
- **AND** identical concurrent requests for the same instrument/endpoint SHALL be deduplicated into a single in-flight promise.

### Requirement: Standardized Panel Error States
The system SHALL standardize all panel visual error states with retry actions:
- `LOADING`: High-contrast terminal pulse animation.
- `EMPTY`: "NO RECORDS FOUND" with clear prompt.
- `UNAVAILABLE`: "FEED NOT CONFIGURED" with settings link.
- `ENTITLEMENT_REQUIRED`: Clear entitlement badge with tier info.
- `RATE_LIMITED`: Exponential backoff timer with automatic retry countdown.
- `STALE / DISCONNECTED`: Offline cache warning with manual refresh trigger.
