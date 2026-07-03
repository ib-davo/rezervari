import BookingsView from "@/components/operator/BookingsView";

export const dynamic = "force-dynamic";

export default function ArhivaPage() {
  return <BookingsView scope="archived" />;
}
