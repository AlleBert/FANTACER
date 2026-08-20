import { useLocale } from '@/lib/LocaleContext'
import type { SelectedCompany } from '@/lib/VoteContext'

interface VoteReceiptProps {
  companies: SelectedCompany[]
}

export function VoteReceipt({ companies }: VoteReceiptProps) {
  const { t } = useLocale()
  if (companies.length === 0) return null

  return (
    <div className="w-full max-w-[280px] rotate-1 rounded-2xl border-2 border-ink bg-white px-4 py-3.5 text-left shadow-[3px_3px_0_#000]">
      <div className="mb-2.5 border-b-2 border-dashed border-ink pb-2 text-[10px] font-black uppercase tracking-widest text-purple">
        {t('success.receiptTitle')}
      </div>
      <ul className="flex flex-col gap-2.5">
        {companies.map((item, index) => (
          <li key={index} className="flex items-center justify-between gap-2">
            <span className="truncate text-sm font-bold text-ink">{item.company.name}</span>
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-ink bg-white text-sm font-black text-purple shadow-[2px_2px_0_#000]">
              {item.pallet}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
