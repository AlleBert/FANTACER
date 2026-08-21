import { useLocale } from '@/lib/LocaleContext'
import type { SelectedCompany } from '@/lib/VoteContext'

interface VoteReceiptProps {
  companies: SelectedCompany[]
}

export function VoteReceipt({ companies }: VoteReceiptProps) {
  const { t } = useLocale()
  if (companies.length === 0) return null

  return (
    <div className="w-full rounded-2xl border-3 border-ink bg-white p-5 text-left shadow-[4px_4px_0_#000]">
      <div className="mb-4 border-b-2 border-dashed border-ink/30 pb-3">
        <h3 className="text-xs font-black uppercase tracking-widest text-purple">
          {t('success.receiptTitle')}
        </h3>
      </div>
      <ul className="flex flex-col gap-3">
        {companies.map((item, index) => (
          <li key={index} className="flex items-center justify-between gap-3">
            <span className="truncate text-base font-bold text-ink">{item.company.name}</span>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-ink bg-purple text-sm font-black text-white shadow-[2px_2px_0_#000]">
              {item.pallet}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
