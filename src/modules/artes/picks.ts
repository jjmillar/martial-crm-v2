import { addFromTemplate, createArt, updateArt, type Art, type ArtTemplate } from './api'

/**
 * The martial arts a school teaches, required in "Datos de la escuela" and when creating a school. Each pick is a
 * school art: from the catalog (copied with its adult and kids belts) or the school's own (generic belts). Belts and
 * degrees then come from these arts and are edited in Ajustes → Artes marciales. Unpicking an art deactivates it
 * (its belts and the students' ranks stay, so picking it again brings everything back).
 */
export type ArtPick = { id: string; name: string; on: boolean; artId?: string; templateKey?: string | null }

/** Picks for the current arts of a school plus the catalog arts it doesn't have yet. */
export function initialPicks(arts: Art[], templates: ArtTemplate[]): ArtPick[] {
  const taken = new Set(arts.map((a) => a.template_key).filter(Boolean))
  return [
    ...arts.map((a) => ({ id: `art:${a.id}`, name: a.name, on: a.active, artId: a.id, templateKey: a.template_key })),
    ...templates.filter((t) => !taken.has(t.key)).map((t) => ({ id: `tpl:${t.key}`, name: t.name, on: false, templateKey: t.key })),
  ]
}

export const picksOk = (picks: ArtPick[]) => picks.some((p) => p.on)
export const ARTS_REQUIRED = 'Elige al menos una arte marcial que imparta la escuela.'

/** Saves the picks: adds the new ones (catalog or own) and turns existing arts on or off. */
export async function applyPicks(schoolId: string, picks: ArtPick[], arts: Art[]) {
  if (!picksOk(picks)) throw new Error(ARTS_REQUIRED)
  let position = arts.length
  // Turn on and add first, so the school never ends up with no active art if something fails halfway.
  for (const p of picks.filter((x) => x.on)) {
    if (p.artId) {
      const art = arts.find((a) => a.id === p.artId)
      if (art && !art.active) await updateArt(p.artId, { active: true })
    } else if (p.templateKey) await addFromTemplate(schoolId, p.templateKey)
    else await createArt(schoolId, p.name, position++)
  }
  for (const p of picks.filter((x) => !x.on && x.artId)) {
    const art = arts.find((a) => a.id === p.artId)
    if (art?.active) await updateArt(p.artId!, { active: false })
  }
}
