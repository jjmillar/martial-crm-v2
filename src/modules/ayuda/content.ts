import type { AppRole } from '../types'

// Ajustes → Ayuda (odd/tasks/tutorial.md S4–S6). Every text names real menus and buttons (checked in the code);
// **text** marks a UI name and is shown in bold.

export type Audience = 'equipo' | 'alumno'
export type Tutorial = {
  id: string
  title: string
  /** One line: what you get out of it. */
  summary: string
  audience: Audience
  /** Narrower than the audience (e.g. only the owner). */
  roles?: AppRole[]
  steps: string[]
  /** Where it happens: shown at the end as "Para más información, …". */
  more?: { text: string; menu: string; to: string }
  /** The first tutorial: can replay the guided tour on the real pages. */
  tour?: boolean
}
export type Faq = { q: string; a: string; audience: Audience | 'todos'; roles?: AppRole[] }

const SETUP: AppRole[] = ['ceo', 'admin']

export const TUTORIALS: Tutorial[] = [
  {
    id: 'primeros-pasos',
    title: 'Primeros pasos',
    summary: 'Lo mínimo para empezar: tu escuela, una clase, un profesor y un plan.',
    audience: 'equipo',
    roles: SETUP,
    tour: true,
    steps: [
      'En **Escuelas**, crea tu escuela: basta con el nombre y el arte marcial que enseñas.',
      'En **Escuelas → Clases**, toca **Nueva clase**, ponle nombre y agrega al menos un horario semanal.',
      'En **Miembros → Profesores**, toca **Nuevo profesor**: nombre y primer apellido bastan.',
      'En **Contabilidad → Planes**, toca **Nuevo plan** con su nombre, precio y ciclo de cobro. Es lo que tus alumnos contratan.',
    ],
    more: { text: 'ver tus escuelas', menu: 'Escuelas', to: '/app/escuelas' },
  },
  {
    id: 'alumnos',
    title: 'Alumnos',
    summary: 'Agrégalos a mano o deja que se registren desde tu página.',
    audience: 'equipo',
    steps: [
      'En **Miembros → Alumnos**, toca **Nuevo alumno** y completa su ficha.',
      'Si se registran desde tu página pública, aparecen en **Tareas → Aprobaciones**: revísalos y apruébalos para darles acceso.',
      'Para que un alumno que agregaste entre a su portal, abre su ficha y en **Cuenta y vínculos** crea su acceso con correo y contraseña inicial.',
      'Desde su portal, el alumno marca asistencia, ve su nivel y sus skills, y paga sus planes.',
    ],
    more: { text: 'ver tus alumnos', menu: 'Miembros', to: '/app/miembros#alumnos' },
  },
  {
    id: 'equipo',
    title: 'Tu equipo',
    summary: 'Invita a administradores y usuarios para que trabajen contigo.',
    audience: 'equipo',
    roles: SETUP,
    steps: [
      'En **Miembros → Administrativos**, toca **Invitar**.',
      'Escribe su correo y elige el rol: **Administrador** gestiona todo en la escuela; **Usuario** trabaja con alumnos, clases y asistencia.',
      'La persona recibe un correo para crear su contraseña y entrar.',
      'Desde la misma lista puedes cambiarle el rol o quitarle el acceso.',
    ],
    more: { text: 'ver a tu equipo', menu: 'Miembros', to: '/app/miembros#administrativos' },
  },
  {
    id: 'asistencia',
    title: 'Tomar asistencia',
    summary: 'Por día, semana o mes, y con lo que marcan tus alumnos.',
    audience: 'equipo',
    steps: [
      'En **Escuelas → Asistencia**, elige **Día**, **Semana** o **Mes** y toca la clase.',
      'En la ventana de la clase, toca a cada alumno presente. Se guarda al instante.',
      'Lo que marcaron los alumnos desde su portal queda **Por aprobar**: apruébalo ahí mismo o con **Aprobar todos**.',
      'Las clases que terminaron sin asistencia aparecen en **Tareas**. Si no se hicieron, márcalas con **No se hizo**.',
    ],
    more: { text: 'tomar asistencia', menu: 'Escuelas', to: '/app/escuelas#asistencia' },
  },
  {
    id: 'qr',
    title: 'Check-in con QR',
    summary: 'Un QR en la sala para que tus alumnos marquen su asistencia.',
    audience: 'equipo',
    roles: SETUP,
    steps: [
      'En **Ajustes → Check-in con QR**, toca **Imprimir** y pega el QR en la sala.',
      'El alumno lo escanea con su celular y queda marcada su clase de hoy, desde una hora antes del inicio hasta que termina.',
      'Si está en la escuela (a menos de 150 m), queda confirmada. Si no, queda por aprobar.',
      'Si el QR se filtra, usa **Generar QR nuevo**: el anterior deja de funcionar y tienes que imprimir el nuevo.',
    ],
    more: { text: 'ver tu QR', menu: 'Ajustes', to: '/app/ajustes#qr' },
  },
  {
    id: 'pagos',
    title: 'Pagos',
    summary: 'Cómo te pagan tus alumnos y cómo registras lo que recibes.',
    audience: 'equipo',
    roles: SETUP,
    steps: [
      'En **Ajustes → Pasarela de pago**, deja tus datos de transferencia: tus alumnos los ven al pagar.',
      'El alumno paga por transferencia o en efectivo y avisa con **Ya pagué**. Lo apruebas en **Tareas → Aprobaciones**.',
      'Si te pagan directo, en **Contabilidad → Pagos** toca **Registrar pago**.',
      'Un pago que reportó el alumno y aprobaste se ve con ✓✓; uno que marcaste tú, con ✓.',
    ],
    more: { text: 'ver los pagos', menu: 'Contabilidad', to: '/app/contabilidad#pagos' },
  },
  {
    id: 'planes',
    title: 'Planes e inscripciones',
    summary: 'Lo que ofreces y quién está inscrito en qué.',
    audience: 'equipo',
    roles: SETUP,
    steps: [
      'En **Contabilidad → Planes**, toca **Nuevo plan**: nombre, precio, ciclo de cobro y, si quieres, el arte marcial.',
      'Tus alumnos ven los planes en **Pagos y planes** y los contratan ahí. El plan se activa cuando confirmas el pago.',
      'Para inscribir tú a un alumno, en **Contabilidad → Inscripciones** toca **Matricular alumno**.',
      'En **Contabilidad → Códigos de descuento** creas códigos para un pago o para todo el plan.',
    ],
    more: { text: 'ver tus planes', menu: 'Contabilidad', to: '/app/contabilidad#planes' },
  },
  {
    id: 'landing',
    title: 'Tu página y clases de prueba',
    summary: 'Una página pública para que te encuentren y agenden una clase gratis.',
    audience: 'equipo',
    roles: SETUP,
    steps: [
      'En **Ajustes → Landing page**, elige colores y fotos y revisa cómo se ve.',
      'En **Ajustes → Agendamiento**, elige qué clases se pueden agendar como prueba gratis y con cuánta anticipación.',
      'Las reservas aparecen en **Escuelas → Asistencia**, en la tarjeta de esa clase y ese día.',
      'Desde la página, los alumnos también pueden crear su cuenta, que luego apruebas en **Tareas**.',
    ],
    more: { text: 'editar tu página', menu: 'Ajustes', to: '/app/ajustes#landing' },
  },
  {
    id: 'escuela',
    title: 'Ajustes de la escuela',
    summary: 'Datos, artes marciales, cinturones, skills y exportar.',
    audience: 'equipo',
    roles: SETUP,
    steps: [
      'En **Ajustes → Datos de la escuela**: logo, dirección, contacto y matrícula.',
      'En **Ajustes → Artes marciales**: las artes que enseñas y sus cinturones, de adultos y kids.',
      'En **Ajustes → Catálogos**: las skills que suben tus alumnos al asistir y las insignias que puedes otorgar.',
      'En **Ajustes → Exportar datos** descargas tus datos en CSV para Excel o Sheets.',
    ],
    more: { text: 'ver los datos de tu escuela', menu: 'Ajustes', to: '/app/ajustes#escuela' },
  },
  {
    id: 'suscripcion',
    title: 'Tu suscripción',
    summary: 'Cómo sigues usando Martial CRM después de la prueba.',
    audience: 'equipo',
    roles: ['ceo'],
    steps: [
      'La prueba dura 14 días, con todas las funciones y sin tarjeta.',
      'En **Ajustes → Mi suscripción** ves tu plan y los datos para pagar por transferencia.',
      'Después de transferir, avisa desde ahí mismo y lo confirmamos.',
    ],
    more: { text: 'ver tu suscripción', menu: 'Ajustes', to: '/app/ajustes#suscripcion' },
  },
  // Students (and guardians)
  {
    id: 'alumno-asistencia',
    title: 'Marcar asistencia',
    summary: 'Marca tus clases y suma XP.',
    audience: 'alumno',
    steps: [
      'En **Inicio**, toca **Marcar** en la clase de hoy. También puedes escanear el QR de la sala.',
      'Tu asistencia queda **Por aprobar** hasta que tu escuela la confirma.',
      'Cada clase confirmada suma XP a tu nivel y a las skills de esa clase.',
      'Tu historial completo está en **Asistencia**.',
    ],
    more: { text: 'ver tu asistencia', menu: 'Asistencia', to: '/app/asistencia' },
  },
  {
    id: 'alumno-pagos',
    title: 'Pagar y contratar planes',
    summary: 'Elige tu plan y avísale a tu escuela cuando pagues.',
    audience: 'alumno',
    steps: [
      'En **Pagos y planes**, elige un plan y contrátalo.',
      'Paga por transferencia (los datos aparecen al pagar) o en efectivo en la escuela.',
      'Después toca **Ya pagué**. Cuando tu escuela lo confirma, queda pagado (✓✓) y tu plan se activa.',
    ],
    more: { text: 'ver tus pagos', menu: 'Pagos y planes', to: '/app/pagos' },
  },
  {
    id: 'alumno-perfil',
    title: 'Tu perfil',
    summary: 'Tu foto, tu ficha y tu página pública.',
    audience: 'alumno',
    steps: [
      'En **Ajustes → Perfil**, cambia tu foto y tu nombre.',
      'En **Ajustes → Mi ficha de alumno**, mantén al día tu contacto, tu contacto de emergencia y tu salud.',
      'En **Ajustes → Mi perfil público**, decides si se publica tu página con tu cinturón, tu nivel y tus skills. Nunca muestra tu RUT ni tus datos de contacto.',
    ],
    more: { text: 'ver tu perfil público', menu: 'Ajustes', to: '/app/ajustes#perfil-publico' },
  },
  {
    id: 'alumno-hijos',
    title: 'Apoderados',
    summary: 'Sigue a tus hijos desde tu misma cuenta.',
    audience: 'alumno',
    steps: [
      'En **Ajustes → Mis hijos**, agrega a tu hijo. La escuela aprueba la solicitud.',
      'Arriba aparece **Viendo** para cambiar entre tú y cada hijo.',
      'Mientras ves a un hijo, puedes marcar su asistencia y pagar sus planes.',
      'Cuando tenga edad, genera un código para entregarle su propia cuenta.',
    ],
    more: { text: 'ver a tus hijos', menu: 'Ajustes', to: '/app/ajustes#hijos' },
  },
]

export const FAQS: Faq[] = [
  { audience: 'equipo', roles: ['ceo'], q: '¿Cuánto dura la prueba y qué pasa después?', a: 'La prueba dura 14 días, con todo incluido y sin tarjeta. Después eliges tu plan y pagas por transferencia desde Ajustes → Mi suscripción. Si no sigues, no se te cobra nada.' },
  { audience: 'equipo', q: '¿Cómo entran mis alumnos a su portal?', a: 'Hay dos caminos: se registran desde tu página pública y los apruebas en Tareas, o tú les creas el acceso desde su ficha, en «Cuenta y vínculos».' },
  { audience: 'equipo', q: '¿Qué diferencia hay entre Administrador y Usuario?', a: 'El Administrador gestiona todo en la escuela: equipo, planes, pagos y ajustes. El Usuario trabaja con alumnos, clases y asistencia.' },
  { audience: 'equipo', roles: ['ceo'], q: '¿Puedo tener más de una escuela?', a: 'Sí. En Escuelas toca «Nueva escuela». La escuela activa se cambia arriba a la izquierda, bajo su nombre.' },
  { audience: 'equipo', q: '¿Cómo me pagan mis alumnos?', a: 'Por transferencia o en efectivo. Ellos avisan con «Ya pagué» y tú lo apruebas en Tareas. Tus datos de transferencia se configuran en Ajustes → Pasarela de pago.' },
  { audience: 'equipo', q: '¿Por qué una asistencia queda «Por aprobar»?', a: 'Porque la marcó el alumno desde su portal, o con el QR estando lejos de la escuela. Al aprobarla suma XP a su nivel y a sus skills.' },
  { audience: 'equipo', q: '¿Puedo sacar mis datos?', a: 'Sí. En Ajustes → Exportar datos descargas alumnos, pagos y más en archivos CSV para Excel o Sheets.' },
  { audience: 'equipo', roles: ['ceo', 'admin'], q: '¿Cómo vuelvo a ver el recorrido guiado?', a: 'Aquí mismo, en Tutoriales → Primeros pasos → «Ver el recorrido guiado».' },
  { audience: 'alumno', q: '¿Por qué mi asistencia dice «Por aprobar»?', a: 'Tu escuela confirma cada asistencia que marcas. Cuando la confirma, suma XP a tu nivel y a tus skills.' },
  { audience: 'alumno', q: '¿Cómo pago mi plan?', a: 'En Pagos y planes: paga por transferencia o en efectivo y toca «Ya pagué». Cuando tu escuela lo confirma, queda pagado.' },
  { audience: 'alumno', q: '¿Qué ve la gente en mi perfil público?', a: 'Tu nombre (nombre y primer apellido), tu cinturón, tu nivel y tus skills, y solo si decides publicarlo. Nunca tu RUT, tu contacto ni tu dirección.' },
  { audience: 'todos', q: '¿Olvidé mi contraseña, qué hago?', a: 'En la pantalla de ingreso toca «¿Olvidaste tu contraseña?» y te llega un enlace para crear una nueva. Si ya entraste, la cambias en Ajustes → Contraseña.' },
  { audience: 'todos', q: '¿Cómo protejo mi cuenta?', a: 'Activa la verificación en dos pasos en Ajustes: además de tu contraseña, te pedirá un código de una app en tu celular.' },
]

const audienceOf = (role: AppRole) => (role === 'alumno' ? 'alumno' : 'equipo')
const allowed = (roles: AppRole[] | undefined, role: AppRole) => !roles || roles.includes(role)

/** The help one role sees. */
export function helpFor(role: AppRole | null): { tutorials: Tutorial[]; faqs: Faq[] } {
  if (!role) return { tutorials: [], faqs: [] }
  const a = audienceOf(role)
  return {
    tutorials: TUTORIALS.filter((t) => t.audience === a && allowed(t.roles, role)),
    faqs: FAQS.filter((f) => (f.audience === a || f.audience === 'todos') && allowed(f.roles, role)),
  }
}

/** "Toca **Nueva clase**" → plain and bold parts. */
export function richParts(s: string): { text: string; strong: boolean }[] {
  return s.split('**').map((text, i) => ({ text, strong: i % 2 === 1 })).filter((p) => p.text)
}
