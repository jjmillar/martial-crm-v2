// The platform operator signs in with a username (no email). Auth needs an email, so a username maps to an address
// on a reserved domain that can never receive mail (RFC 2606 ".invalid").
export const PLATFORM_DOMAIN = 'plataforma.martialcrm.invalid'
export const loginEmail = (id: string) => (id.includes('@') ? id.trim() : `${id.trim().toLowerCase()}@${PLATFORM_DOMAIN}`)
