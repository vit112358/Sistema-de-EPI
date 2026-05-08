export const COMPANY_CONFIG = {
  nome: "Empresa Exemplo Ltda.",
  endereco: "Av. Paulista, 1000 – Bela Vista, São Paulo/SP – CEP 01310-100",
};

export function addDays(dateStr: string, days: number | undefined): Date {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + (days ?? 0));
  return d;
}

export function daysUntil(date: Date): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.round((date.getTime() - now.getTime()) / 86400000);
}

export function fmtDate(d: Date): string {
  return d.toLocaleDateString("pt-BR");
}