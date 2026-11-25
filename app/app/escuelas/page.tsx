'use client'
import { redirect } from 'next/navigation'

// Escuelas moved into Ajustes (accordion "Escuelas"); old links land there.
export default function Page() {
  redirect('/app/ajustes#escuelas')
}
