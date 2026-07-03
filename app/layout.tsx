import type { Metadata, Viewport } from "next";
import { Inter, Montserrat } from "next/font/google";
import Script from "next/script";
import { contactInfo, destinations, moldovanCities } from "@/lib/data";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "latin-ext"],
  display: "swap",
});

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700", "800", "900"],
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://davo.md";

// SEO keywords — generate dynamically from data so adding a city/destination
// automatically extends keyword coverage across the site.
const baseKeywords = [
  "DAVO",
  "DAVO Group",
  "DAVO Grup",
  "transport Moldova Europa",
  "autocar Moldova Europa",
  "autocar Chișinău Europa",
  "bilet autocar Moldova",
  "rezervare autocar online",
  "transport pasageri Moldova",
  "transport colete Moldova Europa",
  "colete perisabile",
  "remorcă frigorifică colete",
  "Wi-Fi Starlink autocar",
  "internet Starlink la bord",
  "însoțitoare bord autocar",
  "prânz gratuit autocar",
  "ceai cafea naturală autocar",
  "colectare colete Moldova",
  "punct colectare Calea Ieșilor",
  "tracking colete Moldova",
];

const moldovaCityKeywords = moldovanCities.flatMap((c) => [
  `transport ${c.name} Europa`,
  `autocar ${c.name}`,
  `colete ${c.name}`,
  `Moldova ${c.name} Anglia`,
  `Moldova ${c.name} Germania`,
]);

const destinationKeywords = destinations.flatMap((d) => [
  `transport Moldova ${d.name}`,
  `autocar ${d.name}`,
  `Moldova ${d.name} preț`,
  `bilet autocar Moldova ${d.name}`,
  `colete Moldova ${d.name}`,
  ...d.cities.slice(0, 8).map((c) => `transport Chișinău ${c.name}`),
]);

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "DAVO Group — Transport rapid și sigur Moldova → Europa",
    template: "%s | DAVO Group",
  },
  description:
    "Transport pasageri și colete din toată Moldova spre Anglia, Germania, Belgia, Olanda și Luxemburg. Autocare moderne cu Wi-Fi Starlink nelimitat, prânz gratuit, însoțitoare 24/7. Colete alterabile în remorcă frigorifică separată. Colectăm din toată Moldova.",
  applicationName: "DAVO Group",
  authors: [{ name: "DAVO Group", url: SITE_URL }],
  generator: "Next.js",
  keywords: [...baseKeywords, ...moldovaCityKeywords, ...destinationKeywords].join(", "),
  alternates: { canonical: "/" },
  openGraph: {
    title: "DAVO Group — Transport rapid și sigur Moldova → Europa",
    description:
      "Rezervă bilet sau trimite colet din toată Moldova spre Europa. Starlink nelimitat, prânz gratuit, remorcă frigorifică pentru perisabile, prețuri de la 120 Euro.",
    type: "website",
    locale: "ro_MD",
    siteName: "DAVO Group",
    url: SITE_URL,
    images: [
      {
        url: "/images/bus-highway.png",
        width: 1200,
        height: 630,
        alt: "DAVO Group — Transport Moldova → Europa",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "DAVO Group — Transport Moldova → Europa",
    description:
      "Autocare cu Starlink, prânz gratuit, însoțitoare 24/7. Colete în remorcă frigorifică. Colectare din toată Moldova.",
    images: ["/images/bus-highway.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-snippet": -1,
      "max-image-preview": "large",
    },
  },
};

// Organization JSON-LD — singura schema globală, rulează pe toate paginile.
// Rich result eligibility pentru sitelinks searchbox + brand panel.
const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": `${SITE_URL}/#organization`,
  name: "DAVO Group",
  alternateName: "DAVO Grup",
  url: SITE_URL,
  logo: `${SITE_URL}/images/logo-davo.png`,
  image: `${SITE_URL}/images/bus-highway.png`,
  description:
    "Operator de transport pasageri și colete din Moldova către Anglia, Belgia, Olanda, Germania și Luxemburg. Curse săptămânale cu autocare moderne, Starlink la bord, prânz gratuit și însoțitoare.",
  telephone: contactInfo.phone,
  email: contactInfo.email,
  address: {
    "@type": "PostalAddress",
    streetAddress: "Calea Ieșilor 11/3",
    addressLocality: "Chișinău",
    addressCountry: "MD",
    postalCode: "MD-2069",
  },
  geo: {
    "@type": "GeoCoordinates",
    latitude: 47.0380005,
    longitude: 28.8060474,
  },
  sameAs: [
    contactInfo.social.facebook,
    contactInfo.social.instagram,
    contactInfo.social.tiktok,
  ],
  areaServed: ["MD", "GB", "BE", "NL", "DE", "LU"],
};

const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": `${SITE_URL}/#website`,
  url: SITE_URL,
  name: "DAVO Group",
  inLanguage: "ro-MD",
  publisher: { "@id": `${SITE_URL}/#organization` },
  potentialAction: {
    "@type": "SearchAction",
    target: `${SITE_URL}/rezervare?to={search_term_string}`,
    "query-input": "required name=search_term_string",
  },
};

const PLAUSIBLE_DOMAIN = "davo.md";
const GA_MEASUREMENT_ID = "G-BMM1CZLE49";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ro" className={`${inter.variable} ${montserrat.variable}`}>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
        />
      </head>
      <body className="bg-white text-slate-900 antialiased">
        {children}
        {/* Plausible analytics — privacy-friendly, fără cookies, fără GDPR banner. */}
        <Script
          defer
          data-domain={PLAUSIBLE_DOMAIN}
          src="https://plausible.io/js/script.js"
          strategy="afterInteractive"
        />
        {/* Google Analytics 4 — gtag.js loader + config inline. */}
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
          strategy="afterInteractive"
        />
        <Script id="ga4-init" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${GA_MEASUREMENT_ID}');
          `}
        </Script>
      </body>
    </html>
  );
}
