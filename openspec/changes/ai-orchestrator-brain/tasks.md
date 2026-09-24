## 1. Dependencies & Setup

- [x] 1.1 Install Vercel AI SDK dependencies: `ai`, `@ai-sdk/openai`, `@ai-sdk/anthropic`
- [x] 1.2 Add `brain-chat` to the `PanelType` union in `tiling-types.ts`
- [x] 1.3 Add `brain-chat` to the panel label/registry mapping
- [x] 1.4 Add `BRAIN` and `AI` command handlers to the command parser in `terminal-context.tsx`

## 2. Brain Settings (brain-settings spec)

- [x] 2.1 Define `BrainSettings` type with provider, model, apiKey, perplexityKey fields
- [x] 2.2 Add brain settings state to `TerminalContext` with localStorage persistence (`blm_brain_settings`)
- [x] 2.3 Create `brain-settings-panel.tsx` with provider selector, model dropdown, API key inputs
- [x] 2.4 Implement API key masking in the settings UI (show `sk-...****` after save)
- [x] 2.5 Add model lists per provider (OpenAI: gpt-4o, gpt-4o-mini; Anthropic: claude-sonnet-4-6-20250514, claude-haiku-4-5-20251001, claude-opus-4-7)
- [x] 2.6 Handle missing/corrupted localStorage gracefully with reset to defaults

## 3. Tool Definitions (brain-tools spec)

- [x] 3.1 Create `src/lib/brain-tools.ts` with AI SDK `tool()` definitions for all client-side tools: `open_panel`, `close_panel`, `set_symbol`, `load_preset`, `switch_watchlist`, `set_chart_range`, `toggle_indicator`, `add_alert`
- [x] 3.2 Add server-side tool definitions: `fetch_fundamentals`, `fetch_news`, `fetch_chart_data`, `fetch_earnings`, `fetch_options`, `fetch_insider_activity`, `research`
- [x] 3.3 Implement parameter validation for all tools (zod schemas via AI SDK tool definitions)
- [x] 3.4 Implement server-side data-fetching tool executors that call existing lib functions (godel.ts, yahoo.ts, sec-edgar.ts)

## 4. API Routes (brain-api spec)

- [x] 4.1 Create `/api/brain/chat/route.ts` — POST handler that accepts messages + settings, constructs AI SDK client, streams response
- [x] 4.2 Build system prompt generator that includes current terminal state (active symbol, open panels, watchlists) and tool descriptions
- [x] 4.3 Implement server-side tool execution loop (handle `fetch_*` tools within the route)
- [x] 4.4 Implement client-side tool passthrough (return `open_panel`, `set_symbol`, etc. as unexecuted tool calls in the stream)
- [x] 4.5 Add error handling for invalid API keys, missing config, provider errors
- [x] 4.6 Create `/api/brain/research/route.ts` — Perplexity proxy with sonar model, 15s timeout, error mapping

## 5. Chat Panel UI (brain-chat-panel spec)

- [x] 5.1 Create `brain-chat-panel.tsx` base component with message list area and input field
- [x] 5.2 Implement streaming message display using AI SDK's `useChat` hook (or custom streaming with fetch)
- [x] 5.3 Style user messages and assistant messages with amber-themed bubbles
- [x] 5.4 Add tool call indicators (compact inline badges showing tool name + status)
- [x] 5.5 Implement structured data cards: fundamentals card (metric grid), news card (headline list), research card (answer + citations)
- [x] 5.6 Add conversation clear button and empty state
- [x] 5.7 Implement per-panel conversation state (keyed by panel ID)
- [x] 5.8 Add "configure API key" prompt when no key is set

## 6. Client-Side Tool Execution

- [x] 6.1 Create `useBrainTools` hook or utility that receives streamed tool calls from the API and dispatches to TerminalContext/TilingContext actions
- [x] 6.2 Map `open_panel` tool calls to `addPanel()` in TilingContext
- [x] 6.3 Map `set_symbol` tool calls to `setSymbol()` in TerminalContext
- [x] 6.4 Map `load_preset` tool calls to `loadPreset()` in TilingContext
- [x] 6.5 Map `switch_watchlist` tool calls to watchlist switch action
- [x] 6.6 Map `set_chart_range`, `toggle_indicator`, `add_alert` to their respective actions
- [x] 6.7 Handle tool execution errors gracefully and feed back to the chat stream

## 7. Integration & Polish

- [x] 7.1 Add `brain-chat` to context menu panel options
- [x] 7.2 Add brain-chat to one or more preset layouts (e.g., add to DENSE preset)
- [x] 7.3 Ensure brain-chat panel works correctly with tiling resize, maximize, drag-and-drop
- [x] 7.4 Add keyboard shortcut for opening brain-chat (e.g., `Ctrl+B`)
- [x] 7.5 Test end-to-end: natural language query → LLM reasoning → tool calls → panel opens + data cards render
- [x] 7.6 Test error scenarios: invalid API key, provider outage, malformed tool calls, missing symbol
