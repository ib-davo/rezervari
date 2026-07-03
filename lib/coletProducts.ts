// Catalog produse "Colet la cheie" — produse moldovenești livrate în Europa.
// Editabil. La launch: se va muta în DB cu CRUD din admin.
//
// Convenție:
//  - id: stable, numeric string ("1", "2"...) pentru relații cart simple
//  - price: în Lei (MDL) — checkout convertește la EUR/GBP la livrare
//  - unit: "kg" | "buc" | "set" | "l" | "g"
//  - image: cale relativă din /public sau emoji fallback dacă lipsește

export type ProductCategory = {
  slug: string;
  name: string;
  emoji: string;
  description: string;
};

export type Product = {
  id: string;
  categorySlug: string;
  name: string;
  brand?: string;
  description: string;
  price: number; // MDL
  unit: "kg" | "buc" | "set" | "l" | "g";
  unitValue?: number; // ex: 0.5 pentru 500g
  image?: string;
  emoji: string;
  badge?: "Tradițional" | "BIO" | "Premium" | "Nou";
  perishable?: boolean; // se transportă în frigorifică
};

export const productCategories: ProductCategory[] = [
  {
    slug: "branzeturi",
    name: "Brânzeturi & lactate",
    emoji: "🧀",
    description: "Brânză de vaci, brânză de oi, smântână, lapte covăsit",
  },
  {
    slug: "carne-mezeluri",
    name: "Carne & mezeluri",
    emoji: "🥩",
    description: "Cârnați de casă, jambon afumat, slănină, mușchi",
  },
  {
    slug: "vinuri-bauturi",
    name: "Vinuri & băuturi",
    emoji: "🍷",
    description: "Vinuri Cricova, Purcari, divin, must, ape minerale",
  },
  {
    slug: "conserve-dulceturi",
    name: "Conserve & dulcețuri",
    emoji: "🫙",
    description: "Murături, dulceață de prune, magiun, miere, zacuscă",
  },
  {
    slug: "paine-placinte",
    name: "Pâine & plăcinte",
    emoji: "🥐",
    description: "Plăcinte cu brânză și verdeață, vărzări, pâine de casă",
  },
  {
    slug: "legume-fructe",
    name: "Legume & fructe",
    emoji: "🍎",
    description: "Mere de Soroca, prune uscate, nuci, struguri",
  },
  {
    slug: "uscate",
    name: "Produse uscate",
    emoji: "🌾",
    description: "Mălai, făină, fasole, păstârnac, ardei iuți",
  },
];

export const products: Product[] = [
  // Brânzeturi
  {
    id: "1",
    categorySlug: "branzeturi",
    name: "Brânză de oi maturată",
    brand: "Producător local",
    description: "Brânză de oi din ciubăr, maturată 30 zile, sărată tradițional",
    price: 180,
    unit: "kg",
    emoji: "🧀",
    badge: "Tradițional",
    perishable: true,
  },
  {
    id: "2",
    categorySlug: "branzeturi",
    name: "Brânză de vaci proaspătă",
    description: "Lapte de vacă crud, fără conservanți, aspectul casnic",
    price: 65,
    unit: "kg",
    emoji: "🥛",
    perishable: true,
  },
  {
    id: "3",
    categorySlug: "branzeturi",
    name: "Smântână 30%",
    description: "Smântână naturală, 30% grăsime, ambalată în borcan 500g",
    price: 55,
    unit: "buc",
    unitValue: 0.5,
    emoji: "🥄",
    perishable: true,
  },

  // Carne & mezeluri
  {
    id: "10",
    categorySlug: "carne-mezeluri",
    name: "Cârnați de casă afumați",
    description: "Carne de porc cu condimente tradiționale, afumat la lemn",
    price: 220,
    unit: "kg",
    emoji: "🌭",
    badge: "Tradițional",
    perishable: true,
  },
  {
    id: "11",
    categorySlug: "carne-mezeluri",
    name: "Jambon afumat",
    description: "Jambon de porc afumat la lemn de mar, gust intens",
    price: 280,
    unit: "kg",
    emoji: "🥓",
    perishable: true,
  },
  {
    id: "12",
    categorySlug: "carne-mezeluri",
    name: "Slănină cu boia",
    description: "Slănină marinată cu usturoi și boia dulce, gata de servit",
    price: 150,
    unit: "kg",
    emoji: "🥓",
    perishable: true,
  },
  {
    id: "13",
    categorySlug: "carne-mezeluri",
    name: "Mușchi file presat",
    description: "Mușchi file de porc presat, condimentat, feliat sub vid",
    price: 320,
    unit: "kg",
    emoji: "🥩",
    badge: "Premium",
    perishable: true,
  },

  // Vinuri & băuturi
  {
    id: "20",
    categorySlug: "vinuri-bauturi",
    name: "Cabernet Sauvignon Cricova",
    brand: "Cricova",
    description: "Vin sec roșu, recoltă 2022, sticlă 750ml",
    price: 120,
    unit: "buc",
    unitValue: 0.75,
    emoji: "🍷",
  },
  {
    id: "21",
    categorySlug: "vinuri-bauturi",
    name: "Feteasca Albă Purcari",
    brand: "Purcari",
    description: "Vin sec alb, recoltă 2023, sticlă 750ml",
    price: 145,
    unit: "buc",
    unitValue: 0.75,
    emoji: "🍾",
    badge: "Premium",
  },
  {
    id: "22",
    categorySlug: "vinuri-bauturi",
    name: "Divin Kvint XO",
    brand: "Kvint",
    description: "Brandy moldovenesc, învechit 7 ani, 500ml",
    price: 380,
    unit: "buc",
    unitValue: 0.5,
    emoji: "🥃",
    badge: "Premium",
  },
  {
    id: "23",
    categorySlug: "vinuri-bauturi",
    name: "Must natural de struguri",
    description: "Must proaspăt din strugurii moldoveneşti, fără adaosuri",
    price: 35,
    unit: "l",
    emoji: "🍇",
  },

  // Conserve & dulcețuri
  {
    id: "30",
    categorySlug: "conserve-dulceturi",
    name: "Dulceață de prune fără sâmburi",
    description: "Dulceață casnică din prune Călăraşi, fără conservanți, 750g",
    price: 75,
    unit: "buc",
    unitValue: 0.75,
    emoji: "🫐",
    badge: "Tradițional",
  },
  {
    id: "31",
    categorySlug: "conserve-dulceturi",
    name: "Magiun de prune",
    description: "Magiun gros, fiert lent, fără zahăr adăugat, borcan 500g",
    price: 80,
    unit: "buc",
    unitValue: 0.5,
    emoji: "🍯",
    badge: "BIO",
  },
  {
    id: "32",
    categorySlug: "conserve-dulceturi",
    name: "Miere de salcâm",
    description: "Miere brută, nepasteurizată, recoltă 2025, borcan 1kg",
    price: 220,
    unit: "buc",
    unitValue: 1,
    emoji: "🍯",
    badge: "BIO",
  },
  {
    id: "33",
    categorySlug: "conserve-dulceturi",
    name: "Zacuscă de vinete",
    description: "Vinete coapte la lemn, ardei și gogoșari, borcan 500g",
    price: 65,
    unit: "buc",
    unitValue: 0.5,
    emoji: "🍆",
  },
  {
    id: "34",
    categorySlug: "conserve-dulceturi",
    name: "Murături asortate",
    description: "Castraveți, gogonele, gogoșari murați în saramură, 1.5kg",
    price: 95,
    unit: "buc",
    unitValue: 1.5,
    emoji: "🥒",
  },

  // Pâine & plăcinte
  {
    id: "40",
    categorySlug: "paine-placinte",
    name: "Plăcinte cu brânză și mărar",
    description: "Plăcinte cu aluat fraged, copt în cuptor pe vatră — set 6 buc",
    price: 90,
    unit: "set",
    emoji: "🥟",
    badge: "Tradițional",
    perishable: true,
  },
  {
    id: "41",
    categorySlug: "paine-placinte",
    name: "Vărzări cu varză murată",
    description: "Aluat de casă cu umplutură de varză murată — set 6 buc",
    price: 85,
    unit: "set",
    emoji: "🥬",
    perishable: true,
  },
  {
    id: "42",
    categorySlug: "paine-placinte",
    name: "Pâine de casă cu mălai",
    description: "Pâine cu cartof și mălai, aluat dospit lent, 1kg",
    price: 45,
    unit: "buc",
    unitValue: 1,
    emoji: "🍞",
    perishable: true,
  },

  // Legume & fructe
  {
    id: "50",
    categorySlug: "legume-fructe",
    name: "Mere Idared de Soroca",
    description: "Mere de toamnă, recoltă 2025, calibru mare, 5kg",
    price: 90,
    unit: "buc",
    unitValue: 5,
    emoji: "🍎",
  },
  {
    id: "51",
    categorySlug: "legume-fructe",
    name: "Prune uscate fără sâmburi",
    description: "Prune deshidratate la soare, calitate I, pungă 500g",
    price: 110,
    unit: "buc",
    unitValue: 0.5,
    emoji: "🟣",
    badge: "BIO",
  },
  {
    id: "52",
    categorySlug: "legume-fructe",
    name: "Nuci miez întreg",
    description: "Miez de nucă moldovenească, calitate I, pungă 500g",
    price: 220,
    unit: "buc",
    unitValue: 0.5,
    emoji: "🌰",
    badge: "Premium",
  },
  {
    id: "53",
    categorySlug: "legume-fructe",
    name: "Roșii de butoi",
    description: "Roșii murate în saramură cu hrean și mărar, 1.5kg",
    price: 75,
    unit: "buc",
    unitValue: 1.5,
    emoji: "🍅",
  },

  // Produse uscate
  {
    id: "60",
    categorySlug: "uscate",
    name: "Mălai galben de țară",
    description: "Mălai măcinat fin, fără aditivi, ambalat 1kg",
    price: 25,
    unit: "buc",
    unitValue: 1,
    emoji: "🌽",
  },
  {
    id: "61",
    categorySlug: "uscate",
    name: "Făină albă tip 550",
    description: "Făină albă din grâu de toamnă, premium, sac 5kg",
    price: 85,
    unit: "buc",
    unitValue: 5,
    emoji: "🌾",
  },
  {
    id: "62",
    categorySlug: "uscate",
    name: "Fasole albă boabe",
    description: "Fasole albă mărime medie, recoltă proaspătă, 1kg",
    price: 65,
    unit: "buc",
    unitValue: 1,
    emoji: "🫘",
  },
  {
    id: "63",
    categorySlug: "uscate",
    name: "Ardei iuți uscați",
    description: "Ardei iuți deshidratați la aer, snur tradițional 250g",
    price: 55,
    unit: "buc",
    unitValue: 0.25,
    emoji: "🌶️",
    badge: "Tradițional",
  },
];

export const COLET_LA_CHEIE_LAUNCHED = false; // toggle când e gata pentru lansare
export const COLET_LA_CHEIE_MIN_ORDER = 800; // MDL — comandă minimă pentru livrare în Europa
