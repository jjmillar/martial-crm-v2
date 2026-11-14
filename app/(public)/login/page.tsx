'use client'
import { RedirectIfAuthed } from '@/shell/RedirectIfAuthed'
import { Login } from '@/screens/Login'

export default function Page() {
  return <RedirectIfAuthed><Login /></RedirectIfAuthed>
}
