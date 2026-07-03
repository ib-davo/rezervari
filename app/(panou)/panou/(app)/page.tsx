import BookingsView from "@/components/operator/BookingsView";

export const dynamic = "force-dynamic";

export default function PanouPage() {
  return <BookingsView scope="active" />;
}
