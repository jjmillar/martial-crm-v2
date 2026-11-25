'use client'
import { redirect } from 'next/navigation'

// The list moved into Miembros (accordion "Profesores"); old links land there.
export default function Page() {
  redirect('/app/miembros#profesores')
}
