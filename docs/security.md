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

## Platform operator ("el CRM del CRM", 2026-11-18)
- One operator account (`platform_operators`), signs in with a username; Auth maps it to `<usuario>@plataforma.martialcrm.invalid` (reserved domain, never receives mail). No password reset by email: recovery only through the service role.
- Two-step verification is mandatory: `is_platform_operator()` requires an `aal2` session, so every `platform_*` function and the `platform_plans` policies refuse a password-only session.
- Least privilege: the operator is not a school member and reads no school data. It sees per-customer aggregates (`platform_customers()`: name, email, schools, active student count, subscription) and changes subscriptions only through `platform_update_subscription()`, which records every change in `subscription_events`.
- `platform_admins` (the old "sees every school" CEO) is empty; `is_ceo()` no longer matches anyone.
- A suspended/cancelled subscription closes the customer's schools for owner, team and students in the RLS helpers (`school_blocked()`), and `is_owner()` turns false so they cannot create schools around the block. Data is kept.

## Guardians / apoderados (2026-11-19)
- `student_guardians` links a login (the guardian) to a child's student record (no login of its own). `my_student_ids()` = own record + children, so every existing "own data" policy (attendance, payments, enrollments, profiles, submissions) extends to the children without new policies.
- Children are requested with `request_child()` (only students of that school; max 5 pending; RUT checked) and created only when the school's CEO/admin approves (`decide_child_request()`, audited).
- Acting for a child goes through functions that take the student id and check it against `my_student_ids()`: `check_in_for` (stamps `attendance.marked_by`), `undo_check_in_for`, `update_my_student`, `save_my_public_profile`, `student_progress`. The child's public profile starts unpublished.
- Hand-over: `create_student_claim()` (guardian only) returns a 12-character one-time code valid 7 days; only its SHA-256 is stored. The sign-up page claims it through the `account-signup` Edge Function (service role, 10 attempts/hour per IP, code validated before any account is created); a signed-in user can claim with `claim_student()`. Claiming links the record to the new login, ends the guardian link and is audited; attendance/XP/payments stay. The student-account guard trigger lets exactly that record through via a transaction-local marker.

## Discount codes (2026-11-21)
- `discount_codes` is readable and writable only by the school's admins/CEO (RLS). Students never read it, so codes can't be listed or enumerated.
- Redeeming goes only through `redeem_discount(payment, code)` (the payment's student, their guardian, or a school member) and `redeem_discount_enrollment(enrollment, code)` (school members). Both are rate limited to 10 tries per hour per user (`rate_limit_hit`), and errors are returned rather than raised, so failed tries still count.
- The checks run in the database with the code row locked: active, validity dates, uses left, one use per student, plan restriction, and the payment must be pending with no transfer in review.
- The discount is snapshotted on the payment (`discount_amount`, `discount_code`) and, for permanent codes, on the enrollment (`discount_percent`/`discount_fixed`). Editing a code later never changes past payments.
- Guard triggers block any direct write to the discount columns, by anyone, including admins. Only the RPCs can write them, using a transaction-local marker (`mcrm.discount`).
- New plan payments of a discounted enrollment get the discount from a trigger. A 100 % discount leaves a $0 payment already marked paid.
- Removing a discount (`remove_discount`, `remove_enrollment_discount`) is for admins only and frees the use. Creating, editing, deleting, redeeming and removing are all in `audit_log`.
- Codes that were already used can't be deleted (FK restrict). Admins deactivate them instead.

## Martial arts, belts and achievements (2026-11-24)
- `art_templates` / `belt_templates` are the platform's original catalog: readable by signed-in users only, written only by migrations (no write grants).
- `add_school_art()` (admins/owner only) copies an art and its belts into the school's own `school_arts` / `school_belts`. Schools edit only their copy; RLS: members and the school's students read, admins write.
- `student_arts`: the team writes (teachers promote), the student and guardian read their own. Composite FKs keep the student, art and belt in the same school/art; the degree can't exceed the belt's maximum (trigger). Arts or belts in use can't be deleted.
- `achievements`: the team reads and manages them. Students and guardians only read their own, submit tournaments through `submit_achievement()` (rate limited to 10/hour per user, at most 5 pending) and withdraw pending ones with `withdraw_achievement()`. Graduations are written by an internal trigger. Milestones are computed by `student_milestones()`, an internal function with no grants, exposed through `student_achievements()`, which checks access.
- The public profile only shows approved achievements, and only when the student turns on "Logros" (`show_achievements`). Same rule as before: no RUT, contact, address or birth date.
