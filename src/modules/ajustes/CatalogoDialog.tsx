import { useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Icon } from '../../ui/Icon'
import { Modal } from '../../ui/Modal'
import { Catalogo, type CatalogProps } from './Catalogo'
import { catalogQuery } from './catalogApi'

/**
 * Edit a catalog (tags, specialties) in a pop-up from inside another form: the page and whatever was typed stay.
 */
export function CatalogoDialog({ label, onChange, ...catalog }: Omit<CatalogProps, 'canEdit'> & { label: ReactNode; onChange: () => void }) {
  const [open, setOpen] = useState(false)
  // Loaded ahead, so the pop-up opens with its list already in place (nothing pops in while it animates).
  useQuery(catalogQuery(catalog.table, catalog.schoolId))

  return (
    <>
      <button type="button" className="link-btn" onClick={() => setOpen(true)}>{label}</button>
      <Modal open={open} onClose={() => setOpen(false)} label={catalog.title} isolate>
        <div className="modal__head">
          <span className="eyebrow">Editar sin salir</span>
          <button type="button" className="icon-btn" onClick={() => setOpen(false)} aria-label="Cerrar"><Icon name="close" /></button>
        </div>
        <Catalogo {...catalog} canEdit onChange={onChange} />
        <button type="button" className="btn" onClick={() => setOpen(false)}>Listo</button>
      </Modal>
    </>
  )
}
