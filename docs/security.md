# Seguridad de Martial CRM

Referencias: **OWASP Top 10 2025**, **OWASP ASVS 5.0** (nivel 2 como objetivo), OWASP Secure Headers,
y las guías de seguridad de Supabase y Next.js. Revisión completa: 2026-11-17.

La seguridad es el **primer criterio** de cualquier cambio: un cambio que no cumple esta lista no se publica,
aunque la funcionalidad esté lista.

## Checklist obligatorio para cada cambio

1. **Datos y permisos (A01 Broken Access Control).**
   - Toda tabla nueva tiene RLS activado y políticas por escuela (`is_school_member`, `has_school_role`, `is_ceo`, `is_school_owner`, `my_student_ids`).
   - Las escrituras sensibles pasan por funciones `security definer` que verifican quién llama y fijan `set search_path = ''`.
   - **Funciones nuevas:** por defecto nadie las puede ejecutar (ni `anon` ni `PUBLIC`). Cada una se concede explícitamente: `grant execute … to authenticated` o, solo si es pública, `to anon`.
   - **Funciones de trigger e internas:** nunca se conceden.
   - **Prueba de base de datos obligatoria** (`scripts/db/*.check.mjs`). Debe demostrar:
     - que otro usuario, otra escuela y `anon` no pueden leer ni escribir;
     - que el rol correcto sí puede.
2. **Datos personales.**
   - Las páginas públicas (landing, perfil público) solo devuelven los campos elegidos.
   - Nunca se exponen RUT, dirección, fecha de nacimiento, correo ni teléfono de alumnos.
   - Ningún dato de pacientes, clientes ni clínicas va a servicios externos.
3. **Entradas (A05 Injection).**
   - Validar en el cliente (mensajes claros) **y** en la base de datos (checks y RPC), con largo máximo en todo texto.
   - Nada de `dangerouslySetInnerHTML` con datos de usuarios.
   - Correos: todo texto con `escapeHtml`.
4. **Autenticación (A07).**
   - Contraseña de 8 caracteres como mínimo.
   - Verificación en dos pasos (TOTP) disponible para todos y recomendada al CEO. Se exige en la base de datos: si la cuenta tiene un factor, sin sesión `aal2` no ve datos (`mfa_ok()`).
   - Las sesiones las maneja Supabase Auth, con rotación de refresh tokens.
5. **Abuso.**
   - Todo punto de entrada anónimo tiene límite de intentos:
     - `rate_limit_hit` en la base de datos;
     - límite por IP en las Edge Functions;
     - límites propios de Supabase Auth.
6. **Dinero y datos bancarios.**
   - Solo el CEO cambia los datos bancarios y aprueba pagos.
   - Cada cambio queda en `audit_log` (A09 Logging), que no se puede editar ni borrar desde la app.
7. **Secretos (A04 Cryptographic Failures).**
   - Nunca en el repo ni en el cliente: solo la clave `anon` es pública.
   - Las claves de servicio viven en `~/.secrets` y en las variables de Netlify o Supabase.
8. **Configuración (A02 Security Misconfiguration).**
   - Los encabezados de seguridad van en `next.config.ts`.
   - CORS de las Edge Functions limitado a los orígenes propios (`_shared/cors.ts`).
   - Los buckets públicos solo aceptan imágenes rasterizadas (sin SVG).
9. **Dependencias (A03 Software Supply Chain).**
   - `npm audit --omit=dev` sin vulnerabilidades altas antes de publicar.
   - Versiones fijadas en `package-lock.json`.
10. **Verificación.**
    - Después de cada migración, `npx supabase db advisors --linked --type security` sin hallazgos nuevos.
    - Prueba manual a 390 px del flujo con un usuario sin permisos.

## Qué está implementado

| Área | Medida | Dónde |
|---|---|---|
| Control de acceso | RLS en todas las tablas; helpers por escuela y rol | migraciones `2026111*` |
| Mínimo privilegio | `anon` solo ejecuta `school_landing`, `student_public_profile`, `book_trial`; triggers e internas no expuestas; default sin EXECUTE | `20261117000002_security_hardening.sql` |
| MFA | TOTP (Ajustes → Verificación en dos pasos), pantalla de código al ingresar, `mfa_ok()` en los helpers de RLS | `MfaGate.tsx`, `Seguridad.tsx` |
| Datos bancarios | Solo el CEO los cambia (trigger) y cada cambio se audita | `schools_transfer_guard` |
| Auditoría | `audit_log`: datos bancarios, estados y montos de pago, pagos eliminados, roles, alumnos eliminados. Lo lee solo el CEO o dueño | Ajustes → Registro de actividad |
| Límites de intentos | Reservas de prueba: 10 por hora por IP. Registros: 5 por hora por IP | `rate_limit_hit`, `account-signup` |
| Encabezados | CSP (sin `unsafe-eval`, `frame-ancestors 'none'`), HSTS, nosniff, X-Frame-Options, Referrer-Policy, Permissions-Policy, COOP | `next.config.ts` |
| CORS | Lista de orígenes permitidos en vez de `*` | `supabase/functions/_shared/cors.ts` |
| Archivos | Logos sin SVG; comprobantes en un bucket privado por escuela | migraciones `*_storage.sql` |
| Dependencias | `zod` ≥ 4.6.7 (GHSA-mrhx-c7xc-m3w5) | `package.json` |

## Pendiente (decisión o plan del dueño)

- **Protección contra contraseñas filtradas (HaveIBeenPwned):** requiere el plan Pro de Supabase.
- **Dominio de correo propio verificado en Resend:** sin él, los correos salen desde `onboarding@resend.dev`.
- **Exigir MFA a todos los CEO** (hoy es opcional y recomendado): se puede activar cuando todos lo tengan configurado.
