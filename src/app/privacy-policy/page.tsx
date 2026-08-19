import type { Metadata } from 'next'
import { LegalPageLayout } from '@/components/legal/legal-page-layout'
import { dictionaries } from '@/i18n'
import { LOCALE_COOKIE, resolveLocale } from '@/lib/locale'
import { cookies, headers } from 'next/headers'

async function getLocale() {
  const cookieStore = await cookies()
  const headerStore = await headers()
  return resolveLocale(
    headerStore.get('accept-language') ?? null,
    cookieStore.get(LOCALE_COOKIE)?.value ?? null,
  )
}

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale()
  return {
    title: `${dictionaries[locale]['privacyPolicy.title']} — FANTACER`,
  }
}

export default async function PrivacyPolicyPage() {
  const locale = await getLocale()
  const t = (key: string, params?: Record<string, string>) => {
    let text = dictionaries[locale][key as keyof typeof dictionaries[typeof locale]] || key
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        text = text.replace(`{${k}}`, v)
      })
    }
    return text
  }

  const toc = [
    { id: 'controller', label: t('privacyPolicy.controller') },
    { id: 'dpo', label: t('privacyPolicy.dpo') },
    { id: 'data-categories', label: t('privacyPolicy.dataCategories') },
    { id: 'purposes', label: t('privacyPolicy.purposes') },
    { id: 'legal-bases', label: t('privacyPolicy.legalBases') },
    { id: 'recipients', label: t('privacyPolicy.recipients') },
    { id: 'subprocessors', label: t('privacyPolicy.subprocessors') },
    { id: 'transfers', label: t('privacyPolicy.transfers') },
    { id: 'retention', label: t('privacyPolicy.retention') },
    { id: 'rights', label: t('privacyPolicy.rights') },
    { id: 'exercise', label: t('privacyPolicy.howToExercise') },
    { id: 'complaint', label: t('privacyPolicy.complaint') },
    { id: 'changes', label: t('privacyPolicy.changes') },
    { id: 'contact', label: t('privacyPolicy.contact') },
  ]

  const summaryBox = (
    <div>
      <h2 className="text-lg font-black text-ink mb-4">
        🛡️ {t('privacyPolicy.summaryTitle')}
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
        <div>
          <strong className="text-ink">{t('privacyPolicy.summaryWho')}</strong>
          <p className="text-ink/70 mt-1">{t('privacyPolicy.summaryWhoDesc')}</p>
        </div>
        <div>
          <strong className="text-ink">{t('privacyPolicy.summaryWhat')}</strong>
          <p className="text-ink/70 mt-1">{t('privacyPolicy.summaryWhatDesc')}</p>
        </div>
        <div>
          <strong className="text-ink">{t('privacyPolicy.summaryHow')}</strong>
          <p className="text-ink/70 mt-1">{t('privacyPolicy.summaryHowDesc')}</p>
        </div>
        <div>
          <strong className="text-ink">{t('privacyPolicy.summaryContact')}</strong>
          <p className="text-ink/70 mt-1">{t('privacyPolicy.summaryContactDesc')}</p>
        </div>
      </div>
    </div>
  )

  return (
    <LegalPageLayout
      toc={toc}
      titleKey="privacyPolicy.title"
      lastUpdatedKey="privacyPolicy.lastUpdated"
      summaryBox={summaryBox}
      summaryColor="blue"
    >
      <section id="controller" aria-labelledby="controller-heading">
        <h2 id="controller-heading">{t('privacyPolicy.controller')}</h2>
        <p>{t('privacyPolicy.controllerDetails')}</p>
      </section>

      <section id="dpo" aria-labelledby="dpo-heading">
        <h2 id="dpo-heading">{t('privacyPolicy.dpo')}</h2>
        <p>{t('privacyPolicy.dpoContact')}</p>
      </section>

      <section id="data-categories" aria-labelledby="data-categories-heading">
        <h2 id="data-categories-heading">{t('privacyPolicy.dataCategories')}</h2>
        <h3>{t('privacyPolicy.dataContact')}</h3>
        <p>{t('privacyPolicy.dataContact').replace('Modulo contatti: ', '')}</p>
        <h3>{t('privacyPolicy.dataVoting')}</h3>
        <p>{t('privacyPolicy.dataVoting').replace('Votazione: ', '')}</p>
        <h3>{t('privacyPolicy.dataAdmin')}</h3>
        <p>{t('privacyPolicy.dataAdmin').replace('Area admin: ', '')}</p>
        <h3>{t('privacyPolicy.dataAnalytics')}</h3>
        <p>{t('privacyPolicy.dataAnalytics').replace('Analytics: ', '')}</p>
        <h3>{t('privacyPolicy.dataTechnical')}</h3>
        <p>{t('privacyPolicy.dataTechnical').replace('Dati tecnici: ', '').replace('Technical data: ', '')}</p>
      </section>

      <section id="purposes" aria-labelledby="purposes-heading">
        <h2 id="purposes-heading">{t('privacyPolicy.purposes')}</h2>
        <h3>{t('privacyPolicy.purposeContact')}</h3>
        <p>{t('privacyPolicy.purposeContact').replace('Rispondere alle richieste inviate tramite il modulo contatti.', '').replace('Respond to requests submitted via the contact form.', '')}</p>
        <h3>{t('privacyPolicy.purposeVoting')}</h3>
        <p>{t('privacyPolicy.purposeVoting').replace('Gestire la votazione, prevenire frodi/voti multipli, generare classifica.', '').replace('Manage voting, prevent fraud/multiple votes, generate ranking.', '')}</p>
        <h3>{t('privacyPolicy.purposeAdmin')}</h3>
        <p>{t('privacyPolicy.purposeAdmin').replace('Autenticare amministratori, garantire sicurezza, tracciare audit log.', '').replace('Authenticate administrators, ensure security, maintain audit logs.', '')}</p>
        <h3>{t('privacyPolicy.purposeAnalytics')}</h3>
        <p>{t('privacyPolicy.purposeAnalytics').replace('Analizzare l\'utilizzo del sito per migliorare l\'esperienza utente (previo consenso).', '').replace('Analyze site usage to improve user experience (with consent).', '')}</p>
        <h3>{t('privacyPolicy.purposeSecurity')}</h3>
        <p>{t('privacyPolicy.purposeSecurity').replace('Prevenire abusi, attacchi, frodi; garantire integrità del servizio.', '').replace('Prevent abuse, attacks, fraud; ensure service integrity.', '')}</p>
      </section>

      <section id="legal-bases" aria-labelledby="legal-bases-heading">
        <h2 id="legal-bases-heading">{t('privacyPolicy.legalBases')}</h2>
        <ul>
          <li><strong>{t('privacyPolicy.basisConsent')}</strong></li>
          <li><strong>{t('privacyPolicy.basisLegitimate')}</strong></li>
          <li><strong>{t('privacyPolicy.basisContract')}</strong></li>
          <li><strong>{t('privacyPolicy.basisLegalObligation')}</strong></li>
        </ul>
        <p className="muted">Il dettaglio della base giuridica per ogni finalità è indicato nella sezione «Finalità».</p>
      </section>

      <section id="recipients" aria-labelledby="recipients-heading">
        <h2 id="recipients-heading">{t('privacyPolicy.recipients')}</h2>
        <p>I dati possono essere comunicati a soggetti terzi che agiscono in qualità di responsabili del trattamento (sub-responsabili) per conto del Titolare, come dettagliato nella sezione successiva.</p>
      </section>

      <section id="subprocessors" aria-labelledby="subprocessors-heading">
        <h2 id="subprocessors-heading">{t('privacyPolicy.subprocessors')}</h2>
        <p>Con ciascun sub-responsabile &egrave; in essere un Data Processing Agreement (DPA) ai sensi dell&apos;Art. 28 GDPR.</p>
        <ul>
          <li>
            <strong>{t('privacyPolicy.supabase')}</strong> — {t('privacyPolicy.supabaseDesc')}
          </li>
          <li>
            <strong>{t('privacyPolicy.resend')}</strong> — {t('privacyPolicy.resendDesc')}
          </li>
          <li>
            <strong>{t('privacyPolicy.cloudflare')}</strong> — {t('privacyPolicy.cloudflareDesc')}
          </li>
          <li>
            <strong>{t('privacyPolicy.googleAnalytics')}</strong> — {t('privacyPolicy.googleAnalyticsDesc')}
          </li>
        </ul>
      </section>

      <section id="transfers" aria-labelledby="transfers-heading">
        <h2 id="transfers-heading">{t('privacyPolicy.transfers')}</h2>
        <p>{t('privacyPolicy.transfersDesc')}</p>
      </section>

      <section id="retention" aria-labelledby="retention-heading">
        <h2 id="retention-heading">{t('privacyPolicy.retention')}</h2>
        <div className="table-scroll">
          <table className="table-card-mobile">
            <thead>
              <tr>
                <th>Categoria</th>
                <th>Periodo di conservazione</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td data-label="Categoria">{t('privacyPolicy.dataContact').replace('Modulo contatti: ', '').replace('Contact form: ', '')}</td>
                <td data-label="Periodo">{t('privacyPolicy.retentionContact')}</td>
              </tr>
              <tr>
                <td data-label="Categoria">{t('privacyPolicy.dataVoting').replace('Votazione: ', '').replace('Voting: ', '')}</td>
                <td data-label="Periodo">{t('privacyPolicy.retentionVoting')}</td>
              </tr>
              <tr>
                <td data-label="Categoria">{t('privacyPolicy.dataAdmin').replace('Area admin: ', '').replace('Admin area: ', '')}</td>
                <td data-label="Periodo">{t('privacyPolicy.retentionAdmin')}</td>
              </tr>
              <tr>
                <td data-label="Categoria">{t('privacyPolicy.dataTechnical').replace('Dati tecnici: ', '').replace('Technical data: ', '')}</td>
                <td data-label="Periodo">{t('privacyPolicy.retentionLogs')}</td>
              </tr>
              <tr>
                <td data-label="Categoria">{t('privacyPolicy.dataAnalytics').replace('Analytics: ', '').replace('Analytics: ', '')}</td>
                <td data-label="Periodo">{t('privacyPolicy.retentionAnalytics')}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section id="rights" aria-labelledby="rights-heading">
        <h2 id="rights-heading">{t('privacyPolicy.rights')}</h2>
        <p>{t('privacyPolicy.rightsList')}</p>
      </section>

      <section id="exercise" aria-labelledby="exercise-heading">
        <h2 id="exercise-heading">{t('privacyPolicy.howToExercise')}</h2>
        <p>{t('privacyPolicy.howToExercise')}</p>
      </section>

      <section id="complaint" aria-labelledby="complaint-heading">
        <h2 id="complaint-heading">{t('privacyPolicy.complaint')}</h2>
        <p>{t('privacyPolicy.complaint')}</p>
      </section>

      <section id="changes" aria-labelledby="changes-heading">
        <h2 id="changes-heading">{t('privacyPolicy.changes')}</h2>
        <p>{t('privacyPolicy.changes')}</p>
      </section>

      <section id="contact" aria-labelledby="contact-heading">
        <h2 id="contact-heading">{t('privacyPolicy.contact')}</h2>
        <p>{t('privacyPolicy.contactDesc') || 'team@fantacer.com'}</p>
      </section>
    </LegalPageLayout>
  )
}
