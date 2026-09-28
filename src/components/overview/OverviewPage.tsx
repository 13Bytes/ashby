import type { ReactNode } from 'react'
import { LINKS, OVERVIEW_CONTENT, type OverviewContent } from '../../content/overviewContent'
import { cn } from '../../lib/utils'
import { useI18n } from '../../uiTranslations'
import { BrandLogo } from '../common/BrandLogo'
import { RichText, TextLink } from '../common/RichText'
import { Button } from '../ui/button'

type ColumnKind = OverviewContent['excelLegend'][number]['kind']
type FeatureIcon = OverviewContent['features'][number]['icon']

// Excerpt of backend/material_properties/MatWeb_materials_export_Spritzguss.xlsx (values as in the file).
const EXCEL_COLUMNS: Array<{ name: string; kind: ColumnKind }> = [
  { name: 'Gruppe', kind: 'text' },
  { name: 'Hersteller', kind: 'text' },
  { name: 'Variante', kind: 'text' },
  { name: 'Density low', kind: 'range' },
  { name: 'Density high', kind: 'range' },
  { name: 'Density unit', kind: 'unit' },
  { name: 'Tensile Strength Yield low', kind: 'range' },
  { name: 'Tensile Strength Yield high', kind: 'range' },
  { name: 'Tensile Strength Yield unit', kind: 'unit' },
]
const EXCEL_ROWS = [
  ['PC', 'Covestro', 'Makrolon 2405', '1.20', '', 'g/cc', '65', '', 'MPa'],
  ['PPSU', 'BASF', 'Ultrason P 3010', '1.29', '', 'g/cc', '74', '', 'MPa'],
  ['PET', 'Eastman', '7352 PET', '1.40', '', 'g/cc', '57', '', 'MPa'],
]
const EXCEL_QUANTITIES = ['Density', 'Tensile Strength Yield']

const KIND_HEADER: Record<ColumnKind, string> = {
  text: 'bg-violet-100 text-violet-900 dark:bg-violet-950/60 dark:text-violet-200',
  range: 'bg-brand-100 text-brand-900 dark:bg-brand-950/70 dark:text-brand-200',
  unit: 'bg-zinc-100 text-zinc-500 italic dark:bg-zinc-800/70 dark:text-zinc-400',
}
const KIND_CELL: Record<ColumnKind, string> = {
  text: 'bg-violet-50/60 dark:bg-violet-950/20',
  range: 'bg-brand-50/60 font-mono tabular-nums dark:bg-brand-950/25',
  unit: 'text-zinc-400 italic dark:text-zinc-500',
}
const KIND_SWATCH: Record<ColumnKind, string> = {
  text: 'bg-violet-200 ring-violet-400 dark:bg-violet-900 dark:ring-violet-600',
  range: 'bg-brand-200 ring-brand-400 dark:bg-brand-900 dark:ring-brand-600',
  unit: 'bg-zinc-100 ring-zinc-300 dark:bg-zinc-800 dark:ring-zinc-600',
}

// Hulls of the hero chart: color, outline and a few points inside.
const CHART_HULLS = [
  { name: 'PA', color: '#f59e0b', path: 'M92,252 C70,212 112,164 172,176 C232,188 302,220 292,250 C282,276 112,286 92,252Z', points: [[120, 246], [168, 236], [230, 232], [262, 250]] },
  { name: 'PC', color: '#219CD3', path: 'M140,178 C132,146 172,122 212,132 C252,142 262,176 238,196 C214,216 148,212 140,178Z', points: [[168, 170], [200, 160], [224, 182]] },
  { name: 'PLA', color: '#10b981', path: 'M102,214 C96,194 126,184 148,194 C170,204 164,228 142,232 C120,236 106,230 102,214Z', points: [[122, 214], [144, 210]] },
  { name: 'PPS', color: '#8b5cf6', path: 'M252,110 C262,80 332,70 370,84 C402,96 396,124 360,132 C320,140 246,136 252,110Z', points: [[284, 110], [322, 98], [360, 112]] },
  { name: 'PEEK', color: '#f43f5e', path: 'M386,150 C380,110 400,56 414,50 C428,46 426,96 419,130 C412,166 392,186 386,150Z', points: [[404, 90], [402, 140]] },
]

const iconProps = { viewBox: '0 0 20 20', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round', className: 'h-5 w-5', 'aria-hidden': true } as const

const FEATURE_ICONS: Record<FeatureIcon, ReactNode> = {
  layers: (
    <svg {...iconProps}>
      <path d="M10 3 3 6.5 10 10l7-3.5z" />
      <path d="m3 10 7 3.5 7-3.5" />
      <path d="m3 13.5 7 3.5 7-3.5" />
    </svg>
  ),
  palette: (
    <svg {...iconProps}>
      <path d="M10 2.5a7.5 7.5 0 1 0 0 15c1 0 1.5-.7 1.5-1.4 0-1.2-1-1.4-1-2.4 0-.8.7-1.2 1.5-1.2h2c1.8 0 3.5-1.3 3.5-3.5 0-3.6-3.4-6.5-7.5-6.5z" />
      <circle cx="6.5" cy="9" r=".9" fill="currentColor" />
      <circle cx="9" cy="6" r=".9" fill="currentColor" />
      <circle cx="12.8" cy="6.6" r=".9" fill="currentColor" />
    </svg>
  ),
  line: (
    <svg {...iconProps}>
      <path d="M3 17 17 3" strokeDasharray="2.5 2.5" />
      <circle cx="7" cy="9" r="2" />
      <circle cx="13" cy="13" r="2" />
    </svg>
  ),
  image: (
    <svg {...iconProps}>
      <rect x="2.5" y="4" width="15" height="12" rx="1.5" />
      <path d="m2.5 13 4-4 3.5 3.5 2.5-2.5 5 5" />
      <circle cx="13.5" cy="7.5" r="1.2" />
    </svg>
  ),
  file: (
    <svg {...iconProps}>
      <path d="M5 2.5h6.5L15 6v11.5H5z" />
      <path d="M8.5 9.5c-.8 0-1 .4-1 1v.5c0 .5-.3.8-.8 1 .5.2.8.5.8 1v.5c0 .6.2 1 1 1M11.5 9.5c.8 0 1 .4 1 1v.5c0 .5.3.8.8 1-.5.2-.8.5-.8 1v.5c0 .6-.2 1-1 1" />
    </svg>
  ),
  shield: (
    <svg {...iconProps}>
      <path d="M10 2.5 4 5v4.5c0 3.8 2.6 6.9 6 8 3.4-1.1 6-4.2 6-8V5z" />
      <path d="m7.5 10 2 2 3.5-3.5" />
    </svg>
  ),
}

const CheckIcon = () => (
  <svg viewBox="0 0 20 20" className="mt-0.5 h-4 w-4 shrink-0 text-brand-600 dark:text-brand-400" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="m5 10.5 3 3 7-7" />
  </svg>
)

const ArrowIcon = () => (
  <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 10h12M11 5l5 5-5 5" />
  </svg>
)

const MailIcon = () => (
  <svg {...iconProps}>
    <rect x="2.5" y="4.5" width="15" height="11" rx="1.5" />
    <path d="m3 5.5 7 5.5 7-5.5" />
  </svg>
)
const HeartIcon = () => (
  <svg {...iconProps}>
    <path d="M10 16.5s-6.5-3.8-6.5-8.3A3.6 3.6 0 0 1 10 6.3a3.6 3.6 0 0 1 6.5 1.9c0 4.5-6.5 8.3-6.5 8.3z" />
  </svg>
)
const MegaphoneIcon = () => (
  <svg {...iconProps}>
    <path d="M3 8.5v3h2.5l6 3.5v-10l-6 3.5z" />
    <path d="M14.5 7.5a3.5 3.5 0 0 1 0 5M6 11.5l1 4.5h2l-.8-3.6" />
  </svg>
)
const CodeIcon = () => (
  <svg {...iconProps}>
    <path d="m7 6-4 4 4 4M13 6l4 4-4 4M11 4.5l-2 11" />
  </svg>
)
const InstagramIcon = () => (
  <svg {...iconProps} className="h-4 w-4">
    <rect x="3" y="3" width="14" height="14" rx="4" />
    <circle cx="10" cy="10" r="3.2" />
    <circle cx="14.2" cy="5.8" r=".6" fill="currentColor" />
  </svg>
)
const LinkedInIcon = () => (
  <svg {...iconProps} className="h-4 w-4">
    <rect x="3" y="3" width="14" height="14" rx="2.5" />
    <path d="M7 9v4.5M7 6.6v.1M10 13.5V9M10 11c0-1.2.9-2 2-2s2 .8 2 2v2.5" />
  </svg>
)
const GitHubIcon = () => (
  <svg {...iconProps} className="h-4 w-4">
    <path d="M7.5 16.5c-3 .9-3-1.5-4.5-2M12.5 17.5v-2.6c0-.8.1-1.3-.4-1.8 2.3-.3 4.4-1.1 4.4-4.9a3.8 3.8 0 0 0-1-2.7 3.6 3.6 0 0 0-.1-2.7s-.9-.3-2.8 1a9.6 9.6 0 0 0-5 0c-1.9-1.3-2.8-1-2.8-1a3.6 3.6 0 0 0-.1 2.7 3.8 3.8 0 0 0-1 2.7c0 3.8 2.1 4.6 4.4 4.9-.5.5-.5 1-.4 1.8v2.6" />
  </svg>
)

function SupportCard({ icon, title, text, children }: { icon: ReactNode; title: string; text: string; children: ReactNode }) {
  return (
    <div className="flex flex-col rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <span className="grid h-9 w-9 place-items-center rounded-lg bg-violet-50 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300">{icon}</span>
      <h3 className="m-0 mt-3 text-base font-semibold text-zinc-900 dark:text-zinc-100">{title}</h3>
      <p className="m-0 mt-1 flex-1 text-sm text-zinc-600 dark:text-zinc-400">{text}</p>
      <div className="mt-3 text-sm">{children}</div>
    </div>
  )
}

function SocialLink({ href, label, children }: { href: string; label: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1.5 rounded-full border border-zinc-300 px-2.5 py-1 text-xs font-medium text-zinc-700 hover:border-brand-400 hover:text-brand-700 dark:border-zinc-700 dark:text-zinc-300 dark:hover:text-brand-300"
    >
      {children}
      {label}
    </a>
  )
}

function SectionHeading({ eyebrow, title, children }: { eyebrow?: string; title: string; children?: ReactNode }) {
  return (
    <div className="max-w-2xl">
      {eyebrow ? <p className="m-0 mb-2 text-xs font-semibold uppercase tracking-wider text-brand-600 dark:text-brand-400">{eyebrow}</p> : null}
      <h2 className="m-0 text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl dark:text-zinc-50">{title}</h2>
      {children ? <p className="m-0 mt-3 text-base text-zinc-600 dark:text-zinc-400">{children}</p> : null}
    </div>
  )
}

/** A made-up Ashby plot in the style of the rendered ones: hulls per family, a guideline and a legend. */
function HeroChart({ content }: { content: OverviewContent }) {
  return (
    <figure className="m-0 rounded-2xl border border-zinc-200 bg-white/80 p-4 shadow-xl shadow-brand-900/5 backdrop-blur sm:p-5 dark:border-zinc-800 dark:bg-zinc-900/80 dark:shadow-black/30">
      <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-600 dark:text-zinc-400">
        {CHART_HULLS.map((hull) => (
          <span key={hull.name} className="flex items-center gap-1.5">
            <span className="h-2.5 w-4 rounded-sm" style={{ backgroundColor: hull.color }} />
            {hull.name}
          </span>
        ))}
      </div>
      <svg viewBox="0 0 470 320" className="h-auto w-full" role="img" aria-label={`${content.chartY} / ${content.chartX}`}>
        <g className="stroke-zinc-200 dark:stroke-zinc-800" strokeDasharray="3 4">
          {[70, 130, 190, 250].map((y) => <line key={y} x1="50" x2="455" y1={y} y2={y} />)}
          {[130, 210, 290, 370].map((x) => <line key={x} x1={x} x2={x} y1="20" y2="290" />)}
        </g>
        <line x1="60" y1="286" x2="440" y2="42" className="stroke-zinc-400 dark:stroke-zinc-500" strokeWidth="1.5" strokeDasharray="7 5" />
        <text x="372" y="28" textAnchor="end" className="fill-zinc-500 text-[12px] italic dark:fill-zinc-400">{content.chartGuideline}</text>
        {CHART_HULLS.map((hull) => (
          <g key={hull.name}>
            <path d={hull.path} fill={hull.color} fillOpacity="0.22" stroke={hull.color} strokeWidth="1.8" />
            {hull.points.map(([cx, cy]) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="3" fill={hull.color} />)}
          </g>
        ))}
        <path d="M50,20 L50,290 L455,290" fill="none" className="stroke-zinc-700 dark:stroke-zinc-300" strokeWidth="2" strokeLinecap="round" />
        <text x="252" y="314" textAnchor="middle" className="fill-zinc-600 text-[13px] dark:fill-zinc-300">{content.chartX} →</text>
        <text x="-155" y="30" transform="rotate(-90)" textAnchor="middle" className="fill-zinc-600 text-[13px] dark:fill-zinc-300">{content.chartY} →</text>
      </svg>
    </figure>
  )
}

function ExcelDiagram({ content }: { content: OverviewContent }) {
  const groups = [
    { label: content.excelGroupText, span: 3, kind: 'text' as const },
    ...EXCEL_QUANTITIES.map((name) => ({ label: content.excelGroupQuantity.replace('{name}', name), span: 3, kind: 'range' as const })),
  ]
  return (
    <figure className="m-0">
      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <table className="w-full border-collapse text-left text-[13px]">
          <thead>
            <tr>
              <th className="w-8 border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900" />
              {groups.map((group) => (
                <th key={group.label} colSpan={group.span} className="border-b border-l border-zinc-200 px-3 pb-1.5 pt-2.5 align-bottom font-normal dark:border-zinc-800">
                  <span className={cn('inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold', KIND_HEADER[group.kind], 'not-italic')}>{group.label}</span>
                </th>
              ))}
              <th className="border-b border-l border-zinc-200 dark:border-zinc-800" />
            </tr>
            <tr>
              <th className="border-b border-zinc-200 bg-zinc-50 px-2 py-1.5 text-center font-mono text-[11px] font-normal text-zinc-400 dark:border-zinc-800 dark:bg-zinc-900">1</th>
              {EXCEL_COLUMNS.map((column) => (
                <th key={column.name} className={cn('whitespace-nowrap border-b border-l border-zinc-200 px-3 py-1.5 font-semibold dark:border-zinc-800', KIND_HEADER[column.kind])}>
                  {column.name}
                </th>
              ))}
              <th className="border-b border-l border-zinc-200 px-3 py-1.5 text-zinc-400 dark:border-zinc-800">…</th>
            </tr>
          </thead>
          <tbody>
            {EXCEL_ROWS.map((row, rowIndex) => (
              <tr key={row[2]}>
                <td className="border-b border-zinc-100 bg-zinc-50 px-2 py-1.5 text-center font-mono text-[11px] text-zinc-400 dark:border-zinc-800 dark:bg-zinc-900">{rowIndex + 2}</td>
                {row.map((value, columnIndex) => (
                  <td key={EXCEL_COLUMNS[columnIndex].name} className={cn('whitespace-nowrap border-b border-l border-zinc-100 px-3 py-1.5 text-zinc-800 dark:border-zinc-800 dark:text-zinc-200', KIND_CELL[EXCEL_COLUMNS[columnIndex].kind])}>
                    {value}
                  </td>
                ))}
                <td className="border-b border-l border-zinc-100 px-3 py-1.5 text-zinc-300 dark:border-zinc-800 dark:text-zinc-600">…</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <figcaption className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">{content.excelCaption}</figcaption>
    </figure>
  )
}

export function OverviewPage({ onOpenEditor, onOpenPrivacy }: { onOpenEditor: () => void; onOpenPrivacy: () => void }) {
  const { language } = useI18n()
  const content = OVERVIEW_CONTENT[language]

  const openButton = (
    <Button onClick={onOpenEditor} className="h-11 gap-2 px-5 text-base shadow-sm">
      {content.openEditor}
      <ArrowIcon />
    </Button>
  )

  return (
    <div className="min-h-0 flex-1 overflow-auto">
      {/* Hero */}
      <section className="border-b border-zinc-200 bg-linear-to-b from-brand-50 to-white dark:border-zinc-800 dark:from-brand-950/50 dark:to-zinc-950">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-6 py-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:py-20">
          <div>
            <p className="m-0 mb-4 inline-flex items-center gap-2 rounded-full border border-brand-200 bg-white/70 px-3 py-1 text-xs font-semibold text-brand-700 dark:border-brand-900 dark:bg-brand-950/60 dark:text-brand-300">
              <BrandLogo className="h-3.5 w-3.5" />
              {content.eyebrow}
            </p>
            <h2 className="m-0 text-4xl font-semibold tracking-tight text-zinc-900 sm:text-5xl dark:text-zinc-50">{content.title}</h2>
            <p className="m-0 mt-5 max-w-xl text-lg text-zinc-600 dark:text-zinc-300">{content.lead}</p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              {openButton}
              <span className="text-sm text-zinc-500 dark:text-zinc-400">{content.keptNote}</span>
            </div>
          </div>
          <HeroChart content={content} />
        </div>
      </section>

      <div className="mx-auto grid max-w-6xl gap-20 px-6 py-16">
        {/* Motivation */}
        <section className="grid gap-8 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] lg:items-center">
          <div>
            <SectionHeading title={content.whyHeading} />
            <div className="mt-4 grid gap-3 text-base text-zinc-600 dark:text-zinc-400">
              {content.whyParagraphs.map((parts, index) => (
                <p key={index} className="m-0"><RichText parts={parts} /></p>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-6 dark:border-zinc-800 dark:bg-zinc-900">
            <p className="m-0 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">{content.whyStatsCaption}</p>
            <dl className="m-0 mt-4 grid grid-cols-3 gap-4">
              {content.whyStats.map((stat) => (
                <div key={stat.label}>
                  <dt className="sr-only">{stat.label}</dt>
                  <dd className="m-0 text-3xl font-semibold tabular-nums text-brand-600 dark:text-brand-400">{stat.value}</dd>
                  <dd className="m-0 mt-1 text-sm text-zinc-600 dark:text-zinc-400">{stat.label}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* How to use it */}
        <section>
          <SectionHeading title={content.stepsHeading} />
          <ol className="m-0 mt-8 grid list-none gap-4 p-0 sm:grid-cols-2 lg:grid-cols-4">
            {content.steps.map((step, index) => (
              <li key={step.title} className="relative rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-brand-600 text-sm font-semibold text-white">{index + 1}</span>
                <h3 className="m-0 mt-4 text-base font-semibold text-zinc-900 dark:text-zinc-100">{step.title}</h3>
                <p className="m-0 mt-1.5 text-sm text-zinc-600 dark:text-zinc-400">{step.text}</p>
              </li>
            ))}
          </ol>
          <p className="m-0 mt-5 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
            <span aria-hidden="true" className="text-base leading-5">💡</span>
            {content.tip}
          </p>
        </section>

        {/* Excel structure */}
        <section>
          <SectionHeading title={content.excelHeading}>{content.excelLead}</SectionHeading>
          <div className="mt-8">
            <ExcelDiagram content={content} />
          </div>
          <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <ul className="m-0 grid list-none content-start gap-4 p-0">
              {content.excelLegend.map((entry) => (
                <li key={entry.kind} className="flex gap-3">
                  <span className={cn('mt-1 h-4 w-4 shrink-0 rounded ring-1', KIND_SWATCH[entry.kind])} />
                  <div>
                    <p className="m-0 font-mono text-sm font-semibold text-zinc-900 dark:text-zinc-100">{entry.title}</p>
                    <p className="m-0 mt-0.5 text-sm text-zinc-600 dark:text-zinc-400">{entry.text}</p>
                  </div>
                </li>
              ))}
            </ul>
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-5 dark:border-zinc-800 dark:bg-zinc-900">
              <h3 className="m-0 text-sm font-semibold text-zinc-900 dark:text-zinc-100">{content.excelRulesHeading}</h3>
              <ul className="m-0 mt-3 grid list-none gap-2.5 p-0">
                {content.excelRules.map((rule) => (
                  <li key={rule} className="flex gap-2.5 text-sm text-zinc-600 dark:text-zinc-400">
                    <CheckIcon />
                    <span>{rule}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Features */}
        <section>
          <SectionHeading title={content.featuresHeading} />
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {content.features.map((feature) => (
              <div key={feature.title} className="rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-50 text-brand-700 dark:bg-brand-950/60 dark:text-brand-300">{FEATURE_ICONS[feature.icon]}</span>
                <h3 className="m-0 mt-3 text-base font-semibold text-zinc-900 dark:text-zinc-100">{feature.title}</h3>
                <p className="m-0 mt-1 text-sm text-zinc-600 dark:text-zinc-400">{feature.text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Feedback and support */}
        <section>
          <SectionHeading title={content.supportHeading}>{content.supportLead}</SectionHeading>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <SupportCard icon={<MailIcon />} title={content.feedbackTitle} text={content.feedbackText}>
              <TextLink href={LINKS.feedback}>{LINKS.feedbackAddress}</TextLink>
            </SupportCard>
            <SupportCard icon={<HeartIcon />} title={content.donateTitle} text={content.donateText}>
              <TextLink href={LINKS.donate}>{content.donateLink}</TextLink>
            </SupportCard>
            <SupportCard icon={<MegaphoneIcon />} title={content.followTitle} text={content.followText}>
              <div className="flex flex-wrap gap-2">
                <SocialLink href={LINKS.instagram} label="Instagram"><InstagramIcon /></SocialLink>
                <SocialLink href={LINKS.linkedin} label="LinkedIn"><LinkedInIcon /></SocialLink>
                <SocialLink href={LINKS.github} label="GitHub"><GitHubIcon /></SocialLink>
              </div>
            </SupportCard>
            <SupportCard icon={<CodeIcon />} title={content.sourceTitle} text={content.sourceText}>
              <TextLink href={LINKS.repository}>{content.sourceLink}</TextLink>
            </SupportCard>
          </div>
        </section>

        {/* Call to action */}
        <section className="flex flex-col items-start gap-5 rounded-2xl bg-brand-600 p-8 text-white sm:flex-row sm:items-center sm:justify-between dark:bg-brand-800">
          <div className="max-w-xl">
            <h2 className="m-0 text-2xl font-semibold tracking-tight">{content.ctaHeading}</h2>
            <p className="m-0 mt-2 text-sm text-brand-50">{content.ctaText}</p>
          </div>
          <Button onClick={onOpenEditor} className="h-11 shrink-0 gap-2 bg-white px-5 text-base text-brand-700 hover:bg-brand-50 dark:bg-white dark:text-brand-800">
            {content.openEditor}
            <ArrowIcon />
          </Button>
        </section>
      </div>

      <footer className="border-t border-zinc-200 dark:border-zinc-800">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-6 py-6 text-sm text-zinc-500 dark:text-zinc-400">
          <span className="flex items-center gap-2 font-semibold text-zinc-800 dark:text-zinc-200">
            <BrandLogo className="h-4 w-4" />
            PolyPlot
          </span>
          <span>{content.footerMadeFor} <TextLink href={LINKS.repolysat}>RePolySat</TextLink> · <TextLink href={LINKS.aerospaceLab}>Aerospace Lab</TextLink></span>
          <span>
            {content.footerBackend} <TextLink href="https://github.com/afffe18">afffe18</TextLink>, {content.footerBasedOn}{' '}
            <TextLink href="https://github.com/walgren/Ashby-plots">walgren/Ashby-plots</TextLink>
          </span>
          <span>
            {content.footerUi} <TextLink href="https://github.com/afffe18">afffe18</TextLink> & <TextLink href="https://github.com/13Bytes">13Bytes</TextLink>
          </span>
          <nav className="flex gap-4 sm:ml-auto">
            <TextLink href={LINKS.imprint}>{content.footerImprint}</TextLink>
            <button type="button" onClick={onOpenPrivacy} className="font-medium text-zinc-700 underline decoration-zinc-300 underline-offset-2 hover:text-brand-700 hover:decoration-brand-400 dark:text-zinc-200 dark:decoration-zinc-600 dark:hover:text-brand-300">
              {content.footerPrivacy}
            </button>
            <TextLink href={LINKS.repository}>GitHub</TextLink>
          </nav>
        </div>
      </footer>
    </div>
  )
}
