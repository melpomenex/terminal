# Specification: Financial & Time-Value-of-Money Calculator (`CALC`)

## ADDED Requirements

### Requirement: Interactive Financial & TVM Calculator (`CALC`)
The system SHALL provide a dedicated Financial Calculator panel (`CALC`) and inline Command Bar math solver supporting standard arithmetic, percentages, powers, logarithms, and Time Value of Money (TVM) functions.

#### Scenario: TVM and Capital Budgeting Calculations
- **GIVEN** `CALC` panel
- **WHEN** the user selects financial solvers
- **THEN** it SHALL provide exact mathematical solvers for:
  - Present Value ($PV$) and Future Value ($FV$)
  - Net Present Value ($NPV$) with customizable discount rates and cash flow streams
  - Internal Rate of Return ($IRR$)
  - Periodic Payment ($PMT$), Interest Rate ($RATE$), Number of Periods ($NPER$)
  - Compound Interest Schedules and Loan Amortization Tables.

#### Scenario: Inline Command Bar quick evaluation
- **WHEN** the user types a mathematical expression into the Command Bar (e.g. `CALC 150 * (1 + 0.08)^5` or `CALC PV(0.05, 10, 1000)`)
- **THEN** the Command Bar SHALL display the evaluated numerical result in an instant inline preview.
