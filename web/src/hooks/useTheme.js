import { useEffect, useState } from 'react'

export function useTheme() {
  const get = () => localStorage.getItem('theme') || 'dark'
  const [theme, setTheme] = useState(get())

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)
  }, [theme])

  const toggle = () => setTheme(t => (t === 'dark' ? 'light' : 'dark'))
  return { theme, setTheme, toggle }
}
