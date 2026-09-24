## ADDED Requirements

### Requirement: Display commodity prices panel
The system SHALL provide a commodity panel (PanelType: `commodity`) tracking futures contracts.

#### Scenario: View default commodities
- **WHEN** user opens a commodity panel
- **THEN** panel displays: Gold (GC=F), Crude Oil (CL=F), Silver (SI=F), Natural Gas (NG=F), Corn (ZC=F), Wheat (ZW=F), Soybeans (ZS=F), Copper (HG=F), Platinum (PL=F), Palladium (PA=F) with columns: Contract, Last, Change, Change %, Unit

#### Scenario: Commodity uses Yahoo Finance futures symbols
- **WHEN** system fetches commodity data
- **THEN** it uses Yahoo Finance futures format (`GC=F`, `CL=F`, etc.) via existing API routes

#### Scenario: CMDTY function key opens commodity panel
- **WHEN** user presses CMDTY function key or types `CMDTY <GO>` in command bar
- **THEN** system adds a commodity panel to the tiling layout (or focuses existing one)

#### Scenario: Commodity unit display
- **WHEN** commodity panel renders
- **THEN** appropriate units shown: Gold/Silver/Platinum/Palladium in $/oz, Oil in $/bbl, Grains in $/bu, Copper in $/lb, Gas in $/MMBtu
