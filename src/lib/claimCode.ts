/** Formats what is typed as XXXX-XXXX-XXXX (letters/numbers only). */
export const formatClaimCode = (v: string) => v.toUpperCase().replace(/[^0-9A-Z]/g, '').slice(0, 12).replace(/(.{4})(?=.)/g, '$1-')
