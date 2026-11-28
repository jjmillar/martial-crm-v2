import { useState } from 'react'
import { Link } from '../../lib/nav'
import { useAuth } from '../../lib/auth'
import { useSchool } from '../../lib/school'
import { Icon } from '../../ui/Icon'
import { Modal } from '../../ui/Modal'
import { helpFor, richParts, type Tutorial } from './content'
import { startTour } from './tour'

const Rich = ({ text }: { text: string }) => <>{richParts(text).map((p, i) => (p.strong ? <b key={i}>{p.text}</b> : <span key={i}>{p.text}</span>))}</>

// Ajustes → Ayuda (odd/tasks/tutorial.md S4–S6): the tutorials (each opens as a normal pop-up, in place) and the FAQ
// with every answer visible. The first tutorial can replay the guided tour on the real pages.
export function Ayuda() {
  const { role } = useSchool()
  const { user } = useAuth()
  const { tutorials, faqs } = helpFor(role)
  // The tutorial stays mounted while its pop-up closes, so the content never vanishes mid-animation.
  const [shown, setShown] = useState<Tutorial | null>(null)
  const [open, setOpen] = useState(false)
  const canTour = role === 'ceo' || role === 'admin'

  const show = (t: Tutorial) => { setShown(t); setOpen(true) }
  const replay = () => {
    if (!user) return
    setOpen(false)
    startTour(user.id)
  }

  return (
    <div className="ayuda">
      <section aria-labelledby="tutoriales-h">
        <h3 className="ajustes__sub" id="tutoriales-h">Tutoriales</h3>
        <ul className="help-list">
          {tutorials.map((t) => (
            <li key={t.id}>
              <button type="button" className="help-row" onClick={() => show(t)}>
                <span className="help-row__main">
                  <strong>{t.title}</strong>
                  <span className="hint">{t.summary}</span>
                </span>
                <Icon name="arrow" size={16} />
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="faq-h">
        <h3 className="ajustes__sub" id="faq-h">Preguntas frecuentes</h3>
        <dl className="faq">
          {faqs.map((f) => (
            <div key={f.q} className="faq__item">
              <dt>{f.q}</dt>
              <dd>{f.a}</dd>
            </div>
          ))}
        </dl>
      </section>

      <Modal open={open} onClose={() => setOpen(false)} labelledBy="tutorial-h">
        {shown && (
          <>
            <div className="modal__head">
              <h2 className="modal__title" id="tutorial-h">{shown.title}</h2>
              <button type="button" className="icon-btn" onClick={() => setOpen(false)} aria-label="Cerrar"><Icon name="close" /></button>
            </div>
            <p className="hint tutorial__lead">{shown.summary}</p>
            <ol className="tutorial__steps">
              {shown.steps.map((s) => <li key={s}><Rich text={s} /></li>)}
            </ol>
            {shown.tour && canTour && (
              <button type="button" className="btn tutorial__tour" onClick={replay}>
                Ver el recorrido guiado <Icon name="arrow" size={16} />
              </button>
            )}
            {shown.more && (
              <p className="modal__more">
                <span className="hint">Para más información,</span>
                <Link className="link-btn" to={shown.more.to} onClick={() => setOpen(false)}>
                  {shown.more.text} en {shown.more.menu} <Icon name="arrow" size={14} />
                </Link>
              </p>
            )}
          </>
        )}
      </Modal>
    </div>
  )
}
