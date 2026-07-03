// Country + city FAQ builders, per locale. Used by app/(site)/[lang]/[slug]/page.tsx.

import type { City, Destination } from "@/types";
import type { Locale } from "@/lib/i18n/config";
import { localizeDestinationName, localizeCity } from "@/lib/i18n/dataI18n";
import { ro } from "@/lib/i18n/dictionaries/ro";
import { ru } from "@/lib/i18n/dictionaries/ru";

type Sched = {
  outboundLabel: string;
  returnLabel: string;
  outboundDuration: string;
  returnDuration: string;
  fullSentence: string;
} | null | undefined;

type FaqItem = { q: string; a: string };

// ---------------------------------------------------------------------------
// Country FAQ
// ---------------------------------------------------------------------------
export function buildCountryFaq(
  destination: Destination,
  sched: Sched,
  locale: Locale
): FaqItem[] {
  const country = localizeDestinationName(destination.slug, locale, destination.name);
  const price = destination.price || "120";
  const currency = destination.currency;
  const items: FaqItem[] = [];

  if (locale === "ru") {
    if (sched) {
      items.push({
        q: `Когда отправляется автобус из Молдовы в ${country}?`,
        a: `${sched.fullSentence} Отправление еженедельное, время остаётся одним и тем же — точку посадки подтверждаем по телефону/SMS за день до выезда.`,
      });
      items.push({
        q: `Когда обратный рейс из ${country} в Молдову?`,
        a: `Обратный рейс отправляется ${sched.returnLabel.toLowerCase()} из ${country}. Место посадки согласуем с пассажирами до отправления.`,
      });
    }
    items.push({
      q: `Сколько стоит билет Молдова - ${country}?`,
      a: `Стартовая цена ${price}${currency} в одну сторону, зависит от города и сезона. Точную цену для вашего маршрута увидите прямо в форме бронирования.`,
    });
    items.push({
      q: `Из каких городов Молдовы можно отправиться?`,
      a: `Автобус DAVO Group забирает пассажиров из: Яловены, Хынчешты, Чимишлия, Комрат, Балабану и Кагул. Отправление — от офиса DAVO в Кишинёве (ул. Каля Иешилор 11/3). При бронировании указываете свой город, а точку посадки согласуем по телефону.`,
    });
    items.push({
      q: `Можно ли отправить посылку в страну ${country}?`,
      a: `Да. У нас есть отдельный рефрижератор для скоропортящихся посылок (еда, сладости, выпечка) и обычный прицеп для обычных посылок. Забор по всей Молдове, доставка до двери получателя в стране ${country}.`,
    });
    items.push({
      q: `Какие удобства на борту?`,
      a: `Безлимитный Wi-Fi Starlink (даже на трассе), USB-розетки у каждого места, бесплатный горячий обед, чай и натуральный кофе, раскладные кресла, кондиционер, стюардесса на протяжении всей поездки, остановки для отдыха.`,
    });
    // First three FAQ items, RU
    items.push(...(ru.faq.questions as FaqItem[]).slice(0, 3));
    return items;
  }

  // RO
  if (sched) {
    items.push({
      q: `Când pleacă autocarul din Moldova spre ${country}?`,
      a: `${sched.fullSentence} Plecarea e săptămânală, ora exactă rămâne aceeași — îți confirmăm punctul de îmbarcare prin telefon/SMS cu o zi înainte.`,
    });
    items.push({
      q: `Când e returul din ${country} spre Moldova?`,
      a: `Returul pleacă ${sched.returnLabel.toLowerCase()} din ${country}. Locul de îmbarcare se confirmă cu pasagerii înainte de plecare.`,
    });
  }
  items.push({
    q: `Cât costă un bilet Moldova - ${country}?`,
    a: `Prețul de pornire e ${price}${currency} pe sens, în funcție de oraș și sezon. Verifici prețul exact pentru ruta ta direct în formularul de rezervare.`,
  });
  items.push({
    q: `Din ce orașe din Moldova pot pleca?`,
    a: `Autocarul DAVO Group preia pasageri din: Ialoveni, Hîncești, Cimișlia, Comrat, Balabanu și Cahul. Plecarea se face de la sediul DAVO din Chișinău (Calea Ieșilor 11/3). La rezervare alegi orașul tău și coordonăm punctul exact prin telefon.`,
  });
  items.push({
    q: `Pot trimite un colet în ${country}?`,
    a: `Da. Avem remorcă frigorifică separată pentru colete perisabile (mâncare, dulciuri, plăcinte) și remorcă obișnuită pentru pachete normale. Preluare din toată Moldova, livrare la ușa destinatarului din ${country}.`,
  });
  items.push({
    q: `Ce facilități am la bord?`,
    a: `Wi-Fi Starlink nelimitat (chiar și pe autostradă), prize USB la fiecare scaun, prânz cald gratuit, ceai și cafea naturală, scaune reclinabile, aer condiționat, însoțitoare de bord pe toată cursa, oprire pentru pauze.`,
  });
  items.push(...(ro.faq.questions as FaqItem[]).slice(0, 3));
  return items;
}

// ---------------------------------------------------------------------------
// City FAQ
// ---------------------------------------------------------------------------
export function buildCityFaq(
  city: City,
  destination: Destination,
  sched: Sched,
  locale: Locale
): FaqItem[] {
  const cityName = localizeCity(city.name, locale);
  const country = localizeDestinationName(destination.slug, locale, destination.name);
  const price = destination.price || "120";
  const currency = destination.currency;
  const items: FaqItem[] = [];

  if (locale === "ru") {
    items.push({
      q: `Как добраться из Кишинёва в ${cityName}?`,
      a: `DAVO Group выполняет регулярный рейс Кишинёв → ${cityName} (${country})${sched ? `, отправление ${sched.outboundLabel.toLowerCase()} и обратный ${sched.returnLabel.toLowerCase()}` : ""}. Современный автобус с Wi-Fi Starlink, включённым обедом и стюардессой 24/24.`,
    });
    items.push({
      q: `Сколько стоит билет Кишинёв - ${cityName}?`,
      a: `Стартовая цена ${price}${currency} в одну сторону. На туда-обратно действует скидка — точную цену получите в форме бронирования.`,
    });
    if (sched) {
      items.push({
        q: `Когда отправляется автобус в ${cityName}?`,
        a: `Еженедельное отправление: ${sched.outboundLabel} из Кишинёва. Обратный рейс из ${cityName}: ${sched.returnLabel}. Точку посадки подтверждаем с каждым пассажиром по телефону перед поездкой.`,
      });
    }
    items.push({
      q: `Можно ли отправить посылку в ${cityName}?`,
      a: `Да, доставляем посылки в ${cityName} до двери получателя. Для скоропортящихся товаров (еда, выпечка, сладости) есть отдельный рефрижератор. Детали и тарифы — при бронировании посылки.`,
    });
    items.push({
      q: `Багаж включён?`,
      a: `Да — 35 кг в багажном отделении + 5 кг ручной клади бесплатно для каждого пассажира. Дополнительный багаж — по предварительной договорённости по сниженной цене.`,
    });
    items.push(...(ru.faq.questions as FaqItem[]).slice(0, 3));
    return items;
  }

  // RO
  items.push({
    q: `Cum ajung de la Chișinău la ${cityName}?`,
    a: `DAVO Group operează cursă regulată Chișinău → ${cityName} (${country})${sched ? `, plecare ${sched.outboundLabel.toLowerCase()} și retur ${sched.returnLabel.toLowerCase()}` : ""}. Autocar modern dotat cu Wi-Fi Starlink, prânz inclus și însoțitoare 24/24.`,
  });
  items.push({
    q: `Cât costă biletul Chișinău - ${cityName}?`,
    a: `Prețul de pornire e ${price}${currency} pe sens, dus simplu. Pentru tur-retur ai reducere — cere ofertă exactă în formularul de rezervare.`,
  });
  if (sched) {
    items.push({
      q: `Când pleacă autocarul în ${cityName}?`,
      a: `Plecare săptămânală: ${sched.outboundLabel} din Chișinău. Returul din ${cityName}: ${sched.returnLabel}. Confirmăm cu fiecare pasager punctul exact de îmbarcare prin telefon înainte de cursă.`,
    });
  }
  items.push({
    q: `Pot să trimit un colet la ${cityName}?`,
    a: `Da, livrăm colete în ${cityName} la ușa destinatarului. Pentru perisabile (mâncare, plăcinte, dulciuri) avem remorcă frigorifică separată. Detalii și tarife la rezervarea coletului.`,
  });
  items.push({
    q: `Bagajul meu e inclus?`,
    a: `Da — 35 kg de cală + 5 kg bagaj de mână gratuit pentru fiecare pasager. Pentru bagaj suplimentar ne înțelegem prealabil la preț redus.`,
  });
  items.push(...(ro.faq.questions as FaqItem[]).slice(0, 3));
  return items;
}

// ---------------------------------------------------------------------------
// Metadata builders (titles + descriptions, per locale)
// ---------------------------------------------------------------------------
export function buildCountryMeta(
  destination: Destination,
  sched: Sched,
  locale: Locale
): { title: string; description: string } {
  const country = localizeDestinationName(destination.slug, locale, destination.name);
  const price = destination.price || "120";
  const currency = destination.currency;
  const desc = destination.description; // we'll override below from translation
  const localizedDesc =
    locale === "ru"
      ? `Регулярный рейс Молдова - ${country}, от ${price}${currency}`
      : desc;

  if (locale === "ru") {
    const sn = sched ? ` Отправление ${sched.outboundLabel}, обратный ${sched.returnLabel}.` : "";
    return {
      title: `Транспорт Молдова ⇋ ${country} | Еженедельные рейсы${sched ? ` ${sched.outboundLabel}` : ""}`,
      description: `${localizedDesc}.${sn} ${destination.cities.length} городов доступно. Отправление из Кишинёва с забором пассажиров из Яловены, Хынчешты, Чимишлия, Комрат, Балабану и Кагул. Wi-Fi Starlink, бесплатный обед, стюардесса 24/24. Цена от ${price}${currency}. Бронируйте онлайн.`,
    };
  }

  const sn = sched ? ` Plecare ${sched.outboundLabel}, retur ${sched.returnLabel}.` : "";
  return {
    title: `Transport Moldova ⇋ ${country} | Curse săptămânale${sched ? ` ${sched.outboundLabel}` : ""}`,
    description: `${desc}.${sn} ${destination.cities.length} orașe disponibile. Plecare din Chișinău, cu preluare pasageri din Ialoveni, Hîncești, Cimișlia, Comrat, Balabanu și Cahul. Wi-Fi Starlink, prânz gratuit, însoțitoare 24/24. Preț de la ${price}${currency}. Rezervă online.`,
  };
}

export function buildCityMeta(
  city: City,
  destination: Destination,
  sched: Sched,
  locale: Locale
): { title: string; description: string } {
  const cityName = localizeCity(city.name, locale);
  const country = localizeDestinationName(destination.slug, locale, destination.name);
  const price = destination.price || "120";
  const currency = destination.currency;

  if (locale === "ru") {
    const sn = sched ? ` Отправление ${sched.outboundLabel} из Кишинёва, обратный ${sched.returnLabel} из ${country}.` : "";
    return {
      title: `Автобус Кишинёв ⇋ ${cityName}, ${country} | Билет от ${price}${currency}`,
      description: `Регулярный транспорт Кишинёв → ${cityName}, ${country} от ${price}${currency}.${sn} Безлимитный Wi-Fi Starlink, бесплатный обед, стюардесса 24/24, рефрижератор для скоропортящихся посылок. Бронируйте онлайн.`,
    };
  }

  const sn = sched ? ` Plecare ${sched.outboundLabel} din Chișinău, retur ${sched.returnLabel} din ${destination.name}.` : "";
  return {
    title: `Autocar Chișinău ⇋ ${city.name}, ${destination.name} | Bilet de la ${price}${currency}`,
    description: `Transport regulat Chișinău → ${city.name}, ${destination.name} de la ${price}${currency}.${sn} Internet Starlink nelimitat, prânz gratuit, însoțitoare 24/24, remorcă frigorifică pentru colete perisabile. Rezervă online.`,
  };
}
