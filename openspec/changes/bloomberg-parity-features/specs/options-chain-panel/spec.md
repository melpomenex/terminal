## ADDED Requirements

### Requirement: Display options chain panel
The system SHALL provide an options chain panel (PanelType: `options-chain`) showing calls and puts grid.

#### Scenario: View options chain for active symbol
- **WHEN** user opens an options panel and a symbol is active (e.g., AAPL)
- **THEN** panel displays a two-sided grid: call premiums on left side, put premiums on right side, strike prices down center column, expiration dates across top row

#### Scenario: Fetch options data from Yahoo Finance
- **WHEN** options panel mounts with an active symbol
- **THEN** system fetches from `/api/yfin/options/{symbol}` which proxies Yahoo Finance v7 finance/options endpoint returning expiration dates + strike data with lastPrice, bid, ask, volume, openInterest, impliedVolatility

#### Scenario: Select expiration date
- **WHEN** user clicks an expiration date header in the options grid
- **THEN** grid refreshes to show only strikes for that expiration; selected expiration highlighted

#### Scenario: Show key Greeks-style data
- **WHEN** options chain cell renders for a strike/expiry combination
- **THEN** cell displays: last price, bid-ask spread (or mid), volume, OI, IV as percentage

#### Scenario: No options available
- **WHEN** symbol has no options data or API returns empty
- **THEN** panel shows "NO OPTIONS DATA" message

#### Scenario: OVME command opens options panel
- **WHEN** user types `OVME <GO>` in command bar
- **THEN** system adds an options panel focused on the active symbol
