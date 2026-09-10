import type { Metadata } from 'next'
import { dictionaries } from '@/i18n'
import { LegalPageLayout, LegalSection } from '@/components/legal/legal-page-layout'
import { getLegalLocale, makeLegalT } from '@/lib/legal'

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLegalLocale()
  return { title: `${dictionaries[locale]['terms.title']} — FANTACER` }
}

const VOTING_RULES = [
  { key: 'terms.votingTurnstile', label: 'Verifica Turnstile (CAPTCHA)' },
  { key: 'terms.votingConfirm', label: 'Conferma e schermata premio' },
  { key: 'terms.votingNoAutomation', label: 'Nessun script o bot' },
  { key: 'terms.votingNoTrading', label: 'Nessuna compravendita voti' },
] as const

function VotingRulesList({ t }: { t: ReturnType<typeof makeLegalT> }) {
  return (
    <ul>
      {VOTING_RULES.map((rule) => (
        <li key={rule.key}>{t(rule.key)}</li>
      ))}
    </ul>
  )
}

export default async function TermsAndConditionsPage() {
  const locale = await getLegalLocale()
  const t = makeLegalT(locale)

  const sections = [
    { id: 'acceptance', headingKey: 'terms.acceptance' },
    { id: 'service', headingKey: 'terms.serviceDescription' },
    { id: 'voting-rules', headingKey: 'terms.votingRules' },
    { id: 'prize', headingKey: 'terms.prizeCollection' },
    { id: 'ip', headingKey: 'terms.intellectualProperty' },
    { id: 'responsibility', headingKey: 'terms.limitation' },
    { id: 'termination', headingKey: 'terms.termination' },
    { id: 'governing-law', headingKey: 'terms.governingLaw' },
    { id: 'contact', headingKey: 'terms.contact' },
  ] as const

  return (
    <LegalPageLayout
      titleKey="terms.title"
      lastUpdatedKey="terms.lastUpdated"
      sections={sections}
    >
      <LegalSection id="acceptance" headingKey="terms.acceptance">
        <p>{t('terms.acceptanceDesc')}</p>
      </LegalSection>

      <LegalSection id="service" headingKey="terms.serviceDescription">
        <p>
          Fantacer mette in gioco un’esperienza semplice e partecipativa: il visitatore sceglie le aziende preferite,
          conferma il voto e raccoglie il premio disponibile durante la fiera.
        </p>
      </LegalSection>

      <LegalSection id="eligibility" headingKey="terms.eligibility">
        <p>{t('terms.eligibilityDesc')}</p>
      </LegalSection>

      <LegalSection id="voting-rules" headingKey="terms.votingRules">
        <p>
          Il gioco è pensato per un voto chiaro e verificabile: un solo voto per dispositivo, tre aziende distinte e
          nessuna forma automatizzata di partecipazione.
        </p>
        <VotingRulesList t={t} />
        <ul>
          <li><strong>{t('terms.oneVotePerDay')}</strong></li>
          <li><strong>{t('terms.threeCompanies')}</strong></li>
        </ul>
        <p>{t('terms.voteValidity')}</p>
      </LegalSection>

      <LegalSection id="prize" headingKey="terms.prizeCollection">
        <p>{t('terms.prizeDetails')}</p>
        <p><strong>{t('terms.fairDates')}</strong></p>
        <p>{t('terms.gadget')}</p>
        <p>{t('terms.noCashAlternative')}</p>
        <p>{t('terms.unclaimedForfeited')}</p>
      </LegalSection>

      <LegalSection id="ip" headingKey="terms.intellectualProperty">
        <p>{t('terms.ipIntro')}</p>
        <ul>
          <li><strong>{t('terms.brandOwnership')}</strong></li>
          <li><strong>{t('terms.companyLogos')}</strong></li>
          <li><strong>{t('terms.voteAttribution')}</strong></li>
        </ul>
      </LegalSection>

      <LegalSection id="user-content" headingKey="terms.userContent">
        <p>
          Tutti i contenuti inseriti dagli utenti devono essere corretti, pertinenti e non lesivi di diritti di terzi.
          Fantacer non è responsabile del contenuto inviato da chi partecipa ma si riserva di intervenire in caso di
          uso improprio del servizio.
        </p>
        <p>{t('terms.userContentDesc')}</p>
      </LegalSection>

      <LegalSection id="disclaimer" headingKey="terms.disclaimer">
        <p>{t('terms.disclaimerDesc')}</p>
      </LegalSection>

      <LegalSection id="responsibility" headingKey="terms.limitation">
        <p>{t('terms.limitationIntro')}</p>
        <ul>
          <li><strong>{t('terms.maxLiability')}</strong></li>
          <li><strong>{t('terms.noIndirectDamages')}</strong></li>
        </ul>
      </LegalSection>

      <LegalSection id="termination" headingKey="terms.termination">
        <p>{t('terms.terminationIntro')}</p>
        <ul>
          <li><strong>{t('terms.organizerMayEnd')}</strong></li>
          <li><strong>{t('terms.userMayStop')}</strong></li>
          <li><strong>{t('terms.provisionsSurvive')}</strong></li>
        </ul>
      </LegalSection>

      <LegalSection id="governing-law" headingKey="terms.governingLaw">
        <p>{t('terms.governingLawIntro')}</p>
        <ul>
          <li><strong>{t('terms.italianLaw')}</strong></li>
          <li><strong>{t('terms.tribunalReggio')}</strong></li>
        </ul>
      </LegalSection>

      <LegalSection id="changes" headingKey="terms.changes">
        <p>{t('terms.changesDesc')}</p>
      </LegalSection>

      <LegalSection id="contact" headingKey="terms.contact">
        <p>{t('terms.contactDesc')}</p>
      </LegalSection>
    </LegalPageLayout>
  )
}