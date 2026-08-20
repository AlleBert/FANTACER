import { render, screen } from '@testing-library/react'
import { VoteReceipt } from '@/components/sections/vote-receipt'
import type { SelectedCompany } from '@/lib/VoteContext'

jest.mock('@/lib/LocaleContext', () => ({ useLocale: () => ({ t: (key: string) => key }) }))

const companies: SelectedCompany[] = [
  { company: { id: '1', name: 'EcoPierrè' }, pallet: 4 },
  { company: { id: '2', name: 'IMSO' }, pallet: 2 },
  { company: { id: '3', name: 'CIR' }, pallet: 1 },
]

describe('VoteReceipt', () => {
  it('rende le aziende con i pallet e il titolo', () => {
    render(<VoteReceipt companies={companies} />)
    expect(screen.getByText('success.receiptTitle')).toBeTruthy()
    expect(screen.getByText('EcoPierrè')).toBeTruthy()
    expect(screen.getByText('IMSO')).toBeTruthy()
    expect(screen.getByText('CIR')).toBeTruthy()
    expect(screen.getByText('4')).toBeTruthy()
    expect(screen.getByText('2')).toBeTruthy()
    expect(screen.getByText('1')).toBeTruthy()
  })

  it('non mostra alcun totale', () => {
    render(<VoteReceipt companies={companies} />)
    expect(screen.queryByText(/totale/i)).toBeNull()
  })

  it('rende null senza aziende', () => {
    const { container } = render(<VoteReceipt companies={[]} />)
    expect(container.firstChild).toBeNull()
  })
})
