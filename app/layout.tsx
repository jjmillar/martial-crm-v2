import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'
// Every stylesheet loads once, globally, in this exact order (modules first, base and shared patterns last):
// the cascade depends on it, so add new stylesheets here, never inside components.
import '@/modules/inicio/inicio.css'
import '@/modules/portal/portal.css'
import '@/modules/miembros/miembros.css'
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
import '@/screens/landing.css'
import '@/screens/auth.css'
import '@/screens/escuela/escuela.css'
import '@/shell/app.css'
import '@/index.css'
import '@/ui/patterns.css'
import '@/ui/motion.css'
import { Providers } from './providers'

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
    <html lang="es" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;500;600;700&display=swap" rel="stylesheet" />
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
