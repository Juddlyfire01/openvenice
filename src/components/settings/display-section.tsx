import { cn } from '../../lib/utils'
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

function cnToggle(on: boolean) {
  return cn(
    'relative inline-flex h-6 w-11 shrink-0 rounded-full border transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)] focus-visible:outline-offset-2',
    on
      ? 'bg-[var(--color-accent)] border-[var(--color-accent)]'
      : 'bg-[var(--color-border-faint)] border-[var(--color-border-soft)]',
  )
}

function cnKnob(on: boolean) {
  return cn(
    'inline-block h-5 w-5 rounded-full bg-white shadow transition-transform translate-y-px',
    on ? 'translate-x-[22px]' : 'translate-x-px',
  )
}

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
          type="button"
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
