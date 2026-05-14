export interface Epi {
  id?: number;
  nome: string;
  ca?: string;
  cas_json?: string | null;
  categoria?: string;
  estoque: number;
  minimo: number;
  validade?: string;
  img?: string;
  periodicidade?: number;
  descricao?: string;
  norma?: string;
  fabricante?: string;
}

export interface Biometria {
  id?: number;
  funcionario_id: number;
  tipo: string;
  data: string;
  qualidade: number;
  imagem_base64?: string | null;
  descriptor_json?: string | null;
}

export interface Funcionario {
  id?: number;
  nome: string;
  matricula: string;
  setor: string;
  cargo: string;
  email: string;
  telefone: string;
  admissao?: string;
  data_admissao?: string;
  biometrias: Biometria[];
}

export interface EntregaItem {
  epi_id: number;
  nome: string;
  img: string;
  qtd: number;
  ca?: string;
}

export type EntregaStatus   = "pendente_assinatura" | "assinado" | "cancelado";
export type TipoAssinatura  = "facial" | "digital" | "manual";

export interface Entrega {
  id?: number;
  funcionario_id: number;
  funcionario: string;
  status: EntregaStatus;
  tipo_assinatura?: TipoAssinatura | null;
  confianca?: number | null;
  data: string;
  itens: EntregaItem[];
  assinatura_img?: string | null;
}

export interface Cargo {
  id: number;
  nome: string;
}

export interface Usuario {
  id?: number;
  nome: string;
  username: string;
  senha?: string;
  role: string;
}

export interface Toast {
  id: number;
  msg: string;
  type: 'success' | 'error' | 'info';
}