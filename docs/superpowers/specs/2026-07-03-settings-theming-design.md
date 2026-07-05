# Settings Menu & Theming System — Design

_Date: 2026-07-03_

## Purpose

Add a Cursor-style settings experience to OVX: a settings cog pinned to
the bottom-left of the sidebar that opens a dedicated Settings screen in the main
area, with a left-hand category list (Profile, Display). The primary goal is
**customisation and variable control** — starting with colour themes, zoom, and
font size.

Delivering real themes requires fixing a structural gap: the app declares design
tokens in `index.css` but almost nothing uses them. Components hardcode hex values
(`bg-[#0a0a0c]`, `bg-[#111114]`, etc.), and the Intel section uses an entirely
different, older near-black palette (`#0a0a0a` / `#0e0e0e`). This spec includes the
full migration of hardcoded colours onto CSS custom properties so themes apply
everywhere cleanly.

## Success Criteria

1. A settings cog is visible bottom-left of the sidebar in both expanded and
   collapsed states; clicking it opens a Settings screen in the main area.
2. Settings screen has a left category list (Profile, Display) and a content pane.
3. Four themes (Dark, Venice, Grey, Light) can be selected and apply instantly
   across the **entire** app — including the Intel section and all dialogs — with
   no black boxes or off-palette surfaces remaining.
4. Zoom (90/100/110/125%) and Font Size (Small/Medium/Large) work and persist.
5. Reduce Motion and Density (Compact/Comfortable) toggles work and persist.
6. Profile shows an avatar placeholder + editable display name (local only).
7. All Display + Profile settings persist across reloads via the existing
   `settings-store` (zustand + persist).

## Architecture

### Theme mechanism

Single source of truth: **CSS custom properties swapped by a `data-theme`
attribute on `<html>`** (the shadcn/ui + VS Code + Cursor standard).

- `:root` holds the default (Venice) palette.
- `[data-theme="dark"]`, `[data-theme="grey"]`, `[data-theme="light"]` override
  the same token names.
- Switching themes = setting one attribute on `<html>`. No component re-render or
  prop drilling required.

### Token migration

Replace hardcoded hex arbitrary values with token-backed ones across all
components:

| Hardcoded value | Token replacement |
|---|---|
| `#0a0a0c`, `#0a0a0a` | `var(--color-bg-base)` |
| `#111114`, `#0e0e0e` | `var(--color-bg-raised)` |
| `#0d0d11` | `var(--color-bg-input)` |
| `#16161b` | `var(--color-bg-overlay)` |

Intel's `#0a0a0a` / `#0e0e0e` fold into the same base/raised tokens, resolving
the "black box" inconsistency. All `text-white/NN` and `border-white/[0.0N]`
usages that need to flip on the light theme move to text/border tokens where they
affect readability; purely decorative low-opacity overlays may remain as-is
(they read acceptably on all four palettes).

### New tokens required

- `--color-accent-contrast` — foreground colour for filled accent/primary buttons
  (fixes `PrimaryButton`'s hardcoded `bg-white text-black`, which is invisible on
  the Light theme).
- `--color-btn-primary-bg` / `--color-btn-primary-fg` — primary CTA surface per
  theme.
- `--zoom` and `--font-scale` — applied to `<html>`.

### Application layer

A small `useApplyAppearance()` effect (called once in `App`) reads
`theme`, `zoom`, `fontScale`, `reduceMotion`, `density` from the settings store and:

- Sets `document.documentElement.dataset.theme = theme`.
- Sets `document.documentElement.style.zoom = zoomPercent` (CSS `zoom` — works with
  the app's existing px-based sizing; no rem refactor needed).
- Sets a `--font-scale` variable consumed by body text.
- Sets `data-density` and `data-reduce-motion` attributes on `<html>`.

`color-scheme` on `<html>` flips to `light` when the Light theme is active (native
form controls / scrollbars follow).

## Palettes

| Token | Dark | Venice (current) | Grey (Cursor Dark Modern) | Light |
|---|---|---|---|---|
| bg-base | `#060607` | `#0a0a0c` | `#181818` | `#f4f4f2` |
| bg-raised | `#0d0d0e` | `#111114` | `#1f1f1f` | `#fbfbfa` |
| bg-input | `#0a0a0b` | `#0d0d11` | `#141414` | `#ffffff` |
| bg-overlay | `#111113` | `#16161b` | `#232323` | `#ffffff` |
| border-faint | `rgba(255,255,255,.05)` | `rgba(255,255,255,.05)` | `rgba(255,255,255,.06)` | `rgba(0,0,0,.06)` |
| border-soft | `rgba(255,255,255,.07)` | `rgba(255,255,255,.08)` | `#2b2b2b` | `rgba(0,0,0,.10)` |
| border-strong | `rgba(255,255,255,.14)` | `rgba(255,255,255,.16)` | `#3c3c3c` | `rgba(0,0,0,.18)` |
| text-primary | `rgba(255,255,255,.90)` | `rgba(255,255,255,.92)` | `#cccccc` | `rgba(20,22,28,.92)` |
| text-secondary | `rgba(255,255,255,.62)` | `rgba(255,255,255,.65)` | `rgba(204,204,204,.75)` | `rgba(20,22,28,.62)` |
| text-tertiary | `rgba(255,255,255,.40)` | `rgba(255,255,255,.42)` | `rgba(204,204,204,.5)` | `rgba(20,22,28,.42)` |
| accent | `#6ee7d3` | `#6ee7d3` | `#4aa3ff` | `#0f9a84` |
| accent-soft | `rgba(110,231,211,.16)` | `rgba(110,231,211,.16)` | `rgba(74,163,255,.16)` | `rgba(15,154,132,.14)` |
| accent-contrast | `#04120e` | `#04120e` | `#03121f` | `#ffffff` |

Grey values are pulled directly from Cursor / VS Code Dark Modern
(`#181818` sidebar, `#1f1f1f` editor, `#2b2b2b` borders, `#cccccc` text). Light is
intentionally soft — off-white surfaces, ink text, never pure white/black.

## Settings UI

### Entry point

- A cog button pinned to the bottom-left of the sidebar. Visible in expanded
  (icon + "Settings" label) and collapsed (icon only, tooltip) states. It sits
  above the existing keyboard-hint footer when expanded (hints are preserved, not
  removed); in the collapsed rail it renders as an icon-only row.
- Clicking sets `activeTab = 'settings'`. A back affordance returns to the
  previously active tab (store remembers `lastNonSettingsTab`).

### Settings screen (main area)

- Left category rail: **Profile**, **Display**.
- Right content pane renders the selected category.
- Reuses existing shared UI primitives (`PillGroup`, `SectionHeading`, `Card`,
  `Label`, `GhostButton`).

### Profile (minimal)

- Avatar placeholder showing initials derived from display name.
- Display name text input (local, persisted; no backend).
- No email, auth, or account wiring (out of scope).

### Display

- **Theme** — 4 selectable swatch buttons (Dark, Venice, Grey, Light) showing a
  mini colour preview each.
- **Zoom** — segmented control: 90% / 100% / 110% / 125%.
- **Font Size** — segmented control: Small / Medium / Large.
- **Reduce Motion** — toggle (forces the reduced-motion path the app already
  honors via `prefers-reduced-motion`).
- **Density** — toggle: Compact / Comfortable.

## State & persistence

Extend `settings-store` (`useSettingsStore`, already zustand + persist):

```
theme: 'dark' | 'venice' | 'grey' | 'light'   // default 'venice'
zoom: 90 | 100 | 110 | 125                     // default 100
fontScale: 'sm' | 'md' | 'lg'                  // default 'md'
reduceMotion: boolean                          // default false
density: 'compact' | 'comfortable'             // default 'comfortable'
profileName: string                            // default ''
lastNonSettingsTab: Tab                         // to restore on close
```

- `'settings'` added to the `Tab` union.
- `'settings'` is **excluded** from the `TAB_ORDER` used by the `⌘1-9`
  shortcuts (it is not a numbered destination).
- Persist `version` bumped; migration is additive (new fields default), so no
  destructive migration needed.

## Naming decision

The theme reflecting the app's current look is labelled **"Venice"** (its accent is
teal `#6ee7d3`, not blue). This avoids the misnomer of calling a teal scheme
"Blue". Grey introduces a genuine blue accent (`#4aa3ff`, Cursor's blue).

## Known inconsistencies addressed

1. **Teal-vs-Blue naming** → resolved by naming the current scheme "Venice".
2. **`PrimaryButton` hardcodes `bg-white text-black`** → invisible on Light;
   fixed via `--color-btn-primary-*` tokens.
3. **Intel off-palette black** (`#0a0a0a` / `#0e0e0e`) → folded into base/raised
   tokens.
4. **Intel sub-tab inactive `text-white/20`** (near-invisible) → moved to
   `text-tertiary` token for legibility on all themes.
5. **Status badge tones** (emerald/sky/violet/etc.) remain dark-tuned; acceptable
   on all four palettes for now (per-theme badge tuning is explicitly out of scope,
   YAGNI).

## Out of scope

- Account/auth-backed profile data.
- Syntax-highlight theming inside code blocks (prose-venice stays as-is).
- Per-theme status-badge retuning.
- rem-based zoom refactor (CSS `zoom` used instead).
- Custom/user-defined themes beyond the four.

## Testing

- Manual: switch each theme; verify sidebar, header, main views, Intel section,
  dialogs, primary buttons, and inputs all recolour with no black boxes.
- Manual: zoom + font size persist across reload; reduce-motion disables
  animations; density toggle changes spacing.
- Verify `⌘1-9` shortcuts still map to the nine functional tabs and never land on
  Settings.
- Existing unit tests remain green (`settings-store` shape change is additive).
