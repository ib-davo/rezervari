"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Trash2,
  Plus,
  Minus,
  ShoppingBag,
  Snowflake,
  Phone,
  Mail,
  User,
  MapPin,
  Truck,
  CheckCircle2,
} from "lucide-react";
import { useCart } from "./CartContext";
import { COLET_LA_CHEIE_MIN_ORDER } from "@/lib/coletProducts";
import { contactInfo } from "@/lib/data";
import { CountryCityPicker } from "@/components/booking/CountryCityPicker";
import { useLocale } from "@/lib/i18n/client";

function formatMdl(n: number) {
  return new Intl.NumberFormat("ro-RO", {
    style: "currency",
    currency: "MDL",
    maximumFractionDigits: 0,
  }).format(n);
}

type CheckoutForm = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  destinationCountry: string;
  destinationCity: string;
  address: string;
  notes: string;
  consent: boolean;
};

const emptyForm: CheckoutForm = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  destinationCountry: "",
  destinationCity: "",
  address: "",
  notes: "",
  consent: false,
};

export default function CartDrawer() {
  const cart = useCart();
  const locale = useLocale();
  const [stage, setStage] = useState<"cart" | "checkout" | "done">("cart");
  const [form, setForm] = useState<CheckoutForm>(emptyForm);
  // Valoarea string "Oraș, Țară" pentru picker — sincronizată cu cele 2
  // câmpuri tipizate (destinationCity / destinationCountry) din form.
  const destinationValue =
    form.destinationCity && form.destinationCountry
      ? `${form.destinationCity}, ${form.destinationCountry}`
      : form.destinationCountry || "";

  function setDestination(v: string) {
    if (!v) {
      setForm((f) => ({ ...f, destinationCity: "", destinationCountry: "" }));
      return;
    }
    const idx = v.lastIndexOf(",");
    if (idx >= 0) {
      setForm((f) => ({
        ...f,
        destinationCity: v.slice(0, idx).trim(),
        destinationCountry: v.slice(idx + 1).trim(),
      }));
    } else {
      setForm((f) => ({ ...f, destinationCity: "", destinationCountry: v.trim() }));
    }
  }
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [orderRef, setOrderRef] = useState<string | null>(null);

  const close = () => {
    cart.setOpen(false);
    setTimeout(() => {
      setStage("cart");
      setSubmitError(null);
    }, 250);
  };

  const setField = <K extends keyof CheckoutForm>(k: K, v: CheckoutForm[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const minOrderMet = cart.totalMdl >= COLET_LA_CHEIE_MIN_ORDER;

  const submitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/colet-la-cheie/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer: form,
          lines: cart.lines.map((l) => ({
            productId: l.product.id,
            name: l.product.name,
            quantity: l.quantity,
            price: l.product.price,
          })),
          totalMdl: cart.totalMdl,
        }),
      });
      const data = await res.json();
      if (!data.success) {
        setSubmitError(data.error || "Eroare la plasarea comenzii");
      } else {
        setOrderRef(data.orderRef);
        setStage("done");
        cart.clear();
      }
    } catch {
      setSubmitError("Eroare de rețea. Încearcă din nou.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {cart.isOpen && (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={close}
            className="fixed inset-0 z-[80] bg-[color:var(--navy-900)]/40 backdrop-blur-[2px]"
          />
          <motion.aside
            key="drawer"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "tween", duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="fixed top-0 right-0 bottom-0 z-[81] w-full sm:w-[460px] bg-white shadow-[0_30px_80px_-20px_rgba(11,38,83,0.4)] flex flex-col"
          >
            <header className="flex items-center justify-between px-5 py-4 border-b border-[color:var(--ink-200)]">
              <div className="flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[color:var(--red-50)] text-[color:var(--red-500)]">
                  <ShoppingBag className="h-4 w-4" />
                </span>
                <div>
                  <div className="font-[family-name:var(--font-montserrat)] font-extrabold text-[color:var(--navy-900)]">
                    {stage === "cart" && "Coșul tău"}
                    {stage === "checkout" && "Date livrare"}
                    {stage === "done" && "Comandă plasată"}
                  </div>
                  <div className="text-[11px] uppercase tracking-widest text-[color:var(--ink-500)] font-bold">
                    {cart.itemCount} {cart.itemCount === 1 ? "produs" : "produse"}
                  </div>
                </div>
              </div>
              <button
                onClick={close}
                aria-label="Închide"
                className="flex h-9 w-9 items-center justify-center rounded-full text-[color:var(--ink-700)] hover:bg-[color:var(--ink-50)] transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </header>

            {stage === "cart" && (
              <>
                <div className="flex-1 overflow-y-auto p-5 space-y-3">
                  {cart.lines.length === 0 && (
                    <div className="flex flex-col items-center justify-center text-center py-16 text-[color:var(--ink-500)]">
                      <ShoppingBag className="h-12 w-12 text-[color:var(--ink-300,rgba(11,38,83,0.18))] mb-3" />
                      <p className="font-semibold text-[color:var(--navy-900)]">Coșul e gol</p>
                      <p className="text-sm mt-1">Alege produse din catalog ca să le adaugi aici.</p>
                    </div>
                  )}

                  {cart.lines.map((line) => (
                    <article
                      key={line.product.id}
                      className="flex gap-3 rounded-2xl border border-[color:var(--ink-200)] bg-white p-3"
                    >
                      <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-[color:var(--ink-50)] text-3xl">
                        {line.product.emoji}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="font-semibold text-[color:var(--navy-900)] text-sm leading-tight">
                            {line.product.name}
                          </h3>
                          <button
                            onClick={() => cart.remove(line.product.id)}
                            aria-label={`Șterge ${line.product.name}`}
                            className="text-[color:var(--ink-500)] hover:text-[color:var(--red-500)] transition-colors shrink-0"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                        <div className="mt-0.5 text-xs text-[color:var(--ink-500)]">
                          {formatMdl(line.product.price)} / {line.product.unit}
                          {line.product.perishable && (
                            <span className="ml-2 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-[color:var(--navy-700)]">
                              <Snowflake className="h-3 w-3" /> frig
                            </span>
                          )}
                        </div>
                        <div className="mt-2 flex items-center justify-between">
                          <div className="inline-flex items-center rounded-full border border-[color:var(--ink-200)]">
                            <button
                              onClick={() => cart.set(line.product.id, line.quantity - 1)}
                              className="flex h-7 w-7 items-center justify-center text-[color:var(--ink-700)] hover:text-[color:var(--red-500)]"
                              aria-label="Minus"
                            >
                              <Minus className="h-3.5 w-3.5" />
                            </button>
                            <span className="px-2 font-mono font-bold text-sm text-[color:var(--navy-900)]">
                              {line.quantity}
                            </span>
                            <button
                              onClick={() => cart.set(line.product.id, line.quantity + 1)}
                              className="flex h-7 w-7 items-center justify-center text-[color:var(--ink-700)] hover:text-[color:var(--red-500)]"
                              aria-label="Plus"
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          <span className="font-bold text-[color:var(--navy-900)]">
                            {formatMdl(line.product.price * line.quantity)}
                          </span>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>

                {cart.lines.length > 0 && (
                  <footer className="border-t border-[color:var(--ink-200)] p-5 space-y-3 bg-[color:var(--ink-50)]">
                    {cart.hasPerishable && (
                      <div className="flex items-start gap-2 rounded-xl bg-[color:var(--navy-50)] p-3 text-xs text-[color:var(--navy-900)]">
                        <Snowflake className="h-4 w-4 text-[color:var(--navy-700)] shrink-0 mt-0.5" />
                        <span>
                          Coșul conține produse alterabile — vor fi transportate în
                          remorca frigorifică.
                        </span>
                      </div>
                    )}
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-[color:var(--ink-700)]">Subtotal</span>
                      <span className="font-bold text-[color:var(--navy-900)]">
                        {formatMdl(cart.totalMdl)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-[color:var(--ink-500)]">
                      <span>Livrare la destinație</span>
                      <span>se calculează la confirmare</span>
                    </div>

                    {!minOrderMet && (
                      <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900">
                        Comanda minimă este {formatMdl(COLET_LA_CHEIE_MIN_ORDER)}.
                        Mai trebuie {formatMdl(COLET_LA_CHEIE_MIN_ORDER - cart.totalMdl)}.
                      </div>
                    )}

                    <button
                      type="button"
                      disabled={!minOrderMet}
                      onClick={() => setStage("checkout")}
                      className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-[color:var(--red-500)] px-5 py-3 text-sm font-semibold text-white hover:bg-[color:var(--red-600)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-[0_12px_30px_-10px_rgba(225,30,43,0.5)]"
                    >
                      Continuă către livrare
                    </button>
                  </footer>
                )}
              </>
            )}

            {stage === "checkout" && (
              <form onSubmit={submitOrder} className="flex-1 overflow-y-auto p-5 space-y-4">
                <SectionTitle>Date contact</SectionTitle>
                <div className="grid grid-cols-2 gap-3">
                  <FieldText label="Nume *" icon={<User className="h-3.5 w-3.5" />} value={form.firstName} onChange={(v) => setField("firstName", v)} required />
                  <FieldText label="Prenume *" icon={<User className="h-3.5 w-3.5" />} value={form.lastName} onChange={(v) => setField("lastName", v)} required />
                  <FieldText label="Email *" type="email" icon={<Mail className="h-3.5 w-3.5" />} value={form.email} onChange={(v) => setField("email", v)} required />
                  <FieldText label="Telefon *" type="tel" icon={<Phone className="h-3.5 w-3.5" />} value={form.phone} onChange={(v) => setField("phone", v)} required />
                </div>

                <SectionTitle>Livrare în Europa</SectionTitle>
                <div className="rounded-lg border border-[color:var(--ink-200)] bg-white px-3 py-2">
                  <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-bold text-[color:var(--ink-500)]">
                    <Truck className="h-3.5 w-3.5 text-[color:var(--red-500)]" />
                    Țară &amp; oraș *
                  </div>
                  <div className="mt-1.5">
                    <CountryCityPicker
                      value={destinationValue}
                      onChange={setDestination}
                      locale={locale}
                      hideCountries={["Moldova"]}
                    />
                  </div>
                </div>
                <FieldText label="Adresă completă *" icon={<MapPin className="h-3.5 w-3.5" />} value={form.address} onChange={(v) => setField("address", v)} placeholder="Stradă, număr, apartament, cod poștal" required />

                <FieldTextarea label="Observații" value={form.notes} onChange={(v) => setField("notes", v)} placeholder="Instrucțiuni speciale, ore de livrare preferate..." />

                <div className="rounded-xl bg-[color:var(--ink-50)] border border-[color:var(--ink-200)] p-4 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-[color:var(--ink-700)]">Total produse</span>
                    <span className="font-bold text-[color:var(--navy-900)]">{formatMdl(cart.totalMdl)}</span>
                  </div>
                  <div className="mt-2 text-xs text-[color:var(--ink-500)] leading-relaxed">
                    Plata se face <strong>la livrare</strong> — cash sau card la curier. Prețul livrării se confirmă telefonic după plasarea comenzii (în funcție de destinație și greutate).
                  </div>
                </div>

                <label className="flex items-start gap-2.5 text-xs text-[color:var(--ink-700)] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.consent}
                    onChange={(e) => setField("consent", e.target.checked)}
                    required
                    className="mt-0.5 accent-[color:var(--red-500)]"
                  />
                  <span>
                    Sunt de acord cu{" "}
                    <a href="/termeni-colete" target="_blank" rel="noreferrer" className="font-semibold underline decoration-[color:var(--red-500)] underline-offset-2">
                      Termenii și Condițiile
                    </a>{" "}
                    de transport colete și prelucrarea datelor personale.
                  </span>
                </label>

                {submitError && (
                  <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                    {submitError}
                  </div>
                )}

                <div className="sticky bottom-0 flex gap-2 pt-3 bg-white">
                  <button
                    type="button"
                    onClick={() => setStage("cart")}
                    className="rounded-full border border-[color:var(--ink-200)] bg-white px-5 py-3 text-sm font-semibold text-[color:var(--navy-900)] hover:border-[color:var(--navy-700)] transition-colors"
                  >
                    Înapoi
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || !form.consent}
                    className="flex-1 inline-flex items-center justify-center gap-2 rounded-full bg-[color:var(--success)] px-5 py-3 text-sm font-semibold text-white hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submitting ? "Se trimite..." : "Plasează comanda"}
                  </button>
                </div>
              </form>
            )}

            {stage === "done" && (
              <div className="flex-1 overflow-y-auto p-6 flex flex-col items-center text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[color:var(--success)] text-white mt-6">
                  <CheckCircle2 className="h-9 w-9" strokeWidth={2} />
                </div>
                <h2 className="mt-5 font-[family-name:var(--font-montserrat)] text-2xl font-extrabold text-[color:var(--navy-900)]">
                  Comanda a fost înregistrată
                </h2>
                <p className="mt-3 text-sm text-[color:var(--ink-700)] leading-relaxed">
                  Te vom suna în câteva ore pentru a confirma detaliile și prețul livrării.
                  Confirmarea îți ajunge și pe email.
                </p>
                {orderRef && (
                  <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-[color:var(--navy-50)] px-4 py-2 border border-[color:var(--navy-100,rgba(20,58,122,0.12))]">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[color:var(--ink-500)]">
                      Nr. comandă
                    </span>
                    <span className="font-mono font-bold text-sm text-[color:var(--navy-900)] tracking-widest">
                      {orderRef}
                    </span>
                  </div>
                )}
                <a
                  href={`tel:${contactInfo.phone.replace(/\s/g, "")}`}
                  className="mt-6 inline-flex items-center gap-2 rounded-full bg-[color:var(--red-500)] px-5 py-3 text-sm font-semibold text-white hover:bg-[color:var(--red-600)] transition-colors"
                >
                  <Phone className="h-4 w-4" />
                  Sună-ne {contactInfo.phone}
                </a>
                <button
                  onClick={close}
                  className="mt-3 text-sm font-semibold text-[color:var(--navy-900)] hover:text-[color:var(--red-500)]"
                >
                  Continuă cumpărăturile →
                </button>
              </div>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] font-bold uppercase tracking-[0.3em] text-[color:var(--red-500)] mt-2">
      {children}
    </div>
  );
}

function FieldText({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  required,
  icon,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-[11px] font-bold uppercase tracking-wider text-[color:var(--ink-500)] mb-1">
        {label}
      </span>
      <div className="flex items-center gap-2 rounded-xl border border-[color:var(--ink-200)] bg-white px-3 py-2.5 focus-within:border-[color:var(--navy-700)]">
        {icon && <span className="text-[color:var(--red-500)]">{icon}</span>}
        <input
          required={required}
          type={type}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-transparent outline-none text-sm font-medium text-[color:var(--navy-900)]"
        />
      </div>
    </label>
  );
}

function FieldTextarea({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="block text-[11px] font-bold uppercase tracking-wider text-[color:var(--ink-500)] mb-1">
        {label}
      </span>
      <textarea
        value={value}
        rows={3}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-[color:var(--ink-200)] bg-white px-3 py-2.5 outline-none focus:border-[color:var(--navy-700)] text-sm text-[color:var(--navy-900)] resize-y min-h-[80px]"
      />
    </label>
  );
}
