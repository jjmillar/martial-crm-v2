import { Route, Routes } from 'react-router-dom'
import { AlumnosList } from './AlumnosList'
import { AlumnoEditor } from './AlumnoForm'
import './alumnos.css'

export function AlumnosRoutes() {
  return (
    <Routes>
      <Route index element={<AlumnosList />} />
      <Route path=":id" element={<AlumnoEditor />} />
    </Routes>
  )
}
