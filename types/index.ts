export interface Destination {
  id: string;
  name: string;
  slug: string;
  seoSlug: string;
  price: string;
  currency: string;
  description: string;
  cities: City[];
  image: string;
}

export interface City {
  id: string;
  name: string;
  slug: string;
  pageSlug?: string;
}

export interface Service {
  id: string;
  title: string;
  slug: string;
  description: string;
  icon: string;
  features: string[];
  image?: string;
}

export interface Testimonial {
  id: string;
  name: string;
  text: string;
  rating: number;
}

export interface ContactInfo {
  phone: string;
  phoneSecondary?: string;
  whatsapp: string;
  viber: string;
  telegram: string;
  email?: string;
  address: string;
}

export type BookingType = "passenger" | "parcel";
export type TripType = "one-way" | "round-trip";

export interface BookingFormData {
  type: BookingType;
  tripType?: TripType;
  departureCity: string;
  arrivalCity?: string;
  name: string;
  phone: string;
  date: string;
  returnDate?: string;
}

export interface NavItem {
  label: string;
  href: string;
  children?: NavItem[];
}
