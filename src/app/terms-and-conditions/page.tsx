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
    title: `${dictionaries[locale]['terms.title']} — FANTACER`,
  }
}

export default async function TermsPage() {
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
    { id: 'acceptance', label: t('terms.acceptance') },
    { id: 'service', label: t('terms.serviceDescription').substring(0, 30) + '...' },
    { id: 'eligibility', label: t('terms.eligibility') },
    { id: 'voting-rules', label: t('terms.votingRules') },
    { id: 'prize', label: t('terms.prizeCollection') },
    { id: 'ip', label: t('terms.intellectualProperty') },
    { id: 'user-content', label: t('terms.userContent') },
    { id: 'disclaimer', label: t('terms.disclaimer') },
    { id: 'limitation', label: t('terms.limitation') },
    { id: 'termination', label: t('terms.termination') },
    { id: 'governing-law', label: t('terms.governingLaw') },
    { id: 'changes', label: t('terms.changes') },
    { id: 'contact', label: t('terms.contact') },
  ]

  const summaryBox = (
    <div>
      <h2 className="text-lg font-black text-ink mb-3">
        🎮 {t('terms.summaryTitle')}
      </h2>
      <p className="text-sm text-ink/80 leading-relaxed mb-6">
        {t('terms.summaryText')}
      </p>
      <h3 className="text-base font-black text-ink mb-4 text-center">
        {t('terms.goldenRulesTitle')}
      </h3>
      <div className="space-y-3">
        <div className="flex items-center gap-3 p-3 bg-orange-50 border-2 border-orange rounded-xl">
          <div className="w-9 h-9 bg-orange text-white rounded-full flex items-center justify-center font-black text-lg flex-shrink-0">
            1
          </div>
          <p className="text-sm font-bold text-ink">{t('terms.goldenRule1')}</p>
        </div>
        <div className="flex items-center gap-3 p-3 bg-orange-50 border-2 border-orange rounded-xl">
          <div className="w-9 h-9 bg-orange text-white rounded-full flex items-center justify-center font-black text-lg flex-shrink-0">
            2
          </div>
          <p className="text-sm font-bold text-ink">{t('terms.goldenRule2')}</p>
        </div>
        <div className="flex items-center gap-3 p-3 bg-orange-50 border-2 border-orange rounded-xl">
          <div className="w-9 h-9 bg-orange text-white rounded-full flex items-center justify-center font-black text-lg flex-shrink-0">
            3
          </div>
          <p className="text-sm font-bold text-ink">{t('terms.goldenRule3')}</p>
        </div>
      </div>
    </div>
  )

  return (
    <LegalPageLayout
      toc={toc}
      titleKey="terms.title"
      lastUpdatedKey="terms.lastUpdated"
      summaryBox={summaryBox}
      summaryColor="green"
    >
      <details className="mb-6 border-2 border-ink/20 rounded-xl">
        <summary className="p-4 cursor-pointer font-black text-ink hover:bg-ink/5 transition-colors">
          {t('terms.legalDetailsTitle')}
        </summary>
        <div className="p-4 pt-0 border-t-2 border-ink/20">
          <section id="acceptance" aria-labelledby="acceptance-heading">
            <h2 id="acceptance-heading">{t('terms.acceptance')}</h2>
            <p>{t('terms.acceptanceDesc')}</p>
          </section>

          <section id="service" aria-labelledby="service-heading">
            <h2 id="service-heading">{t('terms.serviceDescription')}</h2>
            <p>{t('terms.serviceDescription').replace('Fantacer è un gioco a premi gratuito riservato ai visitatori di Cersaie (Salone Internazionale della Ceramica) a Bologna Fiere, dal 21 al 25 settembre 2026. Consente di votare il proprio stand preferito tra le aziende partecipanti e ritirare un gadget.', '').replace('Fantacer is a free prize game reserved for visitors of Cersaie (International Ceramics Exhibition) at Bologna Fiere, 21–25 September 2026. It allows you to vote for your favourite stand among participating companies and collect a gadget.', '')}</p>
          </section>

          <section id="eligibility" aria-labelledby="eligibility-heading">
            <h2 id="eligibility-heading">{t('terms.eligibility')}</h2>
            <p>{t('terms.eligibilityDesc')}</p>
          </section>

          <section id="voting-rules" aria-labelledby="voting-rules-heading">
            <h2 id="voting-rules-heading">{t('terms.votingRules')}</h2>
            <ul>
              <li><strong>{t('terms.oneVotePerDay')}</strong></li>
              <li><strong>{t('terms.threeCompanies')}</strong></li>
              <li>Completare la verifica Turnstile (CAPTCHA) per confermare di essere una persona reale.</li>
              <li>Inviare il voto per ricevere la conferma e la schermata di conferma per il ritiro del premio.</li>
              <li>Non &egrave; consentito l&apos;uso di script, bot o sistemi automatizzati per votare.</li>
              <li>Non &egrave; consentita la compravendita o lo scambio di voti.</li>
            </ul>
          </section>

          <section id="prize" aria-labelledby="prize-heading">
            <h2 id="prize-heading">{t('terms.prizeCollection')}</h2>
            <p>{t('terms.prizeDetails')}</p>
            <p><strong>{t('terms.fairDates')}</strong></p>
            <p>{t('terms.gadget')}</p>
            <p>{t('terms.noCashAlternative')}</p>
            <p>{t('terms.unclaimedForfeited')}</p>
          </section>

          <section id="ip" aria-labelledby="ip-heading">
            <h2 id="ip-heading">{t('terms.intellectualProperty')}</h2>
            <ul>
              <li><strong>{t('terms.brandOwnership')}</strong></li>
              <li><strong>{t('terms.companyLogos')}</strong></li>
              <li><strong>{t('terms.voteAttribution')}</strong></li>
            </ul>
          </section>

          <section id="user-content" aria-labelledby="user-content-heading">
            <h2 id="user-content-heading">{t('terms.userContent')}</h2>
            <p>{t('terms.userContentDesc')}</p>
          </section>

          <section id="disclaimer" aria-labelledby="disclaimer-heading">
            <h2 id="disclaimer-heading">{t('terms.disclaimer')}</h2>
            <p>{t('terms.disclaimerDesc')}</p>
          </section>

          <section id="limitation" aria-labelledby="limitation-heading">
            <h2 id="limitation-heading">{t('terms.limitation')}</h2>
            <ul>
              <li><strong>{t('terms.maxLiability')}</strong></li>
              <li><strong>{t('terms.noIndirectDamages')}</strong></li>
            </ul>
          </section>

          <section id="termination" aria-labelledby="termination-heading">
            <h2 id="termination-heading">{t('terms.termination')}</h2>
            <ul>
              <li><strong>{t('terms.organizerMayEnd')}</strong></li>
              <li><strong>{t('terms.userMayStop')}</strong></li>
              <li><strong>{t('terms.provisionsSurvive')}</strong></li>
            </ul>
          </section>

          <section id="governing-law" aria-labelledby="governing-law-heading">
            <h2 id="governing-law-heading">{t('terms.governingLaw')}</h2>
            <ul>
              <li><strong>{t('terms.italianLaw')}</strong></li>
              <li><strong>{t('terms.tribunalReggio')}</strong></li>
            </ul>
          </section>

          <section id="changes" aria-labelledby="changes-heading">
            <h2 id="changes-heading">{t('terms.changes')}</h2>
            <p>{t('terms.changesDesc')}</p>
          </section>

          <section id="contact" aria-labelledby="contact-heading">
            <h2 id="contact-heading">{t('terms.contact')}</h2>
            <p>{t('terms.contactDesc')}</p>
          </section>
        </div>
      </details>
    </LegalPageLayout>
  )
}
