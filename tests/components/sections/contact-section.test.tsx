import { render, screen, fireEvent } from '@testing-library/react'
import { ContactSection } from '@/components/sections/contact-section'

jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: { src: string; alt: string }) => <img src={props.src} alt={props.alt} />,
}))
jest.mock('@/lib/LocaleContext', () => ({ useLocale: () => ({ t: (key: string) => key }) }))

describe('ContactSection', () => {
  it('mostra label visibili associate ai campi', () => {
    render(<ContactSection />)
    expect(screen.getByLabelText('contact.nameLabel')).toBeInTheDocument()
    expect(screen.getByLabelText('contact.emailLabel')).toBeInTheDocument()
    expect(screen.getByLabelText('contact.messageLabel')).toBeInTheDocument()
  })

  it('espone i contatti come link mailto / tel / website', () => {
    render(<ContactSection />)
    expect(screen.getByRole('link', { name: 'team@fantacer.com' })).toHaveAttribute(
      'href',
      'mailto:team@fantacer.com',
    )
    expect(screen.getByRole('link', { name: '+39 333 138 5574' })).toHaveAttribute(
      'href',
      'tel:+393331385574',
    )
    expect(screen.getByRole('link', { name: 'www.fantacer.com' })).toHaveAttribute(
      'href',
      'https://www.fantacer.com',
    )
  })

  it('tiene la CTA attiva e valida al submit', () => {
    render(<ContactSection />)
    const submit = screen.getByRole('button', { name: 'contact.submit' })
    expect(submit).toBeEnabled()
    fireEvent.click(submit)
    expect(screen.getByText('contact.errorNameRequired')).toBeInTheDocument()
    expect(screen.getByText('contact.errorEmailInvalid')).toBeInTheDocument()
    expect(screen.getByText('contact.errorMessageRequired')).toBeInTheDocument()
  })

  it('segnala email non valida ma non vuota', () => {
    render(<ContactSection />)
    fireEvent.change(screen.getByLabelText('contact.nameLabel'), { target: { value: 'Ada' } })
    fireEvent.change(screen.getByLabelText('contact.emailLabel'), { target: { value: 'not-an-email' } })
    fireEvent.change(screen.getByLabelText('contact.messageLabel'), { target: { value: 'Ciao, come state?' } })
    fireEvent.click(screen.getByRole('button', { name: 'contact.submit' }))
    expect(screen.getByText('contact.errorEmailInvalid')).toBeInTheDocument()
    expect(screen.queryByText('contact.errorNameRequired')).not.toBeInTheDocument()
    expect(screen.queryByText('contact.errorMessageRequired')).not.toBeInTheDocument()
  })

  it('rifiuta un messaggio troppo corto', () => {
    render(<ContactSection />)
    fireEvent.change(screen.getByLabelText('contact.nameLabel'), { target: { value: 'Ada' } })
    fireEvent.change(screen.getByLabelText('contact.emailLabel'), { target: { value: 'ada@example.com' } })
    fireEvent.change(screen.getByLabelText('contact.messageLabel'), { target: { value: 'ciao' } })
    fireEvent.click(screen.getByRole('button', { name: 'contact.submit' }))
    expect(screen.getByText('contact.errorMessageTooShort')).toBeInTheDocument()
  })

  it('rimuove l\'errore quando il campo viene corretto', () => {
    render(<ContactSection />)
    fireEvent.click(screen.getByRole('button', { name: 'contact.submit' }))
    const nameInput = screen.getByLabelText('contact.nameLabel')
    expect(nameInput).toHaveAttribute('aria-invalid', 'true')
    fireEvent.change(nameInput, { target: { value: 'Ada' } })
    expect(nameInput).not.toHaveAttribute('aria-invalid')
    expect(screen.queryByText('contact.errorNameRequired')).not.toBeInTheDocument()
  })
})
