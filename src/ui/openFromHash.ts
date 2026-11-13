/** Opens (and scrolls to) the accordion named by a #hash, or the one that contains that element. */
export function openFromHash(hash: string) {
  if (!hash) return
  const el = document.getElementById(hash.slice(1))
  if (!el) return
  const acc = el.closest('details')
  if (acc) acc.open = true
  el.scrollIntoView({ block: 'start' })
}
