import { Destination, Service, Testimonial, NavItem, City } from "@/types";
import { countryLandingUrl } from "@/lib/utils";

export const destinations: Destination[] = [
  {
    id: "1",
    name: "Anglia",
    slug: "anglia",
    seoSlug: "transport-moldova-anglia-pentru-pasageri-si-colete",
    price: "120",
    currency: "£",
    description: "Cursă regulată Moldova - Anglia, de la 120 GBP, cu cele mai noi și confortabile autocare",
    image: "/images/anglia.jpg",
    cities: [
      { id: "a1", name: "Canterbury", slug: "canterbury" },
      { id: "a2", name: "Ashford", slug: "ashford" },
      { id: "a3", name: "Maidstone", slug: "maidstone" },
      { id: "a4", name: "Crawley", slug: "crawley" },
      { id: "a5", name: "Guildford", slug: "guildford" },
      { id: "a6", name: "London", slug: "london" },
      { id: "a7", name: "Chelmsford", slug: "chelmsford" },
      { id: "a8", name: "Basildon", slug: "basildon" },
      { id: "a9", name: "Luton", slug: "luton" },
      { id: "a10", name: "Cambridge", slug: "cambridge" },
      { id: "a11", name: "Northampton", slug: "northampton" },
      { id: "a12", name: "Kettering", slug: "kettering" },
      { id: "a13", name: "Wellingborough", slug: "wellingborough" },
      { id: "a14", name: "Peterborough", slug: "peterborough" },
      { id: "a15", name: "Huntingdon", slug: "huntingdon" },
      { id: "a16", name: "Leicester", slug: "leicester" },
      { id: "a17", name: "Birmingham", slug: "birmingham" },
      { id: "a18", name: "Walsall", slug: "walsall" },
      { id: "a19", name: "Wolverhampton", slug: "wolverhampton" },
      { id: "a20", name: "Nottingham", slug: "nottingham" },
      { id: "a21", name: "Stoke-on-Trent", slug: "stoke-on-trent" },
      { id: "a22", name: "Manchester", slug: "manchester" },
      { id: "a23", name: "Bolton", slug: "bolton" },
      { id: "a24", name: "Boston", slug: "boston" },
      { id: "a25", name: "Spalding", slug: "spalding" },
      { id: "a26", name: "King's Lynn", slug: "kings-lynn" },
      { id: "a27", name: "Colchester", slug: "colchester" },
      { id: "a28", name: "Dudley", slug: "dudley" },
      { id: "a29", name: "Ipswich", slug: "ipswich" },
      { id: "a30", name: "Southend-on-Sea", slug: "southend-on-sea" },
      { id: "a31", name: "Harlow", slug: "harlow" },
      { id: "a32", name: "Dunstable", slug: "dunstable" },
      { id: "a33", name: "Milton Keynes", slug: "milton-keynes" },
      { id: "a34", name: "Coventry", slug: "coventry" },
      { id: "a35", name: "Corby", slug: "corby" },
      { id: "a36", name: "Rugby", slug: "rugby" },
      { id: "a37", name: "Daventry", slug: "daventry" },
    ],
  },
  {
    id: "2",
    name: "Germania",
    slug: "germania",
    seoSlug: "transport-moldova-germania-pentru-pasageri-si-colete",
    price: "120",
    currency: "€",
    description: "Cursă regulată Moldova - Germania, de la 120 Euro, cu plecări săptămânale",
    image: "/images/germania.jpg",
    cities: [
      { id: "g2", name: "Frankfurt am Main", slug: "frankfurt-am-main" },
      { id: "g3", name: "Köln", slug: "koln", pageSlug: "koln-germania-2" },
      { id: "g4", name: "Duisburg", slug: "duisburg" },
      { id: "g6", name: "Karlsruhe", slug: "karlsruhe" },
      { id: "g7", name: "Pforzheim", slug: "pforzheim" },
      { id: "g15", name: "Nürnberg", slug: "nurnberg" },
      { id: "g16", name: "Würzburg", slug: "wurzburg" },
      { id: "g17", name: "Hanau", slug: "hanau" },
      { id: "g18", name: "Offenbach am Main", slug: "offenbach-am-main" },
      { id: "g19", name: "Wiesbaden", slug: "wiesbaden" },
      { id: "g20", name: "Mainz", slug: "mainz" },
      { id: "g23", name: "Darmstadt", slug: "darmstadt" },
      { id: "g24", name: "Koblenz", slug: "koblenz" },
      { id: "g25", name: "Bonn", slug: "bonn" },
      { id: "g26", name: "Düsseldorf", slug: "dusseldorf" },
      { id: "g27", name: "Wuppertal", slug: "wuppertal" },
      { id: "g28", name: "Essen", slug: "essen" },
      { id: "g29", name: "Münster", slug: "munster" },
      { id: "g30", name: "Osnabrück", slug: "osnabruck" },
    ],
  },
  {
    id: "3",
    name: "Belgia",
    slug: "belgia",
    seoSlug: "transport-moldova-belgia-pentru-pasageri-si-colete",
    price: "120",
    currency: "€",
    description: "Cursă regulată Moldova - Belgia, de la 120 Euro",
    image: "/images/belgia.jpg",
    cities: [
      { id: "b1", name: "Bruxelles", slug: "bruxelles" },
      { id: "b2", name: "Anderlecht", slug: "anderlecht" },
      { id: "b3", name: "Aalst", slug: "aalst" },
      { id: "b4", name: "Asse", slug: "asse", pageSlug: "assebelgia" },
      { id: "b5", name: "Gent", slug: "gent" },
      { id: "b6", name: "Leuven", slug: "leuven", pageSlug: "leuven-belgia-2" },
      { id: "b7", name: "Namur", slug: "namur" },
      { id: "b8", name: "Charleroi", slug: "charleroi" },
      { id: "b9", name: "Mons", slug: "mons" },
      { id: "b10", name: "Liège", slug: "liege" },
      { id: "b11", name: "Hasselt", slug: "hasselt" },
      { id: "b12", name: "Antwerpen", slug: "antwerpen" },
      { id: "b13", name: "Brugge", slug: "brugge" },
      { id: "b14", name: "Kortrijk", slug: "kortrijk" },
      { id: "b15", name: "Roeselare", slug: "roeselare" },
      { id: "b16", name: "Oostende", slug: "oostende" },
      { id: "b17", name: "Mechelen", slug: "mechelen" },
      { id: "b18", name: "Herentals", slug: "herentals" },
      { id: "b19", name: "Tournai", slug: "tournai" },
      { id: "b20", name: "La Louvière", slug: "la-louviere" },
      { id: "b21", name: "Tubize", slug: "tubize" },
      { id: "b22", name: "Lier", slug: "lier" },
    ],
  },
  {
    id: "4",
    name: "Olanda",
    slug: "olanda",
    seoSlug: "transport-moldova-olanda-pentru-pasageri-si-colete",
    price: "150",
    currency: "€",
    description: "Cursă regulată Moldova - Olanda, de la 150 Euro",
    image: "/images/olanda.jpg",
    cities: [
      { id: "o1", name: "Venlo", slug: "venlo" },
      { id: "o2", name: "Eindhoven", slug: "eindhoven" },
      { id: "o3", name: "Tilburg", slug: "tilburg" },
      { id: "o4", name: "Maasdijk", slug: "maasdijk" },
      { id: "o5", name: "Breda", slug: "breda" },
      { id: "o6", name: "Dordrecht", slug: "dordrecht" },
      { id: "o7", name: "Rotterdam", slug: "rotterdam" },
      { id: "o8", name: "Den Haag", slug: "den-haag" },
      { id: "o9", name: "Zoetermeer", slug: "zoetermeer" },
      { id: "o10", name: "Amsterdam", slug: "amsterdam" },
      { id: "o11", name: "Haarlem", slug: "haarlem" },
      { id: "o12", name: "Leiden", slug: "leiden" },
      { id: "o13", name: "Utrecht", slug: "utrecht" },
      { id: "o14", name: "Amersfoort", slug: "amersfoort" },
      { id: "o15", name: "Almere", slug: "almere" },
      { id: "o16", name: "Schiedam", slug: "schiedam" },
    ],
  },
  {
    id: "5",
    name: "Luxemburg",
    slug: "luxemburg",
    seoSlug: "transport-moldova-luxemburg-pentru-pasageri-si-colete",
    price: "",
    currency: "€",
    description: "Cursă regulată Moldova - Luxemburg cu cele mai noi și confortabile autocare",
    image: "/images/luxemburg.jpg",
    cities: [
      { id: "l1", name: "Luxembourg City", slug: "luxembourg-city" },
    ],
  },
];

export const moldovanCities: City[] = [
  { id: "m1", name: "Ialoveni", slug: "ialoveni" },
  { id: "m2", name: "Hîncești", slug: "hincesti" },
  { id: "m3", name: "Cimișlia", slug: "cimislia" },
  { id: "m4", name: "Comrat", slug: "comrat" },
  { id: "m5", name: "Balabanu", slug: "balabanu" },
  { id: "m6", name: "Cahul", slug: "cahul" },
];

export const services: Service[] = [
  {
    id: "1",
    title: "Transport de persoane",
    slug: "transport-de-persoane",
    description: "Transportul internațional de persoane este principala activitate a companiei noastre. Oferim cele mai bune prețuri și autobuze confortabile!",
    icon: "users",
    image: "/images/bus-angle.png",
    features: [
      "Curse regulate în Anglia, Germania, Belgia, Olanda, Luxemburg",
      "Internet Starlink nelimitat pe toată ruta",
      "Prânz gratuit din partea companiei",
      "Ceai și cafea naturală nelimitat",
      "Asistență 24/24 de la însoțitoarea de bord",
      "Autocare moderne, climatizate, cu prize USB",
    ],
  },
  {
    id: "2",
    title: "Transport de colete",
    slug: "transport-de-colete",
    description: "Transport rapid și sigur de colete în toată Europa. Remorcă frigorifică separată pentru produse perisabile (carne, lactate, brânzeturi, fructe, legume) la temperatură controlată.",
    icon: "package",
    image: "/images/parcel-boxes.png",
    features: [
      "Remorcă frigorifică separată pentru produse alterabile",
      "Colectare colete din toată Moldova (vezi grafic)",
      "Integritate garantată — sigilare la preluare",
      "Plată cash sau card la livrare",
    ],
  },
  {
    id: "5",
    title: "Transport de mărfuri până la 5 t",
    slug: "transport-de-marfa-pana-la-5-tone",
    description: "Transport de mărfuri și marfă generală cu vehicule de până la 5 tone capacitate.",
    icon: "boxes",
    image: "/images/bus-front.png",
    features: [
      "Capacitate până la 5 tone",
      "Livrare rapidă",
      "Transport internațional",
      "Prețuri negociabile",
    ],
  },
];

export const testimonials: Testimonial[] = [
  {
    id: "1",
    name: "Vasile",
    text: "Am avut o experiență minunată cu compania de transport în Germania! Serviciul a fost excelent, șoferii profesioniști și autocarul foarte confortabil.",
    rating: 5,
  },
  {
    id: "2",
    name: "Valeriu",
    text: "Foarte mulțumit de serviciile DAVO! Am călătorit în Anglia și totul a fost perfect. Recomand cu încredere!",
    rating: 5,
  },
  {
    id: "3",
    name: "Ana",
    text: "Am expediat colete în Belgia și totul a ajuns în siguranță și la timp. Personal foarte amabil și profesionist.",
    rating: 5,
  },
  {
    id: "4",
    name: "Larisa",
    text: "Cel mai bun serviciu de transport Moldova - Olanda! Autocar modern, Wi-Fi gratuit, și o călătorie plăcută.",
    rating: 5,
  },
  {
    id: "5",
    name: "Andrei",
    text: "Am folosit transferul Chișinău - Iași și a fost perfect. Șoferul a fost punctual și foarte politicos. Mulțumesc DAVO!",
    rating: 5,
  },
];

export const contactInfo = {
  phone: "+373 68 065 699",
  phoneSecondary: "+373 76 041 855",
  phoneBelgium: "+32 484 47 64 46",
  phoneBelgium2: "+32 470 27 59 22",
  phoneUK: "+44 744 748 0276",
  whatsapp: "+373 68 065 699",
  viber: "+373 68 065 699",
  telegram: "+373 68 065 699",
  email: "info@davo.md",
  address: "Calea Ieșilor 11/3, Chișinău, Moldova",
  addressShort: "Calea Ieșilor 11/3, Chișinău",
  mapsUrl: "https://maps.app.goo.gl/sRjSL8mXkw1iHQ4c7",
  mapsEmbedSrc:
    "https://maps.google.com/maps?cid=12291235672842961864&output=embed",
  social: {
    facebook: "https://www.facebook.com/davotrans",
    instagram: "https://www.instagram.com/davotrans/",
    tiktok: "https://www.tiktok.com/@davo.trans",
    handle: "@davotrans",
    handleTikTok: "@davo.trans",
  },
};

// Orar punct de colectare colete + îmbarcare la sediul DAVO (Calea Ieșilor 11/3, Chișinău)
export const pickupSchedule: { day: string; hours: string }[] = [
  { day: "Marți", hours: "09:00 – 14:00" },
  { day: "Miercuri", hours: "08:00 – 20:00" },
  { day: "Joi", hours: "08:00 – 12:00" },
];

// Grafic de colectare colete în orașele din Moldova (șofer + telefon per oraș/zi).
// Editabil pentru admin. Telefonul poate fi gol; se va completa în timp.
export type CollectionPoint = {
  city: string;
  schedule: { day: string; hours: string }[];
  driver?: { name: string; phone: string };
  notes?: string;
};

export const collectionPoints: CollectionPoint[] = [
  {
    city: "Chișinău",
    schedule: [
      { day: "Marți", hours: "09:00 – 14:00" },
      { day: "Miercuri", hours: "08:00 – 20:00" },
      { day: "Joi", hours: "08:00 – 12:00" },
    ],
    notes: "Sediul DAVO Group — Calea Ieșilor 11/3",
  },
  { city: "Bălți", schedule: [{ day: "Miercuri", hours: "10:00 – 14:00" }] },
  { city: "Cahul", schedule: [{ day: "Marți", hours: "12:00 – 16:00" }] },
  { city: "Comrat", schedule: [{ day: "Marți", hours: "10:00 – 13:00" }] },
  { city: "Hîncești", schedule: [{ day: "Miercuri", hours: "09:00 – 11:00" }] },
  { city: "Ialoveni", schedule: [{ day: "Miercuri", hours: "09:00 – 11:00" }] },
  { city: "Orhei", schedule: [{ day: "Joi", hours: "09:00 – 11:00" }] },
  { city: "Soroca", schedule: [{ day: "Miercuri", hours: "13:00 – 16:00" }] },
  { city: "Ungheni", schedule: [{ day: "Joi", hours: "10:00 – 12:00" }] },
  { city: "Edineț", schedule: [{ day: "Miercuri", hours: "14:00 – 17:00" }] },
  { city: "Căușeni", schedule: [{ day: "Marți", hours: "13:00 – 15:00" }] },
  { city: "Strășeni", schedule: [{ day: "Miercuri", hours: "08:00 – 09:30" }] },
  { city: "Cimișlia", schedule: [{ day: "Marți", hours: "11:00 – 13:00" }] },
  { city: "Drochia", schedule: [{ day: "Miercuri", hours: "12:00 – 14:00" }] },
  { city: "Fălești", schedule: [{ day: "Miercuri", hours: "11:00 – 13:00" }] },
];

export const navItems: NavItem[] = [
  { label: "Rezervă bilet", href: "/rezervare" },
  {
    label: "Destinații",
    href: "/destinatii",
    children: destinations.map((d) => ({
      label: `Moldova - ${d.name}`,
      href: countryLandingUrl(d),
    })),
  },
  { label: "Trimite colet", href: "/rezervare?mode=colet" },
  {
    label: "Servicii oferite",
    href: "/serviciile-noastre",
    children: services.map((s) => ({
      label: s.title,
      href: `/serviciile-noastre/${s.slug}`,
    })),
  },
  {
    label: "Informații utile",
    href: "/informatii-utile",
    children: [
      { label: "Despre noi", href: "/despre-noi" },
      { label: "Rechizite bancare", href: "/rechizitele-bancare" },
    ],
  },
  { label: "Contacte", href: "/contact" },
];

export const serviceHighlights = [
  { id: "1", title: "Însoțitoare 24/24", icon: "user-check" },
  { id: "2", title: "Bagaj gratuit 35 kg", icon: "luggage" },
  { id: "3", title: "Ceai & cafea naturală nelimitat", icon: "coffee" },
  { id: "4", title: "Prânz gratuit", icon: "utensils" },
  { id: "5", title: "Internet Starlink nelimitat", icon: "wifi" },
  { id: "6", title: "Multimedia", icon: "monitor" },
  { id: "7", title: "Prize USB", icon: "usb" },
  { id: "8", title: "Șoferi experimentați", icon: "shield-check" },
];

export const galleryImages = [
  { id: "1", src: "/images/gallery-1.jpg", alt: "Autocar DAVO" },
  { id: "2", src: "/images/gallery-2.jpg", alt: "Interior autocar" },
  { id: "3", src: "/images/gallery-3.jpg", alt: "Destinații" },
  { id: "4", src: "/images/gallery-4.jpg", alt: "Echipa DAVO" },
  { id: "5", src: "/images/gallery-5.jpg", alt: "Călători" },
  { id: "6", src: "/images/gallery-6.jpg", alt: "Servicii" },
];

export const bankDetails = {
  companyName: "DAVO GRUP SRL",
  address: "MD-2069, mun. Chișinău, str. Calea Ieșilor, 11/3",
  bank: "BC Moldova Agroindbank SA",
  bankCode: "AGRNMD2X",
  accountMDL: "MD24AG000000022512398136",
  accountEUR: "MD62AG000000022512398150",
  accountUSD: "MD84AG000000022512398167",
  fiscalCode: "1010600006849",
  tvvaCode: "030",
};
