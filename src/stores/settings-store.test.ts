import { describe, it, expect, beforeEach } from 'vitest'
import { useSettingsStore } from './settings-store'

describe('settings-store', () => {
  beforeEach(() => {
    useSettingsStore.setState({
      activeTab: 'chat',
      theme: 'venice',
      scale: 100,
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

  it('setScale accepts the allowed steps', () => {
    useSettingsStore.getState().setScale(90)
    expect(useSettingsStore.getState().scale).toBe(90)
    useSettingsStore.getState().setScale(125)
    expect(useSettingsStore.getState().scale).toBe(125)
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
