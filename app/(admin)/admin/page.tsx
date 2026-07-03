"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Ticket,
  Users,
  Package,
  DollarSign,
  CalendarClock,
  Mail,
  CheckCircle,
  Clock,
  ArrowRight,
  Plus,
} from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import StatCard from "@/components/admin/StatCard";
import Badge from "@/components/admin/Badge";
import type { MockTrip } from "@/lib/adminMock";
import { statusMeta, tripStatusMeta } from "@/lib/adminLabels";

type Stats = {
  totalBookings: number;
  totalPassengers: number;
  totalParcels: number;
  totalRevenue: number;
  pending: number;
  confirmed: number;
};

type RecentBooking = {
  id: string;
  bookingNumber: string;
  firstName: string;
  lastName: string;
  departureCity: string;
  arrivalCity: string;
  departureDate: string;
  price: number;
  currency: string;
  status: string;
  createdAt: string;
};

type EmailStats = { sent: number; failed: number; queued: number; scheduled: number };

const dateFmt = new Intl.DateTimeFormat("ro-RO", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [recent, setRecent] = useState<RecentBooking[]>([]);
  const [trips, setTrips] = useState<MockTrip[]>([]);
  const [emailStats, setEmailStats] = useState<EmailStats>({ sent: 0, failed: 0, queued: 0, scheduled: 0 });

  useEffect(() => {
    fetch("/api/admin/stats").then((r) => r.json()).then((d) => d?.success && setStats(d.stats)).catch(() => {});
    fetch("/api/admin/bookings").then((r) => r.json()).then((d) => d?.success && setRecent(d.bookings.slice(0, 5))).catch(() => {});
    fetch("/api/admin/trips").then((r) => r.json()).then((d) => d?.success && setTrips(d.trips)).catch(() => {});
    fetch("/api/admin/emails").then((r) => r.json()).then((d) => d?.success && setEmailStats(d.stats)).catch(() => {});
  }, []);

  const upcomingTrips = trips
    .filter((t) => new Date(t.departureAt) >= new Date())
    .slice(0, 5);
  const pendingEmails = emailStats.queued + emailStats.scheduled + emailStats.failed;

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle="Rezumat operațional — rezervări, curse și emailuri automate"
        actions={
          <>
            <Link
              href="/admin/trips"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
            >
              Vezi cursele <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <Link
              href="/admin/trips"
              className="inline-flex items-center gap-1.5 rounded-lg bg-orange-500 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-orange-600"
            >
              <Plus className="h-3.5 w-3.5" /> Cursă nouă
            </Link>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total rezervări" value={stats?.totalBookings ?? "—"} icon={Ticket} tone="orange" />
        <StatCard label="Pasageri" value={stats?.totalPassengers ?? "—"} icon={Users} tone="blue" />
        <StatCard label="Colete" value={stats?.totalParcels ?? "—"} icon={Package} tone="purple" />
        <StatCard label="Venit total" value={`${(stats?.totalRevenue ?? 0).toFixed(0)} €`} icon={DollarSign} tone="green" />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="În așteptare" value={stats?.pending ?? 0} icon={Clock} tone="slate" hint="Confirmare plată / manual" />
        <StatCard label="Confirmate" value={stats?.confirmed ?? 0} icon={CheckCircle} tone="green" />
        <StatCard label="Curse viitoare" value={upcomingTrips.length} icon={CalendarClock} tone="orange" />
        <StatCard label="Emailuri pendinte" value={pendingEmails} icon={Mail} tone="red" hint="Scheduled / queued / failed" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <section className="lg:col-span-3 rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Curse viitoare</h2>
              <p className="text-xs text-slate-500">Următoarele plecări programate</p>
            </div>
            <Link href="/admin/trips" className="text-xs font-semibold text-orange-600 hover:text-orange-700">
              Vezi toate →
            </Link>
          </div>
          <ul className="divide-y divide-slate-100">
            {upcomingTrips.length === 0 && (
              <li className="px-5 py-8 text-center text-sm text-slate-500">
                Nu există curse viitoare programate.
              </li>
            )}
            {upcomingTrips.map((t) => {
              const meta = tripStatusMeta[t.status];
              const pct = t.capacity > 0 ? Math.round((t.booked / t.capacity) * 100) : 0;
              return (
                <li key={t.id} className="flex items-center gap-4 px-5 py-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-slate-900">{t.routeLabel}</span>
                      <Badge variant={meta.variant}>{meta.label}</Badge>
                    </div>
                    <div className="mt-0.5 text-xs text-slate-500">
                      {dateFmt.format(new Date(t.departureAt))} · {t.busLabel}
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-orange-400 to-orange-600"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-bold text-slate-900">
                      {t.booked}/{t.capacity}
                    </div>
                    <div className="text-xs text-slate-500">{t.revenue} €</div>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Rezervări recente</h2>
              <p className="text-xs text-slate-500">Ultimele 5 intrări din DB</p>
            </div>
            <Link href="/admin/bookings" className="text-xs font-semibold text-orange-600 hover:text-orange-700">
              Toate →
            </Link>
          </div>
          <ul className="divide-y divide-slate-100">
            {recent.length === 0 && (
              <li className="px-5 py-8 text-center text-sm text-slate-500">
                Nu există rezervări în DB încă.
              </li>
            )}
            {recent.map((b) => {
              const meta = statusMeta[b.status] ?? statusMeta.pending;
              return (
                <li key={b.id} className="px-5 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-mono text-xs font-bold text-slate-900">{b.bookingNumber}</div>
                      <div className="mt-0.5 text-sm text-slate-700 truncate">
                        {b.firstName} {b.lastName}
                      </div>
                      <div className="text-xs text-slate-500 truncate">
                        {b.departureCity} → {b.arrivalCity}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <Badge variant={meta.variant}>{meta.label}</Badge>
                      <div className="mt-1 text-sm font-semibold text-slate-900">
                        {b.price} {b.currency}
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <QuickAction title="Rute active" description="Gestionează originea, destinația și prețul de bază." href="/admin/routes" />
        <QuickAction title="Autocare" description="Adaugă un autocar nou și desenează layout-ul de scaune." href="/admin/buses" />
        <QuickAction title="Coada de emailuri" description="Verifică reminderele programate și emailurile eșuate." href="/admin/emails" />
      </div>
    </div>
  );
}

function QuickAction({ title, description, href }: { title: string; description: string; href: string }) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:border-orange-300 hover:shadow-md"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          {title}
          <ArrowRight className="h-4 w-4 text-slate-400 transition-transform group-hover:translate-x-0.5 group-hover:text-orange-500" />
        </div>
        <p className="mt-1 text-xs text-slate-500">{description}</p>
      </div>
    </Link>
  );
}
