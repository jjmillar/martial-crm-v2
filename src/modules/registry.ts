import type { AppRole, ModuleManifest } from './types'
import { inicio } from './inicio'
import { miembros } from './miembros'
import { escuelas } from './escuelas'
import { ajustes } from './ajustes'

// One line per module. Order here is the order in the navigation.
export const modules: ModuleManifest[] = [inicio, miembros, escuelas, ajustes]

export const modulesFor = (role: AppRole | null) => (role ? modules.filter((m) => m.roles.includes(role)) : [])
