import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['var(--font-display)', 'sans-serif'],
        body: ['var(--font-body)', 'sans-serif'],
        mono: ['var(--font-mono)', 'monospace'],
      },
      colors: {
        void: '#06080F',
        base: '#080C14',
        surface: '#0D1220',
        elevated: '#121929',
        'hover-bg': '#182035',
        card: '#0D1422',
        border: {
          DEFAULT: '#1A2240',
          bright: '#2A3660',
          amber: 'rgba(245,158,11,0.3)',
          cyan: 'rgba(34,211,238,0.25)',
        },
        amber: {
          DEFAULT: '#F59E0B',
          bright: '#FBBF24',
          dim: '#92400E',
          glow: 'rgba(245,158,11,0.15)',
        },
        cyan: {
          DEFAULT: '#22D3EE',
          bright: '#67E8F9',
          dim: '#164E63',
          glow: 'rgba(34,211,238,0.15)',
        },
        alert: {
          DEFAULT: '#FF2040',
          dim: '#7F1D1D',
          glow: 'rgba(255,32,64,0.15)',
        },
        ok: {
          DEFAULT: '#00FFA3',
          dim: '#064E3B',
          glow: 'rgba(0,255,163,0.12)',
        },
        warn: '#FB923C',
        caution: '#FCD34D',
        info: '#60A5FA',
        ink: {
          primary: '#E2E8F7',
          secondary: '#8892AA',
          muted: '#4A5270',
        },
      },
      backgroundImage: {
        'grid-cyan': `
          linear-gradient(rgba(34,211,238,0.04) 1px, transparent 1px),
          linear-gradient(90deg, rgba(34,211,238,0.04) 1px, transparent 1px)
        `,
        'grid-amber': `
          linear-gradient(rgba(245,158,11,0.04) 1px, transparent 1px),
          linear-gradient(90deg, rgba(245,158,11,0.04) 1px, transparent 1px)
        `,
        'amber-radial': 'radial-gradient(ellipse at center, rgba(245,158,11,0.12) 0%, transparent 70%)',
        'cyan-radial': 'radial-gradient(ellipse at center, rgba(34,211,238,0.10) 0%, transparent 70%)',
        'surface-gradient': 'linear-gradient(135deg, #0D1220 0%, #0A101C 100%)',
      },
      backgroundSize: {
        grid: '40px 40px',
      },
      boxShadow: {
        'amber-glow': '0 0 20px rgba(245,158,11,0.25), 0 0 40px rgba(245,158,11,0.08)',
        'amber-glow-sm': '0 0 8px rgba(245,158,11,0.35)',
        'cyan-glow': '0 0 20px rgba(34,211,238,0.2), 0 0 40px rgba(34,211,238,0.06)',
        'cyan-glow-sm': '0 0 8px rgba(34,211,238,0.3)',
        'alert-glow': '0 0 8px rgba(255,32,64,0.4)',
        'ok-glow': '0 0 8px rgba(0,255,163,0.3)',
        'card': '0 2px 24px rgba(0,0,0,0.5), 0 1px 0 rgba(255,255,255,0.04) inset',
        'card-hover': '0 4px 32px rgba(0,0,0,0.6), 0 0 0 1px rgba(245,158,11,0.2)',
      },
      keyframes: {
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(16px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'scan-line': {
          '0%': { transform: 'translateY(-100%)', opacity: '0.6' },
          '100%': { transform: 'translateY(100%)', opacity: '0' },
        },
        'pulse-amber': {
          '0%, 100%': { opacity: '0.6', transform: 'scale(1)' },
          '50%': { opacity: '1', transform: 'scale(1.05)' },
        },
        'pulse-ring': {
          '0%': { transform: 'scale(0.8)', opacity: '0.8' },
          '100%': { transform: 'scale(2)', opacity: '0' },
        },
        'shimmer': {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'data-stream': {
          '0%': { transform: 'translateX(-100%)', opacity: '0' },
          '50%': { opacity: '1' },
          '100%': { transform: 'translateX(100%)', opacity: '0' },
        },
        'blink': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0' },
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-6px)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.5s ease-out forwards',
        'fade-in': 'fade-in 0.4s ease-out forwards',
        'scan-line': 'scan-line 2s linear infinite',
        'pulse-amber': 'pulse-amber 2s ease-in-out infinite',
        'pulse-ring': 'pulse-ring 1.5s ease-out infinite',
        'shimmer': 'shimmer 2s linear infinite',
        'data-stream': 'data-stream 3s ease-in-out infinite',
        'blink': 'blink 1s step-end infinite',
        'float': 'float 3s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}

export default config
