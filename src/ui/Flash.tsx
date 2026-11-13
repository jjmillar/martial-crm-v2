import { useEffect, useState } from 'react'
import { clearNavState, useLocation } from '../lib/nav'
import { Icon } from './Icon'
import { motion } from './motion'

// One-shot confirmation after a navigation, e.g. navigate('..', { state: { flash: 'Plan creado.' } }).
// The message is dropped from history right away so a reload doesn't show it again.
export function Flash() {
  const location = useLocation()
  const [msg, setMsg] = useState<{ text: string; key: string; out?: boolean } | null>(null)
  const text = (location.state as { flash?: string } | null)?.flash

  // Show it once and drop it from the navigation state, so going back or forward never repeats it.
  useEffect(() => {
    if (!text) return
    setMsg({ text, key: location.key })
    clearNavState()
  }, [text, location.key])

  // Its own clock: it leaves after 3.5 s with the standard exit even if the user has already moved on.
  const msgKey = msg?.key
  const leaving = Boolean(msg?.out)
  useEffect(() => {
    if (!msgKey) return
    const t = setTimeout(() => setMsg((m) => (m && m.key === msgKey ? { ...m, out: true } : m)), leaving ? 0 : 3500)
    const t2 = leaving ? setTimeout(() => setMsg((m) => (m && m.key === msgKey ? null : m)), motion.exit) : undefined
    return () => { clearTimeout(t); if (t2) clearTimeout(t2) }
  }, [msgKey, leaving])

  if (!msg) return null
  return (
    <div className={`flash${msg.out ? ' flash--out' : ''}`} role="status" key={msg.key}>
      <Icon name="check" size={18} />
      <span>{msg.text}</span>
    </div>
  )
}
