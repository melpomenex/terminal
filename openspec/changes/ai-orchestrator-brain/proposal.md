## Why

Qube Terminal currently requires users to know Bloomberg-style mnemonic commands (DES, GP, PRTU, etc.) to navigate and extract insights. This creates a steep learning curve and limits the app to users who already think in terminal workflows. An AI orchestrator — "the brain" — would let users interact naturally (e.g., "show me Nvidia's fundamentals alongside its options chain") and have an LLM translate intent into panel actions, data fetching, and structured analysis. This transforms the terminal from a command-driven tool into an intelligent co-pilot that can reason over financial data.

## What Changes

- Add an AI chat panel (new panel type) that serves as the primary interface to the orchestrator
- Introduce a tool-calling framework where the LLM can invoke terminal actions: open panels, set active symbol, load presets, switch watchlists, set chart range, toggle indicators, create alerts, and fetch/structure data
- Add server-side API route(s) that proxy to a configurable LLM provider (OpenAI, Anthropic, etc.) with the terminal's tool definitions
- Expose a "brain settings" UI where users configure their LLM provider, model, and API key (persisted to localStorage)
- Integrate Perplexity API (or similar) as a research tool the LLM can call for real-time intelligent answers that go beyond the terminal's existing data sources
- Add streaming response support so the chat panel shows tokens as they arrive
- Allow the LLM to return structured data cards (tables, key metrics) alongside natural language responses

## Capabilities

### New Capabilities
- `brain-settings`: User-configurable LLM provider, model selection, and API key management (provider, model, key persisted to localStorage)
- `brain-chat-panel`: New panel type with streaming chat UI, message history, and rendering of structured data cards (tables, metric blocks)
- `brain-api`: Server-side API route(s) that accept user messages, manage conversation context, call the configured LLM with tool definitions, and stream responses back
- `brain-tools`: Tool definitions and execution layer — maps LLM tool calls to terminal actions (open panel, set symbol, load preset, fetch data, etc.)
- `brain-research`: Integration with Perplexity API (or equivalent) as a research tool the LLM can invoke for real-time web-grounded answers

### Modified Capabilities
<!-- No existing specs to modify -->

## Impact

- **New dependencies**: `openai` npm package (or `ai` from Vercel AI SDK for provider-agnostic streaming), and optionally `@ai-sdk/openai`, `@ai-sdk/anthropic` for multi-provider support
- **New API routes**: `/api/brain/chat` (streaming LLM proxy), `/api/brain/research` (Perplexity proxy)
- **New panel type**: `brain-chat` added to the `PanelType` union and panel registry
- **New context/state**: Brain settings added to TerminalContext; chat message history per session
- **Modified files**: `terminal-context.tsx` (new state/actions), `tiling-types.ts` (new panel type), `command-bar.tsx` (optional: route natural language to brain), `preset-layouts.ts` (optional brain-inclusive presets)
- **Security**: API keys stored in localStorage (client-side only); all LLM calls proxied through server routes to avoid exposing keys in browser network traffic
