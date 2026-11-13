'use client'
// Navigation API used by every screen, implemented on Next.js's App Router.
// It keeps the small surface the app was written against (Link/NavLink with `to`, relative paths like '..'
// and 'nuevo', navigate(to, { replace, state }), location.state for one-shot messages) so screens stay as they are.
import NextLink from 'next/link'
import {
  useParams as useNextParams,
  usePathname,
  useRouter,
  useSearchParams as useNextSearchParams,
} from 'next/navigation'
import { useCallback, useEffect, useMemo, useState, type AnchorHTMLAttributes, type MouseEvent, type ReactNode } from 'react'

type NavOptions = { replace?: boolean; state?: unknown }

// Navigation state travels in memory to the next page only (a reload or a later visit never sees it again).
let carried: { path: string; state: unknown; id: number } | null = null
let seq = 0
const setCarried = (path: string, state: unknown) => {
  carried = state === undefined ? null : { path: path.split('#')[0], state, id: ++seq }
}
/** Drop the carried state once it has been consumed (e.g. a toast was shown). */
export const clearNavState = () => { carried = null }

/** Resolve '..', 'nuevo', '?x=1' or '#id' against the current path, like relative links do. */
export function resolvePath(to: string, pathname: string, search = ''): string {
  if (/^[a-z][a-z0-9+.-]*:/i.test(to) || to.startsWith('/')) return to
  if (to.startsWith('#')) return pathname + search + to
  if (to.startsWith('?')) return pathname + to
  const cut = to.search(/[?#]/)
  const path = cut === -1 ? to : to.slice(0, cut)
  const rest = cut === -1 ? '' : to.slice(cut)
  const segs = pathname.split('/').filter(Boolean)
  for (const part of path.split('/')) {
    if (part === '..') segs.pop()
    else if (part && part !== '.') segs.push(part)
  }
  return '/' + segs.join('/') + rest
}

function useHere() {
  const pathname = usePathname() ?? '/'
  const params = useNextSearchParams()
  const qs = params?.toString() ?? ''
  return { pathname, search: qs ? `?${qs}` : '' }
}

export function useNavigate() {
  const router = useRouter()
  const { pathname, search } = useHere()
  return useCallback(
    (to: string | number, opts: NavOptions = {}) => {
      if (typeof to === 'number') { if (to < 0) router.back(); else router.forward(); return }
      const href = resolvePath(to, pathname, search)
      setCarried(href, opts.state)
      if (opts.replace) router.replace(href)
      else router.push(href)
    },
    [router, pathname, search],
  )
}

export function useLocation() {
  const { pathname, search } = useHere()
  const [hash, setHash] = useState('')
  useEffect(() => {
    const read = () => setHash(window.location.hash)
    read()
    window.addEventListener('hashchange', read)
    return () => window.removeEventListener('hashchange', read)
  }, [pathname, search])
  const c = carried && carried.path === pathname + search ? carried : null
  return { pathname, search, hash, state: c?.state ?? null, key: `${pathname}${search}:${c?.id ?? 0}` }
}

export function useParams<T extends Record<string, string> = Record<string, string>>() {
  return (useNextParams() ?? {}) as T
}

type SetParams = (next: URLSearchParams | Record<string, string> | ((prev: URLSearchParams) => URLSearchParams), opts?: { replace?: boolean }) => void

export function useSearchParams(): [URLSearchParams, SetParams] {
  const router = useRouter()
  const { pathname } = useHere()
  const current = useNextSearchParams()
  const params = useMemo(() => new URLSearchParams(current?.toString() ?? ''), [current])
  const set = useCallback<SetParams>(
    (next, opts) => {
      const value = typeof next === 'function' ? next(new URLSearchParams(params)) : new URLSearchParams(next as Record<string, string>)
      const qs = value.toString()
      const href = qs ? `${pathname}?${qs}` : pathname
      if (opts?.replace) router.replace(href, { scroll: false })
      else router.push(href, { scroll: false })
    },
    [router, pathname, params],
  )
  return [params, set]
}

type LinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & NavOptions & { to: string; children?: ReactNode }

export function Link({ to, replace, state, onClick, ...rest }: LinkProps) {
  const { pathname, search } = useHere()
  const href = resolvePath(to, pathname, search)
  return (
    <NextLink
      href={href}
      replace={replace}
      onClick={(e: MouseEvent<HTMLAnchorElement>) => { setCarried(href, state); onClick?.(e) }}
      {...rest}
    />
  )
}

type NavLinkProps = Omit<LinkProps, 'className'> & { className?: string | ((s: { isActive: boolean }) => string); end?: boolean }

/** Link that knows whether it points at the current section (adds "active", like the menu expects). */
export function NavLink({ to, className, end, ...rest }: NavLinkProps) {
  const { pathname, search } = useHere()
  const href = resolvePath(to, pathname, search).split(/[?#]/)[0]
  const isActive = end ? pathname === href : pathname === href || pathname.startsWith(href.endsWith('/') ? href : `${href}/`)
  const cls = typeof className === 'function' ? className({ isActive }) : [className, isActive ? 'active' : ''].filter(Boolean).join(' ')
  return <Link to={to} className={cls || undefined} aria-current={isActive ? 'page' : undefined} {...rest} />
}

/** Redirect on render (client side). */
export function Navigate({ to, replace, state }: { to: string } & NavOptions) {
  const navigate = useNavigate()
  useEffect(() => { navigate(to, { replace, state }) }, [navigate, to, replace, state])
  return null
}
