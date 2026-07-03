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

## 5. Operatori & PIN-uri (inițiale — schimbabile în `prisma/seed-operators.ts` + `npm run seed:operators`)

| Operator   | slug      | PIN  |
|------------|-----------|------|
| Adrian     | adrian    | 1188 |
| Olga       | olga      | 1919 |
| Dumitru    | dumitru   | 6767 |
| Alexandru  | alexandru | 2323 |
| Ghenadie   | ghenadie  | 8181 |
| Catalin    | catalin   | 4646 |
| Gabriela   | gabriela  | 7272 |

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
- (Opțional) Filtre pe dashboard (după operator, dată, rută), badge „azi/mâine".
- (Opțional) Rol `supervisor` care vede statistici / poate șterge.
- (Opțional) Colet: formularul suportă modul colet; verifică fluxul end-to-end în panou.
- Confirmă vizual că Realtime „Live" apare după ce se pune anon key-ul.
- Schimbă PIN-urile reale înainte de producție.

---

## 11. REGULI IMPORTANTE (ca să nu strici davo)

- **NU** rula `prisma db push` / `prisma migrate dev` din acest proiect pe DB-ul partajat (ar putea reseta/dropa). Doar `prisma migrate deploy` (aditiv) sau SQL manual gardat cu `IF NOT EXISTS`.
- Orice coloană nouă pe `Booking` = **nullable sau cu DEFAULT** (davo face INSERT fără ele).
- Adaugă mereu câmpurile noi și în schema davo (`~/testing api/davo-website/prisma/schema.prisma`).
- **NU** reintroduce cron-urile davo (`send-reminders`, `generate-trips`) aici — dublează emailuri/curse.
- Emailuri de test → șterge rezervările după (caută după email de test și șterge `SeatBooking`/`EmailJob`/`EmailLog`/`Booking`).
