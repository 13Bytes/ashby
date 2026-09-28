import type { UILanguage } from '../uiTranslations'

export const LINKS = {
  repolysat: 'https://aerospace-lab.de/repolysat/',
  aerospaceLab: 'https://aerospace-lab.de/',
  source2: 'https://ksat-stuttgart.de/en/projects/source-2/',
  imprint: 'https://aerospace-lab.de/impressum/',
  labPrivacy: 'https://aerospace-lab.de/datenschutz/',
  // The lab has no donation page; its bank details are on the home page (section "Verein").
  donate: 'https://aerospace-lab.de/',
  feedback: 'mailto:ashby@aerospace-lab.de',
  feedbackAddress: 'ashby@aerospace-lab.de',
  repository: 'https://github.com/13Bytes/ashby',
  instagram: 'https://www.instagram.com/aerospace_lab/',
  linkedin: 'https://www.linkedin.com/company/aerospacelab-herrenberg',
  github: 'https://github.com/Aerospace-Lab-e-V/',
} as const

/** Text with links: plain strings and linked parts. */
export type RichText = Array<string | { text: string; href: string }>

/** Texts of the overview page shown when the app opens. Every language provides every field. */
export type OverviewContent = {
  eyebrow: string
  title: string
  lead: string
  openEditor: string
  keptNote: string
  chartX: string
  chartY: string
  chartGuideline: string

  whyHeading: string
  whyParagraphs: RichText[]
  whyStats: Array<{ value: string; label: string }>
  whyStatsCaption: string

  stepsHeading: string
  steps: Array<{ title: string; text: string }>
  tip: string

  excelHeading: string
  excelLead: string
  excelGroupText: string
  excelGroupQuantity: string
  excelCaption: string
  excelLegend: Array<{ kind: 'text' | 'range' | 'unit'; title: string; text: string }>
  excelRulesHeading: string
  excelRules: string[]

  featuresHeading: string
  features: Array<{ icon: 'layers' | 'palette' | 'line' | 'image' | 'file' | 'shield'; title: string; text: string }>

  ctaHeading: string
  ctaText: string

  supportHeading: string
  supportLead: string
  feedbackTitle: string
  feedbackText: string
  donateTitle: string
  donateText: string
  donateLink: string
  followTitle: string
  followText: string
  sourceTitle: string
  sourceText: string
  sourceLink: string

  footerImprint: string
  footerPrivacy: string
  footerMadeFor: string
  footerBackend: string
  footerBasedOn: string
  footerUi: string
}

const en: OverviewContent = {
  eyebrow: 'Ashby plots for material selection',
  title: 'Compare materials at a glance.',
  lead: 'PolyPlot turns a spreadsheet of material properties into Ashby plots: two properties against each other, one colored hull per material family, rendered live while you adjust it.',
  openEditor: 'Open the editor',
  keptNote: 'Your current project is kept.',
  chartX: 'Density',
  chartY: 'Tensile strength',
  chartGuideline: 'σ/ρ = const',

  whyHeading: 'Why PolyPlot exists',
  whyParagraphs: [
    [
      'PolyPlot was created as part of the ',
      { text: 'RePolySat', href: LINKS.repolysat },
      ' project at the ',
      { text: 'Aerospace Lab', href: LINKS.aerospaceLab },
      ', a youth research center and non-profit association that gets school students excited about science and technology.',
    ],
    [
      'RePolySat aims to build a structural part for a ',
      { text: 'satellite', href: LINKS.source2 },
      ' from recycled polymers. We developed this tool to make it easier to choose a plastic that withstands space-grade requirements.',
    ],
  ],
  whyStats: [
    { value: '139', label: 'injection molding grades' },
    { value: '11', label: 'polymer families' },
    { value: '190', label: 'properties' },
  ],
  whyStatsCaption: 'The dataset we built PolyPlot for',

  stepsHeading: 'How to use it',
  steps: [
    { title: 'Bring your data', text: 'Upload an Excel workbook, pick a dataset provided on the server, or connect a Teable table.' },
    { title: 'Define the quantities', text: 'Name what you want to plot, such as density or tensile strength, and pick the columns it comes from.' },
    { title: 'Choose axes and groups', text: 'Pick X and Y and group the points by a column such as the polymer family. Each group gets its own hull.' },
    { title: 'Preview and export', text: 'The preview updates as you go. Download a plot as SVG or PNG, or all plots at once as a .zip.' },
  ],
  tip: 'Start in Simple mode: it hides everything that already works at its default. Fields marked in orange still need a value.',

  excelHeading: 'How to structure your Excel file',
  excelLead: 'One row per material, column names in the first row. PolyPlot finds the quantities by their column names.',
  excelGroupText: 'Text columns',
  excelGroupQuantity: 'Quantity “{name}”',
  excelCaption: 'Excerpt from MatWeb_materials_export_Spritzguss.xlsx (injection molding grades exported from MatWeb)',
  excelLegend: [
    { kind: 'text', title: 'Text columns', text: 'Group the points into hulls and name the materials in the legend, e.g. the polymer family.' },
    { kind: 'range', title: '“<name> low” and “<name> high”', text: 'The values of one quantity. Leave “high” empty for a single value, fill in both for a range.' },
    { kind: 'unit', title: '“<name> unit”', text: 'Optional and not read by the plot. Put the unit into the axis label instead.' },
  ],
  excelRulesHeading: 'Checklist',
  excelRules: [
    'Column names in the first row, no title rows above them.',
    'Every quantity needs both columns, spelled exactly “<name> low” and “<name> high”.',
    'Values are numbers. A decimal comma (“1,5”) works too; text in a value cell is skipped.',
    'Empty cells are fine: a material without a value is left out of that plot.',
    'One axis can combine several quantities, e.g. “Tensile Strength Yield” and “Tensile Strength at Break”: PolyPlot takes the first value found, the lowest, the highest or the whole span.',
    'Any other columns, such as links or notes, are ignored.',
  ],

  featuresHeading: 'What else it can do',
  features: [
    { icon: 'layers', title: 'Many datasets and plots', text: 'Shared settings per dataset, a list of plots, one click to render them all.' },
    { icon: 'palette', title: 'Consistent colors', text: 'A material keeps its color in every plot of a dataset.' },
    { icon: 'line', title: 'Reference lines and notes', text: 'Colored areas, guidelines of constant ratio and annotations with arrows.' },
    { icon: 'image', title: 'Ready for print and slides', text: 'SVG or PNG, transparent, white or dark background, labels in several languages.' },
    { icon: 'file', title: 'The project as one file', text: 'Save everything as a .json and load it again later, or edit it directly.' },
    { icon: 'shield', title: 'Your data stays yours', text: 'The server does not keep uploaded workbooks, and the app loads nothing from other sites.' },
  ],

  ctaHeading: 'Ready to plot?',
  ctaText: 'Everything you set up is saved in this browser tab, so you can come back to this overview at any time via the PolyPlot logo.',

  supportHeading: 'Feedback and support',
  supportLead: 'PolyPlot is free to use. Tell us what works and what does not, and support the Aerospace Lab if you like.',
  feedbackTitle: 'Feedback & criticism',
  feedbackText: 'Found a bug, missing a feature, or just want to say something? Write to us.',
  donateTitle: 'Donate',
  donateText: 'The Aerospace Lab is a non-profit association. Donations help it run projects like this one.',
  donateLink: 'Bank details on aerospace-lab.de',
  followTitle: 'Follow the lab',
  followText: 'News from the Aerospace Lab and its projects.',
  sourceTitle: 'Source code',
  sourceText: 'The code of PolyPlot is on GitHub: issues and pull requests are welcome.',
  sourceLink: 'github.com/13Bytes/ashby',

  footerImprint: 'Imprint',
  footerPrivacy: 'Privacy',
  footerMadeFor: 'Made for',
  footerBackend: 'Backend by',
  footerBasedOn: 'based on',
  footerUi: 'UI vibecoded by',
}

const de: OverviewContent = {
  eyebrow: 'Ashby-Plots für die Materialauswahl',
  title: 'Materialien auf einen Blick vergleichen.',
  lead: 'PolyPlot macht aus einer Tabelle mit Materialeigenschaften Ashby-Plots: zwei Eigenschaften gegeneinander, eine farbige Hülle je Materialfamilie, live gerendert, während du anpasst.',
  openEditor: 'Zum Editor',
  keptNote: 'Dein aktuelles Projekt bleibt erhalten.',
  chartX: 'Dichte',
  chartY: 'Zugfestigkeit',
  chartGuideline: 'σ/ρ = konst.',

  whyHeading: 'Warum es PolyPlot gibt',
  whyParagraphs: [
    [
      'PolyPlot ist im Rahmen des Projekts ',
      { text: 'RePolySat', href: LINKS.repolysat },
      ' im ',
      { text: 'Aerospace Lab', href: LINKS.aerospaceLab },
      ' entstanden. Das Aerospace Lab ist ein Jugendforschungszentrum und gemeinnütziger Verein, der es sich zur Aufgabe gemacht hat, Schüler für Naturwissenschaften und Technik zu begeistern.',
    ],
    [
      'Ziel von RePolySat ist es, ein Strukturteil für einen ',
      { text: 'Satelliten', href: LINKS.source2 },
      ' aus recycelten Polymeren zu fertigen. Um uns die Auswahl eines Kunststoffs zu erleichtern, der Space-grade-Anforderungen standhält, haben wir dieses Tool entwickelt.',
    ],
  ],
  whyStats: [
    { value: '139', label: 'Spritzguss-Typen' },
    { value: '11', label: 'Polymerfamilien' },
    { value: '190', label: 'Eigenschaften' },
  ],
  whyStatsCaption: 'Der Datensatz, für den PolyPlot entstand',

  stepsHeading: 'So funktioniert es',
  steps: [
    { title: 'Daten mitbringen', text: 'Lade eine Excel-Arbeitsmappe hoch, wähle einen Datensatz vom Server oder verbinde eine Teable-Tabelle.' },
    { title: 'Größen festlegen', text: 'Benenne, was du plotten willst, etwa Dichte oder Zugfestigkeit, und wähle die Spalten, aus denen es kommt.' },
    { title: 'Achsen und Gruppen wählen', text: 'Wähle X und Y und gruppiere die Punkte nach einer Spalte wie der Polymerfamilie. Jede Gruppe bekommt ihre eigene Hülle.' },
    { title: 'Vorschau und Export', text: 'Die Vorschau aktualisiert sich laufend. Lade einen Plot als SVG oder PNG herunter oder alle auf einmal als .zip.' },
  ],
  tip: 'Starte im Modus „Einfach“: Er blendet alles aus, was mit dem Standardwert schon passt. Orange markierte Felder brauchen noch einen Wert.',

  excelHeading: 'So baust du deine Excel-Datei auf',
  excelLead: 'Eine Zeile je Material, die Spaltennamen in der ersten Zeile. PolyPlot erkennt die Größen an ihren Spaltennamen.',
  excelGroupText: 'Textspalten',
  excelGroupQuantity: 'Größe „{name}“',
  excelCaption: 'Ausschnitt aus MatWeb_materials_export_Spritzguss.xlsx (Spritzguss-Typen, exportiert aus MatWeb)',
  excelLegend: [
    { kind: 'text', title: 'Textspalten', text: 'Gruppieren die Punkte zu Hüllen und benennen die Materialien in der Legende, z. B. die Polymerfamilie.' },
    { kind: 'range', title: '„<Name> low“ und „<Name> high“', text: 'Die Werte einer Größe. Lass „high“ für einen Einzelwert leer, fülle beide für einen Bereich.' },
    { kind: 'unit', title: '„<Name> unit“', text: 'Optional und wird vom Plot nicht gelesen. Schreib die Einheit stattdessen in die Achsenbeschriftung.' },
  ],
  excelRulesHeading: 'Checkliste',
  excelRules: [
    'Spaltennamen in der ersten Zeile, keine Titelzeilen darüber.',
    'Jede Größe braucht beide Spalten, genau geschrieben als „<Name> low“ und „<Name> high“.',
    'Werte sind Zahlen. Ein Dezimalkomma („1,5“) geht auch; Text in einer Wertzelle wird übersprungen.',
    'Leere Zellen sind in Ordnung: Ein Material ohne Wert fehlt einfach in diesem Plot.',
    'Eine Achse kann mehrere Größen zusammenfassen, z. B. „Tensile Strength Yield“ und „Tensile Strength at Break“: PolyPlot nimmt den ersten vorhandenen Wert, den kleinsten, den größten oder die ganze Spanne.',
    'Alle anderen Spalten, etwa Links oder Notizen, werden ignoriert.',
  ],

  featuresHeading: 'Was es sonst noch kann',
  features: [
    { icon: 'layers', title: 'Viele Datensätze und Plots', text: 'Gemeinsame Einstellungen je Datensatz, eine Liste von Plots, ein Klick rendert alle.' },
    { icon: 'palette', title: 'Einheitliche Farben', text: 'Ein Material behält seine Farbe in jedem Plot eines Datensatzes.' },
    { icon: 'line', title: 'Referenzlinien und Notizen', text: 'Farbige Bereiche, Hilfslinien konstanten Verhältnisses und Anmerkungen mit Pfeilen.' },
    { icon: 'image', title: 'Bereit für Druck und Folien', text: 'SVG oder PNG, transparenter, weißer oder dunkler Hintergrund, Beschriftungen in mehreren Sprachen.' },
    { icon: 'file', title: 'Das Projekt als eine Datei', text: 'Speichere alles als .json und lade es später wieder, oder bearbeite es direkt.' },
    { icon: 'shield', title: 'Deine Daten bleiben deine', text: 'Der Server behält keine hochgeladenen Arbeitsmappen, und die App lädt nichts von anderen Seiten.' },
  ],

  ctaHeading: 'Bereit zum Plotten?',
  ctaText: 'Alles, was du einstellst, bleibt in diesem Browser-Tab gespeichert. Über das PolyPlot-Logo kommst du jederzeit zu dieser Übersicht zurück.',

  supportHeading: 'Feedback und Unterstützung',
  supportLead: 'PolyPlot ist kostenlos. Sag uns, was gut läuft und was nicht, und unterstütze das Aerospace Lab, wenn du magst.',
  feedbackTitle: 'Feedback & Kritik',
  feedbackText: 'Einen Fehler gefunden, eine Funktion vermisst oder einfach etwas loswerden? Schreib uns.',
  donateTitle: 'Spenden',
  donateText: 'Das Aerospace Lab ist ein gemeinnütziger Verein. Spenden helfen, Projekte wie dieses umzusetzen.',
  donateLink: 'Bankverbindung auf aerospace-lab.de',
  followTitle: 'Dem Lab folgen',
  followText: 'Neuigkeiten aus dem Aerospace Lab und seinen Projekten.',
  sourceTitle: 'Quellcode',
  sourceText: 'Der Code von PolyPlot liegt auf GitHub: Issues und Pull Requests sind willkommen.',
  sourceLink: 'github.com/13Bytes/ashby',

  footerImprint: 'Impressum',
  footerPrivacy: 'Datenschutz',
  footerMadeFor: 'Entstanden für',
  footerBackend: 'Backend von',
  footerBasedOn: 'basierend auf',
  footerUi: 'UI vibecoded von',
}

export const OVERVIEW_CONTENT: Record<UILanguage, OverviewContent> = { en, de }
