# Chart Workstation — Engine Upgrade Roadmap

Status: **Specification** (evaluation phase; `chart-panel.tsx` keeps serving
the current custom SVG engine until a path is chosen and migrated).

Goal: evolve the existing single-symbol SVG chart into a professional
multi-pane charting workstation with persistent drawings, advanced
measurements (Fibonacci retracements/extensions), synchronized crosshairs
across panes, and large-dataset performance.

---

## Option A — TradingView Lightweight Charts (preferred for velocity)

| Dimension | Assessment |
| --- | --- |
| License | Apache 2.0, free, no watermark |
| Bundle | ~45 KB gzip; zero dependents |
| Renderers | Canvas 2D — handles 100k+ candles smoothly |
| Features out-of-box | Candles / bars / line / area / baseline, price + time scales, crosshair, markers, price lines, autoscale, kinetic scroll |
| Gaps to build | Drawings (trendlines, Fib retracements), indicator panes, crosshair sync across charts, intrapanel axis linking |
| React binding | `lightweight-charts` is imperative; wrap with `useRef` + effect sync (no external wrapper needed) |
| Risk | TradingView could change API across majors (v4→v5 happened); pin versions |

### Migration plan (Option A)
1. **M1 — Parity shell** (`chart-workstation/lwc-chart.tsx`): mount a
   lightweight-chart instance behind the existing `PanelConfig` contract;
   port range/interval/type toggles; feature-flag switch in `panel-content`.
2. **M2 — Data layer**: swap `/api/yfin/chart` polling for the v2 streaming
   gateway (`quotes:<sym>` for live last-price markers + bars on reconnect).
3. **M3 — Indicator panes**: RSI / MACD / Volume as separate synced panes
   (one LWC instance per pane, synchronized visible-logical-range events).
4. **M4 — Drawings**: custom overlay canvas above the chart; serialize
   drawings into `panelSettings.drawings` (persisted per-panel via the
   storage manager) and map x/y ↔ time/price via `timeScale().coordinateToTime`
   and `series.priceToCoordinate`.
5. **M5 — Crosshair sync**: broadcast `SubscribeCrosshairMove` events over a
   small pub-sub keyed by link group; apply `setCrosshairPosition` on peers.

## Option B — Custom WebGL canvas engine

| Dimension | Assessment |
| --- | --- |
| License | Fully ours |
| Bundle | Larger code surface (5–10k LOC for parity) |
| Renderers | WebGL — required only for >500k points or heavy studies |
| Features | Anything we build — full control of drawings, hit-testing, theming |
| Gaps | Everything: axes, scales, pan/zoom physics, DPI handling, a11y |
| Risk | Long timeline; chart engines accrete complexity fast (log scales, session breaks, holiday gaps) |

### Decision framework
- Choose **A** when the priority is shipping drawings + Fib + sync within
  one milestone and dataset sizes stay ≤ 100k bars/pane.
- Choose **B** only when (a) tick-level rendering (L2 heatmaps, footprint
  charts, >1M-point scatter studies) becomes a hard requirement, or
  (b) licensing posture demands full ownership of the render stack.

**Recommendation: Option A now, with an internal render abstraction
(`ChartRenderer` interface) so a WebGL backend can slot in later for exotic
visuals without rewriting panes, drawings, or persistence.**

---

## Shared requirements (either path)

- **Persistent drawings**: trendline, horizontal/vertical ray, rectangle,
  Fibonacci retracement (0.236/0.382/0.5/0.618/0.786 + extensions),
  anchored text notes. Storage: `panelSettings.drawings` per panel id
  through the schema-versioned persistence manager; exportable JSON.
- **Crosshair sync**: charts sharing a color-link group mirror crosshair
  position and visible time range; toggle per link group.
- **Multi-pane layout**: price + ≤4 study panes stacked with shared time
  axis; ratio-resizable via the existing tiling split logic semantics.
- **Provenance**: chart data carries the streaming badge (LIVE/DELAYED);
  derived indicators show the DERIVED pill in the pane corner.
- **Performance budget**: 60 FPS pan/zoom at 50k candles; first paint < 150
  ms on warm cache; drawings redraw isolated from series redraw.
- **Measurements**: click-drag Δprice/Δ%/Δbars readout anchored to the
  drawing; Fib levels show price labels at each ratio.

## Milestone checklist

- [ ] `ChartRenderer` interface defined (data in, events out)
- [ ] LWC shell behind feature flag (`NEXT_PUBLIC_CHART_ENGINE=lwc`)
- [ ] Streaming quote marker wiring
- [ ] Indicator panes (RSI, MACD, Volume)
- [ ] Drawing toolbar + persistence
- [ ] Fib retracement tool with ratio labels
- [ ] Crosshair sync over link groups
- [ ] Performance harness: 50k-bar pan benchmark in CI
