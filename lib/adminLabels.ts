import type { TripStatus, EmailStatus, EmailType } from "@/lib/adminMock";

type BadgeVariant =
  | "slate"
  | "green"
  | "yellow"
  | "red"
  | "blue"
  | "purple"
  | "orange";

export const statusMeta: Record<string, { label: string; variant: BadgeVariant }> = {
  pending: { label: "În așteptare", variant: "yellow" },
  confirmed: { label: "Confirmată", variant: "green" },
  cancelled: { label: "Anulată", variant: "red" },
  completed: { label: "Finalizată", variant: "blue" },
};

export const tripStatusMeta: Record<TripStatus, { label: string; variant: BadgeVariant }> = {
  scheduled: { label: "Programată", variant: "blue" },
  boarding: { label: "Îmbarcare", variant: "orange" },
  en_route: { label: "În drum", variant: "purple" },
  completed: { label: "Finalizată", variant: "slate" },
  cancelled: { label: "Anulată", variant: "red" },
};

export const emailStatusMeta: Record<EmailStatus, { label: string; variant: BadgeVariant }> = {
  sent: { label: "Trimis", variant: "green" },
  failed: { label: "Eșuat", variant: "red" },
  queued: { label: "În coadă", variant: "yellow" },
  scheduled: { label: "Programat", variant: "blue" },
};

export const emailTypeLabel: Record<EmailType, string> = {
  confirmation: "Confirmare rezervare",
  reminder_24h: "Reminder 24h înainte",
  cancellation: "Anulare rezervare",
};
