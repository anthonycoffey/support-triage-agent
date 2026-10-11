// Synthetic customer records. Emails use the reserved .example TLD.

export type Plan = "free" | "pro" | "enterprise";

export interface Customer {
  email: string;
  name: string;
  plan: Plan;
  accountStatus: "active" | "past_due" | "suspended";
  seats: number;
}

export const CUSTOMERS: Customer[] = [
  { email: "maria@brightpaws.example", name: "Maria Okafor", plan: "pro", accountStatus: "active", seats: 4 },
  { email: "ops@northwind-freight.example", name: "Northwind Freight", plan: "enterprise", accountStatus: "active", seats: 120 },
  { email: "dev@tinyforge.example", name: "Sam Lee", plan: "free", accountStatus: "active", seats: 1 },
  { email: "billing@harborclinic.example", name: "Harbor Clinic", plan: "enterprise", accountStatus: "past_due", seats: 45 },
  { email: "jo@quillcafe.example", name: "Jo Duarte", plan: "pro", accountStatus: "active", seats: 2 },
  { email: "admin@eastgate-law.example", name: "Eastgate Law", plan: "enterprise", accountStatus: "active", seats: 60 },
  { email: "kim@lumen-studio.example", name: "Kim Park", plan: "free", accountStatus: "suspended", seats: 1 },
  { email: "team@cobaltdesign.example", name: "Cobalt Design", plan: "pro", accountStatus: "active", seats: 9 },
  { email: "admin@clinica-sol.example", name: "Clínica Sol", plan: "enterprise", accountStatus: "active", seats: 30 },
  { email: "financeiro@padaria-lua.example", name: "Padaria Lua", plan: "pro", accountStatus: "active", seats: 3 },
];
