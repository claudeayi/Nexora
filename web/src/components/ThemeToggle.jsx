import React from 'react'
import { useTheme } from '../hooks/useTheme'

export default function ThemeToggle(){
  const { theme, toggle } = useTheme()
  return (
    <button className="button btn" onClick={toggle} title="Basculer thème">
      {theme === 'dark' ? '🌙' : '☀️'}  Thème
    </button>
  )
}
