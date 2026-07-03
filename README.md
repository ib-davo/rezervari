# DAVO — Panou Operatori

Aplicație internă pentru operatori (Adrian, Olga, Dumitru, Alexandru, Ghenadie, Catalin, Gabriela).
Folosește **aceeași bază de date Supabase ca site-ul davo** → rezervările apar instant pe ambele.

## Cum funcționează sincronul
- Bază unică (Supabase Postgres, partajată cu davo). Nicio sincronizare manuală, niciun cod de copiere.
- Client face rezervare pe davo.md → apare aici. Operator face rezervare aici → apare pe davo.
- Statutul de confirmare e același câmp (`Booking.status` + `passengerResponse` din emailul clientului).
- Pe fiecare rezervare se vede **cine a făcut-o**: operator (numele lui), „Client (site)" sau „Admin davo".
- Când cursa a trecut → iese din „active" și intră în „Arhivă" (rămâne salvată în DB).

## Login
Fiecare operator alege numele și introduce un **PIN de 4 cifre**. PIN-uri inițiale (schimbabile):

| Operator   | PIN  |
|------------|------|
| Adrian     | 1188 |
| Olga       | 1919 |
| Dumitru    | 6767 |
| Alexandru  | 2323 |
| Ghenadie   | 8181 |
| Catalin    | 4646 |
| Gabriela   | 7272 |

Schimbarea PIN-urilor: editează `prisma/seed-operators.ts` și rulează `npm run seed:operators`.

## Rulare locală
```bash
npm install
npm run dev        # http://localhost:3001
```

## ⚠️ Un singur placeholder de completat — Realtime (push instant)
În `.env.local`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` e `PLACEHOLDER_...`.
Pune cheia reală: **Supabase Dashboard → Project Settings → API → Project API keys → `anon public`**.
- Cu cheia → dashboard-ul se actualizează **instant** (badge „Live").
- Fără cheia → merge pe reîmprospătare la 15s (badge „Polling"). Funcționează oricum.

Migrația a încercat deja să activeze Realtime pe tabela `Booking`. Dacă nu vezi „Live",
verifică în Supabase: Database → Publications → `supabase_realtime` → bifează `Booking`.

## Deploy (Vercel — proiect NOU, separat de davo)
1. Creează un proiect Vercel nou din acest folder.
2. Setează variabilele din `.env.local` în Vercel (Settings → Environment Variables).
3. Cron-ul de arhivare (`/api/cron/archive-past`) e în `vercel.json` (zilnic 02:00).

## Ce s-a adăugat în baza de date (aditiv, davo neatins)
- Tabel nou `Operator` (nume, slug, pinHash, role, active).
- Pe `Booking`: `source`, `createdById`, `createdByName`, `archivedAt` — toate cu default/nullable.

## Note
- Linkurile din emailurile de confirmare pointează la `https://davo.md` (site-ul real),
  tokenul se verifică acolo (secret partajat în DB). De aceea `NEXT_PUBLIC_APP_URL=https://davo.md`.
- Remindere/emailuri automate sunt trimise de davo (cron-ul lui), nu de aici — fără dubluri.
- Davo admin (`/admin`) e blocat în acest proiect; operatorii văd doar `/panou`.
