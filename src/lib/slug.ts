// Turns a school name into a slug accepted by the DB check ^[a-z0-9-]{3,48}$.
export function slugify(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
    .replace(/-+$/g, '')
}

export const isValidSlug = (slug: string) => /^[a-z0-9-]{3,48}$/.test(slug)
