import { describe, expect, it } from 'vitest'
import { hasAllowedRole, hasOperationalAccess } from './domain-rules'

describe('acesso operacional lógico', () => {
  it('nega acesso a usuário inativo mesmo com role', () => {
    expect(hasOperationalAccess(false, 'ADMIN')).toBe(false)
  })

  it('nega acesso quando profile/role não existe', () => {
    expect(hasOperationalAccess(true, null)).toBe(false)
  })

  it('permite acesso somente com perfil ativo e role', () => {
    expect(hasOperationalAccess(true, 'LEITURA')).toBe(true)
  })
})

describe('autorização por role', () => {
  it('permite ADMIN em recurso administrativo', () => {
    expect(hasAllowedRole('ADMIN', ['ADMIN'])).toBe(true)
  })

  it('nega LEITURA em recurso administrativo', () => {
    expect(hasAllowedRole('LEITURA', ['ADMIN'])).toBe(false)
  })

  it('nega acesso quando não existe role válida', () => {
    expect(hasAllowedRole(null, ['ADMIN'])).toBe(false)
  })
})
