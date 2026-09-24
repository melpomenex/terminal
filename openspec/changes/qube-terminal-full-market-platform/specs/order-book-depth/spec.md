# Specification: Level 2 Market Depth & Order Book (`DEPTH` / `L2`)

## ADDED Requirements

### Requirement: Authentic Multi-Level Order Book
The system SHALL provide a Level 2 Market Depth panel (`DEPTH` / `L2` / `BOOK`) displaying aggregated bid and ask depth ladders across price levels when supported by the provider.

#### Scenario: Displaying real depth ladder
- **GIVEN** an active instrument with Level 2 entitlement
- **WHEN** the order book updates
- **THEN** the panel SHALL display:
  - Cumulative bid depth volume and price ladder on the left
  - Cumulative ask depth volume and price ladder on the right
  - Bid-ask spread, spread basis points (bps), and order book volume imbalance % ($\frac{BidVol - AskVol}{BidVol + AskVol} \times 100$)
  - Depth-of-Market (DOM) visual horizontal bar gauges representing relative size at each price tier.

#### Scenario: Guarding against synthetic depth generation
- **GIVEN** an instrument where only top-of-book (Level 1) or delayed quotes exist
- **WHEN** the user opens the `DEPTH` panel
- **THEN** the panel SHALL render the available Level 1 BBO (Best Bid/Offer) and display `● UNAVAILABLE (Level 2 depth feed not available from provider)` for deeper tiers.
- **AND** the system SHALL NOT synthesize fake order tiers or fabricated market makers.
