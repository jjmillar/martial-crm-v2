import { Route, Routes } from 'react-router-dom'
import { PagosList } from './PagosList'
import { PagoEditor } from './PagoForm'
import './pagos.css'

export function PagosRoutes() {
  return (
    <Routes>
      <Route index element={<PagosList />} />
      <Route path=":id" element={<PagoEditor />} />
    </Routes>
  )
}
