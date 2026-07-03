import { useEffect } from 'react'
import { useSettingsStore } from '../stores/settings-store'

const FONT_SCALE_MAP = { sm: 0.9, md: 1, lg: 1.12 } as const

export function useApplyAppearance() {
  const theme = useSettingsStore((s) => s.theme)
  const zoom = useSettingsStore((s) => s.zoom)
  const fontScale = useSettingsStore((s) => s.fontScale)
  const reduceMotion = useSettingsStore((s) => s.reduceMotion)
  const density = useSettingsStore((s) => s.density)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.documentElement.style.colorScheme = theme === 'light' ? 'light' : 'dark'
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
