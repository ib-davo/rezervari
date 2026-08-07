"use client";

import { useEffect } from "react";
import { AlertTriangle, X } from "lucide-react";

/**
 * Eroarea unei acțiuni de operator, arătată la nivel de ECRAN, nu de rând.
 *
 * Acțiunile din panou sunt optimiste: rândul se schimbă instant, iar la eșec se
 * face rollback. Problema e că o anulare îl SCOATE din lista activă — componenta
 * care ar fi afișat eroarea se demontează înainte să apuce s-o arate. Operatorul
 * apăsa „Anulat", confirma, rândul clipea și revenea neschimbat, fără niciun
 * motiv scris nicăieri. Toastul stă în afara listei, deci supraviețuiește
 * oricărei remontări și e singurul loc unde se văd erorile de acțiune.
 *
 * `onClose` trebuie să fie stabil (useCallback), altfel cronometrul se reia la
 * fiecare render al părintelui și toastul nu se mai închide singur.
 */
export function ActionToast({ message, onClose }: { message: string | null; onClose: () => void }) {
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(onClose, 8000);
    return () => clearTimeout(t);
  }, [message, onClose]);

  if (!message) return null;

  return (
    // bottom-24: deasupra barei de jos a panoului, ca să nu cadă sub degete.
    <div
      role="alert"
      className="fixed inset-x-3 bottom-24 z-[60] mx-auto max-w-md rounded-xl bg-red-600 px-3 py-2.5 text-sm font-semibold text-white shadow-lg"
    >
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <span className="flex-1 leading-snug">{message}</span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Închide"
          className="-m-1 shrink-0 rounded-full p-1 active:scale-95 transition-transform hover:bg-white/15"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
