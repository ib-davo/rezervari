"use client";

import { createContext, useContext } from "react";
import { staticGeo, type GeoData } from "@/lib/geoShared";

// Geografia (țări + orașe din DB) pentru componentele client: picker-ele de
// rezervare, Hero, formularele din admin. Layout-urile (server) o încarcă cu
// `getGeoSafe()` și o pun aici; în afara provider-ului cădem pe listele statice.
const GeoContext = createContext<GeoData | null>(null);

export function GeoProvider({ geo, children }: { geo: GeoData; children: React.ReactNode }) {
  return <GeoContext.Provider value={geo}>{children}</GeoContext.Provider>;
}

export function useGeo(): GeoData {
  return useContext(GeoContext) ?? staticGeo();
}
