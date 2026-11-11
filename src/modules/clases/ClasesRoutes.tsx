import { Route, Routes } from 'react-router-dom'
import { ClasesList } from './ClasesList'
import { ClaseEditor } from './ClaseForm'
import './clases.css'

export function ClasesRoutes() {
  return (
    <Routes>
      <Route index element={<ClasesList />} />
      <Route path=":id" element={<ClaseEditor />} />
    </Routes>
  )
}
