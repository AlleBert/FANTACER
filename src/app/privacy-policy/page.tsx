import type { Metadata } from 'next'
import { dictionaries } from '@/i18n'
import { LegalPageLayout, LegalSection } from '@/components/legal/legal-page-layout'
import { getLegalLocale, makeLegalT } from '@/lib/legal'

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLegalLocale()
  return {
    title: `${dictionaries[locale]['privacyPolicy.title']} — FANTACER`,
    alternates: { canonical: '/privacy-policy' },
  }
}

const SUBPROCESSOR_ITEMS = [
  { labelKey: 'privacyPolicy.supabase', descKey: 'privacyPolicy.supabaseDesc' },
  { labelKey: 'privacyPolicy.resend', descKey: 'privacyPolicy.resendDesc' },
  { labelKey: 'privacyPolicy.cloudflare', descKey: 'privacyPolicy.cloudflareDesc' },
  { labelKey: 'privacyPolicy.googleAnalytics', descKey: 'privacyPolicy.googleAnalyticsDesc' },
] as const

const RETENTION_ITEMS = [
  { category: 'privacyPolicy.dataContact', period: 'privacyPolicy.retentionContact' },
  { category: 'privacyPolicy.dataVoting', period: 'privacyPolicy.retentionVoting' },
  { category: 'privacyPolicy.dataAdmin', period: 'privacyPolicy.retentionAdmin' },
  { category: 'privacyPolicy.dataTechnical', period: 'privacyPolicy.retentionLogs' },
  { category: 'privacyPolicy.dataAnalytics', period: 'privacyPolicy.retentionAnalytics' },
] as const

function SubprocessorList({ t }: { t: ReturnType<typeof makeLegalT> }) {
  return (
    <ul>
      {SUBPROCESSOR_ITEMS.map((item, i) => (
        <li key={i}>
          <strong>{t(item.labelKey)}</strong> — {t(item.descKey)}
        </li>
      ))}
    </ul>
  )
}

function RetentionTable({ t }: { t: ReturnType<typeof makeLegalT> }) {
  return (
    <div className="table-scroll">
      <table className="table-card-mobile">
        <thead>
          <tr>
            <th data-label={t('privacyPolicy.retentionTableCategory')}>{t('privacyPolicy.retentionTableCategory')}</th>
            <th data-label={t('privacyPolicy.retentionTablePeriod')}>{t('privacyPolicy.retentionTablePeriod')}</th>
          </tr>
        </thead>
        <tbody>
          {RETENTION_ITEMS.map((item, i) => (
            <tr key={i}>
              <td data-label={t(item.category)}>{t(item.category)}</td>
              <td data-label={t(item.period)}>{t(item.period)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default async function PrivacyPolicyPage() {
  const locale = await getLegalLocale()
  const t = makeLegalT(locale)

  const sections = [
    { id: 'controller', headingKey: 'privacyPolicy.controller' },
    { id: 'dpo', headingKey: 'privacyPolicy.dpo' },
    { id: 'data-categories', headingKey: 'privacyPolicy.dataCategories' },
    { id: 'purposes', headingKey: 'privacyPolicy.purposes' },
    { id: 'legal-bases', headingKey: 'privacyPolicy.legalBases' },
    { id: 'recipients', headingKey: 'privacyPolicy.recipients' },
    { id: 'subprocessors', headingKey: 'privacyPolicy.subprocessors' },
    { id: 'transfers', headingKey: 'privacyPolicy.transfers' },
    { id: 'retention', headingKey: 'privacyPolicy.retention' },
    { id: 'rights', headingKey: 'privacyPolicy.rights' },
    { id: 'exercise', headingKey: 'privacyPolicy.howToExerciseHeading' },
    { id: 'complaint', headingKey: 'privacyPolicy.complaintHeading' },
    { id: 'changes', headingKey: 'privacyPolicy.changesHeading' },
    { id: 'contact', headingKey: 'privacyPolicy.contact' },
  ] as const

  return (
    <LegalPageLayout
      titleKey="privacyPolicy.title"
      lastUpdatedKey="privacyPolicy.lastUpdated"
      intro="privacyPolicy.lead"
      sections={sections}
    >
      <LegalSection id="controller" headingKey="privacyPolicy.controller">
        <p>{t('privacyPolicy.controllerDetails')}</p>
      </LegalSection>

      <LegalSection id="dpo" headingKey="privacyPolicy.dpo">
        <p>{t('privacyPolicy.dpoContact')}</p>
      </LegalSection>

      <LegalSection id="data-categories" headingKey="privacyPolicy.dataCategories">
        <p>{t('privacyPolicy.dataContact')}</p>
        <p>{t('privacyPolicy.dataVoting')}</p>
        <p>{t('privacyPolicy.dataAdmin')}</p>
        <p>{t('privacyPolicy.dataAnalytics')}</p>
        <p>{t('privacyPolicy.dataTechnical')}</p>
      </LegalSection>

      <LegalSection id="purposes" headingKey="privacyPolicy.purposes">
        <p>{t('privacyPolicy.purposeContact')}</p>
        <p>{t('privacyPolicy.purposeVoting')}</p>
        <p>{t('privacyPolicy.purposeAdmin')}</p>
        <p>{t('privacyPolicy.purposeAnalytics')}</p>
        <p>{t('privacyPolicy.purposeSecurity')}</p>
      </LegalSection>

      <LegalSection id="legal-bases" headingKey="privacyPolicy.legalBases">
        <p>{t('privacyPolicy.legalBasesIntro')}</p>
        <ul>
          <li><strong>{t('privacyPolicy.basisConsent')}</strong></li>
          <li><strong>{t('privacyPolicy.basisLegitimate')}</strong></li>
          <li><strong>{t('privacyPolicy.basisContract')}</strong></li>
          <li><strong>{t('privacyPolicy.basisLegalObligation')}</strong></li>
        </ul>
        <p className="muted">{t('privacyPolicy.legalBasisNote')}</p>
      </LegalSection>

      <LegalSection id="recipients" headingKey="privacyPolicy.recipients">
        <p>{t('privacyPolicy.recipientsDesc')}</p>
        <SubprocessorList t={t} />
      </LegalSection>

      <LegalSection id="subprocessors" headingKey="privacyPolicy.subprocessors">
        <p>{t('privacyPolicy.subprocessorsIntro')}</p>
        <SubprocessorList t={t} />
      </LegalSection>

      <LegalSection id="transfers" headingKey="privacyPolicy.transfers">
        <p>{t('privacyPolicy.transfersDesc')}</p>
      </LegalSection>

      <LegalSection id="retention" headingKey="privacyPolicy.retention">
        <p>{t('privacyPolicy.retentionIntro')}</p>
        <RetentionTable t={t} />
      </LegalSection>

      <LegalSection id="rights" headingKey="privacyPolicy.rights">
        <p>{t('privacyPolicy.rightsIntro')}</p>
        <p>{t('privacyPolicy.rightsList')}</p>
      </LegalSection>

      <LegalSection id="exercise" headingKey="privacyPolicy.howToExerciseHeading">
        <p>{t('privacyPolicy.howToExercise')}</p>
      </LegalSection>

      <LegalSection id="complaint" headingKey="privacyPolicy.complaintHeading">
        <p>{t('privacyPolicy.complaint')}</p>
      </LegalSection>

      <LegalSection id="changes" headingKey="privacyPolicy.changesHeading">
        <p>{t('privacyPolicy.changes')}</p>
      </LegalSection>

      <LegalSection id="contact" headingKey="privacyPolicy.contact">
        <p>{t('privacyPolicy.contactDetails')}</p>
      </LegalSection>
    </LegalPageLayout>
  )
}