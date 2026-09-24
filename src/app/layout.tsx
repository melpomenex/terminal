import type { Metadata } from 'next';
import { Analytics } from '@vercel/analytics/next';
import './globals.css';
import Providers from './providers';

export const metadata: Metadata = {
	title: 'Qube Terminal',
	description: 'Qube Terminal — professional markets dashboard',
};

// Synchronous pre-hydration script: applies the persisted theme/density/effects
// to <html> BEFORE React mounts so the first painted frame is correct (no FOUC).
const themeInitScript = `
(function(){
  try {
    var raw = localStorage.getItem('blm_prefs_v1');
    var p = raw ? JSON.parse(raw) : null;
    var theme = (p && p.theme) || 'classic-amber';
    var density = (p && p.density) || 'comfortable';
    var e = (p && p.effects) || {};
    var d = document.documentElement;
    d.setAttribute('data-theme', theme);
    d.setAttribute('data-density', density);
    d.setAttribute('data-glow', e.glow ? 'on' : 'off');
    d.setAttribute('data-scanlines', e.scanlines ? 'on' : 'off');
    d.setAttribute('data-vignette', e.vignette ? 'on' : 'off');
    d.setAttribute('data-animations', e.animations === false ? 'off' : 'on');
  } catch (_) {}
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en" suppressHydrationWarning>
			<head>
				<script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
			</head>
			<body>
				<Providers>{children}</Providers>
				<Analytics />
			</body>
		</html>
	);
}
