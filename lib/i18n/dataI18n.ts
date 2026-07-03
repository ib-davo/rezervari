// Translation maps for data items that don't fit cleanly in the static dictionary
// (because they're indexed by id/slug coming from lib/data.ts).
// We don't duplicate the data — we keep IDs as keys and translate only the visible fields.

import type { Locale } from "./config";

type Translated<T> = Record<Locale, T>;

// Destination descriptions, by destination slug.
export const destinationDescription: Record<string, Translated<string>> = {
  anglia: {
    ro: "Cursă regulată Moldova - Anglia, de la 120 GBP, cu cele mai noi și confortabile autocare",
    ru: "Регулярный рейс Молдова - Англия, от 120 GBP, на новых и комфортабельных автобусах",
  },
  germania: {
    ro: "Cursă regulată Moldova - Germania, de la 120 Euro, cu plecări săptămânale",
    ru: "Регулярный рейс Молдова - Германия, от 120 Евро, с еженедельными отправлениями",
  },
  belgia: {
    ro: "Cursă regulată Moldova - Belgia, de la 120 Euro",
    ru: "Регулярный рейс Молдова - Бельгия, от 120 Евро",
  },
  olanda: {
    ro: "Cursă regulată Moldova - Olanda, de la 150 Euro",
    ru: "Регулярный рейс Молдова - Нидерланды, от 150 Евро",
  },
  luxemburg: {
    ro: "Cursă regulată Moldova - Luxemburg cu cele mai noi și confortabile autocare",
    ru: "Регулярный рейс Молдова - Люксембург на новых и комфортабельных автобусах",
  },
};

// Country display names, by destination slug.
export const destinationName: Record<string, Translated<string>> = {
  anglia: { ro: "Anglia", ru: "Англия" },
  germania: { ro: "Germania", ru: "Германия" },
  belgia: { ro: "Belgia", ru: "Бельгия" },
  olanda: { ro: "Olanda", ru: "Нидерланды" },
  luxemburg: { ro: "Luxemburg", ru: "Люксембург" },
};

// Services, by service slug.
export const serviceI18n: Record<
  string,
  { title: Translated<string>; description: Translated<string>; features: Translated<string[]> }
> = {
  "transport-de-persoane": {
    title: {
      ro: "Transport de persoane",
      ru: "Перевозка пассажиров",
    },
    description: {
      ro: "Transportul internațional de persoane este principala activitate a companiei noastre. Oferim cele mai bune prețuri și autobuze confortabile!",
      ru: "Международная перевозка пассажиров — основное направление нашей компании. Предлагаем лучшие цены и комфортабельные автобусы!",
    },
    features: {
      ro: [
        "Curse regulate în Anglia, Germania, Belgia, Olanda, Luxemburg",
        "Internet Starlink nelimitat pe toată ruta",
        "Prânz gratuit din partea companiei",
        "Ceai și cafea naturală nelimitat",
        "Asistență 24/24 de la însoțitoarea de bord",
        "Autocare moderne, climatizate, cu prize USB",
      ],
      ru: [
        "Регулярные рейсы в Англию, Германию, Бельгию, Нидерланды, Люксембург",
        "Безлимитный интернет Starlink на всём маршруте",
        "Бесплатный обед от компании",
        "Чай и натуральный кофе без ограничений",
        "Поддержка 24/24 от стюардессы",
        "Современные автобусы с кондиционером и USB-розетками",
      ],
    },
  },
  "transport-de-colete": {
    title: {
      ro: "Transport de colete",
      ru: "Перевозка посылок",
    },
    description: {
      ro: "Transport rapid și sigur de colete în toată Europa. Remorcă frigorifică separată pentru produse perisabile (carne, lactate, brânzeturi, fructe, legume) la temperatură controlată.",
      ru: "Быстрая и безопасная перевозка посылок по всей Европе. Отдельный рефрижератор для скоропортящихся товаров (мясо, молочное, сыры, фрукты, овощи) при контролируемой температуре.",
    },
    features: {
      ro: [
        "Remorcă frigorifică separată pentru produse alterabile",
        "Colectare colete din toată Moldova (vezi grafic)",
        "Integritate garantată — sigilare la preluare",
        "Plată cash sau card la livrare",
      ],
      ru: [
        "Отдельный рефрижератор для скоропортящихся товаров",
        "Сбор посылок по всей Молдове (см. график)",
        "Гарантия сохранности — пломбирование при приёме",
        "Оплата наличными или картой при доставке",
      ],
    },
  },
  "transport-de-marfa-pana-la-5-tone": {
    title: {
      ro: "Transport de mărfuri până la 5 t",
      ru: "Перевозка грузов до 5 т",
    },
    description: {
      ro: "Transport de mărfuri și marfă generală cu vehicule de până la 5 tone capacitate.",
      ru: "Перевозка грузов и сборных грузов на транспорте грузоподъёмностью до 5 тонн.",
    },
    features: {
      ro: [
        "Capacitate până la 5 tone",
        "Livrare rapidă",
        "Transport internațional",
        "Prețuri negociabile",
      ],
      ru: [
        "Грузоподъёмность до 5 тонн",
        "Быстрая доставка",
        "Международные перевозки",
        "Договорные цены",
      ],
    },
  },
};

// Testimonials, by testimonial id.
export const testimonialI18n: Record<string, Translated<string>> = {
  "1": {
    ro: "Am avut o experiență minunată cu compania de transport în Germania! Serviciul a fost excelent, șoferii profesioniști și autocarul foarte confortabil.",
    ru: "У меня был замечательный опыт поездки в Германию с этой транспортной компанией! Сервис отличный, водители профессиональные, а автобус очень комфортный.",
  },
  "2": {
    ro: "Foarte mulțumit de serviciile DAVO! Am călătorit în Anglia și totul a fost perfect. Recomand cu încredere!",
    ru: "Очень доволен услугами DAVO! Ездил в Англию — всё было идеально. Уверенно рекомендую!",
  },
  "3": {
    ro: "Am expediat colete în Belgia și totul a ajuns în siguranță și la timp. Personal foarte amabil și profesionist.",
    ru: "Отправлял посылки в Бельгию — всё пришло в целости и вовремя. Очень вежливый и профессиональный персонал.",
  },
  "4": {
    ro: "Cel mai bun serviciu de transport Moldova - Olanda! Autocar modern, Wi-Fi gratuit, și o călătorie plăcută.",
    ru: "Лучший транспорт Молдова - Нидерланды! Современный автобус, бесплатный Wi-Fi и приятная поездка.",
  },
  "5": {
    ro: "Am folosit transferul Chișinău - Iași și a fost perfect. Șoferul a fost punctual și foarte politicos. Mulțumesc DAVO!",
    ru: "Пользовался трансфером Кишинёв - Яссы — всё прошло идеально. Водитель пунктуальный и очень вежливый. Спасибо, DAVO!",
  },
};

// City names that differ between languages. Most stay the same (Latin names).
// Add an entry only when the Russian form differs meaningfully.
export const cityNameI18n: Record<string, Translated<string>> = {
  London: { ro: "London", ru: "Лондон" },
  Manchester: { ro: "Manchester", ru: "Манчестер" },
  Birmingham: { ro: "Birmingham", ru: "Бирмингем" },
  Cambridge: { ro: "Cambridge", ru: "Кембридж" },
  Nottingham: { ro: "Nottingham", ru: "Ноттингем" },
  Leicester: { ro: "Leicester", ru: "Лестер" },
  Coventry: { ro: "Coventry", ru: "Ковентри" },
  Luton: { ro: "Luton", ru: "Лутон" },
  "Milton Keynes": { ro: "Milton Keynes", ru: "Милтон Кейнс" },
  Northampton: { ro: "Northampton", ru: "Нортгемптон" },
  Peterborough: { ro: "Peterborough", ru: "Питерборо" },
  Bolton: { ro: "Bolton", ru: "Болтон" },
  "Frankfurt am Main": { ro: "Frankfurt am Main", ru: "Франкфурт-на-Майне" },
  Köln: { ro: "Köln", ru: "Кёльн" },
  Düsseldorf: { ro: "Düsseldorf", ru: "Дюссельдорф" },
  Nürnberg: { ro: "Nürnberg", ru: "Нюрнберг" },
  Würzburg: { ro: "Würzburg", ru: "Вюрцбург" },
  München: { ro: "München", ru: "Мюнхен" },
  Bonn: { ro: "Bonn", ru: "Бонн" },
  Wiesbaden: { ro: "Wiesbaden", ru: "Висбаден" },
  Mainz: { ro: "Mainz", ru: "Майнц" },
  Münster: { ro: "Münster", ru: "Мюнстер" },
  Osnabrück: { ro: "Osnabrück", ru: "Оснабрюк" },
  Essen: { ro: "Essen", ru: "Эссен" },
  Bruxelles: { ro: "Bruxelles", ru: "Брюссель" },
  Antwerpen: { ro: "Antwerpen", ru: "Антверпен" },
  Brugge: { ro: "Brugge", ru: "Брюгге" },
  Gent: { ro: "Gent", ru: "Гент" },
  Liège: { ro: "Liège", ru: "Льеж" },
  Amsterdam: { ro: "Amsterdam", ru: "Амстердам" },
  Rotterdam: { ro: "Rotterdam", ru: "Роттердам" },
  "Den Haag": { ro: "Den Haag", ru: "Гаага" },
  Utrecht: { ro: "Utrecht", ru: "Утрехт" },
  Eindhoven: { ro: "Eindhoven", ru: "Эйндховен" },
  Tilburg: { ro: "Tilburg", ru: "Тилбург" },
  Haarlem: { ro: "Haarlem", ru: "Харлем" },
  Leiden: { ro: "Leiden", ru: "Лейден" },
  Almere: { ro: "Almere", ru: "Алмере" },
  Breda: { ro: "Breda", ru: "Бреда" },
  "Luxembourg City": { ro: "Luxembourg City", ru: "Люксембург" },
  Chișinău: { ro: "Chișinău", ru: "Кишинёв" },
  Bălți: { ro: "Bălți", ru: "Бельцы" },
  Cahul: { ro: "Cahul", ru: "Кагул" },
  Comrat: { ro: "Comrat", ru: "Комрат" },
  Hîncești: { ro: "Hîncești", ru: "Хынчешты" },
  Ialoveni: { ro: "Ialoveni", ru: "Яловены" },
  Orhei: { ro: "Orhei", ru: "Оргеев" },
  Soroca: { ro: "Soroca", ru: "Сороки" },
  Ungheni: { ro: "Ungheni", ru: "Унгены" },
  Edineț: { ro: "Edineț", ru: "Единцы" },
  Căușeni: { ro: "Căușeni", ru: "Каушаны" },
  Strășeni: { ro: "Strășeni", ru: "Страшены" },
  Cimișlia: { ro: "Cimișlia", ru: "Чимишлия" },
  Drochia: { ro: "Drochia", ru: "Дрокия" },
  Fălești: { ro: "Fălești", ru: "Фалешты" },
  Balabanu: { ro: "Balabanu", ru: "Балабану" },
};

export function localizeCity(name: string, locale: Locale): string {
  return cityNameI18n[name]?.[locale] ?? name;
}

export function localizeDestinationName(slug: string, locale: Locale, fallback: string): string {
  return destinationName[slug]?.[locale] ?? fallback;
}

export function localizeDestinationDescription(slug: string, locale: Locale, fallback: string): string {
  return destinationDescription[slug]?.[locale] ?? fallback;
}

export function localizeServiceTitle(slug: string, locale: Locale, fallback: string): string {
  return serviceI18n[slug]?.title?.[locale] ?? fallback;
}

export function localizeServiceDescription(slug: string, locale: Locale, fallback: string): string {
  return serviceI18n[slug]?.description?.[locale] ?? fallback;
}

export function localizeServiceFeatures(slug: string, locale: Locale, fallback: string[]): string[] {
  return serviceI18n[slug]?.features?.[locale] ?? fallback;
}

export function localizeTestimonial(id: string, locale: Locale, fallback: string): string {
  return testimonialI18n[id]?.[locale] ?? fallback;
}
