import { redirect } from 'next/navigation'

// Plans are a section of "Pagos y planes" (/app/pagos#planes); old links land there.
export default function Page() {
  redirect('/app/pagos#planes')
}
