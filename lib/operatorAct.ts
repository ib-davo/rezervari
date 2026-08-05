/**
 * Rezultatul unei acțiuni de operator asupra unei rezervări (PATCH).
 *
 * Acțiunile din panou sunt optimiste: UI-ul se actualizează imediat, iar la
 * eșec se face rollback. Rollback-ul se întâmpla într-un `catch` care arunca
 * mesajul serverului, așa că operatorul primea mereu același „nu s-a putut
 * salva". Or serverul are ce să-i spună: „ziua nu se schimbă din Editează,
 * folosește Reprogramare", „locul 12 e deja ocupat", „persoana e deja
 * rezervată pe ziua asta". Fără mesajul real, operatorul nu știe ce să facă.
 */
export type ActResult = { ok: boolean; error?: string };

/** Trece mesajul serverului prin `catch`-ul care face rollback-ul optimist. */
export class ActError extends Error {
  constructor(msg: string | null) {
    super(msg ?? "");
  }
}
