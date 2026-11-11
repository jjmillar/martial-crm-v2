import { describe, expect, it } from 'vitest'
import { toCsv } from './csv'

describe('toCsv', () => {
  it('uses ; with BOM and CRLF, quoting only when needed', () => {
    const csv = toCsv(['Nombre', 'Notas', 'Activo', 'Monto'], [['Ana', 'dice "hola"; chao', true, 35000], ['Beto', null, false, 0]])
    expect(csv.startsWith('﻿')).toBe(true)
    expect(csv.slice(1).split('\r\n')).toEqual([
      'Nombre;Notas;Activo;Monto',
      'Ana;"dice ""hola""; chao";Sí;35000',
      'Beto;;No;0',
    ])
  })
})
