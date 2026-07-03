import { BookingForm } from "@/components/booking/BookingForm";

export const dynamic = "force-dynamic";

export default function PanouRezervarePage() {
  return (
    <div>
      <h1 className="text-xl font-extrabold text-[color:var(--navy-900)] mb-1">Rezervare nouă</h1>
      <p className="text-sm text-[color:var(--ink-500)] mb-5">
        Același formular ca pe site — rezervarea apare instant pe davo și la ceilalți operatori.
      </p>
      <BookingForm embedded />
    </div>
  );
}
