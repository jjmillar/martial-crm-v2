import { Link } from '../lib/nav'
import { Icon } from './Icon'

export type More = { /** What the other menu offers, e.g. "ver todas las clases del día" */ text: string; /** Menu name */ menu: string; to: string }

/**
 * Bottom of a pop-up opened from another menu (docs/ui-standards.md §6): everything is edited in the pop-up; going to
 * the other menu is optional and always said explicitly.
 */
export function MoreLink({ text, menu, to }: More) {
  return (
    <p className="modal__more">
      <span className="hint">Para más información,</span>
      <Link className="link-btn" to={to}>{text} en {menu} <Icon name="arrow" size={14} /></Link>
    </p>
  )
}
