'use client';

import { useTerminalContext } from '@/context/terminal-context';
import { useEffect, useState } from 'react';

interface CardData {
  symbol: string;
  name: string;
  price: number;
  change: number;
  pct: number;
  prevPrice?: number;
}

const INITIAL_CARDS: Record<string, CardData> = {
  MSFT: { symbol: 'MSFT', name: 'Microsoft Corp', price: 420.00, change: 2.58, pct: 0.62 },
  NVDA: { symbol: 'NVDA', name: 'NVIDIA Corp', price: 220.60, change: -0.01, pct: -0.005 },
  MSTR: { symbol: 'MSTR', name: 'MicroStrategy Inc', price: 166.19, change: 1.56, pct: 0.95 }
};

export default function TickerCardsPanel({ panelId }: { panelId: string }) {
  const { watchlist, setSymbol, symbol } = useTerminalContext();
  const [cards, setCards] = useState<Record<string, CardData>>(INITIAL_CARDS);
  const [flash, setFlash] = useState<Record<string, 'up' | 'down' | null>>({});

  // Sync with watchlist prices if available
  useEffect(() => {
    if (!watchlist || watchlist.length === 0) return;

    setCards(prev => {
      const next = { ...prev };
      let updated = false;

      Object.keys(next).forEach(sym => {
        const item = watchlist.find(w => w.symbol === sym);
        if (item && item.price != null && item.price !== next[sym].price) {
          const diff = item.price - next[sym].price;
          next[sym] = {
            ...next[sym],
            price: item.price,
            change: item.change ?? next[sym].change,
            pct: item.changePercent ?? next[sym].pct
          };
          updated = true;

          // Trigger flash
          setFlash(f => ({ ...f, [sym]: diff > 0 ? 'up' : 'down' }));
          setTimeout(() => {
            setFlash(f => ({ ...f, [sym]: null }));
          }, 600);
        }
      });

      return updated ? next : prev;
    });
  }, [watchlist]);

  // Dynamic simulation of minor price tick changes to make the dashboard feel incredibly alive
  useEffect(() => {
    const interval = setInterval(() => {
      // Pick a random card to tick
      const keys = Object.keys(INITIAL_CARDS);
      const randomSym = keys[Math.floor(Math.random() * keys.length)];
      
      setCards(prev => {
        const card = prev[randomSym];
        const tick = (Math.random() - 0.5) * 0.15; // small tick
        const nextPrice = card.price + tick;
        const diff = nextPrice - card.price;
        
        // Update change and percent based on a baseline
        const basePrice = randomSym === 'MSFT' ? 417.42 : randomSym === 'NVDA' ? 220.61 : 164.63;
        const change = nextPrice - basePrice;
        const pct = (change / basePrice) * 100;

        // Trigger flash
        setFlash(f => ({ ...f, [randomSym]: diff > 0 ? 'up' : 'down' }));
        setTimeout(() => {
          setFlash(f => ({ ...f, [randomSym]: null }));
        }, 500);

        return {
          ...prev,
          [randomSym]: {
            ...card,
            price: nextPrice,
            change,
            pct
          }
        };
      });
    }, 3800);

    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: '#0a0a0c',
      padding: '8px 10px',
      gap: 8,
      minHeight: 0,
      overflowY: 'auto'
    }}>
      {Object.values(cards).map((card) => {
        const isUp = card.change >= 0;
        const isSelected = symbol === card.symbol;
        const currentFlash = flash[card.symbol];
        
        // Dynamic styling for visual feedback
        let flashBg = 'transparent';
        if (currentFlash === 'up') flashBg = 'rgba(0, 176, 80, 0.08)';
        if (currentFlash === 'down') flashBg = 'rgba(239, 68, 68, 0.08)';

        return (
          <div
            key={card.symbol}
            onClick={() => setSymbol(card.symbol)}
            style={{
              background: isSelected ? '#15151b' : '#0d0d10',
              border: isSelected ? '1px solid #ffb000' : '1px solid #1f1f22',
              borderRadius: 4,
              padding: '12px 14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
              userSelect: 'none',
              transition: 'all 0.15s ease',
              boxShadow: isSelected ? '0 0 8px rgba(255, 176, 0, 0.05)' : 'none',
              backgroundColor: flashBg || (isSelected ? '#15151b' : '#0d0d10')
            }}
            onMouseEnter={(e) => {
              if (!isSelected) {
                e.currentTarget.style.borderColor = '#2d2d34';
                e.currentTarget.style.background = '#111115';
              }
            }}
            onMouseLeave={(e) => {
              if (!isSelected) {
                e.currentTarget.style.borderColor = '#1f1f22';
                e.currentTarget.style.background = '#0d0d10';
              }
            }}
          >
            {/* Ticker Symbol left */}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{
                fontSize: 16,
                fontWeight: 700,
                color: isSelected ? '#fff' : '#c9d1d9',
                letterSpacing: '0.5px'
              }}>
                {card.symbol}
              </span>
              <span style={{
                fontSize: 8,
                color: '#555566',
                textTransform: 'uppercase',
                marginTop: 2
              }}>
                {card.name}
              </span>
            </div>

            {/* Price & Change right */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-end',
              fontFamily: 'var(--font)'
            }}>
              {/* Price */}
              <span style={{
                fontSize: 14,
                fontWeight: 700,
                color: currentFlash === 'up' ? '#00b050' : currentFlash === 'down' ? '#ef4444' : (isUp ? '#00b050' : '#ef4444'),
                transition: 'color 0.15s ease'
              }}>
                ${card.price.toFixed(2)}
              </span>

              {/* Percent / Dollar change */}
              <div style={{
                display: 'flex',
                gap: 5,
                fontSize: 9,
                color: isUp ? '#00b050' : '#ef4444',
                marginTop: 3,
                fontWeight: 600
              }}>
                <span>{isUp ? '+' : ''}{card.pct.toFixed(2)}%</span>
                <span>{isUp ? '+' : ''}{card.change.toFixed(2)}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
