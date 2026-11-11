import { Route, Routes } from 'react-router-dom'
import { PlanesList } from './PlanesList'
import { PlanEditor } from './PlanForm'
import './planes.css'

export function PlanesRoutes() {
  return (
    <Routes>
      <Route index element={<PlanesList />} />
      <Route path=":id" element={<PlanEditor />} />
    </Routes>
  )
}
