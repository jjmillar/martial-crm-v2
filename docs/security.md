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
   - Solo el CEO cambia los datos bancarios. Los pagos los aprueban los administradores de la escuela (y el dueño).
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
| Términos y privacidad (Ley 21.719) | Toda cuenta nueva acepta la versión vigente; queda `terms_acceptances` (usuario, versión, fecha, contexto y consentimiento del apoderado para menores de 14). Sin IP ni navegador. Solo lectura de la propia fila; se borra con la cuenta. La Edge Function rechaza registros sin aceptación | `20261124000005_terms_acceptance.sql`, `account-signup`, `src/legal` |
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
- Since `20261126000002` the school's arts are also the disciplines of teachers, classes and plans (the old `specialties` catalog is no longer used). `teacher_arts`: members read, admins insert/delete (no update grant); `set_teacher_arts()` is security invoker (RLS applies), executable by `authenticated` only; composite FKs keep teacher, art, class and plan in the same school. `school_landing()` / `trial_availability()` only expose the art's name.

## Classes without attendance (2026-11-24)
- `class_sessions.not_held` ("no se realizó") is written only through `set_session_not_held()`. Any member of the school can call it, but not students, other schools or anon. It refuses future sessions, and every change is recorded in `audit_log`.

## Payment confirmation (2026-11-24)
- Students and guardians report a pending payment as paid ("Ya pagué") only through `submit_payment()`: transfer or cash. It checks that the payment is theirs and still pending, allows one open report per payment, and caps the reference at 120 characters. Transfer reports need the school's transfer data.
- `decide_payment_submission()` is open to the school's admins and owner, the same roles that can already mark payments paid under `payments_update`. "Usuario" members and students can't approve.
- Students and guardians contract or renew a plan only through `contract_plan()` (20 calls/hour per user): the student must be theirs (`my_student_ids()`), the plan active, non-trial and of the student's school. The price comes from the plan (or the enrollment's snapshot for a renewal), never from the caller. It creates an enrollment `pendiente` plus a pending plan payment; renewal opens only when 7 days or less remain. Students still cannot write `enrollments` or `payments` directly.
- The enrollment activates only when its payment becomes `pagado` (trigger `payments_activate_enrollment`, not executable by any role), so a student cannot activate a plan without the school confirming the payment. `withdraw_plan_contract()` drops only the caller's unpaid, unreported contract or renewal.
- When a payment becomes paid, `payments_close_submission()` (an internal trigger, with no grants) closes the student's pending report as approved. Status changes are already recorded in `audit_log` by `payments_audit`.

## Check-in by QR (2026-11-25)
- Each school has one code in `school_check_in_codes` (32 hex characters from `gen_random_uuid()`, 122 random bits). Only the school's CEO/admins/owner can read it (RLS). There are no write policies: `rotate_check_in_code()` (same roles) creates or replaces it, and every change goes to `audit_log`. Rotating makes the printed QR useless right away (a printed code can be photographed and shared).
- Scanning goes only through `qr_check_in(token, student)` (signed-in users, 30 calls/hour per user; anon has no grant). It checks the code, then uses only students of that school the caller can act for (`my_student_ids()`: their own record and children, MFA respected). A guardian with several people gets the list back and must choose; another student's id is refused.
- The class and date are never taken from the caller. The function finds today's class (Chile time) whose window, 1 hour before the start until the end, contains `now()`, using held sessions or the weekly schedule. The attendance is confirmed on the spot and marked `by_qr`, with the student as `marked_by`/`confirmed_by`. Scanning again doesn't duplicate it.
- The "only once the class has started" rule (`attendance_window`) still applies to every other path. Only `qr_check_in` opens the extra hour, through a transaction-local marker (`mcrm.qr_check_in`) that is cleared right after its insert.
- Location (2026-11-25, `20261125000002`): the school's coordinates (`schools.geo_lat/geo_lng/geo_address`) come from its own address, geocoded in the admin's browser through OpenStreetMap Nominatim (only the school's address is sent). They are written under the existing admin-only `schools` update policy, and cleared by a trigger when the address changes. The phone sends its position once per scan. `qr_check_in` confirms only within 150 m (`distance_m`, an internal function with no grants). Farther away, or without a location, the check-in becomes a pending request (`confirmed_at` null) that the team approves in Tareas or Asistencia. Only the rounded distance is stored (`attendance.qr_distance_m`), never the student's coordinates (Ley 21.719, data minimisation; the privacy policy says so). Coordinates can be faked: this stops casual misuse and sends doubtful cases to a human.
- Headers: `Permissions-Policy` now allows `geolocation=(self)` (still no camera, microphone, payment or usb). `connect-src` adds `https://nominatim.openstreetmap.org`.
- Manual fix (2026-11-25): when the geocoded point is wrong, the school's CEO/admins can move it on a map (Leaflet + OpenStreetMap tiles, `img-src` adds `https://tile.openstreetmap.org`). The point is saved with the current address under the same admin-only update policy, so the automatic lookup doesn't replace it; changing the address clears it as before.

- Since `20261126000003` the app check-in opens 1 hour before the class too (`class_open()`, used by the `attendance_window` trigger; executable by `authenticated` only). Self check-ins still wait for the team's approval. `xp_level()` / `xp_to_reach()` are pure math (no data access), granted to `authenticated`; `student_progress`, `student_public_profile` and `student_milestones` keep their previous grants.

## Paying the subscription (2026-11-26, `20261126000001`)
- The CEO pays Martial CRM like students pay their school: bank transfer to the platform's account, "Ya transferí", and the operator confirms it. Each period is a charge in `platform_invoices`. The customer can read only their own (RLS); nobody writes there directly. Every change goes through security-definer functions that check the caller:
  - **Customer:** `my_subscription`, `subscription_checkout`, `subscription_apply_code`, `subscription_report_transfer`. The caller must be an owner (`billing_owner_ok`: `owners` row plus `mfa_ok`). A suspended customer still passes, so they can pay to get back in.
  - **Operator:** `platform_invoices_list`, `platform_decide_invoice`, `platform_discount_uses`. They require `is_platform_operator()`, that is aal2.
- The plan, price and period come from `platform_plans`, never from the client. The amount is computed in the database. Only active paid plans can be bought.
- Approving a charge (`platform_finalize_invoice`, an internal function with no grants) sets the subscription active on that plan until the charge's period end and logs it in `subscription_events`. Rejecting it sends the charge back to "por pagar" with a reason.
- The platform's transfer data (`platform_settings`, one row) is readable and editable only by the operator under aal2. Customers see it only inside `my_subscription()`.
- The operator's discount codes (`platform_discount_codes`) work like the schools' codes:
  - Customers can't read the table, so codes can't be enumerated. They only try a code through `subscription_apply_code`, rate limited to 10 tries per hour per customer.
  - Each code can be used once per customer, with optional uses, dates and plan.
  - A "permanent" code is snapshotted on the subscription.
  - Redemptions (`platform_redemptions`) are visible only to the operator.
- New grants are explicit. `revoke … from public, anon` applies to every new function; the internal ones have no grants at all.
