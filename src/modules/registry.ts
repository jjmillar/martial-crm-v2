import type { AppRole, ModuleManifest } from './types'
import { inicio } from './inicio'
import { miembros } from './miembros'
import { escuelas } from './escuelas'
import { ajustes } from './ajustes'
import { alumnos } from './alumnos'
import { profesores } from './profesores'
import { planes } from './planes'
import { matriculas } from './matriculas'
import { clases } from './clases'
import { calendario } from './calendario'
import { asistencia } from './asistencia'
import { pagos } from './pagos'
import { cuenta } from './cuenta'
import { pendientes, tareas } from './tareas'
import { pagar } from './pagar'

// One line per module. Order here is the order in the navigation.
export const modules: ModuleManifest[] = [inicio, miembros, escuelas, asistencia, pagos, matriculas, calendario, planes, tareas, clases, alumnos, profesores, ajustes, cuenta, pendientes, pagar]

export const modulesFor = (role: AppRole | null) => (role ? modules.filter((m) => !m.hidden && m.roles.includes(role) && (!m.navFor || m.navFor.includes(role))) : [])
