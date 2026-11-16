import { useRef, useState, type ReactNode, type SyntheticEvent } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from '../../ui/Icon'
import { Catalogo, type CatalogProps } from './Catalogo'

/**
 * Edit a catalog (tags, specialties) in a popup, from inside another form: the page and whatever was typed stay.
 * The dialog is portaled out of the host <form> (no nested forms) and its events stop here, so typing or pressing
 * Enter inside it never marks the host form as changed or submits it.
 */
export function CatalogoDialog({ label, onChange, ...catalog }: Omit<CatalogProps, 'canEdit'> & { label: ReactNode; onChange: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  const [open, setOpen] = useState(false)
  const stop = (e: SyntheticEvent) => e.stopPropagation()

  return (
    <>
      <button type="button" className="link-btn" onClick={() => { setOpen(true); ref.current?.showModal() }}>{label}</button>
      {typeof document !== 'undefined' && createPortal(
        <dialog
          ref={ref}
          className="modal"
          aria-label={catalog.title}
          onClose={() => setOpen(false)}
          onClick={(e) => { e.stopPropagation(); if (e.target === e.currentTarget) ref.current?.close() }}
          onSubmit={stop}
          onChange={stop}
          onInput={stop}
          onKeyDown={stop}
        >
          <div className="modal__body">
            <div className="modal__head">
              <span className="eyebrow">Editar sin salir</span>
              <button type="button" className="icon-btn" onClick={() => ref.current?.close()} aria-label="Cerrar"><Icon name="close" /></button>
            </div>
            {/* Mounted only while open: it starts fresh each time and does not load data until needed. */}
            {open && <Catalogo {...catalog} canEdit onChange={onChange} />}
            <button type="button" className="btn" onClick={() => ref.current?.close()}>Listo</button>
          </div>
        </dialog>,
        document.body,
      )}
    </>
  )
}
