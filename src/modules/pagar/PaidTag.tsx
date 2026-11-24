// "Pagado" with its confirmation, like attendance: ✓✓ when the student reported the payment and the school approved
// it, ✓ when the school marked it paid on its own (e.g. the student said so by WhatsApp).
export function PaidTag({ double }: { double: boolean }) {
  const title = double ? 'El alumno avisó y la escuela lo confirmó' : 'Confirmado por la escuela'
  return (
    <span className="tag tag--pay-pagado paid-tag" title={title} aria-label={`Pagado: ${title.toLowerCase()}`}>
      <span aria-hidden="true" className="paid-tag__checks">{double ? '✓✓' : '✓'}</span> Pagado
    </span>
  )
}
