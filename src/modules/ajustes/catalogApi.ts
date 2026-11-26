import { supabase } from '../../lib/supabase'

// Data for the per-school catalogs (skills = table "tags", school badges) edited by <Catalogo>. The disciplines are the
// school's martial arts (Ajustes → Artes marciales), not a catalog.
export type CatalogTable = 'tags' | 'school_badges'
export type Item = { id: string; text: string; icon: string | null; active: boolean }

export const textCol = { tags: 'label', school_badges: 'name' } as const

export const catalogQuery = (table: CatalogTable, schoolId: string) => ({ queryKey: ['catalog', table, schoolId], queryFn: () => listItems(table, schoolId) })

async function listItems(table: CatalogTable, schoolId: string): Promise<Item[]> {
  const { data, error } = await supabase.from(table).select('*').eq('school_id', schoolId).order(textCol[table])
  if (error) throw error
  return data.map((r) => ({
    id: r.id,
    text: 'label' in r ? r.label : r.name,
    icon: 'icon' in r ? r.icon : null,
    active: r.active,
  }))
}

