import type { Metadata } from 'next'
import { dictionaries } from '@/i18n'
import { LegalPageLayout, LegalSection } from '@/components/legal/legal-page-layout'
import { getLegalLocale, makeLegalT } from '@/lib/legal'
import type { DictionaryKey } from '@/i18n/dictionary'

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

const PRIZE_SECTION_ITEMS = [
  { key: 'terms.prizeCollection', label: 'Ritiro del premio' },
  { key: 'terms.prizeDetails', label: 'Dettagli premio' },
  { key: 'terms.fairDates', label: 'Date fiera' },
  { key: 'terms.gadget', label: 'Gadget' },
  { key: 'terms.noCashAlternative', label: 'Nessuna alternativa cash' },
  { key: 'terms.unclaimedForfeited', label: 'Premi non ritirati' },
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

function PrizeSectionItems({ t }: { t: ReturnType<typeof makeLegalT> }) {
  return (
    <ul>
      {PRIZE_SECTION_ITEMS.map((item) => (
        <li key={item.key}>{t(item.key)}</li>
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
    { id: 'eligibility', headingKey: 'terms.eligibility' },
    { id: 'voting-rules', headingKey: 'terms.votingRules' },
    { id: 'prize', headingKey: 'terms.prizeCollection' },
    { id: 'ip', headingKey: 'terms.intellectualProperty' },
    { id: 'user-content', headingKey: 'terms.userContent' },
    { id: 'disclaimer', headingKey: 'terms.disclaimer' },
    { id: 'limitation', headingKey: 'terms.limitation' },
    { id: 'termination', headingKey: 'terms.termination' },
    { id: 'governing-law', headingKey: 'terms.governingLaw' },
    { id: 'changes', headingKey: 'terms.changes' },
    { id: 'contact', headingKey: 'terms.contact' },
  ] as const

  return (
    <LegalPageLayout
      titleKey="terms.title"
      lastUpdatedKey="terms.lastUpdated"
      sections={sections}
    >
      <LegalSection id="acceptance" headingKey="terms.acceptance">
        <h2>{t('terms.acceptance')}</h2>
        <p>{t('terms.acceptanceDesc')}</p>
      </LegalSection>

      <LegalSection id="service" headingKey="terms.serviceDescription">
        <h2>{t('terms.serviceDescription')}</h2>
        <p>{t('terms.serviceDescription')}</p>
      </LegalSection>

      <LegalSection id="eligibility" headingKey="terms.eligibility">
        <h2>{t('terms.eligibility')}</h2>
        <p>{t('terms.eligibilityDesc')}</p>
      </LegalSection>

      <LegalSection id="voting-rules" headingKey="terms.votingRules">
        <h2>{t('terms.votingRules')}</h2>
        <VotingRulesList t={t} />
        <ul>
          <li><strong>{t('terms.oneVotePerDay')}</strong></li>
          <li><strong>{t('terms.threeCompanies')}</strong></li>
        </ul>
      </LegalSection>

      <LegalSection id="prize" headingKey="terms.prizeCollection">
        <h2>{t('terms.prizeCollection')}</h2>
        <p>{t('terms.prizeDetails')}</p>
        <p><strong>{t('terms.fairDates')}</strong></p>
        <p>{t('terms.gadget')}</p>
        <p>{t('terms.noCashAlternative')}</p>
        <PrizeSectionItems t={t} />
        <p>{t('terms.unclaimedForfeited')}</p>
      </LegalSection>

      <LegalSection id="ip" headingKey="terms.intellectualProperty">
        <h2>{t('terms.intellectualProperty')}</h2>
        <ul>
          <li><strong>{t('terms.brandOwnership')}</strong></li>
          <li><strong>{t('terms.companyLogos')}</strong></li>
          <li><strong>{t('terms.voteAttribution')}</strong></li>
        </ul>
      </LegalSection>

      <LegalSection id="user-content" headingKey="terms.userContent">
        <h2>{t('terms.userContent')}</h2>
        <p>{t('terms.userContentDesc')}</p>
      </LegalSection>

      <LegalSection id="disclaimer" headingKey="terms.disclaimer">
        <h2>{t('terms.disclaimer')}</h2>
        <p>{t('terms.disclaimerDesc')}</p>
      </LegalSection>

      <LegalSection id="limitation" headingKey="terms.limitation">
        <h2>{t('terms.limitation')}</h2>
        <ul>
          <li><strong>{t('terms.maxLiability')}</strong></li>
          <li><strong>{t('terms.noIndirectDamages')}</strong></li>
        </ul>
      </LegalSection>

      <LegalSection id="termination" headingKey="terms.termination">
        <h2>{t('terms.termination')}</h2>
        <ul>
          <li><strong>{t('terms.organizerMayEnd')}</strong></li>
          <li><strong>{t('terms.userMayStop')}</strong></li>
          <li><strong>{t('terms.provisionsSurvive')}</strong></li>
        </ul>
      </LegalSection>

      <LegalSection id="governing-law" headingKey="terms.governingLaw">
        <h2>{t('terms.governingLaw')}</h2>
        <ul>
          <li><strong>{t('terms.italianLaw')}</strong></li>
          <li><strong>{t('terms.tribunalReggio')}</strong></li>
        </ul>
      </LegalSection>

      <LegalSection id="changes" headingKey="terms.changes">
        <h2>{t('terms.changes')}</h2>
        <p>{t('terms.changesDesc')}</p>
      </LegalSection>

      <LegalSection id="contact" headingKey="terms.contact">
        <h2>{t('terms.contact')}</h2>
        <p>{t('terms.contactDesc')}</p>
      </LegalSection>
    </LegalPageLayout>
  )
}