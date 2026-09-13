import type { Metadata } from 'next'
import { dictionaries } from '@/i18n'
import { LegalPageLayout, LegalSection, type LegalSectionDef } from '@/components/legal/legal-page-layout'
import { getLegalLocale, makeLegalT } from '@/lib/legal'
import type { DictionaryKey } from '@/i18n/dictionary'

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLegalLocale()
  return { title: `${dictionaries[locale]['cookiePolicy.title']} — FANTACER` }
}

const TABLE_HEADERS = ['cookiePolicy.tableCookie', 'cookiePolicy.tablePurpose', 'cookiePolicy.tableDuration', 'cookiePolicy.tableProvider'] as const

interface CookieRow {
  cookie: string
  purposeKey: DictionaryKey
  durationKey: DictionaryKey
  provider: string
}

function CookieTable({ rows, t }: { rows: CookieRow[]; t: ReturnType<typeof makeLegalT> }) {
  return (
    <div className="table-scroll">
      <table className="cookie-table table-card-mobile">
        <thead>
          <tr>
            {TABLE_HEADERS.map((h) => (
              <th key={h}>{t(h)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              <td data-label={t(TABLE_HEADERS[0])}><code>{row.cookie}</code></td>
              <td data-label={t(TABLE_HEADERS[1])}>{t(row.purposeKey)}</td>
              <td data-label={t(TABLE_HEADERS[2])}>{t(row.durationKey)}</td>
              <td data-label={t(TABLE_HEADERS[3])}>{row.provider}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default async function CookiePolicyPage() {
  const locale = await getLegalLocale()
  const t = makeLegalT(locale)

  const sections: LegalSectionDef[] = [
    { id: 'what-are-cookies', headingKey: 'cookiePolicy.whatAreCookies' },
    { id: 'categories', headingKey: 'cookiePolicy.categories' },
    { id: 'third-party', headingKey: 'cookiePolicy.thirdParty' },
    { id: 'manage', headingKey: 'cookiePolicy.howToManage' },
    { id: 'contact', headingKey: 'cookiePolicy.contact' },
  ]

  const essentialCookies: CookieRow[] = [
    { cookie: 'supabase-auth-token', purposeKey: 'cookiePolicy.essentialDesc', durationKey: 'cookiePolicy.duration.session', provider: 'Supabase' },
    { cookie: 'fantacer_locale', purposeKey: 'cookiePolicy.essentialDesc', durationKey: 'cookiePolicy.duration.oneYear', provider: 'Fantacer' },
    { cookie: 'fantacer_cookie_consent', purposeKey: 'cookiePolicy.essentialDesc', durationKey: 'cookiePolicy.duration.oneYear', provider: 'Fantacer' },
    { cookie: 'cf_turnstile_*', purposeKey: 'cookiePolicy.essentialDesc', durationKey: 'cookiePolicy.duration.session', provider: 'Cloudflare' },
  ]

  const analyticsCookies: CookieRow[] = [
    { cookie: '_ga, _ga_*', purposeKey: 'cookiePolicy.analyticsDesc', durationKey: 'cookiePolicy.duration.twoYears', provider: 'Google' },
  ]

  return (
    <LegalPageLayout
      titleKey="cookiePolicy.title"
      lastUpdatedKey="cookiePolicy.lastUpdated"
      intro="cookiePolicy.intro"
      sections={sections}
    >
      <LegalSection id="what-are-cookies" headingKey="cookiePolicy.whatAreCookies">
        <p>{t('cookiePolicy.whatAreCookiesDesc')}</p>
      </LegalSection>

      <LegalSection id="categories" headingKey="cookiePolicy.categories">
        <p>{t('cookiePolicy.categoriesIntro')}</p>

        <h3>{t('cookiePolicy.essential')}</h3>
        <p>{t('cookiePolicy.essentialDesc')}</p>
        <CookieTable rows={essentialCookies} t={t} />

        <h3>{t('cookiePolicy.analytics')}</h3>
        <p>{t('cookiePolicy.analyticsDesc')}</p>
        <CookieTable rows={analyticsCookies} t={t} />
        <p className="muted">{t('cookiePolicy.ga4Note')}</p>
      </LegalSection>

      <LegalSection id="third-party" headingKey="cookiePolicy.thirdParty">
        <p className="muted">{t('cookiePolicy.thirdPartyDesc')}</p>
        <ul>
          <li><a href="https://supabase.com/privacy" target="_blank" rel="noopener noreferrer">{t('cookiePolicy.linkSupabase')}</a></li>
          <li><a href="https://resend.com/privacy" target="_blank" rel="noopener noreferrer">{t('cookiePolicy.linkResend')}</a></li>
          <li><a href="https://www.cloudflare.com/privacypolicy/" target="_blank" rel="noopener noreferrer">{t('cookiePolicy.linkCloudflare')}</a></li>
          <li><a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">{t('cookiePolicy.linkGoogle')}</a></li>
        </ul>
      </LegalSection>

      <LegalSection id="manage" headingKey="cookiePolicy.howToManage">
        <p>{t('cookiePolicy.browserSettings')}</p>
        <ul>
          <li><a href="https://support.google.com/chrome/answer/95647" target="_blank" rel="noopener noreferrer">Chrome</a></li>
          <li><a href="https://support.mozilla.org/kb/clear-cookies-and-site-data-firefox" target="_blank" rel="noopener noreferrer">Firefox</a></li>
          <li><a href="https://support.apple.com/guide/safari/manage-cookies-and-website-data-sfri11471/mac" target="_blank" rel="noopener noreferrer">Safari</a></li>
          <li><a href="https://support.microsoft.com/edge/delete-cookies-in-microsoft-edge-63947406-40ac-c3b8-57b9-2a946a29ae09" target="_blank" rel="noopener noreferrer">Edge</a></li>
        </ul>
        <p className="muted">{t('cookiePolicy.reopenBanner')}</p>
      </LegalSection>

      <LegalSection id="contact" headingKey="cookiePolicy.contactHeading">
        <p>{t('cookiePolicy.contact')}</p>
      </LegalSection>
    </LegalPageLayout>
  )
}
