'use client'
import { RedirectIfAuthed } from '@/shell/RedirectIfAuthed'
import { Landing } from '@/screens/Landing'

export default function Page() {
  return <RedirectIfAuthed><Landing /></RedirectIfAuthed>
}
