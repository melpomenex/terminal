'use client';

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useTerminalContext } from '@/context/terminal-context';
import { useTilingContext } from '@/context/tiling-context';
import { getPreset } from '@/lib/preset-layouts';
import { resolveToRef } from '@/lib/security-master/resolver';
import { workspaceService } from '@/lib/workspaces/workspace-service';
import { storageManager } from '@/lib/persistence/storage-manager';
import { runComparison } from '@/lib/brain/comparative-workflows';
import type { BrainMessage, BrainToolCall } from '@/lib/brain-types';
import type { LinkGroupColor, TilingNode } from '@/lib/tiling-types';

interface ResearchNoteRecord {
  id: string; title: string; content: string; associatedSymbols: string[];
  tags: string[]; createdAt: string; updatedAt: string;
}

/** Citation markers like [NVDA 10-K FY2025, Item 7] rendered as chips. */
const CITATION_RE = /\[([^\]\n]{4,90})\]/g;

function renderContentWithCitations(content: string, onCite?: (cite: string) => void) {
  const parts: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  CITATION_RE.lastIndex = 0;
  let key = 0;
  while ((m = CITATION_RE.exec(content)) !== null) {
    const cite = m[1];
    // Skip markdown links / bracketed numbers-only / TODO-style brackets
    if (/^\d+$/.test(cite) || content.slice(m.index - 1, m.index) === '(') continue;
    if (m.index > last) parts.push(content.slice(last, m.index));
    parts.push(
      <button
        key={`cite-${key++}`}
        onClick={() => onCite?.(cite)}
        title={`Evidence: ${cite}`}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 3,
          fontSize: 9, padding: '0 5px', margin: '0 1px',
          border: '1px solid #4d9fff55', borderRadius: 3,
          background: '#4d9fff14', color: '#4d9fff', cursor: 'pointer',
          fontFamily: 'var(--font)', verticalAlign: 'baseline',
        }}
      >
        🔗 {cite}
      </button>,
    );
    last = m.index + m[0].length;
  }
  if (last < content.length) parts.push(content.slice(last));
  return parts;
}

export default function BrainChatPanel({ panelId }: { panelId: string }) {
  const {
    symbol, setSymbol, brainSettings,
    chartRange, setChartRange, comparisonSymbols, setComparisonSymbols,
    addAlert, setWatchlistKey, customWatchlists, portfolioPositions, watchlist,
  } = useTerminalContext();
  const { layout, addPanel, removePanel, loadPreset, activePanelId, setPanelLinkGroup, setPanelInstrument } = useTilingContext();

  const [messages, setMessages] = useState<BrainMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [pendingConfirm, setPendingConfirm] = useState<{ tool: string; args: Record<string, unknown>; description: string } | null>(null);
  const confirmResolver = useRef<((ok: boolean) => void) | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  }, []);

  // ---- Workspace state collectors -----------------------------------------
  const collectPanels = useCallback((node: TilingNode): Array<{ id: string; type: string; label: string; instrument: string | null; linkGroup: string }> => {
    if (node.type === 'leaf') {
      return [{
        id: node.panel.id, type: node.panel.type, label: node.panel.label,
        instrument: node.panel.instrument?.symbol ?? null,
        linkGroup: node.panel.linkGroup ?? 'UNLINKED',
      }];
    }
    return [...collectPanels(node.first), ...collectPanels(node.second)];
  }, []);

  const getOpenPanelTypes = useCallback((): string[] => collectPanels(layout).map((p) => p.type), [collectPanels, layout]);

  const getWatchlistNames = useCallback((): string[] => {
    return ['DEFAULT', 'SECTORS', 'INDEXES', ...customWatchlists.map((w) => w.name.toUpperCase())];
  }, [customWatchlists]);

  // ---- Guardrail: destructive tools require explicit user confirmation ----
  const requestConfirmation = useCallback((tool: string, args: Record<string, unknown>, description: string): Promise<boolean> => {
    return new Promise((resolve) => {
      setPendingConfirm({ tool, args, description });
      confirmResolver.current = resolve;
    });
  }, []);

  const resolveConfirmation = useCallback((ok: boolean) => {
    confirmResolver.current?.(ok);
    confirmResolver.current = null;
    setPendingConfirm(null);
  }, []);

  // ---- Client tool executor (workspace orchestration) ----------------------
  const executeClientTool = useCallback(async (toolName: string, args: Record<string, unknown>): Promise<string> => {
    const requireConfirm = async (description: string): Promise<boolean> =>
      window.confirm === undefined ? true : await requestConfirmation(toolName, args, description);

    try {
      switch (toolName) {
        case 'open_panel': {
          const target = activePanelId || collectPanels(layout)[0]?.id;
          if (!target) return 'No panel to split from';
          addPanel(target, args.type as never, (args.direction as 'horizontal' | 'vertical') || 'vertical');
          const newPanelId = collectPanels(layout)[collectPanels(layout).length - 1]?.id;
          if (args.instrument && newPanelId) setPanelInstrument(newPanelId, resolveToRef(String(args.instrument)));
          if (args.link_group && newPanelId) setPanelLinkGroup(newPanelId, args.link_group as LinkGroupColor);
          return `Opened ${args.type}${args.instrument ? ` on ${args.instrument}` : ''}${args.link_group ? ` [${args.link_group}]` : ''}`;
        }
        case 'close_panel': {
          const id = String(args.panel_id ?? '');
          const panel = collectPanels(layout).find((p) => p.id === id);
          const ok = await requireConfirm(`Close panel ${panel?.label ?? id}? Its local state is lost.`);
          if (!ok) return 'Cancelled by user';
          removePanel(id);
          return `Closed ${panel?.label ?? id}`;
        }
        case 'split_panel': {
          const target = activePanelId || collectPanels(layout)[0]?.id;
          if (!target) return 'No target panel';
          addPanel(target, args.type as never, (args.direction as 'horizontal' | 'vertical') || 'vertical');
          return `Split panel inserted (${args.type})`;
        }
        case 'set_panel_instrument': {
          const id = String(args.panel_id ?? '');
          if (!id) return 'panel_id required';
          setPanelInstrument(id, resolveToRef(String(args.symbol)));
          return `Panel ${id} → ${String(args.symbol).toUpperCase()}`;
        }
        case 'set_link_group': {
          const id = String(args.panel_id ?? '');
          if (!id) return 'panel_id required';
          setPanelLinkGroup(id, args.group as LinkGroupColor);
          return `Panel ${id} link group → ${args.group}`;
        }
        case 'set_symbol': {
          setSymbol(String(args.symbol).toUpperCase());
          return `Set global symbol to ${String(args.symbol).toUpperCase()}`;
        }
        case 'load_preset': {
          const preset = getPreset(String(args.preset).toLowerCase());
          if (!preset) return `Preset not found`;
          const ok = await requireConfirm(`Load preset "${preset.id}"? The current layout is replaced.`);
          if (!ok) return 'Cancelled by user';
          loadPreset(preset.id);
          return `Loaded ${preset.id} preset`;
        }
        case 'load_workspace': {
          const ok = await requireConfirm(`Load workspace "${args.name}"? The current layout is replaced.`);
          if (!ok) return 'Cancelled by user';
          try {
            const ws = await workspaceService.load(String(args.name));
            return `Workspace "${ws.name}" loaded (${ws.panelSummary.length} panels). Apply via the WORKSPACES panel if the layout didn't switch.`;
          } catch (e) {
            return e instanceof Error ? e.message : 'load failed';
          }
        }
        case 'save_workspace': {
          const name = String(args.name ?? '').trim().toLowerCase();
          if (!name) return 'name required';
          await workspaceService.save(name, layout);
          return `Workspace "${name}" saved`;
        }
        case 'switch_watchlist': {
          setWatchlistKey(String(args.name).toUpperCase());
          return `Switched to ${args.name} watchlist`;
        }
        case 'set_chart_range': {
          setChartRange(String(args.range));
          return `Chart range set to ${args.range}`;
        }
        case 'toggle_indicator': {
          const indicator = String(args.indicator);
          const enabled = args.enabled !== false;
          if (enabled && !comparisonSymbols.includes(indicator)) {
            setComparisonSymbols([...comparisonSymbols, indicator]);
          } else if (!enabled) {
            setComparisonSymbols(comparisonSymbols.filter((s) => s !== indicator));
          }
          return `${enabled ? 'Enabled' : 'Disabled'} ${indicator}`;
        }
        case 'add_alert': {
          addAlert({
            id: crypto.randomUUID(),
            symbol: String(args.symbol).toUpperCase(),
            condition: String(args.condition) as 'above' | 'below',
            threshold: Number(args.threshold),
            triggered: false,
          });
          return `Alert created`;
        }
        case 'create_research_note': {
          const notes = await storageManager.load<ResearchNoteRecord[]>('researchNotes', []);
          const note: ResearchNoteRecord = {
            id: crypto.randomUUID(),
            title: String(args.title ?? 'AI research note'),
            content: String(args.content ?? ''),
            associatedSymbols: (Array.isArray(args.symbols) ? args.symbols : []).map((s) => String(s).toUpperCase()),
            tags: ['ai-brain'],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          await storageManager.save('researchNotes', [note, ...notes]);
          return `Research note "${note.title}" created (open the NOTE panel)`;
        }
        default:
          return `Unknown tool: ${toolName}`;
      }
    } catch (e) {
      return `Error: ${String(e)}`;
    }
  }, [activePanelId, layout, addPanel, removePanel, setSymbol, loadPreset, setWatchlistKey, setChartRange, comparisonSymbols, setComparisonSymbols, addAlert, collectPanels, requestConfirmation, setPanelInstrument, setPanelLinkGroup]);

  // ---- COMPARE workflow trigger from the command bar ----------------------
  useEffect(() => {
    const handler = async (e: Event) => {
      const { symbols } = (e as CustomEvent<{ symbols: string[] }>).detail;
      if (!Array.isArray(symbols) || symbols.length < 2) return;
      setMessages((prev) => [...prev,
        { role: 'user', content: `COMPARE ${symbols.join(' ')}` },
      ]);
      setIsLoading(true);
      try {
        const result = await runComparison(symbols);
        // Apply orchestration plan: open panes per symbol with link groups
        const panels = collectPanels(layout);
        let anchor = activePanelId ?? panels[0]?.id ?? null;
        for (const action of result.plan) {
          if (anchor) addPanel(anchor, action.panelType as never, 'vertical');
          const next = collectPanelsRef.current(layout);
          anchor = next[next.length - 1]?.id ?? anchor;
          if (anchor) {
            setPanelInstrument(anchor, resolveToRef(action.instrument));
            setPanelLinkGroup(anchor, action.linkGroup);
          }
        }
        setMessages((prev) => [...prev, {
          role: 'assistant',
          content: `Comparison workspace built for ${symbols.join(' / ')}.\n\n${result.metrics.map((m) => `${m.symbol}: ${m.price != null ? `$${m.price}` : 'n/a'} ${m.changePct != null ? `(${m.changePct >= 0 ? '+' : ''}${m.changePct}%)` : ''} · margin ${m.operatingMarginPct != null ? `${m.operatingMarginPct}%` : 'n/a'} (${m.fiscalPeriod ?? 'no XBRL'})`).join('\n')}\n\nPanes linked: RED=${symbols[0] ?? ''} BLUE=${symbols[1] ?? ''}${symbols[2] ? ` GREEN=${symbols[2]}` : ''}${symbols[3] ? ` YELLOW=${symbols[3]}` : ''}. Ask follow-ups — I have the fetched metrics grounded.`,
          toolCalls: [{ id: crypto.randomUUID(), name: 'compare_instruments', args: { symbols }, status: 'done', result: 'orchestrated' }],
        }]);
        scrollToBottom();
      } finally {
        setIsLoading(false);
      }
    };
    window.addEventListener('qube-brain-compare', handler as EventListener);
    return () => window.removeEventListener('qube-brain-compare', handler as EventListener);
  }, [addPanel, activePanelId, layout, collectPanels, setPanelInstrument, setPanelLinkGroup, scrollToBottom]);

  // Keep a live ref of panel collection for the async orchestration loop
  const collectPanelsRef = useRef(collectPanels);
  useEffect(() => { collectPanelsRef.current = collectPanels; }, [collectPanels]);

  // ---- Chat send ------------------------------------------------------------
  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || isLoading) return;
    if (!brainSettings.apiKey) return;

    const userMessage: BrainMessage = { role: 'user', content: text };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const chatMessages = [...messages, userMessage].map((m) => ({
        role: m.role, content: m.content,
      }));

      const response = await fetch('/api/brain/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: chatMessages,
          settings: brainSettings,
          terminalState: {
            activeSymbol: symbol,
            openPanels: getOpenPanelTypes(),
            watchlists: getWatchlistNames(),
            workspace: {
              panels: collectPanels(layout),
              watchlistSymbols: watchlist.map((w) => w.symbol),
              portfolioSymbols: [...new Set(portfolioPositions.map((p) => p.symbol))],
            },
          },
        }),
      });

      const data = await response.json() as { text?: string; error?: string; actions?: Array<{ toolName: string; args: Record<string, unknown> }>; statusText?: string };

      if (!response.ok || data.error) {
        setMessages((prev) => [...prev, {
          role: 'assistant',
          content: `Error: ${data.error || response.statusText}`,
        }]);
        setIsLoading(false);
        scrollToBottom();
        return;
      }

      // Execute client-side tool actions (guardrails inside executor)
      const toolCalls: BrainToolCall[] = [];
      if (data.actions && Array.isArray(data.actions)) {
        for (const action of data.actions) {
          const tc: BrainToolCall = {
            id: crypto.randomUUID(),
            name: action.toolName,
            args: action.args,
            status: 'pending',
          };
          toolCalls.push(tc);
          const result = await executeClientTool(action.toolName, action.args);
          tc.status = 'done';
          tc.result = result;
        }
      }

      const assistantMessage: BrainMessage = {
        role: 'assistant',
        content: data.text || 'No response',
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      };
      setMessages((prev) => [...prev, assistantMessage]);
      scrollToBottom();
    } catch (e) {
      setMessages((prev) => [...prev, {
        role: 'assistant',
        content: `Connection error: ${String(e)}`,
      }]);
      scrollToBottom();
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, brainSettings, messages, symbol, getOpenPanelTypes, getWatchlistNames, executeClientTool, scrollToBottom, collectPanels, layout, watchlist, portfolioPositions]);

  const clearConversation = useCallback(() => {
    setMessages([]);
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }, [sendMessage]);

  const renderedMessages = useMemo(
    () => messages.map((msg, i) => ({ msg, i })),
    [messages],
  );

  // No API key configured — show setup prompt
  if (!brainSettings.apiKey) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12, padding: 20 }} data-panel-id={panelId}>
        <div style={{ fontSize: 24, color: 'var(--amber-dim)' }}>&#9881;</div>
        <div style={{ fontSize: 12, color: 'var(--amber)', textAlign: 'center', lineHeight: 1.6 }}>
          API key not configured.<br />
          Open a <span style={{ color: 'var(--bright)', fontWeight: 700 }}>BRAIN SETTINGS</span> panel to configure your LLM provider.
        </div>
        <div style={{ fontSize: 10, color: 'var(--amber-dim)' }}>
          Right-click any panel and select &quot;New Brain Settings&quot;
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }} data-panel-id={panelId}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 8px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <span style={{ fontSize: 10, color: 'var(--amber-dim)' }}>{brainSettings.provider}/{brainSettings.model}</span>
        <button
          onClick={clearConversation}
          style={{ background: 'transparent', border: 'none', color: 'var(--amber-dim)', fontSize: 10, cursor: 'pointer', fontFamily: 'var(--font)' }}
          title="Clear conversation"
        >
          CLEAR
        </button>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflow: 'auto', padding: 8, display: 'flex', flexDirection: 'column', gap: 8, minHeight: 0 }}>
        {renderedMessages.length === 0 && (
          <div style={{ color: 'var(--amber-dim)', fontSize: 11, textAlign: 'center', padding: 20, lineHeight: 1.8 }}>
            Ask me anything about stocks, markets, or the terminal.<br />
            <span style={{ color: 'var(--amber)', fontSize: 10 }}>e.g. &quot;Compare NVDA and AMD margins&quot; · &quot;Open a RED-linked chart for TSLA&quot; · &quot;What guidance did MSFT give?&quot;</span>
          </div>
        )}
        {renderedMessages.map(({ msg, i }) => (
          <div key={i} style={{ alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '92%' }}>
            <div style={{
              padding: '6px 10px',
              borderRadius: 4,
              fontSize: 11,
              lineHeight: 1.55,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              ...(msg.role === 'user'
                ? { background: 'var(--border)', color: 'var(--bright)' }
                : { background: 'transparent', color: 'var(--amber)' }),
            }}>
              {msg.role === 'assistant' ? renderContentWithCitations(msg.content) : msg.content}
            </div>
            {msg.toolCalls && msg.toolCalls.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                {msg.toolCalls.map((tc, j) => (
                  <span
                    key={j}
                    title={tc.result}
                    style={{
                      fontSize: 9,
                      padding: '2px 6px',
                      borderRadius: 2,
                      fontFamily: 'var(--font)',
                      background: tc.status === 'error' ? '#330000' : 'rgba(255,176,0,0.1)',
                      color: tc.status === 'error' ? '#ff4400' : tc.status === 'done' ? '#00b050' : 'var(--amber-dim)',
                      border: `1px solid ${tc.status === 'error' ? '#ff4400' : tc.status === 'done' ? '#00b050' : 'var(--border)'}`,
                    }}
                  >
                    {tc.status === 'done' ? '✓' : '✗'} {tc.name}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
        {isLoading && (
          <div style={{ alignSelf: 'flex-start', color: 'var(--amber-dim)', fontSize: 11, padding: '6px 10px' }}>
            Thinking<span style={{ animation: 'blink 0.53s step-end infinite' }}>...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Destructive-action confirmation guardrail */}
      {pendingConfirm && (
        <div style={{ borderTop: '1px solid var(--negative)', background: 'rgba(239,68,68,0.08)', padding: '6px 8px', flexShrink: 0 }}>
          <div style={{ fontSize: 10, color: 'var(--text-bright)', marginBottom: 4 }}>
            ⚠ Confirm <b>{pendingConfirm.tool}</b>: {pendingConfirm.description}
          </div>
          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
            <button onClick={() => resolveConfirmation(false)} style={{ fontSize: 9, padding: '2px 10px', border: '1px solid var(--border-soft)', background: 'transparent', color: 'var(--text-dim)', cursor: 'pointer' }}>CANCEL</button>
            <button onClick={() => resolveConfirmation(true)} style={{ fontSize: 9, padding: '2px 10px', border: '1px solid var(--negative)', background: 'var(--negative)', color: '#fff', cursor: 'pointer', fontWeight: 700 }}>CONFIRM</button>
          </div>
        </div>
      )}

      {/* Input */}
      <div style={{ display: 'flex', gap: 4, padding: 8, borderTop: '1px solid var(--border)', flexShrink: 0 }}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isLoading ? 'Thinking...' : 'Ask the brain...'}
          disabled={isLoading}
          style={{
            flex: 1,
            background: '#111',
            color: 'var(--amber)',
            border: '1px solid var(--border)',
            padding: '6px 10px',
            fontSize: 11,
            fontFamily: 'var(--font)',
            borderRadius: 2,
            outline: 'none',
            opacity: isLoading ? 0.5 : 1,
          }}
        />
        <button
          onClick={sendMessage}
          disabled={isLoading || !input.trim()}
          style={{
            background: isLoading || !input.trim() ? 'var(--border)' : 'var(--amber)',
            color: isLoading || !input.trim() ? 'var(--amber-dim)' : '#000',
            border: 'none',
            padding: '6px 12px',
            fontSize: 10,
            fontWeight: 700,
            cursor: isLoading ? 'not-allowed' : 'pointer',
            fontFamily: 'var(--font)',
            borderRadius: 2,
          }}
        >
          GO
        </button>
      </div>
    </div>
  );
}
