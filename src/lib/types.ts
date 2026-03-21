export type UserRole = 'ramon' | 'mano'

export interface Profile {
  id: string
  name: string | null
  photo_url: string | null
  role: UserRole | null
  company_name: string | null
  pj1_company_name: string | null
  created_at: string
  updated_at: string
}

export interface PfReceita {
  id: string
  user_id: string
  descricao: string
  valor: number
  forma_pagamento: string
  data: string
  created_at: string
}

export interface Pj1Receita {
  id: string
  descricao: string
  valor: number
  quem_pagou: string
  data: string
  created_at: string
}

export interface Pj2Cliente {
  id: string
  nome: string
  contato: string | null
  created_at: string
}

export interface Pj2Servico {
  id: string
  cliente_id: string | null
  descricao: string
  valor_fechado: number
  gastos: number
  imposto: number
  data_vencimento: string | null
  pago: boolean
  impostos_pagos: boolean
  forma_pagamento: string | null
  created_at: string
  pj2_clientes?: Pj2Cliente
}

export interface KanbanPipeline {
  id: string
  nome: string
  ordem: number
  tipo: 'shared' | 'personal'
  user_id: string | null
  created_at: string
}

export interface KanbanTarefa {
  id: string
  pipeline_id: string
  titulo: string
  descricao: string | null
  ordem: number
  tipo: 'shared' | 'personal'
  user_id: string | null
  created_at: string
}

export interface CompanySettings {
  id: number
  company_name: string
  updated_at: string
}
