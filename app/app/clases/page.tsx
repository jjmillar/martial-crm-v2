'use client'
import { redirect } from 'next/navigation'

// Clases moved into Escuelas (accordion "Clases"); old links land there. The forms stay at /app/clases/<id>.
export default function Page() {
  redirect('/app/escuelas#clases')
}
