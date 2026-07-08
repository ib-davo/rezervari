# DAVO — Panou Operatori · MEMORY / HANDOFF

> Document de predare pentru continuarea proiectului de către alt AI/dezvoltator.
> Proiect: `~/Desktop/davo-operatori` (Next.js 16). Sursa „mamă": `~/testing api/davo-website` (site-ul davo).
> Ultima actualizare context: iulie 2026.

---

## 0. TL;DR
Aplicație internă pentru 7 operatori telefonici DAVO. Ei creează/gestionează rezervări de pe telefon.
Folosește **exact aceeași bază Supabase Postgres ca site-ul davo** → rezervările apar instant pe ambele,
fără cod de sincronizare (e literal același rând în tabela `Booking`).

- Login: nume + **PIN 4 cifre**.
- Formular de rezervare = **același ca pe site davo** (direcție → cursă → scaune → date → plată), dar randat **în panou** (fără chrome-ul davo).
- Dashboard: rezervări **active** (live, Supabase Realtime) + **arhivă** (cursele trecute).
- Fiecare rezervare arată **cine a făcut-o** (operator / client site / admin) și **statutul de confirmare**.

---

## 1. Prompturile utilizatorului (verbatim, în ordine)

**[P1] Cerința inițială:**
> trebuie de facut un alt proiect. pe desktop. legat de acest proiect. sa fie unit cu rezervarile davo. acolo vor fi 5 operatori. cand operator 1 adauga o rezervare noua, trebuie sa fie cu acelasi formular ca pe davo, de ce? ca sa apara instant de pe vercelul nou si pe davo. daca facem o rezervare pe davo manuala -> sa apara pe vercel. daca un client face rezervare pe site -> apare si pe davo si pe vercel. daca op2 face rezervare pe vercel, apare si pe davo si pentru ceilalti operatori de pe vercel. sa scrie cine a facut-o si pe davo si pe vercel. sa fie pe vercel statutul de confirmare ca si pe davo, fie el manual, fie el din email de la client. cand cursa deja a avut loc, pleaca in arhiva, se salveaza, dar de pe vercel pleaca, ca sa nu incurce vizual. operatori: adrian, olga, dumitru, alexandru, ghenadie, catalin, gabriela. fiecare se va loga cu un pin de 4 cifre. rezervarea trebuie sa fie asemanatoare ca cum cleintul isi rezerveaza pe site, adica good ui ux, chiar daca e manuala de pe vercel. ia datele la baza de date davo de aici. dupa lasa placeholdere si zi ce trebuie din baza de date noua si da mi schema sql.

**[P2] Răspuns la întrebări (DB / realtime / cum procedăm):**
> DB: „FOLOSESTE DAVO + O ALTA BAZA DE DATE." · Realtime: „Supabase Realtime (push)" · Pași: „fii atent, crezi ca se poate tot in aceasi baza de date supabase fara sa stricam ceea ce merge deja? vorbim asta si dupa te apuci de tot odata one shot"

**[P3] Decizie finală:**
> one shot on single db
> 1. ia-le din env local si punele tu acolo
> 2. genereaza simple dar nu 1111, mai multe 1188 sau 1919 sau 6767

**[P4] Buguri raportate:**
> Eroare la procesarea rezervării cand fac.
> si nu vreau sa ma duca pe interfata davo cand pun comanda noua

**[P5] UI telefon:**
> trebuie sa fie cat mai comod ui pentru telefon la operatori

**[P6] Compactare:**
> si clientii afisari pe curse gen trebuie sa fie mai compact, ca e prea insirat

**[P7] Acest document:**
> da-mi memory.md cu toate prompturile si tot. ca sa ii dau in alt terminal altui ai sa continue. da i si prompturile mele

---

## 2. Arhitectură & decizii cheie

- **O singură bază Supabase**, partajată cu davo. Sincron instant = fără sync, e aceeași tabelă `Booking`.
  (Deși P2 zicea „davo + o altă bază", am ales single-DB fără FK rigid ca să nu stricăm davo — vezi §13.)
- Proiect Next.js **separat** (deploy Vercel separat), obținut prin **copierea proiectului davo** apoi
  stripat/gated ca panou operatori. Astfel formularul e IDENTIC cu al site-ului (cerința P1).
- **Realtime**: Supabase Realtime pe tabela `Booking` (push). Fallback: polling 15s dacă lipsește anon key.
- **Emailuri**: create de operator → confirmarea pleacă imediat (Resend, cont davo). Remindere automate le
  trimite **davo** (cron-ul lui, din tabela partajată `EmailJob`) — am șters cr, on-urile davo din acest proiect
  ca să NU se trimită dublu.
- **Confirmare**: refolosim câmpurile existente `Booking.status` + `Booking.passengerResponse` (din emailul clientului). Nicio coloană nouă pentru confirmare.
- **Arhivă**: „cursa a trecut" = ultima dată relevantă (retur dacă există, altfel plecarea) < azi. Filtrare pe dată în query + coloană `archivedAt` + cron zilnic.

---

## 3. Baza de date (adiție APLICATĂ pe DB-ul live)

Supabase project ref: `njdxbwpsdzsgnjfrxbvd` (host: `aws-0-eu-west-1.pooler.supabase.com`).
Migrație aplicată: `prisma/migrations/20260626120000_operators_panel/` (rulată cu `prisma migrate deploy`).
**100% aditiv** — davo neatins. Aceleași câmpuri au fost adăugate și în `~/testing api/davo-website/prisma/schema.prisma` (necomis) ca migrațiile viitoare davo să nu le șteargă.

```sql
-- Tabel nou
CREATE TABLE "Operator" (
  "id" TEXT PRIMARY KEY, "name" TEXT NOT NULL, "slug" TEXT NOT NULL UNIQUE,
  "pinHash" TEXT NOT NULL, "role" TEXT NOT NULL DEFAULT 'operator',
  "active" BOOLEAN NOT NULL DEFAULT true, "lastLogin" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
-- Coloane noi pe Booking (toate default/nullable → nu strică INSERT-urile davo)
ALTER TABLE "Booking" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'site';   -- site | operator | admin
ALTER TABLE "Booking" ADD COLUMN "createdById" TEXT;                       -- Operator.id
ALTER TABLE "Booking" ADD COLUMN "createdByName" TEXT;                     -- snapshot nume
ALTER TABLE "Booking" ADD COLUMN "archivedAt" TIMESTAMP(3);
-- FK ON DELETE SET NULL + indexuri (source, archivedAt, createdById)
-- Realtime: ALTER PUBLICATION supabase_realtime ADD TABLE "Booking";  (deja rulat)
```

Prisma models corespunzătoare sunt în `prisma/schema.prisma` (model `Operator` + câmpurile pe `Booking`).

---

## 4. Fișiere adăugate / modificate (hartă)

**Adăugate (specifice panoului):**
- `lib/operatorSession.ts` — sesiune HMAC operator, cookie `davo_operator` (secret: `OPERATOR_SESSION_SECRET` env, fallback Settings DB).
- `lib/supabaseClient.ts` — client browser DOAR pentru Realtime (null dacă lipsește/placeholder anon key).
- `prisma/seed-operators.ts` — seed 7 operatori (PIN bcrypt). `npm run seed:operators`.
- `app/api/operator/login|logout|me|list/route.ts` — auth operator (`list` e public, pt. ecranul de login).
- `app/api/operator/bookings/route.ts` (GET active/archived), `.../[id]/route.ts` (PATCH status/plată/arhivă).
- `app/api/cron/archive-past/route.ts` — setează `archivedAt` pt. curse trecute (protejat cu `CRON_SECRET`).
- `app/(panou)/panou/login/page.tsx` — PIN pad (select nume → 4 cifre).
- `app/(panou)/panou/(app)/layout.tsx` — chrome panou: header + **bară nav jos pt. mobil** (Active / ➕ FAB / Arhivă).
- `app/(panou)/panou/(app)/page.tsx` (active) + `arhiva/page.tsx` + `rezervare/page.tsx` (`<BookingForm embedded />`).
- `components/operator/BookingsView.tsx` — listă compactă + Realtime/polling + acțiuni (confirmă/anulează/achitat/arhivează).
- `components/booking/BookingForm.tsx` — formularul site extras din pagina rezervare; prop `embedded` ascunde chrome-ul davo (RouteHero/ColetPromoBand/BenefitsStrip) și randează success compact cu „Înapoi la panou".

**Modificate:**
- `proxy.ts` — REBUILT: gate tot pe sesiune operator; blochează `/admin` + `/api/admin`; `/` → `/panou`; rescriere `/ro` doar pt. paginile de formular.
- `app/api/bookings/route.ts` — adăugat: citește cookie-ul operator → stampilează `source='operator'`, `createdById`, `createdByName`. (Are și pricing de colet corect — modificat ulterior de user/linter.)
- `lib/bookingToken.ts` — `SESSION_SECRET` cade pe secretul partajat din `Settings` DB dacă env lipsește (fix pt. „Eroare la procesarea rezervării").
- `app/(site)/[lang]/rezervare/page.tsx` — redus la wrapper: `return <BookingForm />`.
- `package.json` — name `davo-operatori`, port 3001, `@supabase/supabase-js`, script `seed:operators`, `prisma.seed → seed-operators.ts`, eliminat `claude` dep. (fără `db:push`/`migrate dev` ca să nu strice DB-ul partajat).
- `vercel.json` — cron doar `/api/cron/archive-past` (eliminat `send-reminders` ca să nu dubleze emailuri).

**Șterse din copie:** `app/api/cron/send-reminders`, `app/api/cron/generate-trips`, `.vercel/`, junk (AWSCLIV2.pkg etc.). Davo admin (`/admin`) există în cod dar e blocat de proxy.

---

## 5. Operatori & PIN-uri

7 operatori: adrian, olga, dumitru, alexandru, ghenadie, catalin, gabriela.

**PIN-urile NU se mai țin în cod** (versiunea veche cu PIN-uri în clar în
`seed-operators.ts` a fost expusă în repo-ul public → rotite). Acum vin din
variabila `OPERATOR_PINS` din `.env.local` (gitignored) și din Vercel:

```
OPERATOR_PINS="adrian:XXXX,olga:XXXX,..."   # 4 cifre fiecare
```

Schimbare PIN: editează `OPERATOR_PINS` în `.env.local` → `npm run seed:operators`.
Valorile curente sunt DOAR în `.env.local` (nu în acest fișier — e urmărit de git).

---

## 6. Env & secrete & PLACEHOLDERE rămase

Secretele reale sunt în `.env.local` și `.env` (NU în acest doc). Conțin: `DATABASE_URL`, `DIRECT_URL`
(același Supabase ca davo), `RESEND_API_KEY`, `EMAIL_FROM`, `NEXT_PUBLIC_APP_URL="https://davo.md"`,
`OPERATOR_SESSION_SECRET` (generat), `CRON_SECRET` (generat), `NEXT_PUBLIC_SUPABASE_URL`.

**⚠️ De completat (2 placeholdere):**
1. `NEXT_PUBLIC_SUPABASE_ANON_KEY` — momentan `PLACEHOLDER_...`. Pune cheia reală din
   Supabase → Project Settings → API → `anon public`. Fără ea → dashboard pe polling 15s (badge „15s"); cu ea → „Live".
2. `SESSION_SECRET` (comentat în `.env.local`) — pune valoarea EXACTĂ din davo (Vercel) DOAR dacă vrei ca
   butoanele Confirm/Anulează **din emailul clientului** să se verifice pe davo.md. Booking-ul + confirmarea manuală merg și fără.

---

## 7bis. DEPLOY LIVE (4 iulie 2026)

- **Panou operatori LIVE: https://davo-operatori.vercel.app** (proiect Vercel `xdmy1s-projects/davo-operatori`, prj_Ezr7G7EnedvGjiRGHDTX4kd5WYXw). Toate env-urile din `.env.local` setate în Vercel (production), inclusiv `OPERATOR_PINS`. Deployment Protection (SSO) DEZACTIVAT via API (`ssoProtection: null`) ca operatorii să poată intra — aplicația are auth-ul ei cu PIN prin proxy.ts. Verificat: login, /trips, /buses merg pe prod.
- **davo.md redeployat** (proiect `davo-qv2s`, prin git push pe github.com/xdmy1/davo) — are etichetele de admin (`source='admin'`) + coloana `manualBusId` în schema/client. Schema davo acum comisă cu toate câmpurile operator-panel (erau necomise).
- Deploy davo-operatori: CLI-ul vechi (44) nu mergea → `npx vercel@latest --prod --yes`. La update-uri viitoare: fie `npx vercel@latest --prod`, fie conectează repo-ul `ib-davo/rezervari` la proiectul Vercel pt. auto-deploy pe push.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` = încă placeholder în Vercel → realtime pe polling 15s. Pune cheia reală în Vercel env + redeploy pt. „Live".

## 7ter. Runda 7 (4 iul 2026) — exporturi + curse goale pe calendar

- **Export refăcut** (userul: „excelurile sunt praf/urate"): **Excel = .xlsx REAL** generat pe server cu `exceljs` — `GET /api/operator/manifest?key=<groupKey>` (antet colorat navy, borduri, lățimi, plată colorată, total). Butonul „Excel" e acum un `<a href>` (cookie same-origin). **PDF redesign** complet în `lib/tripManifest.ts` (antet DAVO GROUP, pastilă pasageri, rânduri alternante, coloană Observații). Ambele: doar pasageri ACTIVI (cancelled excluși).
- Gruparea extrasă în **`lib/tripGrouping.ts`** (partajată de dashboard + export). Ocuparea exclude cancelled.
- **Curse goale pe calendar** (userul: „arată și cursele goale, cele cu pasageri special, cele goale goale"): endpoint returnează `scheduledDays` + carduri `kind:"empty"` (autobuz+zi programat fără rezervări — un autobuz/zi = o cursă). Calendar: zile cu pasageri = roșu+număr; zile programate goale = conturate+punct; legendă. Card gol mut cu „+ Rezervare pe cursă". ATENȚIE date: toate cele ~918 curse auto-generate au ACELAȘI autobuz (DAW 077) → grupate pe autobuz+zi dau ~1 cursă fizică/zi de plecare (bine).
- **Redeployat** pe davo-operatori.vercel.app (`npx vercel@latest --prod`; CLI-ul global e vechi). Verificat pe prod: 66 grupuri (62 goale), xlsx 200.
- `exceljs` adăugat în dependencies.

## 7quater. Runda 8 (7 iul 2026) — PROGRAM FIX autobuze (`lib/busSchedule.ts`)

Userul a definit programul săptămânal al celor 3 autobuze. Aplicat în COD (nu în DB) prin override în `lib/tripGrouping.ts` — gruparea pune autobuzul corect după zi+țară, iar cardurile goale se generează din program.
- **DUS (Moldova→Europa):** JOI → **DAW 077** (Anglia+Luxemburg+Belgia, fără Liège); VINERI → **ZNQ 874** (Belgia+Olanda+Germania); excepție **10 iul → DAW 777**.
- **RETUR (tur-retur, același autobuz):** după țara de origine — BE/OL/DE → ZNQ 874, Anglia/Lux → DAW 077; excepție **12 iul → DAW 777**. Se aplică și rezervărilor loose (după „Oraș, Țară").
- Cardurile goale (kind:empty) generate pt. fiecare joi/vineri din program: „Chișinău → Anglia, Luxemburg, Belgia" + „+ Rezervare pe cursă". DB-ul deja generează cursele DUS pe joi (166)/vineri (360), retur duminică — deci coerent cap-coadă.
- Plăcuțe DB exacte: `DAW 077`, `DAW 777` (Astromega 89 locuri), `ZNQ 874` (51 locuri).

⚠️ **PRESUPUNERI făcute (userul n-a apucat să confirme — de verificat):** (1) DAW 777 doar weekendul 10–12 iul; (2) Belgia deservită AMBELE zile (joi+vineri); (3) Liège doar vineri (ZNQ 874); (4) retururi: zi liberă, mapate DOAR după țara de origine; (5) implementat în cod, fără scriere în DB. Dacă vreuna e greșită → schimbă `scheduleForDay`/`scheduledPlateForTrip` în `lib/busSchedule.ts`.

## 7quinquies. Runda 9 (7 iul 2026) — Schimbă autocarul (în proiectul davo, LIVE pe davo.md)

Feature în `~/testing api/davo-website` (adminul davo.md, nu panoul operatorilor):
- **`POST /api/admin/trips/[id]/change-bus`** `{busId, notify}`: schimbă autobuzul cursei, **remapează locurile** (păstrează același număr dacă există pe noul autobuz, altfel unul liber la întâmplare; dedup pe `[tripId,seatNumber]` prin delete+recreate în tranzacție), actualizează `capacity`. Dacă `notify` → **email către toți pasagerii** cu locul nou + scuze dacă s-a schimbat (template `busChangeHtml` în `lib/emailTemplates.ts`, brand DAVO), log în `EmailLog`. Fallback: dacă nu-s destule locuri → cei rămași fără loc, emailul zice „va fi comunicat".
- **UI**: `app/(admin)/admin/trips/page.tsx` → modalul manifest (click pe o cursă) → secțiune „Schimbă autocarul": dropdown autobuz + checkbox „Anunță pasagerii" + buton (cu confirm).
- Verificat: algoritm remapare (unit, toate scenariile), typecheck davo curat, deploy davo Ready. NU testat cu email real (producție, clienți reali) — userul face primul test din admin.
- ⚠️ Endpoint-ul NU se declanșează automat — doar la apăsarea butonului. Recomandat: prima dată testează cu „Anunță" DEBIFAT (verifici remaparea), apoi cu email pe o cursă reală.

## 7sexies. Runda 10 (8 iul 2026) — SINCRONIZARE totală, DB sursa unică, cursă pe ȚARĂ

Userul: „totul sincronizat, DB-driven, cursă = per autocar + per dată + per ȚARĂ (nu oraș; o cursă cuprinde toate orașele unei țări + mai multe țări)". Refăcut din programul-în-cod → **program în DB**:
- **Aliniere DB** (script `scratchpad/align-db.js`, rulat cu --apply): scris busId corect pe **1060 curse** conform programului (909 DAW 077→ZNQ 874 vinerile, 151→DAW 777 pe 10–12 iul), remapat 7 locuri. Verificat: Joi DUS=DAW 077, Vin DUS=ZNQ 874(+DAW 777 pe 10), retururi pe țara de origine. **DB = sursa unică acum.** Reversibil (toate erau DAW 077).
- **Panou operatori** (`lib/tripGrouping.ts`): scos override-ul `busSchedule` — citește `trip.bus` din DB. Rezervările loose (fără cursă) se leagă de run-ul fizic din DB după zi+direcție+țară (`runBusByKey`). Afișare pe **ȚARĂ** (`joinCountries`, dedup+sortat). Carduri goale din DB. `lib/busSchedule.ts` ȘTERS.
- **Admin davo** (`app/(admin)/admin/trips/page.tsx`): lista grupată în **carduri de cursă** (autocar+zi+direcție), afișare pe țară, ocupare totală, status uniform/mixt pe toate rutele, click→pasageri+change-bus. GET `/api/admin/trips` +originCountry/destinationCountry/busPlate.
- **Sincronizare**: admin schimbă autobuz → scrie DB → apare instant pe panou (ambele citesc `trip.bus`). Change-bus e pe tot run-ul (vezi runda 9).
- ⚠️ De verificat vizual adminul davo.md (n-am putut testa cu sesiune admin). ⚠️ Generatorul de curse (`tripGenerator`) încă pune bus default — cursele noi generate pe viitor vor trebui re-aliniate (sau fă generatorul schedule-aware).

## 7septies. Runda 11 (8 iul 2026) — 3 cereri noi

**C. Preț manual pe rezervare (panou) — FĂCUT + LIVE.** `components/booking/BookingForm.tsx` (doar `embedded`): câmp „Preț manual" în pasul Plată care suprascrie totalul. `app/api/bookings/route.ts`: operator autentificat → `body.customPrice` suprascrie prețul; publicul ignorat (endpoint oricum operator-only, 401). Verificat: operator customPrice=7→preț 7; public→401.

**B. Curse pe 1 an ca program RECURENT — FĂCUT + LIVE.** Userul a zis „b go". Implementat calendar VIRTUAL pe tot anul, fără materializare:
- `lib/busSchedule.ts` (RESTAURAT, altă formă): `busPlateForCountry` (Anglia/Lux→DAW 077, Germania/Belgia/Olanda→ZNQ 874), `busPlateForRun`, `scheduledRunsForDate` (din programul pe țări Country.outbound/returnWeekday+Time).
- Panou (`lib/tripGrouping.ts`): cardurile goale sunt VIRTUALE, generate pe 366 zile din regulă (nu din curse materializate). Verificat: 209 zile programate (9 iul 2026→8 iul 2027), 257 carduri, zero rânduri noi în DB. Loose legate prin `busPlateForRun`.
- Materializare LAZY (exista deja: `ensureTripsForSchedule` în `app/api/public/trips` din AMBELE proiecte): cursa reală se creează doar când cineva rezervă; acum primește autobuzul corect din regulă (`plate`), nu default. Verificat lazy Luxemburg→DAW 077.
- Cursele DAW 777 pe 10-12 iul rămân materializate (specialul aliniat); regula recurentă viitoare = joi DAW 077 / vineri ZNQ 874.
- ⚠️ Generatoarele bulk (`lib/tripGenerator.ts` ambele) încă pun bus default — NU le mai folosi (lazy le înlocuiește). De curățat/deprecat eventual.

**A. Stocare + unificare clienți davo + colete.vercel.app — ULTERIOR** (userul a zis „ulterior"). davo are deja `admin/clients`. `colete.vercel.app` = proiect separat de colete.

## 7. Rulare / build / deploy

```bash
cd ~/Desktop/davo-operatori
npm install
npm run seed:operators     # o dată, dacă tabela Operator e goală
npm run dev                # http://localhost:3001
npm run build              # verificare producție (prisma generate && next build)
```
**Deploy:** proiect Vercel NOU din acest folder; copiază variabilele din `.env.local` în Vercel env.
Cron arhivare configurat în `vercel.json` (zilnic 02:00).

---

## 8. Probleme rezolvate (istoric)

- **„Eroare la procesarea rezervării"** = `SESSION_SECRET not set` în `lib/bookingToken.ts` (davo îl are doar pe Vercel).
  Fix: fallback la secretul partajat din `Settings` DB. Verificat: booking creat + email trimis + `source='operator'`.
- **„Nu vreau interfața davo la comandă nouă"** — formularul mutat în panou la `/panou/rezervare` (`<BookingForm embedded />`), fără header/nav/footer/marketing davo.
- Cele 3 rezervări de test folosite la depanare au fost ȘTERSE din DB.

---

## 9. UI mobil (P5 + P6)

- **Bară de navigare jos** (thumb-friendly) pe telefon: Active · ➕ Rezervare nouă (FAB roșu central) · Arhivă. Tab-urile sus doar pe desktop. Header compact. `pb-28` + safe-area pt. iPhone.
- **Carduri compacte** (nu mai sunt înșirate): 3 linii scurte — [status·nr·cine·preț] / [rută·dată·pax·✓client] / [pasager·telefon tap-to-call]. Acțiunile ascunse sub un buton „Acțiuni" (tap deschide). Grilă 1/2/3 coloane (telefon/tabletă/desktop).

---

## 10. TODO / idei de continuare (neimplementate)

- (Opțional) Editare completă rezervare din panou (acum doar status/plată/arhivă).
- ~~(Opțional) Filtre pe dashboard (după operator, dată, rută), badge „azi/mâine".~~ ✅ FĂCUT 3 iul 2026 (§12) — chip-uri filtre + grupare pe zile.
- (Opțional) Rol `supervisor` care vede statistici / poate șterge.
- ~~(Opțional) Colet: formularul suportă modul colet; verifică fluxul end-to-end în panou.~~ ✅ VERIFICAT + 3 buguri de colet reparate (§12).
- Confirmă vizual că Realtime „Live" apare după ce se pune anon key-ul. (`NEXT_PUBLIC_SUPABASE_ANON_KEY` e ÎNCĂ placeholder — 3 iul 2026.)
- Schimbă PIN-urile reale înainte de producție.

---

## 11. REGULI IMPORTANTE (ca să nu strici davo)

- **NU** rula `prisma db push` / `prisma migrate dev` din acest proiect pe DB-ul partajat (ar putea reseta/dropa). Doar `prisma migrate deploy` (aditiv) sau SQL manual gardat cu `IF NOT EXISTS`.
- Orice coloană nouă pe `Booking` = **nullable sau cu DEFAULT** (davo face INSERT fără ele).
- Adaugă mereu câmpurile noi și în schema davo (`~/testing api/davo-website/prisma/schema.prisma`).
- **NU** reintroduce cron-urile davo (`send-reminders`, `generate-trips`) aici — dublează emailuri/curse.
- Emailuri de test → șterge rezervările după (caută după email de test și șterge `SeatBooking`/`EmailJob`/`EmailLog`/`Booking`).

---

## 12. Sesiunea 3 iulie 2026 — verificare completă + bugfixuri + UI/UX overhaul

**Prompturile utilizatorului (verbatim):**
> cum stam? ce e cu aplicatia? cum merge? trebuie sa o imbunatatesti complet UI/UX si verifica fiecare functionalitate in parte

> ai si memory.md

> memory.md ai verificat? mai cauta, mai fa ceva. sa fie gata asta azi de utilizat

**Buguri reparate (funcționale):**
1. **Anularea din panou nu elibera locurile** — `PATCH /api/operator/bookings/[id]` seta doar `status='cancelled'`; acum șterge `SeatBooking`-urile + `cancelForBooking` (anulează EmailJob-urile programate + pune în coadă emailul de anulare, trimis de cron-ul davo). Re-confirmarea după anulare re-programează reminder-ul 24h.
2. **Preț colet greșit** — coletele cu `tripId` erau taxate cu tariful întreg de pasager (`calculatePriceFromRoute(seats=0→1)`), nu cu 1.5/kg cum arăta UI-ul. Acum `calculateParcelPrice` (lib/pricing.ts) = `round(max(kg,1) × 1.5)` în valuta rutei; formularul trimite `parcelWeight` (înainte NU-l trimitea deloc).
3. **Destinatarul coletului se pierdea** — nume/telefon/adresă destinatar colectate în formular dar netrimise; acum intră în `parcelDetails`.
4. **Mass-assignment** — `PATCH /api/bookings/[bookingNumber]` accepta orice câmp raw; acum whitelist: doar firstName/lastName/email/phone/parcelDetails (string-uri).
5. **„TOTAL 100€" fals** în sumar înainte de orice selecție (fallback DEFAULT_BASE) — acum „alege destinația"/„se calculează după greutate" până există selecție reală.
6. **Rate-limit pe login PIN** (nou: `lib/loginRateLimit.ts`) — 5 încercări greșite / operator+IP → blocare 15 min (429). In-memory, per instanță. Testat live.
7. Dependența accidentală `claude` scoasă din package.json. Validare pași colet în `canContinue` (expeditor/destinatar/greutate obligatorii).

**UI/UX (BookingsView rescris complet):**
- Chip-uri filtre rapide cu contoare: Toate / Pleacă azi / În așteptare / Neachitate / Colete (în arhivă: Toate/Colete).
- **Grupare pe ziua plecării** cu headere („Astăzi · vin., 3 iulie" cu roșu, „Mâine · …"), nr. de rezervări per zi.
- Skeleton loading (6 carduri pulse), stare de eroare cu buton retry, empty state cu reset filtre.
- **Anulare în 2 pași**: „Se eliberează locurile — sigur? [Da, anulează][Nu]" — nu mai anulezi accidental.
- Update optimist (revert la eșec), spinner per acțiune, search cu buton clear.
- Mobil: telefoanele nu se mai trunchiază (flex-wrap), status „anulată" vizibil pe card.
- Formular embedded (operator): fără „Ajutor rapid" (era telefonul firmei), texte adaptate („Clientul a fost informat și acceptă…", „Confirmarea ajunge pe emailul clientului"), `<a>`→`<Link>` la /panou și /rezervare.

**Verificat e2e (read-only, FĂRĂ rezervări de test pe DB-ul live):**
- Login PIN prin UI real (Playwright + Chrome), toate paginile 200, fără erori JS.
- Flux rezervare până la pasul Pasageri: Anglia/London → calendar (curse joia, 07:00, 120£) → hartă 54 locuri → selecție loc → Continuă activ. Atenție: calendarul poate dura >10s la prima încărcare (generare lazy curse 16 săpt.).
- Filtre: 28→3 pe Colete; căutare + clear OK. `npm run build` TRECE. `tsc --noEmit` curat.
- Lint: rămân 4 erori pre-existente `set-state-in-effect` în BookingForm/BookingsView (pattern vechi, nu blochează build-ul — Next 16 nu mai rulează lint la build).

**Git:** proiectul a fost pus sub git (init + commit inițial „baseline funcțional + UI/UX overhaul", branch `main`). `.gitignore` acoperă `.env*`.

**Runda 2 (aceeași zi) — revizie adversarială + cerințe noi:**
> autobuzele layout ia-le din proiectul davo.
> si toate functionalitatile din panel care ar avea nevoie operatorii si nu adminii. daca cursa a trecut dispare de la operatori da? sa nu incurce.

- **Layout autobuze**: verificat — SeatPicker/BusSeatMap/TripPicker sunt IDENTICE cu davo (diff curat), iar layout-urile propriu-zise (`Bus.layoutJson`) vin din DB-ul comun. Nimic de portat.
- **Curse trecute**: DA, dispar automat din Active (query-ul filtrează `departureDate`/`returnDate >= azi`), independent de cron; cron-ul 02:00 doar marchează `archivedAt`.
- **Funcții noi pt. operatori** (nu admin): locurile pe card (🪑 dus + retur, din `seatBookings` adăugat în GET /api/operator/bookings), buton **Bilet** (deschide /bilet/[nr] în panou, printabil), email-ul clientului ca buton mailto în zona Acțiuni.
- **Fix-uri din revizia adversarială** (9 găsite, toate rezolvate):
  1. cancel→re-confirm retrage emailul de anulare încă `queued` (altfel cron-ul davo îl livra deși booking-ul era re-confirmat);
  2. colete <1 kg taxate ca 1 kg (0.3 kg dădea preț 0 — colet gratis) — UI + server identic;
  3. revert-ul optimist e per-card, nu snapshot pe toată lista (nu mai șterge update-urile concurente);
  4. anularea e blocată pentru curse trecute/arhivate (tab vechi nu mai poate anula o cursă care a avut loc) + tranziția în cancelled e atomică (`updateMany where status != cancelled` — un singur request rulează efectele secundare);
  5. destinatar redevenit opțional (per design — comentariul din PartyForm), doar expeditorul obligatoriu; email expeditor marcat cu `*`;
  6. `recipient.email` + `sender.address` (Ridicare:) incluse în parcelDetails (se pierdeau);
  7. `parcelWeight` stocat numeric coerent cu prețul;
  8. a doua anulare (după re-confirmare) trimite din nou email (dedup doar pe `queued`, nu pe `sent`);
  9. fallback-ul de dată la colete fără cursă folosește data locală, nu UTC (la 01:00 dădea ziua de ieri).

**Runda 3 (aceeași zi) — arhivare pe ORA reală de plecare:**
> calculeaza, daca acolo scrie pornirea 08:30 si deja e 19:00 aceiasi zi, sa plece cursa

- Bug: filtrarea active/arhivă compara doar DATA (`startOfToday()`), deci o cursă de azi 08:30 rămânea în Active toată ziua, până la miezul nopții.
- Fix în 3 locuri (toate acum compară cu `new Date()`, nu cu miezul nopții): `app/api/operator/bookings/route.ts` (GET), `app/api/cron/archive-past/route.ts`, guard-ul de anulare din `.../[id]/route.ts`. `departureDate`/`returnDate` sunt timestamp-uri UTC complete (ex. 08:30 = 05:30Z), deci comparația pe instant e corectă indiferent de fusul serverului Vercel (elimină și un bug latent de fus din `setHours`).
- Verificat live (era 19:04, curse azi 08:30): cele 2 au ieșit din Active → Arhivă. ✓

**Runda 4 (aceeași zi) — securitate PIN + etichete sursă:**
- **PIN-uri:** repo `ib-davo/rezervari` a fost pus PUBLIC din greșeală cu PIN-urile în clar → rotite. Acum PIN-urile vin din `OPERATOR_PINS` (`.env.local` + Vercel), seed-ul le citește de acolo, `seed-operators.ts` nu mai are niciun PIN. `.env` NU a fost expus (parola DB + Resend safe). Rămâne: fă repo-ul privat.
- **Etichete sursă în panou** (cerință user): rezervare de admin din panoul davo → „Rezervare manuală · <nume admin>" (Administrator/Admin 2); operator → „Operator · <nume>"; client de pe site → „Client site". Statutul V/X din emailul clientului se afișează DOAR la `source=site`.
  - Bug găsit: ruta admin de creare (`app/api/admin/bookings/route.ts`) NU seta `source`/`createdByName` → rezervările de admin apăreau ca „Client site". Fixat în AMBELE proiecte (davo-operatori + `~/testing api/davo-website`): citește sesiunea admin (`verifyToken`→email→`AdminUser.name`), setează `source='admin'` + `createdByName`. `createdById` rămâne null (FK e către Operator, nu AdminUser).
  - ⚠️ Modificarea din davo e comisă LOCAL în `~/testing api/davo-website` (commit `ebca494`) dar NU e pushed/deployed — trebuie redeploy davo ca rezervările de admin să primească eticheta. Fără redeploy, cele vechi rămân „Client site".

**Runda 5 (aceeași zi) — mobil responsive + dashboard pe CURSE:**
- **Overflow mobil reparat** (workflow cu 5 agenți + verificare): cardurile ieșeau ~412px la 390 (spanuri `truncate` fără `min-w-0`). Fix: min-w-0 pe copiii flex/grid în BookingsView/BookingForm/layout, `overflow-x-auto` pe harta de scaune (SeatPicker). 0 overflow la 360/390 pe toate paginile. Diagnostic: `scratchpad/overflow-*.js`.
- **Dashboard reproiectat per CURSĂ** (cerință user, înlocuiește lista per-bilet pe Active):
  - `GET /api/operator/trips`: grupează rezervările active pe cursă (autocar+rută+dată exactă via tripId), grup „loose" pe rută+zi pentru cele fără cursă; + sumar calendar (zile→nr curse).
  - `components/operator/TripsView.tsx`: calendar lunar (zile cu curse marcate+număr, click→cursele zilei), carduri de cursă (🚌 autocar·rută·oră·ocupare X/46) cu rezervările dedesubt (loc, telefon, sursă, acțiuni). Search global. Arhiva rămâne pe `BookingsView` (per-bilet).
  - „+ Rezervare pe cursă" → `/panou/rezervare?tripId=…&from=…&to=…`. `TripPicker` primește `autoSelectTripId` → preselectează cursa via `pickTrip` (trece PublicTrip complet ca prețul/data să fie corecte — NU seta doar tripId, `updateSeats` nu trece tripInfo). Sare la harta de scaune.
  - Export per cursă în `lib/tripManifest.ts`: Excel (CSV cu BOM, `;`) + PDF (HTML printabil, auto-print) — foaie de parcurs cu pasageri (loc/nume/telefon/nr/plată/status/preț) + totaluri încasat/de încasat/total. Fără dependințe noi.
  - Decizii user: calendar lunar; grupare autocar+rută+dată; fără-cursă = grup separat; „+" preselectat; export Excel+PDF; placement pe Active (Arhiva neschimbată).

**Runda 6 (aceeași zi) — model „cursă fizică":**
- Problema (user): un autobuz care pleacă dintr-o țară trece prin mai multe (Belgia→Germania→Olanda) și ia pasageri din toate — în DB sunt rute/Trip-uri separate per oraș, deci apăreau ca 3 curse separate deși fizic e UN autobuz. Export-ul scotea doar dintr-un oraș.
- Model implementat: **o cursă = un autobuz (real din Trip.bus SAU atribuit manual) + zi + direcție** (spre/dinspre Moldova). `app/api/operator/trips/route.ts` grupează pe `zi:direcție:busKey`; ocupare = suma locurilor pe leg-uri (dedup pe tripId); rezervările fără autobuz dintr-o zi+direcție → un singur card „fără autocar".
- **Atribuire manuală autobuz**: coloană nouă `Booking.manualBusId String?` — ADITIVĂ/nullable, aplicată pe DB-ul de PRODUCȚIE cu `ADD COLUMN IF NOT EXISTS` (via `prisma db execute`), oglindită în schema davo. `GET /api/operator/buses` (listă), `PATCH /api/operator/bookings/[id]` acceptă `manualBusId` (validează bus există), dropdown „Atribuie autocar" pe rezervările fără cursă (`components/operator/TripsView.tsx`). Grupare: bus = trip.bus ?? manualBus.
- Export (`lib/tripManifest.ts`): foaia = TOȚI pasagerii cursei fizice (din toate orașele), coloană **Ruta** per pasager — ca foaia reală (Nr d/o, Loc, Nume, Telefon, Ruta, Nr, Plată, Preț + totaluri).
- ⚠️ IMPORTANT: după `prisma generate` TREBUIE repornit `next dev` — altfel clientul vechi din memorie dă „Unknown field manualBusId" (500). La deploy Vercel: build-ul rulează `prisma generate`, deci ok.
- Verificat e2e: grupare multi-țară (Bruxelles+Anderlecht+Horhausen pe DAW 077 = 5/54), consolidare (19 iul 3→1), atribuire+scoatere (curățat producția), export cu toți pasagerii, 0 overflow mobil.
- **Review adversarial (workflow, 6 probleme confirmate) → reparate:**
  1. Round-trip: gruparea ignora `returnTripId` → cursa de retur nu apărea + ocupare umflată. Fix: `placeLeg` plasează fiecare rezervare pe AMBELE leg-uri (dus + retur); `seatsFor` filtrează pe `g.tripIds` (cardul are member trips).
  2. Direcția scoasă din cheia autobuzului (`dk:bus:busId`, nu `dk:direction:busId`) — un autobuz face o direcție/zi, iar atribuirea manuală se contopește chiar dacă orașul rezervării n-are țară (site/panou salvează „Chișinău" fără țară → countryOf → „x"). Fără autobuz: cheie `dk:none:direction`.
  3+4. Ocupare = din pasagerii LISTAȚI (locuri pe cursele cardului, sau `pax` dacă n-au locuri), NU din `trip._count` global (includea arhivate/holds). Cardul „fără autocar" arată nr. pasageri, nu 0.
  5. (nereparat — follow-up) davo n-are fișier de migrare pt. `manualBusId` (are doar în schema.prisma). Producția are coloana (aplicată din davo-operatori); risc doar pe DB fresh/preview davo, unde davo oricum nu folosește coloana. De adăugat o migrare în davo dacă se face `migrate reset/deploy` pe DB nou.
  6. LOW rămase acceptabile: `act` optimist nu tratează manualBusId (dar reload după PATCH rezolvă); validare manualBusId cere acum `active:true`.

**Rămase pentru producție (acțiuni USER):**
1. **Fă repo-ul `ib-davo/rezervari` PRIVAT** (GitHub → Settings → Danger Zone).
2. Comunică noile PIN-uri operatorilor; pune `OPERATOR_PINS` și în Vercel.
3. **Redeploy davo** (`~/testing api/davo-website`, commit `ebca494`) pt. etichetele de admin.
4. Pune `NEXT_PUBLIC_SUPABASE_ANON_KEY` real → badge „Live" în loc de „15s".
5. La deploy panou: proiect Vercel + env din `.env.local` (vezi §7), inclusiv `OPERATOR_PINS`.
