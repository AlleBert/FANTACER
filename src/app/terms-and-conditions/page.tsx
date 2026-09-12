import type { Metadata } from 'next'
import { dictionaries } from '@/i18n'
import { LegalPageLayout, LegalSection } from '@/components/legal/legal-page-layout'
import { getLegalLocale, makeLegalT } from '@/lib/legal'

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLegalLocale()
  return { title: `${dictionaries[locale]['terms.title']} — FANTACER` }
}

const PARTICIPATION_REQUIREMENTS = [
  'terms.votingTurnstile',
  'terms.eligibilityAge',
  'terms.oneVotePerDay',
] as const

function ParticipationRequirements({ t }: { t: ReturnType<typeof makeLegalT> }) {
  return (
    <ul>
      {PARTICIPATION_REQUIREMENTS.map((key) => (
        <li key={key}>{t(key)}</li>
      ))}
    </ul>
  )
}

export default async function TermsAndConditionsPage() {
  const locale = await getLegalLocale()
  const t = makeLegalT(locale)

  const sections = [
    { id: 'acceptance', headingKey: 'terms.acceptance' },
    { id: 'eligibility', headingKey: 'terms.eligibility' },
    { id: 'participation', headingKey: 'terms.participation' },
    { id: 'ip', headingKey: 'terms.intellectualProperty' },
    { id: 'user-content', headingKey: 'terms.userContent' },
    { id: 'disclaimer', headingKey: 'terms.disclaimer' },
    { id: 'responsibility', headingKey: 'terms.limitation' },
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
        <p>{t('terms.acceptanceDesc')}</p>
        <p>{t('terms.acceptanceFree')}</p>
        <p>{t('terms.acceptanceVoluntary')}</p>
      </LegalSection>

      <LegalSection id="eligibility" headingKey="terms.eligibility">
        <ParticipationRequirements t={t} />
      </LegalSection>

      <LegalSection id="participation" headingKey="terms.participation">
        <p>{t('terms.participationDesc')}</p>
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
        <p>{t('terms.userContentIntro')}</p>
        <p>{t('terms.userContentDesc')}</p>
      </LegalSection>

      <LegalSection id="disclaimer" headingKey="terms.disclaimer">
        <p>{t('terms.disclaimerDesc')}</p>
      </LegalSection>

      <LegalSection id="responsibility" headingKey="terms.limitation">
        <p>{t('terms.limitationFantasy')}</p>
        <p>{t('terms.organizerMayEnd')}</p>
        <p>{t('terms.userMayStop')}</p>
        <p>{t('terms.provisionsSurvive')}</p>
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
