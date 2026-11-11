import { Route, Routes } from 'react-router-dom'
import { ProfesoresList } from './ProfesoresList'
import { ProfesorEditor } from './ProfesorForm'
import './profesores.css'

export function ProfesoresRoutes() {
  return (
    <Routes>
      <Route index element={<ProfesoresList />} />
      <Route path=":id" element={<ProfesorEditor />} />
    </Routes>
  )
}
