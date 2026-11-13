import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Icon } from './Icon'

// One-shot confirmation after a navigation, e.g. navigate('..', { state: { flash: 'Plan creado.' } }).
// The message is dropped from history right away so a reload doesn't show it again.
export function Flash() {
  const location = useLocation()
  const [msg, setMsg] = useState<{ text: string; key: string } | null>(null)
  const text = (location.state as { flash?: string } | null)?.flash

  useEffect(() => {
    if (!text) return
    setMsg({ text, key: location.key })
    try {
      const h = window.history.state as { usr?: unknown } | null
      if (h && typeof h === 'object') window.history.replaceState({ ...h, usr: undefined }, '')
    } catch { /* ignore */ }
    const t = setTimeout(() => setMsg(null), 3500)
    return () => clearTimeout(t)
  }, [text, location.key])

  if (!msg) return null
  return (
    <div className="flash" role="status" key={msg.key}>
      <Icon name="check" size={18} />
      <span>{msg.text}</span>
    </div>
  )
}
