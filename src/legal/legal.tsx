import type { ReactNode } from 'react'
import { Link } from '../lib/nav'

// Términos y condiciones + Política de privacidad of Martial CRM.
// Base: Ley 19.628 as amended by Ley 21.719 (Protección de Datos Personales, in force since 2026-12-01), Ley 19.496
// (consumer protection) and current global practice (GDPR-style roles, layered summary, plain language, versioning).
//
// Changing the text materially = new TERMS_VERSION here AND in public.current_terms_version() (new migration) AND in
// supabase/functions/account-signup (TERMS_VERSION). New accounts then accept the new version.
export const TERMS_VERSION = '2026-11-24'
export const TERMS_DATE = '24 de noviembre de 2026'

/**
 * Who provides the service. Fill in before going public with paying customers (Ley 21.719 requires the controller's
 * identity and a contact channel). Empty fields are shown as "se publicará aquí".
 */
export const PROVIDER = {
  name: 'Martial CRM',
  legalName: '',
  rut: '',
  address: '',
  email: '',
}

export type LegalKind = 'terminos' | 'privacidad'
export const LEGAL_TITLE: Record<LegalKind, string> = { terminos: 'Términos y condiciones', privacidad: 'Política de privacidad' }

const pending = <em>se publicará aquí</em>
function Contact() {
  return (
    <ul>
      <li>Responsable: {PROVIDER.legalName || PROVIDER.name}{PROVIDER.rut && `, RUT ${PROVIDER.rut}`}</li>
      <li>Domicilio: {PROVIDER.address || pending}</li>
      <li>Correo de contacto y de privacidad: {PROVIDER.email ? <a href={`mailto:${PROVIDER.email}`}>{PROVIDER.email}</a> : pending}</li>
    </ul>
  )
}

function Summary({ children }: { children: ReactNode }) {
  return (
    <aside className="legal__summary">
      <strong>En resumen</strong>
      <ul>{children}</ul>
    </aside>
  )
}

export function Terminos() {
  return (
    <>
      <Summary>
        <li>Martial CRM es un sistema para que academias de artes marciales administren alumnos, clases, asistencia y pagos.</li>
        <li>Cada escuela es dueña de los datos de sus alumnos y decide sobre ellos; nosotros los guardamos y procesamos por encargo suyo.</li>
        <li>No vendemos datos ni mostramos publicidad. Lo público (landing y perfil público del alumno) solo muestra lo que se elige mostrar.</li>
        <li>Los pagos entre alumnos y escuelas son entre ellos: Martial CRM no recibe ese dinero.</li>
        <li>Puedes cerrar tu cuenta cuando quieras y pedir una copia de tus datos.</li>
      </Summary>

      <h2>1. Quiénes somos y aceptación</h2>
      <p>Estos términos regulan el uso de Martial CRM (la «Plataforma»). Al crear una cuenta declaras que los leíste y los aceptas, junto con la <Link to="/privacidad">Política de privacidad</Link>. Si no estás de acuerdo, no crees la cuenta.</p>
      <Contact />

      <h2>2. Quién es quién</h2>
      <ul>
        <li><strong>CEO o dueño:</strong> la persona o empresa que contrata Martial CRM y crea una o más escuelas.</li>
        <li><strong>Escuela:</strong> cada academia creada por un CEO. Es la <strong>responsable</strong> de los datos de sus alumnos, equipo y apoderados.</li>
        <li><strong>Equipo:</strong> administradores y profesores invitados por la escuela.</li>
        <li><strong>Alumno:</strong> quien se registra desde la página de su escuela o es inscrito por ella.</li>
        <li><strong>Apoderado:</strong> padre, madre o representante legal que gestiona la cuenta de un alumno menor de edad.</li>
        <li><strong>Martial CRM:</strong> entrega la Plataforma. Es responsable de los datos de las cuentas de CEO y <strong>encargado</strong> (procesa por cuenta de la escuela) de los datos de cada escuela.</li>
      </ul>

      <h2>3. Tu cuenta</h2>
      <ul>
        <li>Los datos que entregas deben ser verdaderos y estar actualizados. Una cuenta es personal: no la compartas.</li>
        <li>Cuida tu contraseña (mínimo 8 caracteres) y activa la verificación en dos pasos; es especialmente recomendada para el CEO y los administradores.</li>
        <li>Si sospechas que alguien entró a tu cuenta, cambia tu contraseña y avísanos de inmediato.</li>
        <li>Los menores de 14 años solo pueden tener cuenta con el consentimiento de su padre, madre o representante legal, que se registra al crearla. Entre 14 y 17 años recomendamos que la cuenta la gestione o la conozca su apoderado.</li>
      </ul>

      <h2>4. Obligaciones de la escuela</h2>
      <p>Como responsable de los datos de sus alumnos, cada escuela se compromete a:</p>
      <ul>
        <li>Pedir solo los datos necesarios para inscribir, enseñar y cobrar, e informar a sus alumnos para qué los usa.</li>
        <li>Contar con una base legal para tratarlos (por ejemplo, el contrato de clases o el consentimiento) y, para menores de 14 años, el consentimiento de sus padres o representantes.</li>
        <li>Dar acceso solo a las personas de su equipo que lo necesitan, con el rol que corresponde.</li>
        <li>Responder las solicitudes de sus alumnos sobre sus datos (acceso, rectificación, supresión, etc.). Martial CRM la ayuda con las herramientas de la Plataforma.</li>
        <li>No subir datos sensibles (salud, por ejemplo) salvo que sean imprescindibles y cuente con el consentimiento expreso del titular.</li>
      </ul>

      <h2>5. Uso aceptable</h2>
      <p>No está permitido:</p>
      <ul>
        <li>Usar la Plataforma para fines ilegales, para enviar spam o para acosar o discriminar a otras personas.</li>
        <li>Intentar acceder a datos de otras escuelas o cuentas, saltarse los controles de seguridad, o probar vulnerabilidades sin autorización escrita.</li>
        <li>Sobrecargar el servicio, automatizar registros o extraer datos de forma masiva.</li>
        <li>Subir contenido que infrinja derechos de terceros (imágenes, marcas, logos) o que contenga software malicioso.</li>
      </ul>
      <p>Podemos suspender una cuenta que incumpla estas reglas, avisando la causa salvo que la ley o la seguridad lo impidan.</p>

      <h2>6. Contenido y propiedad intelectual</h2>
      <p>Lo que subes (logos, fotos, textos, comprobantes) sigue siendo tuyo o de tu escuela. Nos das solo el permiso necesario para guardarlo y mostrarlo dentro del servicio, por ejemplo en la landing de tu escuela. El software, el diseño y la marca Martial CRM son nuestros; no puedes copiarlos ni revenderlos.</p>

      <h2>7. Planes, precios y pagos</h2>
      <ul>
        <li>El CEO contrata un plan de Martial CRM. El precio, lo que incluye y su periodicidad se informan antes de contratar. Cambios de precio se avisan con al menos 30 días de anticipación.</li>
        <li>Si la suscripción se suspende o termina, las escuelas quedan cerradas, pero los datos se conservan para que puedas reactivarlas o exportarlos, según la Política de privacidad.</li>
        <li>Las mensualidades, matrículas y otros cobros de la escuela a sus alumnos son una relación entre ellos. Martial CRM no recibe ni retiene ese dinero, y la escuela es responsable de sus precios, descuentos, boletas y devoluciones.</li>
        <li>Cuando corresponda, se aplican los derechos de la Ley 19.496 sobre protección de los derechos de los consumidores.</li>
      </ul>

      <h2>8. Disponibilidad y cambios del servicio</h2>
      <p>Trabajamos para que Martial CRM esté siempre disponible, pero puede haber interrupciones por mantención o por fallas de terceros. Podemos mejorar, cambiar o retirar funciones; si un cambio quita algo importante de tu plan, te avisaremos antes.</p>

      <h2>9. Responsabilidad</h2>
      <ul>
        <li>Martial CRM es una herramienta de gestión. Las clases, la práctica de artes marciales, la seguridad en el dojo y las graduaciones son responsabilidad de cada escuela.</li>
        <li>Respondemos por los daños que causemos por culpa o dolo, incluido el incumplimiento de nuestras obligaciones de seguridad de datos. Fuera de eso, y en la medida que la ley lo permita, nuestra responsabilidad frente al CEO se limita a lo pagado por el servicio en los últimos 12 meses.</li>
        <li>Nada de esto limita los derechos irrenunciables que te otorgan las leyes chilenas.</li>
      </ul>

      <h2>10. Término de la cuenta</h2>
      <p>Puedes dejar de usar Martial CRM cuando quieras. El CEO puede pedir la exportación de los datos de sus escuelas antes de cerrar. El alumno que deja una escuela puede pedirle a ella o a nosotros la supresión de sus datos, salvo los que la escuela deba conservar por ley (por ejemplo, registros de pagos).</p>

      <h2>11. Cambios a estos términos</h2>
      <p>Si cambiamos estos términos de forma relevante, publicaremos la nueva versión con su fecha y te avisaremos dentro de la Plataforma o por correo antes de que rija. Para cambios importantes te pediremos aceptarlos de nuevo.</p>

      <h2>12. Ley aplicable</h2>
      <p>Estos términos se rigen por las leyes de la República de Chile. Cualquier controversia se someterá a los tribunales ordinarios de justicia de Chile, sin perjuicio de los derechos del consumidor a recurrir al tribunal de su domicilio o al SERNAC.</p>
    </>
  )
}

export function Privacidad() {
  return (
    <>
      <Summary>
        <li>Pedimos los datos mínimos para que tu escuela te inscriba, registre tu asistencia y tus pagos.</li>
        <li>Cada escuela ve solo sus datos: la separación se aplica en la base de datos, no solo en la pantalla.</li>
        <li>Nunca publicamos tu RUT, dirección, fecha de nacimiento, correo ni teléfono.</li>
        <li>No vendemos ni compartimos tus datos para publicidad.</li>
        <li>Puedes pedir acceso, corrección, eliminación, portabilidad, oposición o bloqueo de tus datos, gratis.</li>
      </Summary>

      <p>Esta política explica cómo se tratan los datos personales en Martial CRM, conforme a la Ley N° 19.628 sobre Protección de la Vida Privada, modificada por la Ley N° 21.719, y a los principios de licitud y lealtad, finalidad, proporcionalidad, calidad, responsabilidad, seguridad, transparencia y confidencialidad.</p>

      <h2>1. Quién es responsable</h2>
      <ul>
        <li><strong>Datos de tu escuela</strong> (alumnos, apoderados, equipo, clases, asistencia, pagos): el responsable es la <strong>escuela</strong>. Martial CRM actúa como <strong>encargado</strong>: los trata solo para prestarle el servicio y según sus instrucciones.</li>
        <li><strong>Datos de las cuentas de CEO y de uso de la Plataforma:</strong> el responsable es Martial CRM.</li>
      </ul>
      <Contact />

      <h2>2. Qué datos tratamos</h2>
      <ul>
        <li><strong>Cuenta:</strong> nombre, apellidos, correo, teléfono (opcional) y contraseña (guardada cifrada; nadie puede leerla).</li>
        <li><strong>Alumnos:</strong> además, RUT, fecha de nacimiento y dirección, que la escuela usa para identificarte, saber tu edad y categoría, y emitir sus documentos.</li>
        <li><strong>Actividad en la escuela:</strong> clases, asistencia, artes marciales, cinturones y grados, logros, nivel y experiencia.</li>
        <li><strong>Pagos:</strong> planes, montos, estado y comprobantes de transferencia que subes. No guardamos datos de tarjetas.</li>
        <li><strong>Apoderados:</strong> el vínculo entre el apoderado y el alumno a su cargo.</li>
        <li><strong>Clases de prueba:</strong> nombre y datos de contacto que entregas al reservar.</li>
        <li><strong>Seguridad:</strong> registros técnicos de acceso y un registro de actividad de acciones sensibles (cambios de roles, datos bancarios y pagos).</li>
        <li><strong>Aceptación de estos documentos:</strong> versión aceptada y fecha.</li>
      </ul>
      <p>No pedimos datos sensibles. Si una escuela necesita registrar algo de salud (por ejemplo, una lesión), debe tener tu consentimiento expreso.</p>

      <h2>3. Para qué y con qué base legal</h2>
      <ul>
        <li><strong>Prestar el servicio y administrar tu inscripción</strong> (clases, asistencia, pagos, graduaciones): ejecución del contrato con la escuela o con Martial CRM.</li>
        <li><strong>Seguridad, prevención de fraude y registro de actividad:</strong> interés legítimo y nuestra obligación legal de proteger los datos.</li>
        <li><strong>Correos del servicio</strong> (invitaciones, recuperación de contraseña, avisos de la escuela): ejecución del contrato.</li>
        <li><strong>Perfil público del alumno:</strong> tu consentimiento. Está apagado por defecto y lo puedes apagar cuando quieras.</li>
        <li><strong>Cumplir la ley</strong> (por ejemplo, registros tributarios de la escuela o requerimientos de autoridad): obligación legal.</li>
      </ul>
      <p>No usamos tus datos para publicidad, no los vendemos y no tomamos decisiones automatizadas que te afecten de forma significativa.</p>

      <h2>4. Quién puede verlos</h2>
      <ul>
        <li>Dentro de tu escuela, solo las personas con el rol que corresponde. Otras escuelas no ven nada de la tuya.</li>
        <li>En internet, solo lo que la escuela publica en su landing y lo que tú eliges mostrar en tu perfil público (nombre, cinturón, nivel, logros). Nunca RUT, dirección, fecha de nacimiento, correo ni teléfono.</li>
        <li>Proveedores que nos ayudan a operar, con contrato y solo para eso: Supabase (base de datos, autenticación y archivos, alojados en São Paulo, Brasil), Netlify (alojamiento del sitio, Estados Unidos), Resend (envío de correos, Estados Unidos) y Google Fonts (tipografía, que recibe la dirección IP de tu navegador).</li>
        <li>Autoridades, solo cuando la ley lo exige.</li>
      </ul>

      <h2>5. Transferencias internacionales</h2>
      <p>Como algunos proveedores están fuera de Chile, tus datos pueden almacenarse o pasar por Brasil y Estados Unidos. Lo hacemos con proveedores que ofrecen garantías adecuadas (cláusulas contractuales de protección de datos y medidas de seguridad), según lo permite la Ley 21.719.</p>

      <h2>6. Cuánto tiempo los guardamos</h2>
      <ul>
        <li>Mientras tu cuenta o tu inscripción en la escuela estén activas.</li>
        <li>Si la suscripción de una escuela se suspende o termina, sus datos se conservan cerrados para que pueda reactivarse o exportarlos. Si el CEO pide el cierre definitivo, se eliminan en un máximo de 30 días.</li>
        <li>Si pides la supresión, eliminamos o anonimizamos tus datos en un máximo de 30 días, salvo lo que la escuela o nosotros debamos conservar por ley (por ejemplo, registros de pagos con fines tributarios, hasta 6 años).</li>
        <li>Las copias de respaldo se sobrescriben en ciclos cortos; lo eliminado desaparece también de ellas al completarse el ciclo.</li>
      </ul>

      <h2>7. Cómo los protegemos</h2>
      <ul>
        <li>Conexión cifrada (HTTPS) en todo el sitio y contraseñas guardadas con cifrado irreversible.</li>
        <li>Separación por escuela y por rol aplicada en la base de datos.</li>
        <li>Verificación en dos pasos disponible para todas las cuentas.</li>
        <li>Registro de las acciones sensibles, que nadie puede editar ni borrar desde la Plataforma.</li>
        <li>Límites de intentos en el registro y en los formularios públicos.</li>
      </ul>
      <p>Si ocurre una vulneración de seguridad que pueda afectar tus datos, la informaremos a la Agencia de Protección de Datos Personales y a la escuela, y a ti cuando corresponda, sin dilación indebida.</p>

      <h2>8. Niños, niñas y adolescentes</h2>
      <p>Los datos de menores de 14 años solo se tratan con el consentimiento de su padre, madre o representante legal, que queda registrado al crear la cuenta. Siempre se busca el interés superior del niño: el perfil público está apagado por defecto y el apoderado puede ver y gestionar la cuenta de su hijo o hija desde la suya.</p>

      <h2>9. Tus derechos</h2>
      <p>Puedes ejercer gratuitamente tus derechos de:</p>
      <ul>
        <li><strong>Acceso:</strong> saber qué datos tuyos se tratan y para qué.</li>
        <li><strong>Rectificación:</strong> corregir datos inexactos o incompletos (muchos los puedes cambiar tú mismo en Ajustes).</li>
        <li><strong>Supresión:</strong> pedir que se eliminen.</li>
        <li><strong>Oposición:</strong> oponerte a un tratamiento en particular.</li>
        <li><strong>Portabilidad:</strong> recibir tus datos en un formato estructurado y de uso común.</li>
        <li><strong>Bloqueo:</strong> pedir que se suspenda temporalmente el tratamiento mientras se resuelve una solicitud.</li>
      </ul>
      <p>Si eres alumno, escríbele a tu escuela (es la responsable) o a nosotros y la ayudaremos a responder. Si eres CEO, escríbenos. Responderemos en un plazo máximo de 30 días corridos, prorrogable una vez por igual plazo si es necesario, avisándote. Si no quedas conforme, puedes reclamar ante la Agencia de Protección de Datos Personales.</p>
      <p>Si diste tu consentimiento para algo (por ejemplo, el perfil público), puedes retirarlo en cualquier momento, sin que eso afecte lo hecho antes.</p>

      <h2>10. Cookies y almacenamiento local</h2>
      <p>Usamos solo lo necesario para que la Plataforma funcione: la sesión iniciada y preferencias como el tema claro u oscuro o la escuela activa, guardadas en tu navegador. No usamos cookies de publicidad ni de seguimiento de terceros.</p>

      <h2>11. Cambios a esta política</h2>
      <p>Si la cambiamos de forma relevante, publicaremos la nueva versión con su fecha y te avisaremos antes de que rija.</p>
    </>
  )
}
