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

// One line per module. Order here is the order in the navigation.
export const modules: ModuleManifest[] = [inicio, alumnos, asistencia, pagos, matriculas, calendario, clases, profesores, planes, miembros, tareas, escuelas, ajustes, cuenta, pendientes]

export const modulesFor = (role: AppRole | null) => (role ? modules.filter((m) => !m.hidden && m.roles.includes(role)) : [])
