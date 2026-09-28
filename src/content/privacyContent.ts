import type { UILanguage } from '../uiTranslations'
import { LINKS, type RichText } from './overviewContent'

/**
 * Privacy notice of PolyPlot. Describes what the code does: browser storage (uiTheme, uiTranslations,
 * App.tsx, datasourceStorage.ts), the render and import requests (backend/app.py, plot_renderer.py) and
 * Teable imports (backend/import_data/teable.py). Update it when any of these change.
 */
export type PrivacyContent = {
  title: string
  updated: string
  summary: string[]
  sections: Array<{ heading: string; paragraphs: RichText[] }>
}

const CONTROLLER = 'Jugendforschungszentrum Herrenberg-Gäu AEROSPACE LAB e.V., Berliner Str. 1, 71083 Herrenberg, '

const de: PrivacyContent = {
  title: 'Datenschutzerklärung',
  updated: 'Stand: September 2026',
  summary: [
    'Keine Cookies, kein Tracking, keine Analyse-Tools.',
    'Keine externen Schriftarten, Skripte oder Werbung.',
    'Hochgeladene Excel-Dateien werden auf dem Server nicht gespeichert.',
  ],
  sections: [
    {
      heading: 'Verantwortlicher',
      paragraphs: [
        [CONTROLLER, { text: 'ashby@aerospace-lab.de', href: 'mailto:ashby@aerospace-lab.de' }, '. Weitere Angaben im ', { text: 'Impressum', href: LINKS.imprint }, '.'],
      ],
    },
    {
      heading: 'Aufruf der Seite',
      paragraphs: [
        ['Beim Aufruf verarbeitet der Webserver technisch notwendige Verbindungsdaten (IP-Adresse, Zeitpunkt, aufgerufene Adresse, Statuscode), um die Seite auszuliefern und Fehler zu finden. Die Daten werden nicht mit anderen Daten zusammengeführt. Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse am sicheren Betrieb).'],
      ],
    },
    {
      heading: 'Plots erstellen und Daten importieren',
      paragraphs: [
        ['Für Vorschau, Download und Import sendet dein Browser die Plot-Konfiguration und gegebenenfalls die gewählte Excel-Datei an den Server. Der Server verarbeitet sie nur im Arbeitsspeicher, erzeugt das Bild in einem temporären Ordner und löscht es direkt nach der Anfrage. Es wird nichts dauerhaft gespeichert. Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO (Bereitstellung der angeforderten Funktion).'],
        ['Wählst du „Teable“ als Datenquelle, ruft der Server mit der angegebenen URL und dem API-Key die Tabelle vom jeweiligen Teable-Server ab. Dafür gelten zusätzlich die Datenschutzbestimmungen dieses Anbieters. Der API-Key ist Teil der Plot-Konfiguration: Er bleibt in deinem Browser-Tab und steht in exportierten Konfigurationsdateien.'],
      ],
    },
    {
      heading: 'Speicherung in deinem Browser',
      paragraphs: [
        ['PolyPlot speichert Daten nur lokal in deinem Browser, damit die App nach dem Neuladen so weiterarbeitet, wie du sie verlassen hast:'],
        ['• Local Storage: UI-Sprache, Design und Anzeigeoptionen (z. B. Modus „Einfach“, Breite der Vorschau).'],
        ['• Session Storage: das Projekt des jeweiligen Tabs. Es wird beim Schließen des Tabs gelöscht.'],
        ['• IndexedDB: eine Kopie der gewählten Excel-Dateien. Löschen kannst du sie unter Einstellungen → „Alle gespeicherten Dateien löschen“.'],
        ['Offene Tabs desselben Projekts gleichen sich direkt im Browser ab; dabei wird nichts übertragen. Diese Speicherung ist für die von dir genutzten Funktionen unbedingt erforderlich (§ 25 Abs. 2 Nr. 2 TDDDG).'],
      ],
    },
    {
      heading: 'Kontakt per E-Mail',
      paragraphs: [
        ['Schreibst du uns an ', { text: LINKS.feedbackAddress, href: LINKS.feedback }, ', verwenden wir deine Angaben nur, um deine Nachricht zu bearbeiten (Art. 6 Abs. 1 lit. f DSGVO).'],
      ],
    },
    {
      heading: 'Links zu anderen Seiten',
      paragraphs: [
        ['Links zu GitHub, Instagram, LinkedIn oder der Website des Aerospace Lab sind einfache Links: Erst wenn du sie anklickst, verbindet sich dein Browser mit der jeweiligen Seite. Dort gelten deren Datenschutzbestimmungen, für aerospace-lab.de die ', { text: 'Datenschutzerklärung des Vereins', href: LINKS.labPrivacy }, '.'],
      ],
    },
    {
      heading: 'Deine Rechte',
      paragraphs: [
        ['Du hast das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung, Datenübertragbarkeit und Widerspruch (Art. 15–21 DSGVO). Wende dich dazu an ', { text: 'ashby@aerospace-lab.de', href: 'mailto:ashby@aerospace-lab.de' }, '. Außerdem kannst du dich bei einer Datenschutz-Aufsichtsbehörde beschweren, zum Beispiel beim Landesbeauftragten für den Datenschutz und die Informationsfreiheit Baden-Württemberg.'],
      ],
    },
  ],
}

const en: PrivacyContent = {
  title: 'Privacy notice',
  updated: 'As of September 2026',
  summary: [
    'No cookies, no tracking, no analytics.',
    'No external fonts, scripts or ads.',
    'Uploaded Excel files are not stored on the server.',
  ],
  sections: [
    {
      heading: 'Controller',
      paragraphs: [
        [CONTROLLER, { text: 'ashby@aerospace-lab.de', href: 'mailto:ashby@aerospace-lab.de' }, '. More details in the ', { text: 'imprint', href: LINKS.imprint }, '.'],
      ],
    },
    {
      heading: 'Visiting the page',
      paragraphs: [
        ['When you open the page, the web server processes technically necessary connection data (IP address, time, requested address, status code) to deliver the page and find errors. This data is not combined with other data. Legal basis: Art. 6(1)(f) GDPR (legitimate interest in secure operation).'],
      ],
    },
    {
      heading: 'Creating plots and importing data',
      paragraphs: [
        ['For previews, downloads and imports, your browser sends the plot configuration and, if selected, the Excel file to the server. The server processes them in memory only, creates the image in a temporary folder and deletes it right after the request. Nothing is stored permanently. Legal basis: Art. 6(1)(f) GDPR (providing the requested function).'],
        ['If you choose “Teable” as the data source, the server uses the given URL and API key to fetch the table from that Teable server. The privacy policy of that provider applies as well. The API key is part of the plot configuration: it stays in your browser tab and is included in exported config files.'],
      ],
    },
    {
      heading: 'Storage in your browser',
      paragraphs: [
        ['PolyPlot stores data only locally in your browser, so the app continues where you left off after a reload:'],
        ['• Local storage: UI language, theme and display options (e.g. Simple mode, preview width).'],
        ['• Session storage: the project of each tab. It is deleted when you close the tab.'],
        ['• IndexedDB: a copy of the selected Excel files. You can delete them under Settings → “Delete all stored files”.'],
        ['Open tabs of the same project sync directly within the browser; nothing is transmitted. This storage is strictly necessary for the functions you use (Section 25(2) No. 2 TDDDG).'],
      ],
    },
    {
      heading: 'Contact by email',
      paragraphs: [
        ['If you write to ', { text: LINKS.feedbackAddress, href: LINKS.feedback }, ', we use your details only to handle your message (Art. 6(1)(f) GDPR).'],
      ],
    },
    {
      heading: 'Links to other sites',
      paragraphs: [
        ['Links to GitHub, Instagram, LinkedIn or the Aerospace Lab website are plain links: your browser connects to those sites only when you click them. Their privacy policies apply there; for aerospace-lab.de see the ', { text: "association's privacy policy", href: LINKS.labPrivacy }, '.'],
      ],
    },
    {
      heading: 'Your rights',
      paragraphs: [
        ['You have the right to access, rectification, erasure, restriction of processing, data portability and objection (Art. 15–21 GDPR). Contact ', { text: 'ashby@aerospace-lab.de', href: 'mailto:ashby@aerospace-lab.de' }, '. You can also lodge a complaint with a data protection supervisory authority, for example the State Commissioner for Data Protection and Freedom of Information of Baden-Württemberg.'],
      ],
    },
  ],
}

export const PRIVACY_CONTENT: Record<UILanguage, PrivacyContent> = { de, en }
