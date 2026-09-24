## 1. Fix the scroll container in tiling-manager.tsx

- [x] 1.1 In `src/components/tiling/tiling-manager.tsx` line 145, add `display: 'flex', flexDirection: 'column'` to the `[data-panel-scroll]` div styles. The scroll container must be a flex column so panel roots can participate in flex layout.

## 2. Fix panel root elements — remove `height: '100%'` and inner `overflow: 'auto'`

For each panel below, replace `height: '100%'` with `flex: 1, minHeight: 0` on the root div, and remove `overflow: 'auto'` from any inner scroll container divs (replace with just `flex: 1, minHeight: 0`). Keep `flexShrink: 0` on header elements.

- [x] 2.1 `src/components/panels/quote-monitor.tsx` — root div line 12, inner scroll div line 16
- [x] 2.2 `src/components/panels/news-feed.tsx` — root div line 137, inner scroll div line 166
- [x] 2.3 `src/components/panels/options-chain-panel.tsx` — root div line 115, inner scroll div line 139
- [x] 2.4 `src/components/panels/analyst-ratings-panel.tsx` — root div line 70, inner scroll div line 120
- [x] 2.5 `src/components/panels/stock-screener-panel.tsx` — root div line 96, inner scroll div line 157
- [x] 2.6 `src/components/panels/earnings-panel.tsx` — root div line 54, inner scroll div line 67
- [x] 2.7 `src/components/panels/fundamentals-panel.tsx` — root div line 47, inner scroll div line 48
- [x] 2.8 `src/components/panels/security-description.tsx` — root div line 38, inner scroll div line 39
- [x] 2.9 `src/components/panels/portfolio-panel.tsx` — root div line 83, inner scroll div line 96
- [x] 2.10 `src/components/panels/fx-rates-panel.tsx` — root div line 117, inner scroll div line 222
- [x] 2.11 `src/components/panels/commodity-panel.tsx` — root div line 68, inner scroll div line 76
- [x] 2.12 `src/components/panels/economic-calendar-panel.tsx` — root div line 119, inner scroll div line 156
- [x] 2.13 `src/components/panels/bond-yields-panel.tsx` — root div line 365, inner scroll div line 428
- [x] 2.14 `src/components/panels/market-heatmap-panel.tsx` — root div line 125 (no inner scroll, just fix root)
- [x] 2.15 `src/components/panels/insider-activity-panel.tsx` — root div line 122, inner scroll div line 162
- [x] 2.16 `src/components/panels/institutional-holdings-panel.tsx` — root div line 170, inner scroll div line 226
- [x] 2.17 `src/components/panels/sec-filings-panel.tsx` — root div line 148, inner scroll div line 193
- [x] 2.18 `src/components/panels/world-markets-panel.tsx` — root div line 88, inner scroll div line 121
- [x] 2.19 `src/components/panels/correlation-risk-panel.tsx` — root div line 215, inner scroll divs lines 243 and 250
- [x] 2.20 `src/components/panels/social-sentiment-panel.tsx` — root div line 112, inner scroll divs lines 131 and 277
- [x] 2.21 `src/components/panels/help-panel.tsx` — root div line 75, inner scroll div line 88
- [x] 2.22 `src/components/panels/chart-panel.tsx` — root div line 310, inner scroll div line 360
- [x] 2.23 `src/components/panels/article-viewer.tsx` — root divs lines 39/53/73, inner scroll div line 112
- [x] 2.24 `src/components/panels/historical-data-table.tsx` — root div line 121 (has `overflow: auto` on root itself, remove and let parent handle)

## 3. Verify

- [x] 3.1 Run `npx tsc --noEmit` — no new errors
- [x] 3.2 Run `npx next build` — clean build
- [ ] 3.3 Test: open news panel, confirm scrolling works with mouse wheel
- [ ] 3.4 Test: open stock screener, scroll through results
- [ ] 3.5 Test: open options chain, scroll through strikes
- [ ] 3.6 Test: resize a pane very small, confirm it scrolls
