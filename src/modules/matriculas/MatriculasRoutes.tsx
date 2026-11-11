import { Route, Routes } from 'react-router-dom'
import { MatriculasList } from './MatriculasList'
import { MatriculaEditor } from './MatriculaForm'
import './matriculas.css'

export function MatriculasRoutes() {
  return (
    <Routes>
      <Route index element={<MatriculasList />} />
      <Route path=":id" element={<MatriculaEditor />} />
    </Routes>
  )
}
