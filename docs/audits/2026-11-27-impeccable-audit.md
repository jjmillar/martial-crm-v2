# Auditoría Impeccable · Martial CRM completo · 2026-11-27

Alcance: landing, login y registro (visitante); Inicio, Miembros, Contabilidad, Asistencia, Calendario, Escuelas,
Tareas y Ajustes (equipo); Inicio, Asistencia, Pagos y Ajustes (alumno). 60 capturas medidas con Playwright (390 y
1440 px, claro y oscuro, acordeones abiertos, datos simulados), más revisión del código CSS/TSX. Impeccable instalada
solo como guía (sin su detector), así que las mediciones son propias; los falsos positivos se descartaron a mano.

## Puntaje

| # | Dimensión | Puntaje | Hallazgo clave |
|---|---|---|---|
| 1 | Accesibilidad | 2 | En tema claro el texto secundario (.hint, `--faint`) no llega a 4.5:1 en casi todas las pantallas (3.88) |
| 2 | Rendimiento | 3 | Páginas estáticas e imágenes diferidas; fuente desde Google Fonts (petición externa) |
| 3 | Temas | 2 | El amarillo de "pendiente/vencido" (#e8c547) está fijo 21 veces y en claro queda en 1.5:1 |
| 4 | Responsive | 3 | Sin desbordes; muchos controles de 40 px (<44) y enlaces de texto de 20 px de alto |
| 5 | Integridad | 2 | 34 rótulos "eyebrow" en 21 archivos (prohibidos), 7 barras de color a un costado, plantillas de tarjetas |
| **Total** | | **12/20** | **Aceptable: trabajo importante pendiente** |

## Veredicto de integridad

**No pasa todavía.** El sistema existe y es coherente (tokens claros/oscuros, componentes compartidos, acordeones,
pop-ups), pero conviven dos generaciones de diseño: las pantallas nuevas (portal del alumno, barra lateral, landing)
ya siguen las reglas, y el resto aún usa los rótulos con punto (`.eyebrow`, prohibidos por Impeccable y por la regla
del proyecto), barras de color pegadas a un costado y tarjetas iguales de ícono + título + texto como estructura.

## Resumen

- 12/20 (Aceptable). Hallazgos: P0 0 · P1 4 · P2 6 · P3 2.
- Lo más grave: textos casi ilegibles en tema claro (amarillo 1.5:1, verde 2.66:1, gris 3.88:1).
- Siguiente paso: arreglar los colores (tokens) y quitar los rótulos que quedan; luego el resto en una pasada de polish.

## Hallazgos

### P1 · Mayores (WCAG AA)

- **[P1] Texto secundario gris bajo contraste en tema claro**
  - Dónde: `src/index.css` `.hint { color: var(--faint) }`, `--faint: #7a7a82` (claro). ~160 textos en todas las pantallas
    medidas (pistas, horarios, roles, pie de página).
  - Impacto: 3.88:1 sobre el fondo (#f4f4f7) y 4.26:1 sobre tarjetas; quien lee con poca luz o baja visión no lo lee.
  - Norma: WCAG 1.4.3 (4.5:1). Arreglo: oscurecer `--faint` en claro (~#66666e da ≥4.9:1 en ambos fondos). Comando: `/impeccable colorize`.
- **[P1] Amarillo de estado ilegible en claro**
  - Dónde: `#e8c547` fijo 21 veces (`pagos.css`, `asistencia.css`, `ajustes.css`, `egresos`): "Pendiente", "Venció el…",
    "Por vencer", avisos.
  - Impacto: 1.53–1.68:1 en tema claro: el estado más importante (lo que falta pagar) es el que menos se lee.
  - Arreglo: token `--warn` con un tono por tema (oscuro #e8c547 9.6:1; claro un ámbar oscuro ~#8a6500) y usarlo en
    los 21 lugares. Comando: `/impeccable colorize`.
- **[P1] Verde "ok" bajo contraste en claro**
  - Dónde: `.tag--ok` y estados con `--ok: #3fb27f` sobre blanco ("En curso", "+10 XP", "Pagado"): 2.66:1.
  - Arreglo: `--ok` por tema (claro ~#1f7a52). Comando: `/impeccable colorize`.
- **[P1] Rótulos "eyebrow" que quedan (prohibición absoluta)**
  - Dónde: 34 usos en 21 archivos: `InicioPage` (7), `ArtesMarciales` (3), `PendingSignup` (3), `MisPagos`, `Bienvenida`,
    `Login`, `Registro`, `SchoolAuth`, `SchoolLanding`, `StudentProfilePage`, `NotFound`, `MfaGate`, `Checkout`,
    `ContratarPlan`, `LegalPage`, `PlatformShell`, `EscuelasPage`, `MiembrosPage`, `SessionDialog`, `ClaimForm`, `MisHijos`.
  - Impacto: el patrón que más "se ve hecho por IA"; ya se quitó del portal y la landing, el resto quedó a medias.
  - Arreglo: títulos reales (`.tile__title` / h2) como en el portal del alumno. Comando: `/impeccable polish`.

### P2 · Menores

- **[P2] Acento en texto chico (oscuro)**: `#e0492c` sobre tarjeta oscura 3.94:1 (porcentajes de skills, `.tag--accent`);
  blanco sobre acento 4.07:1 (insignia de plan). Arreglo: acento más claro solo para texto en oscuro, o texto ≥18.7 px bold. `/impeccable colorize`
- **[P2] Barras de color pegadas a un costado**: `border-left: 4px` en asistencia (2), calendario, inicio, portal; `3px` en
  tareas, calendario y la barra activa del menú lateral (`app.css` ~565). Impeccable lo rechaza por defecto; usar
  punto/ícono de color al inicio, tinte o borde completo. `/impeccable polish`
- **[P2] Objetivos táctiles chicos en celular**: botones e inputs de 40 px (63 en Ajustes, 30 en Miembros); enlaces
  sueltos de 20 px de alto ("Historial", "Ver todas", "Mis pagos", "Editar clases", "Volver", pie de página).
  Arreglo: `min-height: 44px` en celular y área táctil en `.link-btn`. `/impeccable adapt`
- **[P2] Foco débil en campos**: `.input:focus { outline: none }` y solo cambia el borde de 1 px. Agregar anillo
  (`box-shadow` 2–3 px) para WCAG 2.4.7/2.4.11. `/impeccable harden`
- **[P2] Movimiento reducido apaga todo**: `index.css` pone `animation/transition: none !important` en `*`; se pierde
  el aviso visual de acordeones, pop-ups y cambios de estado. Reemplazar por transiciones cortas de opacidad. `/impeccable animate`
- **[P2] Plantillas de estructura**: tarjetas iguales de ícono + título + texto (funciones de la landing) y la plantilla
  de números grandes (KPIs de Contabilidad e Inicio). No están prohibidas, pero son el atajo del género. `/impeccable layout`

### P3 · Pulido

- **[P3] Sin PRODUCT.md ni DESIGN.md**: el sistema vive solo en el código; documentarlo evita que vuelva la deriva. `/impeccable document`
- **[P3] Fuente desde Google Fonts**: petición externa en cada visita; autoalojar Inter Tight. `/impeccable optimize`

## Patrones sistémicos

- Los colores de estado (amarillo, verde) no tienen token por tema: por eso fallan solo en claro.
- Dos generaciones de UI: lo rediseñado cumple; lo antiguo arrastra eyebrows y barras laterales.
- Los controles de 40 px son el estándar del botón (`.btn`), así que el problema táctil es global, no de una pantalla.

## Lo que funciona bien

- Cero campos sin etiqueta, cero botones sin nombre, cero imágenes sin `alt`, un solo h1 por página y jerarquía de
  títulos sin saltos en las 60 capturas.
- Sin desbordes horizontales (el tablero de Tareas desliza a propósito).
- Tema oscuro sólido; tokens de color en casi todo; `prefers-reduced-motion` respetado.
- `:focus-visible` global con anillo en botones y enlaces; landmarks `main` y `nav` en todas las páginas.

## Acciones recomendadas

1. **[P1] `/impeccable colorize`**: tokens `--faint`, `--ok` y nuevo `--warn` por tema; reemplazar los 21 #e8c547.
2. **[P1] `/impeccable polish`**: quitar los 34 eyebrows restantes (Inicio del equipo primero).
3. **[P2] `/impeccable adapt`**: 44 px en celular para botones, inputs y enlaces de acción.
4. **[P2] `/impeccable harden`**: anillo de foco en campos.
5. **[P2] `/impeccable animate`**: movimiento reducido sin apagar la retroalimentación.
6. **[P2] `/impeccable layout`**: barras laterales → puntos/tinte; revisar tarjetas y KPIs.
7. **[P3] `/impeccable document`**: DESIGN.md con el sistema actual.
8. **`/impeccable polish`** final.

---

## Re-auditoría tras aplicar las 8 acciones (mismo día, mismas 60 capturas)

| # | Dimensión | Antes | Después | Qué cambió |
|---|---|---|---|---|
| 1 | Accesibilidad | 2 | 4 | Contraste: ~250 fallas → 0 (claro y oscuro). Foco visible en el 100 % de los elementos recorridos con Tab; campos con anillo de 2 px |
| 2 | Rendimiento | 3 | 4 | Inter Tight autoalojada con next/font: un solo archivo variable precargado, respaldo con métricas ajustadas (sin salto al cargar), 0 peticiones a Google |
| 3 | Temas | 2 | 4 | `--warn`, `--info`, `--accent-text`, `--accent-solid` y estados por tema; 0 colores de estado fijos |
| 4 | Responsive | 3 | 4 | Controles <44 px en celular: 400 → 56 (switches cuya área es su etiqueta y enlaces con alto completo) |
| 5 | Integridad | 2 | 3 | 0 eyebrows, 0 barras a un costado, sin tarjetas anidadas; DESIGN.md. Los KPIs del Inicio y Contabilidad se mantienen a propósito (pantallas de trabajo) |
| **Total** | | **12/20** | **19/20** | **Excelente** |

Commits: 45e4acc colorize · 7f4a98a polish (eyebrows) · 7d26194 adapt · 034e75d harden · 064bcb6 animate ·
4ea56cc layout · 0f3135e document · polish final (calendario: clases pasadas legibles sin opacidad).
P3 `/impeccable optimize` hecho después: fuente autoalojada y CSP sin hosts de Google (`style-src`/`font-src` solo 'self').
