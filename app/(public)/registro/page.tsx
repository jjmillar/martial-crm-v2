'use client'
import { RedirectIfAuthed } from '@/shell/RedirectIfAuthed'
import { Registro } from '@/screens/Registro'

export default function Page() {
  return <RedirectIfAuthed><Registro /></RedirectIfAuthed>
}
