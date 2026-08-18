import type { Metadata } from 'next'
import { LegalPage } from '@/components/legal/legal-page'
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
    title: `${dictionaries[locale]['cookiePolicy.title']} — FANTACER`,
  }
}

export default async function CookiePolicyPage() {
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

  const cookieTable = [
    {
      cookie: 'supabase-auth-token',
      purpose: t('cookiePolicy.essentialDesc'),
      duration: 'Sessione',
      provider: 'Supabase',
    },
    {
      cookie: 'fantacer_locale',
      purpose: 'Preferenza lingua',
      duration: '1 anno',
      provider: 'Fantacer',
    },
    {
      cookie: 'fantacer_cookie_consent',
      purpose: 'Registrazione consenso cookie',
      duration: '1 anno',
      provider: 'Fantacer',
    },
    {
      cookie: 'cf_turnstile_*',
      purpose: 'Protezione bot Turnstile',
      duration: 'Sessione',
      provider: 'Cloudflare',
    },
    {
      cookie: '_ga, _ga_*',
      purpose: 'Analytics Google (GA4)',
      duration: '2 anni',
      provider: 'Google',
    },
  ]

  const toc = [
    { id: 'what-are-cookies', label: t('cookiePolicy.whatAreCookies') },
    { id: 'categories', label: t('cookiePolicy.categories') },
    { id: 'essential', label: t('cookiePolicy.essential') },
    { id: 'analytics', label: t('cookiePolicy.analytics') },
    { id: 'third-party', label: t('cookiePolicy.thirdParty') },
    { id: 'manage', label: t('cookiePolicy.howToManage') },
    { id: 'contact', label: t('cookiePolicy.contact') },
  ]

  return (
    <LegalPage
      toc={toc}
      titleKey="cookiePolicy.title"
      lastUpdatedKey="cookiePolicy.lastUpdated"
    >
      <section id="intro" aria-labelledby="intro-heading">
        <p>{t('cookiePolicy.intro')}</p>
        <p>{t('cookiePolicy.whatAreCookiesDesc')}</p>
      </section>

      <section id="what-are-cookies" aria-labelledby="what-are-cookies-heading">
        <h2 id="what-are-cookies-heading">{t('cookiePolicy.whatAreCookies')}</h2>
        <p>{t('cookiePolicy.whatAreCookiesDesc')}</p>
      </section>

      <section id="categories" aria-labelledby="categories-heading">
        <h2 id="categories-heading">{t('cookiePolicy.categories')}</h2>
      </section>

      <section id="essential" aria-labelledby="essential-heading">
        <h2 id="essential-heading">{t('cookiePolicy.essential')}</h2>
        <p className="muted">{t('cookiePolicy.essentialDesc')}</p>
        <div className="table-scroll">
          <table className="cookie-table">
            <thead>
              <tr>
                <th>{t('cookiePolicy.tableCookie')}</th>
                <th>{t('cookiePolicy.tablePurpose')}</th>
                <th>{t('cookiePolicy.tableDuration')}</th>
                <th>{t('cookiePolicy.tableProvider')}</th>
              </tr>
            </thead>
            <tbody>
              {cookieTable
                .filter((c) => !c.cookie.includes('_ga'))
                .map((row, i) => (
                  <tr key={i}>
                    <td><code>{row.cookie}</code></td>
                    <td>{row.purpose}</td>
                    <td>{row.duration}</td>
                    <td>{row.provider}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>

      <section id="analytics" aria-labelledby="analytics-heading">
        <h2 id="analytics-heading">{t('cookiePolicy.analytics')}</h2>
        <p className="muted">{t('cookiePolicy.analyticsDesc')}</p>
        <div className="table-scroll">
          <table className="cookie-table">
            <thead>
              <tr>
                <th>{t('cookiePolicy.tableCookie')}</th>
                <th>{t('cookiePolicy.tablePurpose')}</th>
                <th>{t('cookiePolicy.tableDuration')}</th>
                <th>{t('cookiePolicy.tableProvider')}</th>
              </tr>
            </thead>
            <tbody>
              {cookieTable
                .filter((c) => c.cookie.includes('_ga'))
                .map((row, i) => (
                  <tr key={i}>
                    <td><code>{row.cookie}</code></td>
                    <td>{row.purpose}</td>
                    <td>{row.duration}</td>
                    <td>{row.provider}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        <p className="muted">{t('cookiePolicy.ga4Note')}</p>
      </section>

      <section id="third-party" aria-labelledby="third-party-heading">
        <h2 id="third-party-heading">{t('cookiePolicy.thirdParty')}</h2>
        <p className="muted">{t('cookiePolicy.thirdPartyDesc')}</p>
        <ul>
          <li><a href="https://supabase.com/privacy" target="_blank" rel="noopener noreferrer">Supabase Privacy Policy</a></li>
          <li><a href="https://resend.com/privacy" target="_blank" rel="noopener noreferrer">Resend Privacy Policy</a></li>
          <li><a href="https://www.cloudflare.com/privacypolicy/" target="_blank" rel="noopener noreferrer">Cloudflare Privacy Policy</a></li>
          <li><a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">Google Privacy Policy</a></li>
        </ul>
      </section>

      <section id="manage" aria-labelledby="manage-heading">
        <h2 id="manage-heading">{t('cookiePolicy.howToManage')}</h2>
        <p>{t('cookiePolicy.browserSettings')}</p>
        <ul>
          <li><a href="https://support.google.com/chrome/answer/95647" target="_blank" rel="noopener noreferrer">Chrome</a></li>
          <li><a href="https://support.mozilla.org/kb/clear-cookies-and-site-data-firefox" target="_blank" rel="noopener noreferrer">Firefox</a></li>
          <li><a href="https://support.apple.com/guide/safari/manage-cookies-and-website-data-sfri11471/mac" target="_blank" rel="noopener noreferrer">Safari</a></li>
          <li><a href="https://support.microsoft.com/edge/delete-cookies-in-microsoft-edge-63947406-40ac-c3b8-57b9-2a946a29ae09" target="_blank" rel="noopener noreferrer">Edge</a></li>
        </ul>
        <p>Puoi anche riaprire il banner delle preferenze cookie in qualsiasi momento cliccando su <strong>«Preferenze cookie»</strong> nel footer di questa pagina.</p>
      </section>

      <section id="contact" aria-labelledby="contact-heading">
        <h2 id="contact-heading">{t('cookiePolicy.contact')}</h2>
        <p>{t('cookiePolicy.contact')}</p>
      </section>
    </LegalPage>
  )
}