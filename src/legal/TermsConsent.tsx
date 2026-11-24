import { useState } from 'react'
import { Icon } from '../ui/Icon'
import { Modal } from '../ui/Modal'
import { MoreLink } from '../ui/MoreLink'
import { Toggle } from '../ui/Toggle'
import { LEGAL_TITLE, type LegalKind } from './legal'
import { LegalBody } from './LegalPage'

type Props = {
  accepted: boolean
  onAccepted: (v: boolean) => void
  /** Under 14: a parent or legal guardian must give the consent (Ley 21.719). */
  minor?: boolean
  guardian?: boolean
  onGuardian?: (v: boolean) => void
}

// Sign-up consent: one toggle (no checkboxes, docs/ui-standards.md §2); the documents open in a pop-up right there so
// nothing typed in the form is lost.
export function TermsConsent({ accepted, onAccepted, minor, guardian, onGuardian }: Props) {
  const [open, setOpen] = useState<LegalKind | null>(null)
  const [shown, setShown] = useState<LegalKind>('terminos')
  const show = (k: LegalKind) => { setShown(k); setOpen(k) }
  const doc = (k: LegalKind) => (
    <button type="button" className="link-btn legal-link" onClick={(e) => { e.preventDefault(); show(k) }}>{LEGAL_TITLE[k]}</button>
  )
  return (
    <div className="terms-consent">
      <Toggle
        id="r-terms"
        checked={accepted}
        onChange={onAccepted}
        label="Acepto los términos y la política de privacidad"
        hint={<>Lee los {doc('terminos')} y la {doc('privacidad')}.</>}
      />
      {minor && onGuardian && (
        <Toggle
          id="r-guardian"
          checked={!!guardian}
          onChange={onGuardian}
          label="Soy su padre, madre o representante legal y doy mi consentimiento"
          hint="Para menores de 14 años la ley exige el consentimiento de un adulto responsable."
        />
      )}
      <Modal open={open !== null} onClose={() => setOpen(null)} isolate wide label={LEGAL_TITLE[shown]}>
        <div className="modal__head">
          <h2>{LEGAL_TITLE[shown]}</h2>
          <button type="button" className="icon-btn" onClick={() => setOpen(null)} aria-label="Cerrar"><Icon name="close" /></button>
        </div>
        <LegalBody kind={shown} />
        <div className="form-actions">
          <button type="button" className="btn" onClick={() => { onAccepted(true); setOpen(null) }}>Aceptar y volver</button>
          <button type="button" className="btn btn--ghost" onClick={() => setOpen(null)}>Volver</button>
        </div>
        <MoreLink text="ver el documento completo" menu="su página" to={`/${shown}`} />
      </Modal>
    </div>
  )
}
