"use client";

import { createContext, useContext } from "react";
import { BUSINESS } from "@/lib/config";

export interface Business {
  name: string;
  address: string;
  taxId: string;
  phone: string;
  logo: string | null; // dirección del logo para recibos y facturas
}

const BusinessContext = createContext<Business>({ name: BUSINESS.name, address: BUSINESS.address, taxId: BUSINESS.taxId, phone: "", logo: null });

/** Datos del restaurante actual para los componentes del navegador (ticket, encabezados). */
export function BusinessProvider({ value, children }: { value: Business; children: React.ReactNode }) {
  return <BusinessContext.Provider value={value}>{children}</BusinessContext.Provider>;
}

export function useBusiness() {
  return useContext(BusinessContext);
}
