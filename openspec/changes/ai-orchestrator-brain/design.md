## Context

Qube Terminal is a Bloomberg-style financial terminal built with Next.js 15, React 19, and zero external UI/state dependencies. It features a binary-split tiling window manager with 22 panel types, ~90 API route handlers proxying Yahoo Finance, Godel Terminal, SEC EDGAR, and RSS feeds, and a Bloomberg-style command parser with 25+ mnemonic commands. All state lives in React Context (TerminalProvider + TilingProvider). There are currently no AI/LLM integrations.

The terminal's panel actions are already well-defined: `addPanel()`, `removePanel()`, `setSymbol()`, `loadPreset()`, `setChartRange()`, `addAlert()`, etc. These are the exact primitives an LLM orchestrator needs to call as tools.

## Goals / Non-Goals

**Goals:**
- Allow users to interact with the terminal using natural language instead of mnemonic commands
- Give the LLM the ability to open panels, set symbols, fetch data, and structure responses
- Support multiple LLM providers (OpenAI, Anthropic, etc.) configurable by the user
- Integrate a web-grounded research API (Perplexity) for answers beyond existing data sources
- Stream responses in real-time within a dedicated chat panel
- Keep the existing command-driven workflow untouched — the brain is additive, not replacing

**Non-Goals:**
- Multi-user chat or collaboration features
- Server-side session persistence (conversation history lives in client state only)
- Fine-tuning or training custom models
- Voice input/output
- Autonomous trading or order execution

## Decisions

### 1. Vercel AI SDK for provider abstraction

**Decision:** Use Vercel AI SDK (`ai` package) with provider-specific modules (`@ai-sdk/openai`, `@ai-sdk/anthropic`) rather than calling provider APIs directly.

**Rationale:** The AI SDK handles streaming, tool calling, and multi-provider abstraction out of the box. It provides `streamText()` which returns a streaming response compatible with the client-side `useChat` hook. Switching providers requires only changing the model string, not rewriting API call logic.

**Alternative considered:** Raw `fetch` calls to each provider's API. Rejected because we'd have to implement streaming parsing, tool-call wire format, and conversation management ourselves for each provider.

### 2. Server-side API route as LLM proxy

**Decision:** All LLM calls go through a Next.js API route (`/api/brain/chat`) that reads the provider/key from the request body, constructs the AI SDK client, and streams the response.

**Rationale:** Avoids exposing API keys in browser network traffic. The route is stateless — it receives the full message history + settings with each request. No server-side session store needed.

**Alternative considered:** Client-side direct calls. Rejected because API keys would appear in browser DevTools network tab even with server components.

### 3. Tools defined as AI SDK tool definitions, executed client-side

**Decision:** Define tools using AI SDK's `tool()` format in the API route. When the LLM returns a tool call, the API route executes read-only data-fetching tools server-side (like `fetch_fundamentals`), but panel-manipulation tools (like `open_panel`, `set_symbol`) are returned to the client as part of the streamed response and executed there via dispatch to TerminalContext/TilingContext actions.

**Rationale:** Panel state only exists on the client (React Context). Server can't open a panel. Data-fetching tools benefit from server-side execution (no CORS, direct API access). This split is natural and clean.

**Implementation pattern:**
- Server-side tools: `fetch_fundamentals`, `fetch_news`, `fetch_chart_data`, `fetch_earnings`, `fetch_options`, `research` (Perplexity)
- Client-side tools: `open_panel`, `close_panel`, `set_symbol`, `load_preset`, `set_chart_range`, `add_alert`, `switch_watchlist`

### 4. Perplexity API for web-grounded research

**Decision:** Use Perplexity's `sonar` model via their chat completions API as a dedicated `research` tool the LLM can invoke when the user asks questions requiring real-time web data.

**Rationale:** The terminal's existing data sources (Yahoo, Godel, SEC) are historical/market data only. Perplexity provides grounded answers with citations for questions like "What's the latest on NVIDIA's earnings?" or "What are analysts saying about TSLA?"

**Alternative considered:** Tavily or SerpAPI for web search + summarization. Rejected because Perplexity returns synthesized answers with citations, which is more useful than raw search results.

### 5. Settings stored in localStorage, sent with each request

**Decision:** Brain settings (provider, model, API key) are stored in localStorage and sent as metadata with each chat request.

**Rationale:** No backend database to manage. Consistent with the app's existing localStorage pattern (portfolio, alerts, watchlists, layout). The API route validates the key on each request — if invalid, returns an error message.

### 6. New panel type: `brain-chat`

**Decision:** Add `brain-chat` as a new PanelType in the tiling system. It renders as a full chat interface with message bubbles, streaming tokens, tool-call indicators, and structured data cards.

**Rationale:** Fits naturally into the existing tiling window manager. Users can position, resize, and maximize it like any other panel. Multiple brain-chat panels are possible (each with independent conversation state, keyed by panel ID).

### 7. Structured data cards in chat responses

**Decision:** When the LLM calls a data-fetching tool, the result is rendered as a styled card (table, metric block, or mini-chart) within the chat flow, not just text.

**Rationale:** Financial data in plain text is hard to parse visually. Cards make the brain's output consistent with the rest of the terminal's visual language. The AI SDK's tool results flow naturally into the stream.

## Risks / Trade-offs

- **[API key security]** → Keys in localStorage are accessible to any script on the page. Mitigation: warn users in settings UI; future option for server-side encrypted storage.
- **[LLM cost]** → Every chat message incurs API cost. Mitigation: show token usage estimates; keep system prompts concise; use cheaper models for simple queries.
- **[Tool execution latency]** → Multi-tool calls require multiple round trips. Mitigation: AI SDK supports parallel tool calls; batch data-fetching tools where possible.
- **[Streaming complexity]** → Tool calls mid-stream require careful client-side handling. Mitigation: AI SDK's `useChat` hook handles tool call streaming natively; we add client-side execution layer.
- **[Provider outages]** → If the configured provider is down, the brain is unusable. Mitigation: allow fallback provider configuration in settings; show clear error messages.
- **[Tool hallucination]** → LLM might call tools with invalid parameters. Mitigation: validate all tool inputs server-side before execution; return descriptive errors the LLM can self-correct from.
