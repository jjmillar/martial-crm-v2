import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../lib/auth'
import { useSchool } from '../../lib/school'
import { roleLabel } from '../../lib/roles'
import type { SchoolRole } from '../../lib/database.types'
import { Icon } from '../../ui/Icon'
import { inviteMember, listCeos, listMembers, removeMember, updateRole } from './api'
import './miembros.css'

export function MiembrosPage() {
  const { activeSchool } = useSchool()
  const { user } = useAuth()
  const qc = useQueryClient()
  const schoolId = activeSchool?.id
  const key = ['members', schoolId]

  const members = useQuery({ queryKey: key, queryFn: () => listMembers(schoolId!), enabled: Boolean(schoolId) })
  const ceos = useQuery({ queryKey: ['platform-ceos'], queryFn: listCeos, staleTime: 10 * 60_000 })
  const ceoRows = (ceos.data ?? []).filter((c) => !(members.data ?? []).some((m) => m.user_id === c.user_id))

  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [role, setRole] = useState<SchoolRole>('user')
  const [formError, setFormError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [rowError, setRowError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState<string | null>(null)

  const invite = useMutation({
    mutationFn: inviteMember,
    onSuccess: ({ invited }, vars) => {
      setNotice(invited ? `Invitación enviada a ${vars.email}.` : `${vars.email} ya tenía cuenta: quedó agregado a la escuela.`)
      setEmail('')
      setFullName('')
      setRole('user')
      qc.invalidateQueries({ queryKey: key })
    },
    onError: (e: Error) => setFormError(e.message),
  })

  const changeRole = useMutation({
    mutationFn: ({ id, role }: { id: string; role: SchoolRole }) => updateRole(id, role),
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
    onError: (e: Error) => setRowError(e.message),
  })

  const remove = useMutation({
    mutationFn: removeMember,
    onSuccess: () => {
      setConfirming(null)
      qc.invalidateQueries({ queryKey: key })
    },
    onError: (e: Error) => {
      setConfirming(null)
      setRowError(e.message)
    },
  })

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    setFormError(null)
    setNotice(null)
    if (!schoolId) return
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setFormError('Escribe un correo válido.')
    invite.mutate({ school_id: schoolId, email: email.trim(), role, full_name: fullName.trim() || undefined })
  }

  if (!activeSchool) return <p className="page-note">Selecciona una escuela para ver sus miembros.</p>

  return (
    <div className="miembros">
      <header className="page-head">
        <span className="eyebrow">{activeSchool.name}</span>
        <h1>Miembros</h1>
        <p className="hint">Los administradores gestionan toda la escuela. Los usuarios trabajan el día a día.</p>
      </header>

      <div className="miembros__grid">
        <form className="card miembros__form" onSubmit={onSubmit} noValidate>
          <h2>Invitar</h2>
          <div className="field">
            <label htmlFor="inv-email">Correo</label>
            <input id="inv-email" className="input" type="email" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="inv-name">Nombre (opcional)</label>
            <input id="inv-name" className="input" autoComplete="off" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="inv-role">Rol</label>
            <select id="inv-role" className="input" value={role} onChange={(e) => setRole(e.target.value as SchoolRole)}>
              <option value="user">{roleLabel.user}</option>
              <option value="admin">{roleLabel.admin}</option>
            </select>
          </div>
          {formError && <p className="alert" role="alert">{formError}</p>}
          {notice && <p className="alert alert--ok" role="status">{notice}</p>}
          <button className="btn" type="submit" disabled={invite.isPending}>
            <Icon name="plus" size={16} /> {invite.isPending ? 'Enviando…' : 'Enviar invitación'}
          </button>
          <p className="hint">La persona recibe un correo para crear su contraseña.</p>
        </form>

        <section className="miembros__list" aria-label="Miembros de la escuela">
          {rowError && <p className="alert" role="alert">{rowError}</p>}
          {members.isLoading && <p className="hint">Cargando…</p>}
          {members.isError && <p className="alert">No se pudieron cargar los miembros.</p>}
          {ceoRows.map((c) => (
            <article key={c.user_id} className="card member-row">
              <div className="member-row__who">
                <strong>{c.full_name || c.email}{c.user_id === user?.id ? ' (tú)' : ''}</strong>
                {c.full_name && <span className="hint">{c.email}</span>}
              </div>
              <div className="member-row__actions">
                <span className="tag tag--accent" title="Acceso a todas las escuelas de la plataforma">{roleLabel.ceo}</span>
              </div>
            </article>
          ))}
          {members.data?.length === 0 && <p className="card hint">Esta escuela aún no tiene miembros. Invita a su administrador.</p>}
          {members.data?.map((m) => {
            const name = m.profile?.full_name || m.profile?.email || 'Invitación pendiente'
            return (
              <article key={m.id} className="card member-row">
                <div className="member-row__who">
                  <strong>{name}{m.user_id === user?.id ? ' (tú)' : ''}</strong>
                  {m.profile?.full_name && <span className="hint">{m.profile.email}</span>}
                </div>
                <div className="member-row__actions">
                  <select
                    className="input member-row__role"
                    aria-label={`Rol de ${name}`}
                    value={m.role}
                    disabled={changeRole.isPending}
                    onChange={(e) => {
                      setRowError(null)
                      changeRole.mutate({ id: m.id, role: e.target.value as SchoolRole })
                    }}
                  >
                    <option value="admin">{roleLabel.admin}</option>
                    <option value="user">{roleLabel.user}</option>
                  </select>
                  {confirming === m.id ? (
                    <>
                      <button type="button" className="btn btn--danger" disabled={remove.isPending} onClick={() => { setRowError(null); remove.mutate(m.id) }}>
                        Confirmar
                      </button>
                      <button type="button" className="btn btn--ghost" onClick={() => setConfirming(null)}>Cancelar</button>
                    </>
                  ) : (
                    <button type="button" className="btn btn--ghost" onClick={() => setConfirming(m.id)}>Quitar</button>
                  )}
                </div>
              </article>
            )
          })}
        </section>
      </div>
    </div>
  )
}
