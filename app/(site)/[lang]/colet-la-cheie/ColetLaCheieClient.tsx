"use client";

import { useMemo, useState } from "react";
import {
  ShoppingBag,
  Search,
  Plus,
  Minus,
  Snowflake,
  Truck,
  ShieldCheck,
  Phone,
  Filter,
} from "lucide-react";
import {
  productCategories,
  products,
  COLET_LA_CHEIE_MIN_ORDER,
  type Product,
} from "@/lib/coletProducts";
import { contactInfo } from "@/lib/data";
import { CartProvider, useCart } from "./CartContext";
import CartDrawer from "./CartDrawer";

function formatMdl(n: number) {
  return new Intl.NumberFormat("ro-RO", {
    style: "currency",
    currency: "MDL",
    maximumFractionDigits: 0,
  }).format(n);
}

export default function ColetLaCheieClient() {
  return (
    <CartProvider>
      <Storefront />
      <CartDrawer />
    </CartProvider>
  );
}

function Storefront() {
  const cart = useCart();
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"name" | "price-asc" | "price-desc">("name");

  const filtered = useMemo(() => {
    let list = products;
    if (activeCategory) list = list.filter((p) => p.categorySlug === activeCategory);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          (p.brand?.toLowerCase().includes(q) ?? false)
      );
    }
    const sorted = [...list];
    if (sort === "price-asc") sorted.sort((a, b) => a.price - b.price);
    else if (sort === "price-desc") sorted.sort((a, b) => b.price - a.price);
    else sorted.sort((a, b) => a.name.localeCompare(b.name, "ro"));
    return sorted;
  }, [activeCategory, search, sort]);

  const countByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    for (const p of products) {
      map[p.categorySlug] = (map[p.categorySlug] ?? 0) + 1;
    }
    return map;
  }, []);

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-[color:var(--navy-900)] bg-hero-navy text-white">
        <div className="bg-noise absolute inset-0 opacity-30" />
        <div className="container-page relative py-12 lg:py-16">
          <div className="grid gap-8 lg:grid-cols-[1.4fr,1fr] items-center">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.3em] text-[color:var(--red-400)]">
                Produse moldovenești · livrare în Europa
              </div>
              <h1 className="mt-4 display-hero display-xl text-white">
                Colet la cheie
              </h1>
              <p className="mt-5 text-lg text-white/75 max-w-xl leading-relaxed">
                Comandă online produse moldovenești tradiționale — brânzeturi, cârnați,
                vinuri, plăcinte, dulcețuri. Noi le împachetăm și ți le livrăm acasă în
                Anglia, Germania, Belgia, Olanda sau Luxemburg.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <a
                  href="#catalog"
                  className="inline-flex items-center gap-2 rounded-full bg-[color:var(--red-500)] px-6 py-3 font-semibold text-white hover:bg-[color:var(--red-600)] transition-colors"
                >
                  <ShoppingBag className="h-4 w-4" /> Vezi catalogul
                </a>
                <a
                  href={`tel:${contactInfo.phone.replace(/\s/g, "")}`}
                  className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/5 backdrop-blur px-6 py-3 font-semibold text-white hover:bg-white/10 transition-colors"
                >
                  <Phone className="h-4 w-4" /> {contactInfo.phone}
                </a>
              </div>

              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                <Bullet icon={<Snowflake className="h-4 w-4" />}>
                  Remorcă frigorifică pentru produsele alterabile
                </Bullet>
                <Bullet icon={<Truck className="h-4 w-4" />}>
                  Livrare la ușă în 5-10 zile lucrătoare
                </Bullet>
                <Bullet icon={<ShieldCheck className="h-4 w-4" />}>
                  Plata la livrare — cash sau card
                </Bullet>
              </div>
            </div>

            <div className="relative">
              <div className="rounded-3xl bg-white/5 backdrop-blur border border-white/10 p-6">
                <div className="text-[10px] uppercase tracking-[0.3em] font-bold text-[color:var(--red-400)]">
                  Comandă minimă
                </div>
                <div className="mt-2 font-[family-name:var(--font-montserrat)] text-4xl font-extrabold">
                  {formatMdl(COLET_LA_CHEIE_MIN_ORDER)}
                </div>
                <p className="mt-2 text-sm text-white/65">
                  pentru livrare în Europa
                </p>

                <ul className="mt-6 space-y-3 text-sm text-white/85">
                  {[
                    "Plată în Lei, EUR sau GBP la livrare",
                    "Ambalare profesională, etichetare cu nume",
                    "Notificare SMS când coletul pleacă din Chișinău",
                    "Notificare la sosire în țara destinație",
                  ].map((t) => (
                    <li key={t} className="flex items-start gap-2">
                      <span className="mt-1 h-1.5 w-1.5 rounded-full bg-[color:var(--red-400)]" />
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Catalog */}
      <section id="catalog" className="relative py-12 lg:py-16 bg-[color:var(--ink-50)]">
        <div className="container-page">
          {/* Sticky toolbar */}
          <div className="mb-8 grid gap-3 lg:grid-cols-[1fr,auto,auto] items-center rounded-2xl bg-white border border-[color:var(--ink-200)] p-3">
            <div className="flex items-center gap-2 rounded-xl border border-[color:var(--ink-200)] bg-white px-3 py-2 focus-within:border-[color:var(--navy-700)]">
              <Search className="h-4 w-4 text-[color:var(--ink-500)]" />
              <input
                placeholder="Caută produs (ex. brânză, vin, plăcinte...)"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-transparent outline-none text-sm font-medium text-[color:var(--navy-900)]"
              />
            </div>

            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-[color:var(--ink-500)]" />
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as typeof sort)}
                className="rounded-xl border border-[color:var(--ink-200)] bg-white px-3 py-2 text-sm font-medium text-[color:var(--navy-900)] outline-none focus:border-[color:var(--navy-700)]"
              >
                <option value="name">Sortare: A-Z</option>
                <option value="price-asc">Preț crescător</option>
                <option value="price-desc">Preț descrescător</option>
              </select>
            </div>

            <button
              type="button"
              onClick={() => cart.setOpen(true)}
              className="relative inline-flex items-center justify-center gap-2 rounded-xl bg-[color:var(--navy-900)] px-4 py-2 text-sm font-semibold text-white hover:bg-[color:var(--navy-800)] transition-colors"
            >
              <ShoppingBag className="h-4 w-4" />
              Coș · {formatMdl(cart.totalMdl)}
              {cart.itemCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[color:var(--red-500)] text-[10px] font-bold text-white px-1">
                  {cart.itemCount}
                </span>
              )}
            </button>
          </div>

          <div className="grid gap-6 lg:grid-cols-[260px,1fr]">
            {/* Categories sidebar */}
            <aside className="lg:sticky lg:top-24 lg:self-start">
              <div className="rounded-2xl bg-white border border-[color:var(--ink-200)] p-4">
                <div className="text-[10px] font-bold uppercase tracking-widest text-[color:var(--ink-500)] mb-3">
                  Categorii
                </div>
                <ul className="space-y-1">
                  <li>
                    <button
                      onClick={() => setActiveCategory(null)}
                      className={`w-full flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition-colors ${
                        activeCategory === null
                          ? "bg-[color:var(--red-50)] text-[color:var(--red-600)]"
                          : "text-[color:var(--navy-900)] hover:bg-[color:var(--ink-50)]"
                      }`}
                    >
                      <span>Toate produsele</span>
                      <span className="text-[11px] font-mono text-[color:var(--ink-500)]">
                        {products.length}
                      </span>
                    </button>
                  </li>
                  {productCategories.map((c) => (
                    <li key={c.slug}>
                      <button
                        onClick={() => setActiveCategory(c.slug)}
                        className={`w-full flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition-colors ${
                          activeCategory === c.slug
                            ? "bg-[color:var(--red-50)] text-[color:var(--red-600)]"
                            : "text-[color:var(--navy-900)] hover:bg-[color:var(--ink-50)]"
                        }`}
                      >
                        <span className="flex items-center gap-2 text-left">
                          <span className="text-base">{c.emoji}</span>
                          {c.name}
                        </span>
                        <span className="text-[11px] font-mono text-[color:var(--ink-500)]">
                          {countByCategory[c.slug] ?? 0}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-4 rounded-2xl bg-[color:var(--navy-900)] bg-hero-navy text-white p-5 relative overflow-hidden">
                <div className="bg-noise absolute inset-0 opacity-30" />
                <div className="relative">
                  <Snowflake className="h-6 w-6 text-[color:var(--red-400)] mb-2" />
                  <div className="font-[family-name:var(--font-montserrat)] font-bold text-base leading-tight">
                    Frigorifică separată
                  </div>
                  <p className="mt-2 text-xs text-white/70 leading-relaxed">
                    Produsele perisabile (carne, lactate, brânzeturi, plăcinte) sunt
                    transportate într-o remorcă cu temperatură controlată.
                  </p>
                </div>
              </div>
            </aside>

            {/* Products grid */}
            <div>
              {activeCategory && (
                <div className="mb-4">
                  {productCategories
                    .filter((c) => c.slug === activeCategory)
                    .map((c) => (
                      <div key={c.slug}>
                        <h2 className="font-[family-name:var(--font-montserrat)] text-xl font-extrabold text-[color:var(--navy-900)]">
                          {c.emoji} {c.name}
                        </h2>
                        <p className="mt-1 text-sm text-[color:var(--ink-500)]">
                          {c.description}
                        </p>
                      </div>
                    ))}
                </div>
              )}

              {filtered.length === 0 ? (
                <div className="rounded-2xl border border-[color:var(--ink-200)] bg-white p-10 text-center text-[color:var(--ink-500)]">
                  Nimic găsit pentru &ldquo;{search}&rdquo;.
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {filtered.map((p) => (
                    <ProductCard key={p.id} product={p} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Floating cart button (mobile) */}
      {cart.itemCount > 0 && (
        <button
          type="button"
          onClick={() => cart.setOpen(true)}
          aria-label="Deschide coșul"
          className="lg:hidden fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 rounded-full bg-[color:var(--red-500)] px-5 py-3.5 text-sm font-bold text-white shadow-[0_18px_40px_-10px_rgba(225,30,43,0.6)]"
        >
          <ShoppingBag className="h-4 w-4" />
          {formatMdl(cart.totalMdl)} · {cart.itemCount}
        </button>
      )}

      {/* Trust band */}
      <section className="bg-white py-12 border-t border-[color:var(--ink-100)]">
        <div className="container-page">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                icon: Snowflake,
                title: "Lanț frigorific",
                body: "Pentru produsele perisabile — temperatură controlată tot drumul",
              },
              {
                icon: Truck,
                title: "Livrare la ușă",
                body: "5-10 zile lucrătoare în Anglia, Germania, Belgia, Olanda, Luxemburg",
              },
              {
                icon: ShieldCheck,
                title: "Plata la livrare",
                body: "Cash sau card. Nu plătești nimic în avans",
              },
              {
                icon: Phone,
                title: "Asistență 24/7",
                body: "Întrebări? Sună-ne, te ajutăm imediat",
              },
            ].map((b) => (
              <div
                key={b.title}
                className="flex items-start gap-3 rounded-2xl border border-[color:var(--ink-200)] bg-white p-5"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[color:var(--navy-50)] text-[color:var(--navy-800)]">
                  <b.icon className="h-5 w-5" />
                </span>
                <div>
                  <div className="font-[family-name:var(--font-montserrat)] font-bold text-[color:var(--navy-900)]">
                    {b.title}
                  </div>
                  <div className="mt-1 text-sm text-[color:var(--ink-500)]">{b.body}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

function ProductCard({ product }: { product: Product }) {
  const cart = useCart();
  const line = cart.lines.find((l) => l.product.id === product.id);

  return (
    <article className="group relative flex h-full flex-col rounded-2xl border border-[color:var(--ink-200)] bg-white overflow-hidden hover:border-[color:var(--red-400)] hover:shadow-[0_24px_60px_-30px_rgba(11,38,83,0.3)] transition-all">
      <div className="relative h-40 bg-gradient-to-br from-[color:var(--ink-50)] to-[color:var(--navy-50)] flex items-center justify-center text-7xl">
        {product.emoji}
        {product.badge && (
          <span className="absolute top-3 left-3 rounded-full bg-[color:var(--navy-900)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white">
            {product.badge}
          </span>
        )}
        {product.perishable && (
          <span className="absolute top-3 right-3 inline-flex items-center gap-1 rounded-full bg-white px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[color:var(--navy-900)] border border-[color:var(--navy-100,rgba(20,58,122,0.15))]">
            <Snowflake className="h-3 w-3" /> frig
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-4">
        <h3 className="font-[family-name:var(--font-montserrat)] font-bold text-[color:var(--navy-900)] leading-tight">
          {product.name}
        </h3>
        {product.brand && (
          <div className="mt-0.5 text-[11px] text-[color:var(--ink-500)] uppercase tracking-wider font-bold">
            {product.brand}
          </div>
        )}
        <p className="mt-2 text-xs text-[color:var(--ink-500)] leading-relaxed line-clamp-2">
          {product.description}
        </p>

        <div className="mt-auto pt-4 flex items-end justify-between gap-2">
          <div>
            <div className="font-[family-name:var(--font-montserrat)] text-xl font-extrabold text-[color:var(--navy-900)]">
              {formatMdl(product.price)}
            </div>
            <div className="text-[10px] text-[color:var(--ink-500)] uppercase tracking-wider font-bold">
              / {product.unitValue ? `${product.unitValue}${product.unit}` : product.unit}
            </div>
          </div>

          {line ? (
            <div className="inline-flex items-center rounded-full bg-[color:var(--red-500)] text-white">
              <button
                onClick={() => cart.set(product.id, line.quantity - 1)}
                aria-label="Minus"
                className="flex h-9 w-9 items-center justify-center hover:brightness-110"
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
              <span className="px-2 font-mono font-bold text-sm min-w-[1.5rem] text-center">
                {line.quantity}
              </span>
              <button
                onClick={() => cart.set(product.id, line.quantity + 1)}
                aria-label="Plus"
                className="flex h-9 w-9 items-center justify-center hover:brightness-110"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => {
                cart.add(product);
                cart.setOpen(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-full bg-[color:var(--navy-900)] px-3.5 py-2 text-xs font-bold text-white hover:bg-[color:var(--red-500)] transition-colors"
            >
              <Plus className="h-3.5 w-3.5" /> Adaugă
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

function Bullet({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 rounded-xl border border-white/15 bg-white/5 backdrop-blur p-3">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/10 text-[color:var(--red-400)]">
        {icon}
      </span>
      <span className="text-sm text-white/85 leading-snug">{children}</span>
    </div>
  );
}
