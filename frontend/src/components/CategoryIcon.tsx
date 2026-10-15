import type { CategoryColor, CategoryIcon as CategoryIconName } from '../types/Category'

function IconPaths({ icon }: { readonly icon: CategoryIconName }) {
  switch (icon) {
    case 'HEART': return <path d="M12 20.5S4 15.4 4 9.5A4.5 4.5 0 0 1 12 6.7a4.5 4.5 0 0 1 8 2.8c0 5.9-8 11-8 11Z" />
    case 'BRIEFCASE': return <><rect x="3" y="7" width="18" height="12" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18M10 12v2h4v-2" /></>
    case 'HOME': return <><path d="m3 11 9-8 9 8" /><path d="M5 10v11h14V10M9 21v-7h6v7" /></>
    case 'BOOK': return <><path d="M4 4.5A3.5 3.5 0 0 1 7.5 8H12v13H7.5A3.5 3.5 0 0 0 4 17.5Z" /><path d="M20 4.5A3.5 3.5 0 0 0 16.5 8H12v13h4.5a3.5 3.5 0 0 1 3.5-3.5Z" /></>
    case 'DUMBBELL': return <><path d="M6 7v10M3 9v6M18 7v10M21 9v6M6 12h12" /></>
    case 'WALLET': return <><path d="M4 6h14a2 2 0 0 1 2 2v11H4a2 2 0 0 1-2-2V6a3 3 0 0 1 3-3h12v3" /><path d="M15 11h7v5h-7a2.5 2.5 0 0 1 0-5Z" /></>
    case 'PEOPLE': return <><circle cx="9" cy="8" r="3" /><circle cx="17" cy="9" r="2.5" /><path d="M3 20a6 6 0 0 1 12 0M14 15a5 5 0 0 1 7 4.5" /></>
    case 'STAR': return <path d="m12 2.5 2.9 5.9 6.5 1-4.7 4.5 1.1 6.4-5.8-3-5.8 3 1.1-6.4-4.7-4.5 6.5-1Z" />
    case 'LEAF': return <><path d="M20.5 3.5C12 3 5 6.5 5 13a6 6 0 0 0 6 6c6.5 0 9-7 9.5-15.5Z" /><path d="M4 21c2.5-6 6.5-9.5 12-12" /></>
    case 'RUNNING': return <><circle cx="14" cy="4" r="2" /><path d="m10 8 4 2 2 4M10 8l-3 4M14 10l-3 4 4 6M11 14l-5 5M15 14l4-1" /></>
    case 'UTENSILS': return <><path d="M6 3v8M3.5 3v5A2.5 2.5 0 0 0 6 10.5 2.5 2.5 0 0 0 8.5 8V3M6 10.5V21" /><path d="M17 3v18M17 3c-3 2-3 7 0 9" /></>
    case 'PLANE': return <path d="m3 11 7 2 4 8 2-1-1-7 6-4c1.5-1 1-3-1-2l-6 3-6-6-2 1 4 7" />
    case 'MUSIC': return <><path d="M9 18V5l11-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="17" cy="16" r="3" /></>
    case 'PALETTE': return <><path d="M12 3a9 9 0 1 0 0 18h1.5a2 2 0 0 0 0-4H12a2 2 0 0 1 0-4h4a5 5 0 0 0 5-5c0-3-4-5-9-5Z" /><circle cx="7" cy="9" r="1" /><circle cx="10" cy="6" r="1" /><circle cx="15" cy="7" r="1" /></>
    case 'CODE': return <><path d="m8 7-5 5 5 5M16 7l5 5-5 5M14 4l-4 16" /></>
    case 'MOON': return <path d="M20 15.5A8.5 8.5 0 0 1 8.5 4 8.5 8.5 0 1 0 20 15.5Z" />
    case 'SUN': return <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>
    case 'CAR': return <><path d="m4 15 1.5-6h13l1.5 6v5h-3v-2H7v2H4Z" /><path d="M6 15h12M8 12h.01M16 12h.01" /></>
    case 'SHOPPING_CART': return <><path d="M3 4h2l2.5 11h10l2-7H7" /><circle cx="9" cy="19" r="1.5" /><circle cx="17" cy="19" r="1.5" /></>
    case 'OTHER': return <><circle cx="12" cy="12" r="9" /><path d="M8 12h8M12 8v8" /></>
  }
}

export default function CategoryIcon({ icon, color }: {
  readonly icon: CategoryIconName
  readonly color: CategoryColor
}) {
  return <span className={`category-mark category-color-${color.toLowerCase()}`} aria-hidden="true">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round"><IconPaths icon={icon} /></svg>
  </span>
}
