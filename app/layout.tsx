import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'
// Every stylesheet loads once, globally, in this exact order (modules first, base and shared patterns last):
// the cascade depends on it, so add new stylesheets here, never inside components.
import '@/modules/inicio/inicio.css'
import '@/modules/portal/portal.css'
import '@/modules/miembros/miembros.css'
import 'leaflet/dist/leaflet.css'
import '@/modules/ajustes/ajustes.css'
import '@/modules/escuelas/escuelas.css'
import '@/modules/pagos/pagos.css'
import '@/modules/vinculos/vinculos.css'
import '@/modules/alumnos/alumnos.css'
import '@/modules/profesores/profesores.css'
import '@/modules/planes/planes.css'
import '@/modules/matriculas/matriculas.css'
import '@/modules/clases/clases.css'
import '@/modules/calendario/calendario.css'
import '@/modules/asistencia/asistencia.css'
import '@/modules/tareas/tareas.css'
import '@/modules/artes/artes.css'
import '@/modules/suscripcion/suscripcion.css'
import '@/modules/ayuda/ayuda.css'
import '@/screens/landing.css'
import '@/screens/auth.css'
import '@/screens/escuela/escuela.css'
import '@/shell/app.css'
import '@/index.css'
import '@/ui/patterns.css'
import '@/ui/motion.css'
import { Inter_Tight } from 'next/font/google'
import { Providers } from './providers'

// Inter Tight, self-hosted: next/font downloads it at build time and serves it from our own origin (no request to
// Google per visit, no third-party host in the CSP). One variable file (latin covers Spanish), preloaded, with a
// metric-matched fallback so the swap does not shift the layout.
const interTight = Inter_Tight({ subsets: ['latin'], display: 'swap', variable: '--font-inter-tight' })

export const metadata: Metadata = {
  title: 'Martial CRM',
  description: 'CRM para academias de artes marciales: alumnos, clases, asistencia y pagos en un solo lugar.',
  icons: { icon: '/favicon.svg' },
}

export const viewport: Viewport = { themeColor: '#19191c', width: 'device-width', initialScale: 1 }

// Applies the saved light/dark choice before the first paint (no flash of the wrong theme).
const themeScript = "try { var t = localStorage.getItem('mcrm.theme'); if (t) document.documentElement.dataset.theme = t } catch (e) {}"

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es" className={interTight.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <div id="root">
          <Providers>{children}</Providers>
        </div>
      </body>
    </html>
  )
}
