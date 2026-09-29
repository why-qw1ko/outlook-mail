import { cn } from '@/lib/utils'

export function MailIllustration({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 320 220" fill="none" aria-hidden="true" className={cn('text-foreground', className)}>
      <ellipse cx="160" cy="194" rx="108" ry="10" fill="hsl(var(--secondary) / .10)" />
      <circle cx="247" cy="58" r="30" fill="hsl(var(--tertiary))" />
      <circle cx="62" cy="143" r="24" fill="hsl(var(--primary) / .16)" />
      <rect x="70" y="79" width="180" height="111" rx="16" fill="hsl(var(--secondary))" stroke="currentColor" strokeWidth="2.5" />
      <rect x="94" y="30" width="132" height="128" rx="10" fill="hsl(var(--card))" stroke="currentColor" strokeWidth="2.5" transform="rotate(-6 160 94)" />
      <path d="M119 65L182 59M121 82L202 74M123 99L174 94" stroke="hsl(var(--secondary))" strokeWidth="5" strokeLinecap="round" />
      <path d="M72 93L150 146Q160 154 170 146L248 93V174Q248 190 232 190H88Q72 190 72 174Z" fill="hsl(var(--primary))" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M74 184L129 138M246 184L192 138" stroke="currentColor" strokeWidth="2.5" />
      <path d="M47 58V72M40 65H54M270 133V147M263 140H277" stroke="hsl(var(--secondary))" strokeWidth="3" strokeLinecap="round" />
      <circle cx="255" cy="61" r="17" fill="hsl(var(--tertiary))" stroke="currentColor" strokeWidth="2.5" />
      <path d="M248 61L253 66L263 56" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
