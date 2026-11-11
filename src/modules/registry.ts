import type { AppRole, ModuleManifest } from './types'
import { inicio } from './inicio'
import { escuelas } from './escuelas'

// One line per module. Order here is the order in the navigation.
export const modules: ModuleManifest[] = [inicio, escuelas]

export const modulesFor = (role: AppRole | null) => (role ? modules.filter((m) => m.roles.includes(role)) : [])
