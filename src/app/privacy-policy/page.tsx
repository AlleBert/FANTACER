import type { Metadata } from 'next'
import { dictionaries } from '@/i18n'
import { LegalPageLayout, LegalSection } from '@/components/legal/legal-page-layout'
import { getLegalLocale, makeLegalT } from '@/lib/legal'
import type { DictionaryKey } from '@/i18n/dictionary'

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLegalLocale()
  return { title: `${dictionaries[locale]['privacyPolicy.title']} — FANTACER` }
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
            <th data-label="Categoria">{t('privacyPolicy.retentionTableCategory')}</th>
            <th data-label="Periodo">{t('privacyPolicy.retentionTablePeriod')}</th>
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
    { id: 'exercise', headingKey: 'privacyPolicy.howToExercise' },
    { id: 'complaint', headingKey: 'privacyPolicy.complaint' },
    { id: 'changes', headingKey: 'privacyPolicy.changes' },
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
        <h2 id="controller-heading">{t('privacyPolicy.controller')}</h2>
        <p>{t('privacyPolicy.controllerDetails')}</p>
      </LegalSection>

      <LegalSection id="dpo" headingKey="privacyPolicy.dpo">
        <h2 id="dpo-heading">{t('privacyPolicy.dpo')}</h2>
        <p>{t('privacyPolicy.dpoContact')}</p>
      </LegalSection>

      <LegalSection id="data-categories" headingKey="privacyPolicy.dataCategories">
        <p>{t('privacyPolicy.dataCategories')}</p>
      </LegalSection>

      <LegalSection id="purposes" headingKey="privacyPolicy.purposes">
        <h3>{t('privacyPolicy.purposeContact')}</h3>
        <p>{t('privacyPolicy.purposeContact')}</p>
        <h3>{t('privacyPolicy.purposeVoting')}</h3>
        <p>{t('privacyPolicy.purposeVoting')}</p>
        <h3>{t('privacyPolicy.purposeAdmin')}</h3>
        <p>{t('privacyPolicy.purposeAdmin')}</p>
        <h3>{t('privacyPolicy.purposeAnalytics')}</h3>
        <p>{t('privacyPolicy.purposeAnalytics')}</p>
        <h3>{t('privacyPolicy.purposeSecurity')}</h3>
        <p>{t('privacyPolicy.purposeSecurity')}</p>
      </LegalSection>

      <LegalSection id="legal-bases" headingKey="privacyPolicy.legalBases">
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
        <h2>{t('privacyPolicy.subprocessors')}</h2>
        <p>{t('privacyPolicy.subprocessorsIntro')}</p>
        <SubprocessorList t={t} />
      </LegalSection>

      <LegalSection id="transfers" headingKey="privacyPolicy.transfers">
        <h2>{t('privacyPolicy.transfers')}</h2>
        <p>{t('privacyPolicy.transfersDesc')}</p>
      </LegalSection>

      <LegalSection id="retention" headingKey="privacyPolicy.retention">
        <RetentionTable t={t} />
      </LegalSection>

      <LegalSection id="rights" headingKey="privacyPolicy.rights">
        <h2>{t('privacyPolicy.rights')}</h2>
        <p>{t('privacyPolicy.rightsList')}</p>
      </LegalSection>

      <LegalSection id="exercise" headingKey="privacyPolicy.howToExercise">
        <h2>{t('privacyPolicy.howToExerciseHeading')}</h2>
        <p>{t('privacyPolicy.howToExercise')}</p>
      </LegalSection>

      <LegalSection id="complaint" headingKey="privacyPolicy.complaintHeading">
        <h2>{t('privacyPolicy.complaintHeading')}</h2>
        <p>{t('privacyPolicy.complaint')}</p>
      </LegalSection>

      <LegalSection id="changes" headingKey="privacyPolicy.changesHeading">
        <h2>{t('privacyPolicy.changesHeading')}</h2>
        <p>{t('privacyPolicy.changes')}</p>
      </LegalSection>

      <LegalSection id="contact" headingKey="privacyPolicy.contact">
        <h2>{t('privacyPolicy.contact')}</h2>
        <p>{t('privacyPolicy.dataContactDesc') || 'team@fantacer.com'}</p>
      </LegalSection>
    </LegalPageLayout>
  )
}