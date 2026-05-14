export const COMPANY_CONFIG = {
  nome: "Empresa Exemplo Ltda.",
  endereco: "Av. Paulista, 1000 – Bela Vista, São Paulo/SP – CEP 01310-100",
  cnpj: "12.345.678/0001-90",
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

export function fmtDateStr(s: string | undefined | null): string {
  if (!s) return "—";
  const [y, m, d] = s.split("-");
  if (!y || !m || !d) return s;
  return `${d}/${m}/${y}`;
}

export function declaracaoCompletaEpi(nomeFuncionario: string): string {
  return (
    `Eu, ${nomeFuncionario}, declaro para todos os efeitos previstos na legislação, haver recebido gratuitamente, conforme descrito na C.L.T. nos artigos 166, 167 e demais artigos adstritos à matéria, na NR - 6 e nos itens 1.4.2 e 1.5.5.1.2 da NR - 1 DISPOSIÇÕES GERAIS e GERENCIAMENTO DE RISCOS OCUPACIONAIS, após treinamento e orientação do uso adequado, aplicação, guarda, conservação, substituição e requisitos de higiene, em palestra realizada pelo Serviço Especializado em Segurança e Medicina do Trabalho da empresa, ${COMPANY_CONFIG.nome}, situada ${COMPANY_CONFIG.endereco}, o(s) equipamento(s) de proteção individual abaixo descrito(s) e designado(s) como EPIs, os quais obrigo-me a usá-lo(s) sistematicamente em meu trabalho, mediante ainda, os termos seguintes:\n\n` +
    `a) O EPI será usado unicamente para finalidade a que se destina e qualquer alteração que o torne parcial ou totalmente danificado será por mim comunicado à empresa;\n\n` +
    `b) Declaro que me responsabilizo pela guarda e conservação dos EPI's que me foram confiados e que, na impossibilidade de seu uso, deverei comunicar a chefia imediatamente, para as providências que se fizerem necessárias, e os devolverei após o vencimento de duração estipulada;\n\n` +
    `c) Estou ciente e de pleno acordo que a falta de uso por mim, dos EPI's fornecidos pela Empresa, constitui Ato Faltoso, sujeito às sanções disciplinares previstas na legislação pertinente aos assuntos, Regulamento Interno e Normas de Segurança da Empresa;\n\n` +
    `d) Reconhecendo expressamente que a sua não utilização configura em falta grave capitulada na letra "h", do Artigo 482 da C.L.T., como ato de indisciplina ou de insubordinação, ensejadora da rescisão do meu contrato de trabalho por justa causa;\n\n` +
    `e) Autorizo expressamente a Empresa a proceder descontos nos meus salários, vencimentos, gratificações, indenizações, os valores dos EPI's que por ventura por mim forem:\n` +
    `   - Danificados propositadamente;\n` +
    `   - Extraviados;\n` +
    `   - Não devolvidos à empresa para substituição;\n\n` +
    `f) Tomei ciência e estou de acordo com os termos da declaração acima, assinando-a de livre e espontânea vontade, após sua leitura nessa data`
  );
}

export function declaracaoTermoEpi(): string {
  return (
    `Declaro que recebi treinamento, instrução sobre uso correto dos EPI's na empresa ${COMPANY_CONFIG.nome}, para meu uso em caráter ` +
    `obrigatório, os equipamentos descritos abaixo, os quais me comprometo a utilizá-los devidamente durante o tempo em que permanecer ` +
    `na empresa, observando as medidas gerais de disciplinas que integram a NR-06 – EPI – Equipamentos de Proteção Individual da ` +
    `Portaria 3.214 de 08/06/78`
  );
}