# Settings Menu & Theming System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Cursor-style settings screen (cog bottom-left of sidebar → Profile + Display categories) and a CSS-variable theming system with four palettes that apply app-wide, including fixing the Intel section's off-palette black surfaces.

**Architecture:** CSS custom properties on `:root` plus `[data-theme="..."]` overrides on `<html>`, applied by a single `useApplyAppearance` effect reading from the existing zustand `settings-store`. A full migration replaces hardcoded hex (`bg-[#0a0a0c]`, `#111114`, Intel's `#0a0a0a`/`#0e0e0e`) with token references so every surface recolours from one attribute swap. Zoom uses CSS `zoom` on the root; font size and density use CSS variables + a `data-density` attribute.

**Tech Stack:** React 19, Zustand 5 (+ persist), Tailwind CSS v4 (via `@theme` + arbitrary `var(--...)` values), Vitest, TypeScript.

---

## File Structure

**Create:**
- `src/hooks/use-apply-appearance.ts` — effect that pushes theme/zoom/font-scale/density/reduce-motion from the store onto `<html>`.
- `src/components/settings/settings-view.tsx` — main settings screen (category rail + content pane).
- `src/components/settings/profile-section.tsx` — Profile category (avatar + name).
- `src/components/settings/display-section.tsx` — Display category (theme, zoom, font, motion, density).
- `src/components/settings/theme-swatches.tsx` — 4 theme swatch buttons.
- `src/lib/theme-palettes.ts` — the 4 palette definitions (single source for CSS + swatch previews).
- `test/settings-store.test.ts` — unit tests for the extended store (new fields + tab handling).

**Modify:**
- `src/index.css` — replace static `:root` tokens with `:root` default + 3 `[data-theme]` override blocks; add button-surface tokens; add `--font-scale`, density + reduce-motion rules.
- `src/stores/settings-store.ts` — extend `Tab` union with `'settings'`; add `theme`, `zoom`, `fontScale`, `reduceMotion`, `density`, `profileName`, `lastNonSettingsTab` + setters; bump persist version with additive migration.
- `src/app.tsx` — render `SettingsView` when `activeTab === 'settings'`; call `useApplyAppearance()` once; exclude `'settings'` from `⌘1-9` ordering.
- `src/components/layout/sidebar.tsx` — add settings cog bottom-left; gate `⌘1-9` hint copy; route cog click to `setActiveTab('settings')`.
- `src/components/layout/header.tsx` — replace `bg-[#0a0a0c]` with `bg-[var(--color-bg-base)]`; guard the header label when the active tab is `'settings'`.
- `src/components/ui/shared.tsx` — `TextArea` input bg, `Card` raised bg, `PrimaryButton` `bg-white text-black` → button-surface tokens.
- `src/components/ui/select.tsx` — dropdown panel `bg-[#0e0e0e]` → raised token.
- `src/components/ui/generation-view.tsx` — `bg-[#0a0a0c]` → base token.
- `src/components/layout/api-key-dialog.tsx` — dialog surface `#0e0e0e`, inputs `#0a0a0a` → overlay + input tokens.
- `src/components/x-intel/intel-view.tsx` — inactive sub-tab `text-white/20` → `text-[var(--color-text-tertiary)]`.
- `src/components/x-intel/target-rail.tsx` — `#0a0a0a`/`#0e0e0e` → base/input tokens.
- `src/components/x-intel/profile-card.tsx` — `#0e0e0e`/`#0a0a0a` → raised/input tokens.
- `src/components/x-intel/activity-feed.tsx` — `#0e0e0e` → raised token.
- `src/components/x-intel/draft-workspace.tsx` — `#0e0e0e` → raised/input tokens.
- `src/components/x-intel/network-graph.tsx` — inline `'#0e0e0e'` background + `#0e0e0e` input → read CSS var via `getComputedStyle`.
- `src/components/x-intel/credentials-dialog.tsx` — `#0e0e0e`/`#0a0a0a` → overlay/input tokens.
- `src/components/workflows/workflows-view.tsx` — `#0a0a0a` panels → base token.
- `src/components/playground/playground-view.tsx` — `#0a0a0a` bars → base token.
- `src/components/audio/audio-view.tsx` — `#111114` result card → raised token.

**Note on SVG/illustration hex** (logo dots, message-bubble icon fill `#0a0a0a`/`#0a0a0c`): these are inside `<svg>` markup where the value is a deliberate "hole" cut out of the logo glyph, not a UI surface. They stay hardcoded — they do not need to track the theme.

---

### Task 1: Extend the settings store with appearance + settings tab

**Files:**
- Modify: `src/stores/settings-store.ts`
- Test: `test/settings-store.test.ts`

- [ ] **Step 1: Write the failing test**

Create `test/settings-store.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { useSettingsStore } from '../src/stores/settings-store'

describe('settings-store', () => {
  beforeEach(() => {
    useSettingsStore.setState({
      activeTab: 'chat',
      theme: 'venice',
      zoom: 100,
      fontScale: 'md',
      reduceMotion: false,
      density: 'comfortable',
      profileName: '',
      lastNonSettingsTab: 'chat',
    })
  })

  it('exposes the four theme names as a union', () => {
    const themes = ['dark', 'venice', 'grey', 'light'] as const
    for (const t of themes) {
      useSettingsStore.getState().setTheme(t)
      expect(useSettingsStore.getState().theme).toBe(t)
    }
  })

  it('setZoom clamps to the allowed steps', () => {
    useSettingsStore.getState().setZoom(90)
    expect(useSettingsStore.getState().zoom).toBe(90)
    useSettingsStore.getState().setZoom(125)
    expect(useSettingsStore.getState().zoom).toBe(125)
  })

  it('setFontScale accepts sm/md/lg', () => {
    useSettingsStore.getState().setFontScale('lg')
    expect(useSettingsStore.getState().fontScale).toBe('lg')
  })

  it('opens settings and remembers the previous tab', () => {
    useSettingsStore.getState().setActiveTab('image')
    useSettingsStore.getState().openSettings()
    expect(useSettingsStore.getState().activeTab).toBe('settings')
    expect(useSettingsStore.getState().lastNonSettingsTab).toBe('image')
  })

  it('closeSettings restores the previous tab', () => {
    useSettingsStore.getState().setActiveTab('chat')
    useSettingsStore.getState().openSettings()
    useSettingsStore.getState().closeSettings()
    expect(useSettingsStore.getState().activeTab).toBe('chat')
  })

  it('toggleReduceMotion flips the flag', () => {
    expect(useSettingsStore.getState().reduceMotion).toBe(false)
    useSettingsStore.getState().toggleReduceMotion()
    expect(useSettingsStore.getState().reduceMotion).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/settings-store.test.ts`
Expected: FAIL — `setTheme`, `setZoom`, `setFontScale`, `openSettings`, `closeSettings`, `toggleReduceMotion` do not exist; `theme`/`zoom`/`fontScale`/`reduceMotion`/`density`/`profileName`/`lastNonSettingsTab` undefined.

- [ ] **Step 3: Write minimal implementation**

Replace `src/stores/settings-store.ts` with:

```typescript
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { createSafeStorage } from '../lib/safe-storage'

export type Tab = 'chat' | 'image' | 'audio' | 'music' | 'video' | 'embeddings' | 'workflows' | 'playground' | 'intel' | 'settings'
export type Theme = 'dark' | 'venice' | 'grey' | 'light'
export type Zoom = 90 | 100 | 110 | 125
export type FontScale = 'sm' | 'md' | 'lg'
export type Density = 'compact' | 'comfortable'

interface SettingsState {
  activeTab: Tab
  setActiveTab: (tab: Tab) => void
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
  toggleSidebar: () => void
  selectedModels: Record<string, string>
  setSelectedModel: (tab: string, modelId: string) => void
  playgroundAgentModel: string
  setPlaygroundAgentModel: (modelId: string) => void

  theme: Theme
  setTheme: (t: Theme) => void
  zoom: Zoom
  setZoom: (z: Zoom) => void
  fontScale: FontScale
  setFontScale: (f: FontScale) => void
  reduceMotion: boolean
  toggleReduceMotion: () => void
  density: Density
  setDensity: (d: Density) => void
  profileName: string
  setProfileName: (name: string) => void

  lastNonSettingsTab: Tab
  openSettings: () => void
  closeSettings: () => void
}

const NON_SETTINGS_DEFAULT: Tab = 'chat'

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      activeTab: 'chat',
      setActiveTab: (tab) => set({ activeTab: tab }),
      sidebarOpen: true,
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
      selectedModels: {},
      setSelectedModel: (tab, modelId) =>
        set((s) => ({ selectedModels: { ...s.selectedModels, [tab]: modelId } })),
      playgroundAgentModel: '',
      setPlaygroundAgentModel: (modelId) => set({ playgroundAgentModel: modelId }),

      theme: 'venice',
      setTheme: (t) => set({ theme: t }),
      zoom: 100,
      setZoom: (z) => set({ zoom: z }),
      fontScale: 'md',
      setFontScale: (f) => set({ fontScale: f }),
      reduceMotion: false,
      toggleReduceMotion: () => set((s) => ({ reduceMotion: !s.reduceMotion })),
      density: 'comfortable',
      setDensity: (d) => set({ density: d }),
      profileName: '',
      setProfileName: (name) => set({ profileName: name }),

      lastNonSettingsTab: NON_SETTINGS_DEFAULT,
      openSettings: () =>
        set((s) => ({
          lastNonSettingsTab: s.activeTab === 'settings' ? s.lastNonSettingsTab : s.activeTab,
          activeTab: 'settings',
        })),
      closeSettings: () =>
        set((s) => ({ activeTab: s.lastNonSettingsTab ?? NON_SETTINGS_DEFAULT })),
    }),
    {
      name: 'venice-settings',
      version: 2,
      storage: createJSONStorage(() => createSafeStorage()),
      migrate: (persisted, version) => {
        // v1 -> v2: appearance fields are additive; defaults fill in on read.
        const s = (persisted ?? {}) as Partial<SettingsState>
        return {
          ...s,
          theme: s.theme ?? 'venice',
          zoom: s.zoom ?? 100,
          fontScale: s.fontScale ?? 'md',
          reduceMotion: s.reduceMotion ?? false,
          density: s.density ?? 'comfortable',
          profileName: s.profileName ?? '',
          lastNonSettingsTab: s.lastNonSettingsTab ?? NON_SETTINGS_DEFAULT,
        }
      },
    },
  ),
)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/settings-store.test.ts`
Expected: PASS (all 6 tests).

- [ ] **Step 5: Run full test suite to confirm no regressions**

Run: `npx vitest run`
Expected: PASS — existing `x-intel-store.test.ts`, `validate-x-key.test.ts`, `validate-venice-key.test.ts`, `normalize.test.ts`, `gather.test.ts`, `synthesize.test.ts` all still green (store shape change is additive).

- [ ] **Step 6: Commit**

```bash
git add src/stores/settings-store.ts test/settings-store.test.ts
git commit -m "feat(settings): extend settings store with theme, zoom, font, density, profile + settings tab"
```

---

### Task 2: Define the four palettes and rewrite index.css tokens

**Files:**
- Create: `src/lib/theme-palettes.ts`
- Modify: `src/index.css`

- [ ] **Step 1: Create the palette definitions module**

Create `src/lib/theme-palettes.ts`:

```typescript
export interface Palette {
  name: string
  bgBase: string
  bgRaised: string
  bgInput: string
  bgOverlay: string
  borderFaint: string
  borderSoft: string
  borderStrong: string
  textPrimary: string
  textSecondary: string
  textTertiary: string
  accent: string
  accentSoft: string
  accentContrast: string
  colorScheme: 'dark' | 'light'
}

export const PALETTES: Record<string, Palette> = {
  dark: {
    name: 'Dark',
    bgBase: '#060607',
    bgRaised: '#0d0d0e',
    bgInput: '#0a0a0b',
    bgOverlay: '#111113',
    borderFaint: 'rgba(255,255,255,0.05)',
    borderSoft: 'rgba(255,255,255,0.07)',
    borderStrong: 'rgba(255,255,255,0.14)',
    textPrimary: 'rgba(255,255,255,0.90)',
    textSecondary: 'rgba(255,255,255,0.62)',
    textTertiary: 'rgba(255,255,255,0.40)',
    accent: '#6ee7d3',
    accentSoft: 'rgba(110,231,211,0.16)',
    accentContrast: '#04120e',
    colorScheme: 'dark',
  },
  venice: {
    name: 'Venice',
    bgBase: '#0a0a0c',
    bgRaised: '#111114',
    bgInput: '#0d0d11',
    bgOverlay: '#16161b',
    borderFaint: 'rgba(255,255,255,0.05)',
    borderSoft: 'rgba(255,255,255,0.08)',
    borderStrong: 'rgba(255,255,255,0.16)',
    textPrimary: 'rgba(255,255,255,0.92)',
    textSecondary: 'rgba(255,255,255,0.65)',
    textTertiary: 'rgba(255,255,255,0.42)',
    accent: '#6ee7d3',
    accentSoft: 'rgba(110,231,211,0.16)',
    accentContrast: '#04120e',
    colorScheme: 'dark',
  },
  grey: {
    name: 'Grey',
    bgBase: '#181818',
    bgRaised: '#1f1f1f',
    bgInput: '#141414',
    bgOverlay: '#232323',
    borderFaint: 'rgba(255,255,255,0.06)',
    borderSoft: '#2b2b2b',
    borderStrong: '#3c3c3c',
    textPrimary: '#cccccc',
    textSecondary: 'rgba(204,204,204,0.75)',
    textTertiary: 'rgba(204,204,204,0.5)',
    accent: '#4aa3ff',
    accentSoft: 'rgba(74,163,255,0.16)',
    accentContrast: '#03121f',
    colorScheme: 'dark',
  },
  light: {
    name: 'Light',
    bgBase: '#f4f4f2',
    bgRaised: '#fbfbfa',
    bgInput: '#ffffff',
    bgOverlay: '#ffffff',
    borderFaint: 'rgba(0,0,0,0.06)',
    borderSoft: 'rgba(0,0,0,0.10)',
    borderStrong: 'rgba(0,0,0,0.18)',
    textPrimary: 'rgba(20,22,28,0.92)',
    textSecondary: 'rgba(20,22,28,0.62)',
    textTertiary: 'rgba(20,22,28,0.42)',
    accent: '#0f9a84',
    accentSoft: 'rgba(15,154,132,0.14)',
    accentContrast: '#ffffff',
    colorScheme: 'light',
  },
}

export const THEME_ORDER = ['dark', 'venice', 'grey', 'light'] as const
export type ThemeKey = (typeof THEME_ORDER)[number]
```

- [ ] **Step 2: Rewrite `src/index.css` `@theme` block + add per-theme overrides**

Replace lines 1–29 of `src/index.css` (from `@import "tailwindcss";` through the closing `}` of `@theme`) with:

```css
@import "tailwindcss";

@theme {
  --font-sans: "Inter", "InterVariable", system-ui, sans-serif;
  --font-mono: "JetBrains Mono", "SF Mono", monospace;
}

/* Default theme = Venice. Overridden per-theme below. */
:root {
  --color-bg-base: #0a0a0c;
  --color-bg-raised: #111114;
  --color-bg-overlay: #16161b;
  --color-bg-input: #0d0d11;
  --color-border-faint: rgba(255, 255, 255, 0.05);
  --color-border-soft: rgba(255, 255, 255, 0.08);
  --color-border-strong: rgba(255, 255, 255, 0.16);
  --color-text-primary: rgba(255, 255, 255, 0.92);
  --color-text-secondary: rgba(255, 255, 255, 0.65);
  --color-text-tertiary: rgba(255, 255, 255, 0.42);
  --color-text-quaternary: rgba(255, 255, 255, 0.28);
  --color-accent: #6ee7d3;
  --color-accent-soft: rgba(110, 231, 211, 0.16);
  --color-accent-contrast: #04120e;
  --color-btn-primary-bg: #ffffff;
  --color-btn-primary-fg: #000000;
  --font-scale: 1;
  color-scheme: dark;
}

[data-theme="dark"] {
  --color-bg-base: #060607;
  --color-bg-raised: #0d0d0e;
  --color-bg-overlay: #111113;
  --color-bg-input: #0a0a0b;
  --color-border-faint: rgba(255, 255, 255, 0.05);
  --color-border-soft: rgba(255, 255, 255, 0.07);
  --color-border-strong: rgba(255, 255, 255, 0.14);
  --color-text-primary: rgba(255, 255, 255, 0.90);
  --color-text-secondary: rgba(255, 255, 255, 0.62);
  --color-text-tertiary: rgba(255, 255, 255, 0.40);
  --color-text-quaternary: rgba(255, 255, 255, 0.26);
  --color-accent: #6ee7d3;
  --color-accent-soft: rgba(110, 231, 211, 0.16);
  --color-accent-contrast: #04120e;
  --color-btn-primary-bg: #ffffff;
  --color-btn-primary-fg: #000000;
  color-scheme: dark;
}

[data-theme="grey"] {
  --color-bg-base: #181818;
  --color-bg-raised: #1f1f1f;
  --color-bg-overlay: #232323;
  --color-bg-input: #141414;
  --color-border-faint: rgba(255, 255, 255, 0.06);
  --color-border-soft: #2b2b2b;
  --color-border-strong: #3c3c3c;
  --color-text-primary: #cccccc;
  --color-text-secondary: rgba(204, 204, 204, 0.75);
  --color-text-tertiary: rgba(204, 204, 204, 0.5);
  --color-text-quaternary: rgba(204, 204, 204, 0.35);
  --color-accent: #4aa3ff;
  --color-accent-soft: rgba(74, 163, 255, 0.16);
  --color-accent-contrast: #03121f;
  --color-btn-primary-bg: #4aa3ff;
  --color-btn-primary-fg: #ffffff;
  color-scheme: dark;
}

[data-theme="light"] {
  --color-bg-base: #f4f4f2;
  --color-bg-raised: #fbfbfa;
  --color-bg-overlay: #ffffff;
  --color-bg-input: #ffffff;
  --color-border-faint: rgba(0, 0, 0, 0.06);
  --color-border-soft: rgba(0, 0, 0, 0.10);
  --color-border-strong: rgba(0, 0, 0, 0.18);
  --color-text-primary: rgba(20, 22, 28, 0.92);
  --color-text-secondary: rgba(20, 22, 28, 0.62);
  --color-text-tertiary: rgba(20, 22, 28, 0.42);
  --color-text-quaternary: rgba(20, 22, 28, 0.30);
  --color-accent: #0f9a84;
  --color-accent-soft: rgba(15, 154, 132, 0.14);
  --color-accent-contrast: #ffffff;
  --color-btn-primary-bg: #0f9a84;
  --color-btn-primary-fg: #ffffff;
  color-scheme: light;
}
```

Then in the same file, update the `body` rule (currently lines 30–37) to consume the font-scale variable:

```css
html { color-scheme: dark; }
body {
  margin: 0;
  background: var(--color-bg-base);
  color: var(--color-text-primary);
  font-size: calc(15px * var(--font-scale));
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  font-feature-settings: "ss01", "cv11";
}
```

Add at the end of the file (density + reduce-motion overrides):

```css
/* Density — compact tightens vertical rhythm on surface containers */
[data-density="compact"] { --density-pad: 0.75; }
[data-density="comfortable"] { --density-pad: 1; }

/* Reduce motion — forced when the toggle is on (in addition to prefers-reduced-motion) */
[data-reduce-motion="true"] *,
[data-reduce-motion="true"] *::before,
[data-reduce-motion="true"] *::after {
  animation-duration: 0.01ms !important;
  animation-iteration-count: 1 !important;
  transition-duration: 0.01ms !important;
  scroll-behavior: auto !important;
}
```

- [ ] **Step 3: Verify the build still compiles**

Run: `npx tsc -b --noEmit && npx vite build`
Expected: build succeeds (Tailwind v4 ingests the new CSS; no TS errors because no component references these tokens yet).

- [ ] **Step 4: Commit**

```bash
git add src/lib/theme-palettes.ts src/index.css
git commit -m "feat(theme): define four palettes and data-theme CSS variable overrides"
```

---

### Task 3: Apply appearance to `<html>` via an effect

**Files:**
- Create: `src/hooks/use-apply-appearance.ts`
- Modify: `src/app.tsx`

- [ ] **Step 1: Create the hook**

Create `src/hooks/use-apply-appearance.ts`:

```typescript
import { useEffect } from 'react'
import { useSettingsStore } from '../stores/settings-store'
import { PALETTES } from '../lib/theme-palettes'

const FONT_SCALE_MAP = { sm: 0.9, md: 1, lg: 1.12 } as const

export function useApplyAppearance() {
  const theme = useSettingsStore((s) => s.theme)
  const zoom = useSettingsStore((s) => s.zoom)
  const fontScale = useSettingsStore((s) => s.fontScale)
  const reduceMotion = useSettingsStore((s) => s.reduceMotion)
  const density = useSettingsStore((s) => s.density)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  useEffect(() => {
    document.documentElement.style.zoom = `${zoom}%`
  }, [zoom])

  useEffect(() => {
    document.documentElement.style.setProperty('--font-scale', String(FONT_SCALE_MAP[fontScale]))
  }, [fontScale])

  useEffect(() => {
    document.documentElement.dataset.reduceMotion = String(reduceMotion)
  }, [reduceMotion])

  useEffect(() => {
    document.documentElement.dataset.density = density
  }, [density])
}

// Helper for non-React code (e.g. canvas/SVG that needs the current accent).
export function readToken(name: keyof typeof PALETTES.venice extends infer P ? any : never): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}
```

Note: the `readToken` export is intentionally loose-typed (returns `string`); `network-graph.tsx` will use `getComputedStyle` directly in Task 8 rather than this helper, but it is available if needed. If unused after Task 8, remove it then.

- [ ] **Step 2: Wire the hook into App**

In `src/app.tsx`, add the import and call. Modify the top of the file (after the existing imports, around line 16) by adding:

```typescript
import { useApplyAppearance } from './hooks/use-apply-appearance'
```

Then inside the `App` function, immediately after the existing `useEffect` block closes (around line 80, after `}, [setActiveTab])`), add:

```typescript
  useApplyAppearance()
```

- [ ] **Step 3: Verify the dev server boots and applies the default theme**

Run: `npx vite build`
Expected: build succeeds. (Manual verification in the next task via the settings UI.)

- [ ] **Step 4: Commit**

```bash
git add src/hooks/use-apply-appearance.ts src/app.tsx
git commit -m "feat(theme): apply theme/zoom/font/density to html via useApplyAppearance"
```

---

### Task 4: Add the settings cog to the sidebar

**Files:**
- Modify: `src/components/layout/sidebar.tsx`

- [ ] **Step 1: Add the cog to the sidebar footer**

In `src/components/layout/sidebar.tsx`, the keyboard-hint footer block is currently lines 220–227. Replace that block with:

```tsx
      {expanded && (
        <div className="px-3 py-2.5 border-t border-[var(--color-border-faint)]">
          <button
            onClick={() => useSettingsStore.getState().openSettings()}
            aria-label="Open settings"
            title="Settings"
            className="flex items-center gap-2.5 w-full rounded-lg px-2.5 py-2 text-[14px] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-white/[0.03] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)] focus-visible:outline-offset-2"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
            <span className="font-medium">Settings</span>
          </button>
          <div className="mt-2 text-[11px] text-[var(--color-text-tertiary)] space-y-0.5">
            <div className="flex justify-between"><span>New chat</span><kbd className="font-mono text-[var(--color-text-secondary)]">⌘N</kbd></div>
            <div className="flex justify-between"><span>Switch tab</span><kbd className="font-mono text-[var(--color-text-secondary)]">⌘1-9</kbd></div>
          </div>
        </div>
      )}

      {!expanded && (
        <div className="hidden md:block flex-1" />
      )}
      {!expanded && (
        <div className="px-3 py-2.5 border-t border-[var(--color-border-faint)]">
          <button
            onClick={() => useSettingsStore.getState().openSettings()}
            aria-label="Open settings"
            title="Settings"
            className="flex items-center justify-center w-full rounded-lg py-2 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-white/[0.03] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)] focus-visible:outline-offset-2"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
        </div>
      )}
```

This replaces both the previous expanded footer block and the previous collapsed-state spacer (`{!expanded && <div className="hidden md:block flex-1" />}`). The collapsed cog block now sits at the bottom; keep the `flex-1` spacer *above* the cog so the cog pins to the bottom. Concretely, ensure the structure inside `<aside>` is: `<nav>...</nav>` → chat-history block → `{!expanded && <div className="hidden md:block flex-1" />}` → collapsed cog block. (The expanded branch already ends with the cog + hints.)

- [ ] **Step 2: Verify the build**

Run: `npx tsc -b --noEmit && npx vite build`
Expected: succeeds. (Runtime check happens once the settings view exists in Task 6.)

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/sidebar.tsx
git commit -m "feat(settings): add settings cog to sidebar footer (expanded + collapsed)"
```

---

### Task 5: Migrate shared UI primitives and layout surfaces to tokens

**Files:**
- Modify: `src/components/ui/shared.tsx`
- Modify: `src/components/ui/select.tsx`
- Modify: `src/components/ui/generation-view.tsx`
- Modify: `src/components/layout/header.tsx`
- Modify: `src/components/layout/sidebar.tsx` (the `aside` bg)
- Modify: `src/components/layout/api-key-dialog.tsx`
- Modify: `src/components/audio/audio-view.tsx`

This task is a mechanical sweep — no tests (these are presentational; the app's existing tests don't render them). Verify with the build + manual smoke in Task 9.

- [ ] **Step 1: `src/components/ui/shared.tsx`**

In `TextArea` (line 33), replace:
`bg-[#0d0d11] border border-white/[0.08]`
with:
`bg-[var(--color-bg-input)] border border-[var(--color-border-soft)]`

In `PrimaryButton` (lines 57–60), replace the ternary's two branches:
`bg-white text-black hover:bg-white/90` → `bg-[var(--color-btn-primary-bg)] text-[var(--color-btn-primary-fg)] hover:opacity-90`
`bg-white/[0.06] text-white/30` → `bg-[var(--color-border-faint)] text-[var(--color-text-tertiary)]`

In `Card` (line 158), replace:
`bg-[#111114] border border-white/[0.06]`
with:
`bg-[var(--color-bg-raised)] border border-[var(--color-border-faint)]`

In `PillGroup` (lines 101–105), the active and inactive button classes are hardcoded dark values. Replace the active branch:
`border-white/15 bg-white/[0.08] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]`
with:
`border-[var(--color-border-strong)] bg-[var(--color-accent-soft)] text-[var(--color-text-primary)] shadow-none`
and the inactive branch:
`border-white/[0.06] text-white/55 hover:text-white/85 hover:border-white/[0.14] hover:bg-white/[0.02]`
with:
`border-[var(--color-border-soft)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-border-strong)] hover:bg-white/[0.02]`

Also migrate the other primitives in this file that use hardcoded `text-white/NN` where readability must flip on Light:
- `Label` (line 7): `text-white/55` → `text-[var(--color-text-secondary)]`; the `hint` span `text-white/35` → `text-[var(--color-text-tertiary)]`.
- `ErrorText` (line 116): leave as-is (red tones are intentional and read on all themes).
- `EmptyState` (line 126): `text-white/30` → `text-[var(--color-text-tertiary)]`.
- `ExamplePrompts` (lines 136–149): `text-white/40` → `text-[var(--color-text-tertiary)]`; button `text-white/70 hover:text-white/90` → `text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]`; `text-white/25 group-hover:text-[var(--color-accent)]` → `text-[var(--color-text-quaternary)] group-hover:text-[var(--color-accent)]`.
- `SectionHeading` (line 167): `text-white/40` → `text-[var(--color-text-tertiary)]`.
- `ConnectionPill` (lines 217–224): `border-white/[0.08] hover:border-white/[0.2]` → `border-[var(--color-border-soft)] hover:border-[var(--color-border-strong)]`; the connected span `text-white/85` → `text-[var(--color-text-primary)]`; disconnected `text-white/65` → `text-[var(--color-text-secondary)]`.

Leave `Badge` and `StatusDot` (the tone-coloured status indicators) as-is — those are intentional accent colours, acceptable on all four palettes per the spec.

- [ ] **Step 2: `src/components/ui/select.tsx`**

Line 55, replace `bg-[#0e0e0e] border border-white/[0.08]` with `bg-[var(--color-bg-raised)] border border-[var(--color-border-soft)]`.

- [ ] **Step 3: `src/components/ui/generation-view.tsx`**

Line 22, replace `bg-[#0a0a0c]` with `bg-[var(--color-bg-base)]`.

- [ ] **Step 4: `src/components/layout/header.tsx`**

Line 60, replace `border-b border-white/[0.05] bg-[#0a0a0c]` with `border-b border-[var(--color-border-faint)] bg-[var(--color-bg-base)]`.

Also handle the `'settings'` tab: the existing `tabLabels` and `tabSubtitles` maps do not have a `'settings'` entry. Add to `tabLabels` (after the `intel` entry around line 27):
`  settings: 'Settings',`
And to `tabSubtitles` (after the `intel` entry around line 38):
`  settings: 'Preferences and appearance',`
And add `'settings'` to the `noModelSelector` set (line 41) so the header does not render a model selector on the settings tab:
`const noModelSelector = new Set(['video', 'workflows', 'playground', 'intel', 'settings'])`

- [ ] **Step 5: `src/components/layout/sidebar.tsx`**

Line 117, replace `bg-[#0d0d11] border-r border-white/[0.05]` with `bg-[var(--color-bg-input)] border-r border-[var(--color-border-faint)]`.

- [ ] **Step 6: `src/components/layout/api-key-dialog.tsx`**

Line 73, replace `bg-[#0e0e0e] border border-white/[0.1]` with `bg-[var(--color-bg-overlay)] border border-[var(--color-border-soft)]`.
Lines 99, 114, 151, replace `bg-[#0a0a0a] border border-white/[0.1]` with `bg-[var(--color-bg-input)] border border-[var(--color-border-soft)]` (three identical replacements — use replace_all on the exact substring `bg-[#0a0a0a] border border-white/[0.1]`).

- [ ] **Step 7: `src/components/audio/audio-view.tsx`**

Line 199, replace `bg-[#111114] border border-white/[0.06]` with `bg-[var(--color-bg-raised)] border border-[var(--color-border-faint)]`.

- [ ] **Step 8: Verify the build**

Run: `npx tsc -b --noEmit && npx vite build`
Expected: succeeds.

- [ ] **Step 9: Commit**

```bash
git add src/components/ui/shared.tsx src/components/ui/select.tsx src/components/ui/generation-view.tsx src/components/layout/header.tsx src/components/layout/sidebar.tsx src/components/layout/api-key-dialog.tsx src/components/audio/audio-view.tsx
git commit -m "refactor(theme): migrate shared UI + layout surfaces to CSS tokens"
```

---

### Task 6: Build the settings screen (category rail + Profile + Display)

**Files:**
- Create: `src/components/settings/theme-swatches.tsx`
- Create: `src/components/settings/profile-section.tsx`
- Create: `src/components/settings/display-section.tsx`
- Create: `src/components/settings/settings-view.tsx`
- Modify: `src/app.tsx`

- [ ] **Step 1: Create the theme swatch component**

Create `src/components/settings/theme-swatches.tsx`:

```tsx
import { cn } from '../../lib/utils'
import { useSettingsStore, type Theme } from '../../stores/settings-store'
import { PALETTES, THEME_ORDER } from '../../lib/theme-palettes'

export function ThemeSwatches() {
  const theme = useSettingsStore((s) => s.theme)
  const setTheme = useSettingsStore((s) => s.setTheme)

  return (
    <div role="radiogroup" aria-label="Colour theme" className="flex flex-wrap gap-2">
      {THEME_ORDER.map((key) => {
        const p = PALETTES[key]
        const active = theme === key
        return (
          <button
            key={key}
            role="radio"
            aria-checked={active}
            onClick={() => setTheme(key as Theme)}
            className={cn(
              'flex flex-col items-start gap-2 rounded-xl border p-3 w-[140px] text-left transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)] focus-visible:outline-offset-2',
              active
                ? 'border-[var(--color-accent)] bg-[var(--color-accent-soft)]'
                : 'border-[var(--color-border-soft)] hover:border-[var(--color-border-strong)]',
            )}
          >
            <div className="flex w-full h-10 rounded-md overflow-hidden border border-[var(--color-border-faint)]">
              <span className="flex-1" style={{ background: p.bgBase }} />
              <span className="flex-1" style={{ background: p.bgRaised }} />
              <span className="flex-1" style={{ background: p.accent }} />
            </div>
            <span className="text-[13px] font-medium text-[var(--color-text-primary)]">{p.name}</span>
          </button>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Create the Profile section**

Create `src/components/settings/profile-section.tsx`:

```tsx
import { useSettingsStore } from '../../stores/settings-store'
import { Label } from '../ui/shared'

export function ProfileSection() {
  const profileName = useSettingsStore((s) => s.profileName)
  const setProfileName = useSettingsStore((s) => s.setProfileName)

  const initials = profileName.trim()
    .split(/\s+/).filter(Boolean).slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '').join('') || 'OV'

  return (
    <div className="flex flex-col gap-6 max-w-md">
      <div className="flex items-center gap-4">
        <div className="flex items-center justify-center w-16 h-16 rounded-full bg-[var(--color-accent-soft)] text-[var(--color-accent)] text-[22px] font-semibold border border-[var(--color-accent)]/30">
          {initials}
        </div>
        <div className="flex flex-col">
          <span className="text-[15px] font-semibold text-[var(--color-text-primary)]">
            {profileName.trim() || 'OVX user'}
          </span>
          <span className="text-[12px] text-[var(--color-text-tertiary)]">Local profile</span>
        </div>
      </div>

      <div>
        <Label htmlFor="profile-name">Display name</Label>
        <input
          id="profile-name"
          value={profileName}
          onChange={(e) => setProfileName(e.target.value)}
          placeholder="Your name"
          maxLength={48}
          className="w-full bg-[var(--color-bg-input)] border border-[var(--color-border-soft)] rounded-lg px-3 py-2.5 text-[15px] text-[var(--color-text-primary)] outline-none focus:border-[var(--color-border-strong)] transition-colors placeholder:text-[var(--color-text-quaternary)]"
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create the Display section**

Create `src/components/settings/display-section.tsx`:

```tsx
import { useSettingsStore, type Zoom, type FontScale, type Density } from '../../stores/settings-store'
import { Label, PillGroup } from '../ui/shared'
import { ThemeSwatches } from './theme-swatches'

const ZOOM_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '90', label: '90%' },
  { value: '100', label: '100%' },
  { value: '110', label: '110%' },
  { value: '125', label: '125%' },
]

const FONT_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'sm', label: 'Small' },
  { value: 'md', label: 'Medium' },
  { value: 'lg', label: 'Large' },
]

const DENSITY_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'comfortable', label: 'Comfortable' },
  { value: 'compact', label: 'Compact' },
]

export function DisplaySection() {
  const zoom = useSettingsStore((s) => s.zoom)
  const setZoom = useSettingsStore((s) => s.setZoom)
  const fontScale = useSettingsStore((s) => s.fontScale)
  const setFontScale = useSettingsStore((s) => s.setFontScale)
  const reduceMotion = useSettingsStore((s) => s.reduceMotion)
  const toggleReduceMotion = useSettingsStore((s) => s.toggleReduceMotion)
  const density = useSettingsStore((s) => s.density)
  const setDensity = useSettingsStore((s) => s.setDensity)

  return (
    <div className="flex flex-col gap-7 max-w-lg">
      <div>
        <Label>Theme</Label>
        <ThemeSwatches />
      </div>

      <div>
        <Label>Zoom</Label>
        <PillGroup
          ariaLabel="Zoom level"
          options={ZOOM_OPTIONS}
          value={String(zoom)}
          onChange={(v) => setZoom(Number(v) as Zoom)}
        />
      </div>

      <div>
        <Label>Font size</Label>
        <PillGroup
          ariaLabel="Font size"
          options={FONT_OPTIONS}
          value={fontScale}
          onChange={(v) => setFontScale(v as FontScale)}
        />
      </div>

      <div>
        <Label>Density</Label>
        <PillGroup
          ariaLabel="Density"
          options={DENSITY_OPTIONS}
          value={density}
          onChange={(v) => setDensity(v as Density)}
        />
      </div>

      <div className="flex items-center justify-between gap-4 py-1">
        <div className="flex flex-col">
          <span className="text-[13px] font-medium text-[var(--color-text-primary)]">Reduce motion</span>
          <span className="text-[11px] text-[var(--color-text-tertiary)]">Disable animations and transitions</span>
        </div>
        <button
          role="switch"
          aria-checked={reduceMotion}
          aria-label="Reduce motion"
          onClick={toggleReduceMotion}
          className={cnToggle(reduceMotion)}
        >
          <span className={cnKnob(reduceMotion)} />
        </button>
      </div>
    </div>
  )
}

function cnToggle(on: boolean) {
  return [
    'relative inline-flex h-6 w-11 shrink-0 rounded-full border transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)] focus-visible:outline-offset-2',
    on
      ? 'bg-[var(--color-accent)] border-[var(--color-accent)]'
      : 'bg-[var(--color-border-faint)] border-[var(--color-border-soft)]',
  ].join(' ')
}
function cnKnob(on: boolean) {
  return [
    'inline-block h-5 w-5 rounded-full bg-white shadow transition-transform translate-y-px',
    on ? 'translate-x-[22px]' : 'translate-x-px',
  ].join(' ')
}
```

- [ ] **Step 4: Create the settings shell**

Create `src/components/settings/settings-view.tsx`:

```tsx
import { useState } from 'react'
import { cn } from '../../lib/utils'
import { useSettingsStore } from '../../stores/settings-store'
import { ProfileSection } from './profile-section'
import { DisplaySection } from './display-section'

type Category = 'profile' | 'display'

const CATEGORIES: Array<{ id: Category; label: string; desc: string }> = [
  { id: 'profile', label: 'Profile', desc: 'Your display identity' },
  { id: 'display', label: 'Display', desc: 'Theme, zoom, and density' },
]

export function SettingsView() {
  const [cat, setCat] = useState<Category>('display')
  const closeSettings = useSettingsStore((s) => s.closeSettings)

  return (
    <div className="flex h-full">
      <aside className="w-56 shrink-0 border-r border-[var(--color-border-faint)] bg-[var(--color-bg-base)] flex flex-col">
        <div className="flex items-center gap-2 px-4 h-14 border-b border-[var(--color-border-faint)]">
          <button
            onClick={closeSettings}
            aria-label="Back"
            className="text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] transition-colors p-1 -ml-1 rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" /></svg>
          </button>
          <span className="text-[14px] font-semibold text-[var(--color-text-primary)]">Settings</span>
        </div>
        <nav className="flex flex-col gap-px p-2">
          {CATEGORIES.map((c) => {
            const active = cat === c.id
            return (
              <button
                key={c.id}
                onClick={() => setCat(c.id)}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex flex-col gap-0.5 rounded-lg px-2.5 py-2 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)] focus-visible:outline-offset-2',
                  active
                    ? 'bg-white/[0.06] text-[var(--color-text-primary)]'
                    : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-white/[0.03]',
                )}
              >
                <span className="text-[14px] font-medium">{c.label}</span>
                <span className="text-[11px] text-[var(--color-text-tertiary)]">{c.desc}</span>
              </button>
            )
          })}
        </nav>
      </aside>

      <div className="flex-1 min-w-0 overflow-y-auto">
        <div className="px-8 py-8 max-w-2xl">
          <h2 className="text-[18px] font-semibold text-[var(--color-text-primary)] mb-6">
            {CATEGORIES.find((c) => c.id === cat)?.label}
          </h2>
          {cat === 'profile' ? <ProfileSection /> : <DisplaySection />}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Render SettingsView in App**

In `src/app.tsx`, add the import with the other component imports (around line 15):

```typescript
import { SettingsView } from './components/settings/settings-view'
```

Add `'settings'` to the `views` map (after `intel: IntelView,` around line 42):

```typescript
  settings: SettingsView,
```

The `TAB_ORDER` array (line 45) must **not** include `'settings'` — leave it as the nine functional tabs so `⌘1-9` never lands on settings. Confirm the existing keyboard handler uses `TAB_ORDER` and not the `views` keys (it does), so no further change is needed there.

- [ ] **Step 6: Verify the build**

Run: `npx tsc -b --noEmit && npx vite build`
Expected: succeeds.

- [ ] **Step 7: Manual smoke (instructions for the implementer)**

Run `npm run dev`, open the app, click the settings cog bottom-left, confirm:
- Settings screen opens with Display selected by default.
- Theme swatches switch the whole app's colours live (sidebar, header, background).
- Zoom buttons rescale the UI.
- Font Size changes body text size.
- Reduce Motion toggle stops the fade/scale animations.
- Back arrow returns to the previous tab.

- [ ] **Step 8: Commit**

```bash
git add src/components/settings/theme-swatches.tsx src/components/settings/profile-section.tsx src/components/settings/display-section.tsx src/components/settings/settings-view.tsx src/app.tsx
git commit -m "feat(settings): add Cursor-style settings screen with Profile + Display"
```

---

### Task 7: Migrate the Intel section to tokens (fixes the black boxes)

**Files:**
- Modify: `src/components/x-intel/intel-view.tsx`
- Modify: `src/components/x-intel/target-rail.tsx`
- Modify: `src/components/x-intel/profile-card.tsx`
- Modify: `src/components/x-intel/activity-feed.tsx`
- Modify: `src/components/x-intel/draft-workspace.tsx`
- Modify: `src/components/x-intel/network-graph.tsx`
- Modify: `src/components/x-intel/credentials-dialog.tsx`

- [ ] **Step 1: `intel-view.tsx` — fix the near-invisible inactive sub-tab**

Line 44, replace the inactive branch `bg-white/[0.03] text-white/20 hover:text-white/40 hover:bg-white/[0.05]` with `bg-white/[0.03] text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] hover:bg-white/[0.05]`. (The active branch `bg-white text-black` is the inverted pill — leave it; it reads correctly on all themes as an inverted state.)

- [ ] **Step 2: `target-rail.tsx`**

Line 47, replace `bg-[#0a0a0a]` with `bg-[var(--color-bg-base)]`.
Line 55, replace `bg-[#0e0e0e] border border-white/[0.06]` with `bg-[var(--color-bg-input)] border border-[var(--color-border-faint)]`. Also replace `text-white` → `text-[var(--color-text-primary)]` and `placeholder:text-white/15` → `placeholder:text-[var(--color-text-quaternary)]` on that same input className.

- [ ] **Step 3: `profile-card.tsx`**

Line 145, replace `bg-[#0e0e0e]` with `bg-[var(--color-bg-raised)]`.
Line 169, replace `bg-[#0a0a0a] border border-white/[0.08]` with `bg-[var(--color-bg-input)] border border-[var(--color-border-soft)]`, and `text-white/70` → `text-[var(--color-text-secondary)]`.
Line 219, replace `bg-[#0e0e0e]` with `bg-[var(--color-bg-raised)]`.

- [ ] **Step 4: `activity-feed.tsx`**

Line 97, replace `bg-[#0e0e0e]` with `bg-[var(--color-bg-raised)]`.

- [ ] **Step 5: `draft-workspace.tsx`**

Line 64, replace `bg-[#0e0e0e] border border-white/[0.06]` with `bg-[var(--color-bg-input)] border border-[var(--color-border-faint)]`, and `text-white/70` → `text-[var(--color-text-secondary)]`, `placeholder:text-white/15` → `placeholder:text-[var(--color-text-quaternary)]`.
Line 83, replace `bg-[#0e0e0e]` with `bg-[var(--color-bg-raised)]`.

- [ ] **Step 6: `network-graph.tsx` — canvas background must read the live token**

Line 74 is a JS string `background: '#0e0e0e', ...` passed to a node renderer. Replace it so it reads the current token at call time. At the top of the file (after the existing imports), add:

```typescript
function readToken(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#111114'
}
```

Then change line 74 from:
`background: '#0e0e0e', color: 'rgba(255,255,255,0.6)', fontSize: size,`
to:
`background: readToken('--color-bg-raised'), color: readToken('--color-text-secondary'), fontSize: size,`

Line 159, replace `bg-[#0e0e0e] border border-white/[0.08]` with `bg-[var(--color-bg-input)] border border-[var(--color-border-soft)]`, and `text-white/60` → `text-[var(--color-text-secondary)]`.

- [ ] **Step 7: `credentials-dialog.tsx`**

Line 40, the `bg-black/70 backdrop-blur-sm` overlay is fine on all themes (it is a dimming scrim, not a surface) — leave it.
Line 42, replace `bg-[#0e0e0e] border border-white/[0.08]` with `bg-[var(--color-bg-overlay)] border border-[var(--color-border-soft)]`.
Line 57, replace `bg-[#0a0a0a] border border-white/[0.08]` with `bg-[var(--color-bg-input)] border border-[var(--color-border-soft)]`, and `text-white` → `text-[var(--color-text-primary)]`, `placeholder:text-white/10` → `placeholder:text-[var(--color-text-quaternary)]`.

- [ ] **Step 8: Verify the build**

Run: `npx tsc -b --noEmit && npx vite build`
Expected: succeeds.

- [ ] **Step 9: Commit**

```bash
git add src/components/x-intel/
git commit -m "refactor(theme): migrate intel section to tokens, fix off-palette black surfaces + invisible sub-tab"
```

---

### Task 8: Migrate remaining view surfaces (workflows, playground)

**Files:**
- Modify: `src/components/workflows/workflows-view.tsx`
- Modify: `src/components/playground/playground-view.tsx`

- [ ] **Step 1: `workflows-view.tsx`**

Three occurrences of `bg-[#0a0a0a]`:
- Line 277: replace `bg-[#0a0a0a]` with `bg-[var(--color-bg-base)]`.
- Line 341: the `!bg-[#0a0a0a] !border-white/[0.06]` (React Flow node override) → `!bg-[var(--color-bg-base)] !border-[var(--color-border-faint)]`.
- Line 366: replace `bg-[#0a0a0a]` with `bg-[var(--color-bg-base)]`.

- [ ] **Step 2: `playground-view.tsx`**

Lines 115 and 137: both are `bg-[#0a0a0a]` bar surfaces. Replace each with `bg-[var(--color-bg-base)]` (use replace_all on `bg-[#0a0a0a]` within this file).

- [ ] **Step 3: Verify the build**

Run: `npx tsc -b --noEmit && npx vite build`
Expected: succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/components/workflows/workflows-view.tsx src/components/playground/playground-view.tsx
git commit -m "refactor(theme): migrate workflows + playground surfaces to tokens"
```

---

### Task 9: Lint, typecheck, and full verification pass

**Files:** none (verification only)

- [ ] **Step 1: Run the linter**

Run: `npm run lint`
Expected: PASS. If any `@typescript-eslint/no-unused-vars` flags the `readToken` helper in `use-apply-appearance.ts` (it may, if `network-graph.tsx` defines its own local copy and the exported one is unused), remove the export from `use-apply-appearance.ts` and delete the `readToken` function there, keeping only the local one in `network-graph.tsx`.

- [ ] **Step 2: Run the full test suite**

Run: `npm test`
Expected: all tests PASS, including the new `settings-store.test.ts`.

- [ ] **Step 3: Run a production build**

Run: `npm run build`
Expected: succeeds with no TS errors.

- [ ] **Step 4: Manual theme sweep (instructions for the implementer)**

With `npm run dev`, for each of the four themes (Dark, Venice, Grey, Light), open every tab (Chat, Image, Audio, Music, Video, Embeddings, Workflows, Playground, Intel) and the API-key + X-credentials dialogs. Confirm:
- No black boxes remain; every surface recolours.
- Intel sub-tabs are legible in both active and inactive states.
- Primary buttons are visible (especially on Light — green button, not white-on-white).
- Inputs have a visible surface on Light (white input on off-white base, bordered).
- Zoom and font size persist across a reload.
- Reduce Motion disables animations across tabs.

- [ ] **Step 5: Commit any cleanup from Step 1**

```bash
git add -A
git commit -m "chore(theme): cleanup unused helper after token migration"
```
(Skip this commit if Step 1 required no changes.)

---

## Self-Review notes

- **Spec coverage:** Theme mechanism (Task 2 + 3), four palettes (Task 2), settings cog + screen (Tasks 4 + 6), Profile (Task 6), Display with theme/zoom/font/motion/density (Task 6), token migration incl. Intel black-box fix (Tasks 5 + 7 + 8), persistence + version migration (Task 1), `⌘1-9` exclusion (Task 6 — `TAB_ORDER` left unchanged; `'settings'` added to `views` only). Primary-button contrast fix (Task 5). Intel sub-tab legibility (Task 7). All spec sections mapped.
- **Type consistency:** `Theme`, `Zoom`, `FontScale`, `Density`, `Tab` defined once in Task 1 and reused identically in Task 6. `PALETTES` / `THEME_ORDER` defined in Task 2, consumed in Task 6's `ThemeSwatches`. `openSettings` / `closeSettings` / `lastNonSettingsTab` defined in Task 1, consumed in Tasks 4 and 6.
- **No placeholders:** every code step contains full code.
