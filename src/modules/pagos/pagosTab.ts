import { useLocation, useSearchParams } from '../../lib/nav'

// Which tab of "Pagos y planes" is showing (from the URL).
export type PagosTab = 'pagos' | 'historial' | 'planes'

export function usePagosTab(): PagosTab {
  const { pathname } = useLocation()
  const [params] = useSearchParams()
  if (pathname.startsWith('/app/planes')) return 'planes'
  return params.get('vista') === 'historial' ? 'historial' : 'pagos'
}
