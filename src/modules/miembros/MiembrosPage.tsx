import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../lib/auth'
import { useSchool } from '../../lib/school'
import { useLocation } from '../../lib/nav'
import { usePersisted } from '../../lib/persist'
import { roleLabel } from '../../lib/roles'
import type { SchoolRole } from '../../lib/database.types'
import { Icon } from '../../ui/Icon'
import { Acc } from '../../ui/Accordion'
import { Modal } from '../../ui/Modal'
import { ShowMore } from '../../ui/ShowMore'
import { useShowMore } from '../../ui/useShowMore'
import { openFromHash } from '../../ui/openFromHash'
import { AlumnosList } from '../alumnos/AlumnosList'
import { listStudents, studentsKey } from '../alumnos/api'
import { ProfesoresList } from '../profesores/ProfesoresList'
import { listTeachers, teachersKey } from '../profesores/api'
import { inviteMember, listCeos, listMembers, removeMember, updateRole, type Ceo, type Member } from './api'

// Everyone in the school, one accordion each (like Ajustes): Alumnos, Profesores and, for CEO/admin, Administrativos
// (the staff accounts). Each list has its own search and filters and shows 10 at a time.
export function MiembrosPage() {
  const { activeSchool, role } = useSchool()
  const location = useLocation()
  const schoolId = activeSchool?.id
  const manages = role === 'ceo' || role === 'admin'
  const students = useQuery({ queryKey: studentsKey(schoolId), queryFn: () => listStudents(schoolId!), enabled: Boolean(schoolId) })
  const teachers = useQuery({ queryKey: teachersKey(schoolId), queryFn: () => listTeachers(schoolId!), enabled: Boolean(schoolId) })
  const members = useQuery({ queryKey: ['members', schoolId], queryFn: () => listMembers(schoolId!), enabled: Boolean(schoolId) && manages })
  useEffect(() => {
    const t = setTimeout(() => openFromHash(location.hash), 50)
    return () => clearTimeout(t)
  }, [location.hash])

  if (!activeSchool) return <p className="page-note">Selecciona una escuela para ver sus miembros.</p>

  const count = (n: number | undefined, one: string, many: string) => (n === undefined ? 'Cargando…' : `${n} ${n === 1 ? one : many}`)
  const admins = members.data?.filter((m) => m.role === 'admin').length
  const users = members.data?.filter((m) => m.role === 'user').length

  return (
    <div className="miembros">
      <header className="page-head">
        <h1>Miembros</h1>
        <p className="hint">Toca una sección para abrirla.</p>
      </header>
      <div className="miembros__sections">
        <Acc id="alumnos" icon="user" title="Alumnos" hint={count(students.data?.filter((s) => s.active).length, 'alumno activo', 'alumnos activos')}>
          <AlumnosList />
        </Acc>
        <Acc id="profesores" icon="teacher" title="Profesores" hint={count(teachers.data?.filter((t) => t.active).length, 'profesor activo', 'profesores activos')}>
          <ProfesoresList />
        </Acc>
        {manages && (
          <Acc id="administrativos" icon="users" title="Administrativos"
            hint={members.data ? `${count(admins, 'administrador', 'administradores')} · ${count(users, 'usuario', 'usuarios')}` : 'Cargando…'}>
            <Administrativos schoolId={activeSchool.id} />
          </Acc>
        )}
      </div>
    </div>
  )
}

type RoleFilter = 'todos' | 'admin' | 'user'
type Row = { kind: 'ceo'; key: string; name: string; email: string | null; ceo: Ceo } | { kind: 'member'; key: string; name: string; email: string | null; m: Member }
const normalize = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

/** Staff accounts (admins and users) plus the owner: search, filter by role, invite in a pop-up, change role, remove. */
function Administrativos({ schoolId }: { schoolId: string }) {
  const { user } = useAuth()
  const qc = useQueryClient()
  const key = ['members', schoolId]

  const members = useQuery({ queryKey: key, queryFn: () => listMembers(schoolId) })
  const ceos = useQuery({ queryKey: ['school-owner', schoolId], queryFn: () => listCeos(schoolId), staleTime: 10 * 60_000 })

  const [q, setQ] = usePersisted('miembros.q', '', 'session')
  const [filter, setFilter] = usePersisted<RoleFilter>('miembros.filtro', 'todos')
  const { shown, more } = useShowMore('miembros.mostrar', 10)
  const [inviting, setInviting] = useState(false)
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [role, setRole] = useState<SchoolRole>('user')
  const [formError, setFormError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [rowError, setRowError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState<string | null>(null)

  const all = useMemo<Row[]>(() => {
    const list = members.data ?? []
    const owners = (ceos.data ?? []).filter((c) => !list.some((m) => m.user_id === c.user_id))
    return [
      ...owners.map((c): Row => ({ kind: 'ceo', key: c.user_id, name: c.full_name || c.email || 'Dueño', email: c.email, ceo: c })),
      ...list.map((m): Row => ({ kind: 'member', key: m.id, name: m.profile?.full_name || m.profile?.email || 'Invitación pendiente', email: m.profile?.email ?? null, m })),
    ]
  }, [members.data, ceos.data])
  const rows = useMemo(() => {
    const needle = normalize(q.trim())
    return all.filter((r) =>
      (filter === 'todos' || (r.kind === 'member' && r.m.role === filter)) &&
      (!needle || normalize(r.name).includes(needle) || normalize(r.email ?? '').includes(needle)))
  }, [all, q, filter])
  const counts: Record<RoleFilter, number> = {
    todos: all.length,
    admin: all.filter((r) => r.kind === 'member' && r.m.role === 'admin').length,
    user: all.filter((r) => r.kind === 'member' && r.m.role === 'user').length,
  }

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
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setFormError('Escribe un correo válido.')
    invite.mutate({ school_id: schoolId, email: email.trim(), role, full_name: fullName.trim() || undefined })
  }
  const closeInvite = () => { setInviting(false); setFormError(null); setNotice(null) }

  return (
    <div className="miembros__list">
      <p className="hint">Los administradores gestionan toda la escuela. Los usuarios trabajan el día a día.</p>
      <div className="toolbar">
        <label className="search">
          <Icon name="search" size={16} />
          <span className="sr-only">Buscar administrativo</span>
          <input className="input" type="search" placeholder="Buscar por nombre o correo" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <div className="segmented" role="group" aria-label="Filtrar por rol">
          {([['todos', 'Todos'], ['admin', 'Administradores'], ['user', 'Usuarios']] as const).map(([f, label]) => (
            <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)}>{label} <span>{counts[f]}</span></button>
          ))}
        </div>
        <button type="button" className="btn" onClick={() => setInviting(true)}><Icon name="plus" size={16} /> Invitar</button>
      </div>

      {rowError && <p className="alert" role="alert">{rowError}</p>}
      {members.isLoading && <p className="hint">Cargando…</p>}
      {members.isError && <p className="alert">No se pudieron cargar los administrativos.</p>}
      {members.data?.length === 0 && <p className="hint">Esta escuela aún no tiene administrativos. Invita a su administrador.</p>}
      {all.length > 0 && rows.length === 0 && <p className="hint">Nadie coincide con la búsqueda.</p>}

      <div className="member-group">
      {rows.slice(0, shown).map((r) => r.kind === 'ceo' ? (
        <article key={r.key} className="card member-row">
          <div className="member-row__who">
            <strong>{r.name}{r.ceo.user_id === user?.id ? ' (tú)' : ''}</strong>
            {r.ceo.full_name && <span className="hint">{r.ceo.email}</span>}
          </div>
          <div className="member-row__actions">
            <span className="tag tag--accent" title="Dueño de la escuela">{roleLabel.ceo}</span>
          </div>
        </article>
      ) : (
        <article key={r.key} className="card member-row">
          <div className="member-row__who">
            <strong>{r.name}{r.m.user_id === user?.id ? ' (tú)' : ''}</strong>
            {r.m.profile?.full_name && <span className="hint">{r.m.profile.email}</span>}
          </div>
          <div className="member-row__actions">
            <select
              className="input member-row__role"
              aria-label={`Rol de ${r.name}`}
              value={r.m.role}
              disabled={changeRole.isPending}
              onChange={(e) => {
                setRowError(null)
                changeRole.mutate({ id: r.m.id, role: e.target.value as SchoolRole })
              }}
            >
              <option value="admin">{roleLabel.admin}</option>
              <option value="user">{roleLabel.user}</option>
            </select>
            {confirming === r.m.id ? (
              <>
                <button type="button" className="btn btn--danger" disabled={remove.isPending} onClick={() => { setRowError(null); remove.mutate(r.m.id) }}>
                  Confirmar
                </button>
                <button type="button" className="btn btn--ghost" onClick={() => setConfirming(null)}>Cancelar</button>
              </>
            ) : (
              <button type="button" className="btn btn--ghost" onClick={() => setConfirming(r.m.id)}>Quitar</button>
            )}
          </div>
        </article>
      ))}
      </div>
      <ShowMore shown={shown} total={rows.length} onMore={more} label="Mostrar más" />

      <Modal open={inviting} onClose={closeInvite} label="Invitar administrativo">
        <div className="modal__head">
          <h2 className="modal__title">Invitar administrativo</h2>
          <button type="button" className="icon-btn" onClick={closeInvite} aria-label="Cerrar"><Icon name="close" /></button>
        </div>
        <form className="miembros__form" onSubmit={onSubmit} noValidate>
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
          <div className="form-actions">
            <button className="btn" type="submit" disabled={invite.isPending}>
              <Icon name="mail" size={16} /> {invite.isPending ? 'Enviando…' : 'Enviar invitación'}
            </button>
            <button type="button" className="btn btn--ghost" onClick={closeInvite}>Cerrar</button>
          </div>
          <p className="hint">La persona recibe un correo para crear su contraseña.</p>
        </form>
      </Modal>
    </div>
  )
}
