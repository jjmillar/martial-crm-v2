import { useEffect, useRef, useState, type ReactNode, type SyntheticEvent } from 'react'
import { createPortal } from 'react-dom'
import { closeDialog } from './motion'

type Props = {
  open: boolean
  onClose: () => void
  children: ReactNode
  label?: string
  labelledBy?: string
  wide?: boolean
  /** Inside another <form>: render outside it and keep its events from reaching that form. */
  isolate?: boolean
}

/**
 * The app's only pop-up. Enter and exit follow the motion standard, and the content stays in place while the
 * pop-up leaves (it mounts when opening and unmounts once the dialog has really closed), so text never jumps or vanishes
 * mid-animation. Close it by setting `open` to false; Esc, the backdrop and the close buttons all go through onClose.
 */
export function Modal({ open, onClose, children, label, labelledBy, wide, isolate }: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  const [mounted, setMounted] = useState(open)
  if (open && !mounted) setMounted(true)

  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open) {
      if (!d.open) d.showModal()
      return
    }
    closeDialog(d)
  }, [open])

  const stop = (e: SyntheticEvent) => e.stopPropagation()
  const dialog = (
    <dialog
      ref={ref}
      className={`modal${wide ? ' modal--wide' : ''}`}
      aria-label={label}
      aria-labelledby={labelledBy}
      onCancel={(e) => { e.preventDefault(); onClose() }}
      // Closed by the browser while open (rare) → tell the owner; closed after our exit → drop the content now.
      onClose={() => { if (open) onClose(); else setMounted(false) }}
      onClick={(e) => { if (isolate) e.stopPropagation(); if (e.target === e.currentTarget) onClose() }}
      {...(isolate ? { onSubmit: stop, onChange: stop, onInput: stop, onKeyDown: stop } : {})}
    >
      <div className="modal__body">{mounted && children}</div>
    </dialog>
  )
  return isolate && typeof document !== 'undefined' ? createPortal(dialog, document.body) : dialog
}
