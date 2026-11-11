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

// One line per module. Order here is the order in the navigation; the first 4 also fill the mobile dock.
export const modules: ModuleManifest[] = [inicio, alumnos, asistencia, matriculas, calendario, clases, profesores, planes, miembros, escuelas, ajustes]

export const modulesFor = (role: AppRole | null) => (role ? modules.filter((m) => m.roles.includes(role)) : [])
