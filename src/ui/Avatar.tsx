import { initialsOf, useAvatarUrl } from '../lib/avatars'

/**
 * A person's photo, or their initials when there is none. Give `url` when a list already signed every photo at once;
 * otherwise `path` is signed here.
 */
export function Avatar({ path, url, name, size = 40, className = '' }: { path?: string | null; url?: string | null; name: string | null | undefined; size?: number; className?: string }) {
  const own = useAvatarUrl(url === undefined ? path : null)
  const src = url === undefined ? own : url
  return (
    <span className={`avatar${src ? ' avatar--photo' : ''}${className ? ` ${className}` : ''}`} style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }} aria-hidden="true">
      {src ? <img src={src} alt="" loading="lazy" decoding="async" /> : initialsOf(name)}
    </span>
  )
}
