export const FLASH_EVENT = 'app:flash'

/** Show the confirmation toast without navigating, e.g. after saving inside a pop-up that then closes. */
export const flash = (text: string) => window.dispatchEvent(new CustomEvent(FLASH_EVENT, { detail: text }))
