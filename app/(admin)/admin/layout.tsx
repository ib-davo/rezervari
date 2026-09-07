import AdminShell from "@/components/admin/AdminShell";
import { GeoProvider } from "@/components/geo/GeoProvider";
import { getGeoSafe } from "@/lib/geo";

export const metadata = {
  title: "DAVO — Panou administrare",
  robots: { index: false, follow: false },
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Orașele (DB) pentru formularele din admin: rezervare manuală, schemă autocar.
  const geo = await getGeoSafe();
  return (
    <GeoProvider geo={geo}>
      <AdminShell>{children}</AdminShell>
    </GeoProvider>
  );
}
