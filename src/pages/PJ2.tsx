import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { format, parseISO } from 'date-fns'
import { Plus, Trash2, CheckCircle2, Circle, Receipt, CheckCheck } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { Pj2Cliente, Pj2Servico } from '../lib/types'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import { Input } from '../components/ui/Input'

function formatBRL(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

const FORMAS_PAGAMENTO = ['PIX', 'Boleto', 'TED', 'Dinheiro', 'Cartão', 'Cheque', 'Outro']

interface ClienteForm {
  nome: string
  contato: string
}

interface ServicoForm {
  cliente_id: string
  descricao: string
  valor_fechado: string
  gastos: string
  imposto: string
  data_vencimento: string
  forma_pagamento: string
}

export default function PJ2() {
  const [activeTab, setActiveTab] = useState<'clientes' | 'servicos'>('clientes')
  const [clientes, setClientes] = useState<Pj2Cliente[]>([])
  const [servicos, setServicos] = useState<Pj2Servico[]>([])
  const [loading, setLoading] = useState(true)
  const [isClienteModalOpen, setIsClienteModalOpen] = useState(false)
  const [isServicoModalOpen, setIsServicoModalOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [toggling, setToggling] = useState<string | null>(null)

  const clienteForm = useForm<ClienteForm>()
  const servicoForm = useForm<ServicoForm>({
    defaultValues: { gastos: '0', imposto: '0', data_vencimento: '', forma_pagamento: 'PIX' },
  })

  const watchedServico = servicoForm.watch(['valor_fechado', 'gastos', 'imposto'])
  const valorFechado = parseFloat(watchedServico[0]?.replace(',', '.') || '0') || 0
  const gastos = parseFloat(watchedServico[1]?.replace(',', '.') || '0') || 0
  const imposto = parseFloat(watchedServico[2]?.replace(',', '.') || '0') || 0
  const lucro = valorFechado - gastos - imposto
  const lucroCada = lucro / 2

  const fetchData = async () => {
    setLoading(true)
    const [cRes, sRes] = await Promise.all([
      supabase.from('pj2_clientes').select('*').order('nome'),
      supabase.from('pj2_servicos').select('*, pj2_clientes(nome, contato)').order('created_at', { ascending: false }),
    ])
    setClientes((cRes.data as Pj2Cliente[]) || [])
    const sData = (sRes.data || []).map((s: any) => ({
      ...s,
      pago: s.pago ?? false,
      impostos_pagos: s.impostos_pagos ?? false,
      forma_pagamento: s.forma_pagamento ?? null,
    }))
    setServicos(sData as Pj2Servico[])
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [])

  const onSubmitCliente = async (data: ClienteForm) => {
    setSubmitting(true)
    const { error } = await supabase.from('pj2_clientes').insert({
      nome: data.nome,
      contato: data.contato || null,
    })
    if (!error) {
      await fetchData()
      clienteForm.reset()
      setIsClienteModalOpen(false)
    }
    setSubmitting(false)
  }

  const onSubmitServico = async (data: ServicoForm) => {
    setSubmitting(true)
    const { error } = await supabase.from('pj2_servicos').insert({
      cliente_id: data.cliente_id || null,
      descricao: data.descricao,
      valor_fechado: parseFloat(data.valor_fechado.replace(',', '.')),
      gastos: parseFloat(data.gastos.replace(',', '.') || '0'),
      imposto: parseFloat(data.imposto.replace(',', '.') || '0'),
      data_vencimento: data.data_vencimento || null,
      forma_pagamento: data.forma_pagamento || null,
      pago: false,
      impostos_pagos: false,
    })
    if (!error) {
      await fetchData()
      servicoForm.reset({ gastos: '0', imposto: '0', forma_pagamento: 'PIX' })
      setIsServicoModalOpen(false)
    }
    setSubmitting(false)
  }

  const togglePago = async (id: string, current: boolean) => {
    setToggling(id + '-pago')
    const { error } = await supabase.from('pj2_servicos').update({ pago: !current }).eq('id', id)
    if (!error) {
      setServicos(prev => prev.map(s => s.id === id ? { ...s, pago: !current } : s))
    }
    setToggling(null)
  }

  const toggleImpostosPagos = async (id: string, current: boolean) => {
    setToggling(id + '-imp')
    const { error } = await supabase.from('pj2_servicos').update({ impostos_pagos: !current }).eq('id', id)
    if (!error) {
      setServicos(prev => prev.map(s => s.id === id ? { ...s, impostos_pagos: !current } : s))
    }
    setToggling(null)
  }

  const handleDeleteCliente = async (id: string) => {
    if (!confirm('Deletar este cliente?')) return
    await supabase.from('pj2_clientes').delete().eq('id', id)
    setClientes(prev => prev.filter(c => c.id !== id))
  }

  const handleDeleteServico = async (id: string) => {
    if (!confirm('Deletar este serviço?')) return
    await supabase.from('pj2_servicos').delete().eq('id', id)
    setServicos(prev => prev.filter(s => s.id !== id))
  }

  // Stats
  const totalFaturado = servicos.reduce((s, sv) => s + Number(sv.valor_fechado), 0)
  const totalRecebido = servicos.filter(s => s.pago).reduce((s, sv) => s + Number(sv.valor_fechado), 0)
  const totalAReceber = servicos.filter(s => !s.pago).reduce((s, sv) => s + Number(sv.valor_fechado), 0)
  const totalLucro = servicos.reduce((s, sv) => s + Number(sv.valor_fechado) - Number(sv.gastos) - Number(sv.imposto), 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">PJ2 — Sociedade</h1>
        <p className="text-zinc-500 text-sm mt-0.5">Gestão de clientes, contratos e pagamentos</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-zinc-900 border border-white/5 rounded-2xl p-4">
          <p className="text-zinc-400 text-xs font-medium uppercase tracking-wide mb-2">Faturado Total</p>
          <p className="text-xl font-bold text-white tabular-nums">{formatBRL(totalFaturado)}</p>
        </div>
        <div className="bg-zinc-900 border border-white/5 rounded-2xl p-4">
          <p className="text-zinc-400 text-xs font-medium uppercase tracking-wide mb-2">Recebido</p>
          <p className="text-xl font-bold text-green-400 tabular-nums">{formatBRL(totalRecebido)}</p>
        </div>
        <div className="bg-zinc-900 border border-white/5 rounded-2xl p-4">
          <p className="text-zinc-400 text-xs font-medium uppercase tracking-wide mb-2">A Receber</p>
          <p className="text-xl font-bold text-amber-400 tabular-nums">{formatBRL(totalAReceber)}</p>
        </div>
        <div className="bg-zinc-900 border border-white/5 rounded-2xl p-4">
          <p className="text-zinc-400 text-xs font-medium uppercase tracking-wide mb-2">Lucro Total</p>
          <p className={`text-xl font-bold tabular-nums ${totalLucro >= 0 ? 'text-purple-400' : 'text-red-400'}`}>{formatBRL(totalLucro)}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-zinc-900 border border-white/5 rounded-2xl p-1 w-fit">
        {(['clientes', 'servicos'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-150 ${
              activeTab === tab
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20'
                : 'text-zinc-400 hover:text-zinc-100 hover:bg-white/5'
            }`}
          >
            {tab === 'clientes' ? 'Clientes' : 'Serviços / Contratos'}
          </button>
        ))}
      </div>

      {/* Clientes Tab */}
      {activeTab === 'clientes' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setIsClienteModalOpen(true)}>
              <Plus size={16} /> Novo Cliente
            </Button>
          </div>
          <div className="bg-zinc-900 border border-white/5 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-white/5">
              <h3 className="text-white font-semibold text-sm">Clientes ({clientes.length})</h3>
            </div>
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : clientes.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-zinc-500 text-sm">Nenhum cliente cadastrado</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/5">
                      <th className="text-left text-zinc-500 text-xs font-medium px-5 py-3 uppercase tracking-wide">Nome</th>
                      <th className="text-left text-zinc-500 text-xs font-medium px-5 py-3 uppercase tracking-wide hidden sm:table-cell">Contato</th>
                      <th className="text-left text-zinc-500 text-xs font-medium px-5 py-3 uppercase tracking-wide hidden md:table-cell">Cadastro</th>
                      <th className="px-5 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {clientes.map(c => (
                      <tr key={c.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="px-5 py-3 text-white text-sm font-medium">{c.nome}</td>
                        <td className="px-5 py-3 text-zinc-400 text-sm hidden sm:table-cell">{c.contato || '—'}</td>
                        <td className="px-5 py-3 text-zinc-400 text-sm hidden md:table-cell">
                          {format(parseISO(c.created_at), 'dd/MM/yyyy')}
                        </td>
                        <td className="px-5 py-3">
                          <button onClick={() => handleDeleteCliente(c.id)} className="text-zinc-600 hover:text-red-400 transition-colors">
                            <Trash2 size={15} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Serviços Tab */}
      {activeTab === 'servicos' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setIsServicoModalOpen(true)}>
              <Plus size={16} /> Novo Serviço
            </Button>
          </div>
          <div className="bg-zinc-900 border border-white/5 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-white/5">
              <h3 className="text-white font-semibold text-sm">Serviços ({servicos.length})</h3>
            </div>
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : servicos.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-zinc-500 text-sm">Nenhum serviço cadastrado</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/5">
                      <th className="text-left text-zinc-500 text-xs font-medium px-5 py-3 uppercase tracking-wide">Cliente</th>
                      <th className="text-left text-zinc-500 text-xs font-medium px-5 py-3 uppercase tracking-wide">Descrição</th>
                      <th className="text-right text-zinc-500 text-xs font-medium px-5 py-3 uppercase tracking-wide hidden sm:table-cell">Valor</th>
                      <th className="text-right text-zinc-500 text-xs font-medium px-5 py-3 uppercase tracking-wide hidden md:table-cell">Gastos</th>
                      <th className="text-right text-zinc-500 text-xs font-medium px-5 py-3 uppercase tracking-wide hidden md:table-cell">Imposto</th>
                      <th className="text-right text-zinc-500 text-xs font-medium px-5 py-3 uppercase tracking-wide">Lucro</th>
                      <th className="text-center text-zinc-500 text-xs font-medium px-5 py-3 uppercase tracking-wide">Pago</th>
                      <th className="text-center text-zinc-500 text-xs font-medium px-5 py-3 uppercase tracking-wide hidden lg:table-cell">Imp. Pago</th>
                      <th className="text-left text-zinc-500 text-xs font-medium px-5 py-3 uppercase tracking-wide hidden lg:table-cell">Vencimento</th>
                      <th className="px-5 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {servicos.map(s => {
                      const lucroS = Number(s.valor_fechado) - Number(s.gastos) - Number(s.imposto)
                      const isPagoToggling = toggling === s.id + '-pago'
                      const isImpToggling = toggling === s.id + '-imp'
                      return (
                        <tr key={s.id} className="hover:bg-white/[0.02] transition-colors">
                          <td className="px-5 py-3 text-white text-sm font-medium">
                            {(s.pj2_clientes as any)?.nome || '—'}
                          </td>
                          <td className="px-5 py-3 text-zinc-300 text-sm">
                            <div>
                              {s.descricao}
                              {s.forma_pagamento && (
                                <span className="ml-2 text-xs text-zinc-500 bg-zinc-800 px-1.5 py-0.5 rounded-md">
                                  {s.forma_pagamento}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-5 py-3 text-right text-zinc-300 text-sm tabular-nums hidden sm:table-cell">
                            {formatBRL(Number(s.valor_fechado))}
                          </td>
                          <td className="px-5 py-3 text-right text-red-400 text-sm tabular-nums hidden md:table-cell">
                            {formatBRL(Number(s.gastos))}
                          </td>
                          <td className="px-5 py-3 text-right text-orange-400 text-sm tabular-nums hidden md:table-cell">
                            {formatBRL(Number(s.imposto))}
                          </td>
                          <td className="px-5 py-3 text-right font-semibold text-sm tabular-nums">
                            <span className={lucroS >= 0 ? 'text-green-400' : 'text-red-400'}>
                              {formatBRL(lucroS)}
                            </span>
                          </td>
                          {/* Pago toggle */}
                          <td className="px-5 py-3 text-center">
                            <button
                              onClick={() => togglePago(s.id, s.pago)}
                              disabled={isPagoToggling}
                              className={`transition-all duration-150 ${isPagoToggling ? 'opacity-40' : 'hover:scale-110'}`}
                              title={s.pago ? 'Marcar como não pago' : 'Marcar como pago'}
                            >
                              {s.pago ? (
                                <CheckCircle2 size={18} className="text-green-400" />
                              ) : (
                                <Circle size={18} className="text-zinc-600 hover:text-zinc-400" />
                              )}
                            </button>
                          </td>
                          {/* Impostos pagos toggle */}
                          <td className="px-5 py-3 text-center hidden lg:table-cell">
                            <button
                              onClick={() => toggleImpostosPagos(s.id, s.impostos_pagos)}
                              disabled={isImpToggling || Number(s.imposto) === 0}
                              className={`transition-all duration-150 ${isImpToggling || Number(s.imposto) === 0 ? 'opacity-30' : 'hover:scale-110'}`}
                              title={s.impostos_pagos ? 'Marcar imposto como não pago' : 'Marcar imposto como pago'}
                            >
                              {s.impostos_pagos ? (
                                <CheckCheck size={16} className="text-blue-400" />
                              ) : (
                                <Receipt size={16} className={Number(s.imposto) > 0 ? 'text-zinc-600 hover:text-zinc-400' : 'text-zinc-800'} />
                              )}
                            </button>
                          </td>
                          <td className="px-5 py-3 text-zinc-400 text-sm hidden lg:table-cell">
                            {s.data_vencimento ? format(parseISO(s.data_vencimento), 'dd/MM/yyyy') : '—'}
                          </td>
                          <td className="px-5 py-3">
                            <button onClick={() => handleDeleteServico(s.id)} className="text-zinc-700 hover:text-red-400 transition-colors">
                              <Trash2 size={15} />
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Cliente Modal */}
      <Modal isOpen={isClienteModalOpen} onClose={() => setIsClienteModalOpen(false)} title="Novo Cliente">
        <form onSubmit={clienteForm.handleSubmit(onSubmitCliente)} className="space-y-4">
          <Input
            label="Nome"
            placeholder="Nome do cliente"
            error={clienteForm.formState.errors.nome?.message}
            {...clienteForm.register('nome', { required: 'Obrigatório' })}
          />
          <Input
            label="Contato (telefone/email)"
            placeholder="(11) 99999-9999 ou email@exemplo.com"
            {...clienteForm.register('contato')}
          />
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" className="flex-1" onClick={() => setIsClienteModalOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" className="flex-1" loading={submitting}>
              Salvar
            </Button>
          </div>
        </form>
      </Modal>

      {/* Serviço Modal */}
      <Modal isOpen={isServicoModalOpen} onClose={() => setIsServicoModalOpen(false)} title="Novo Serviço" size="lg">
        <form onSubmit={servicoForm.handleSubmit(onSubmitServico)} className="space-y-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-zinc-300">Cliente</label>
            <select
              className="bg-zinc-800 border border-white/10 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 text-sm"
              {...servicoForm.register('cliente_id')}
            >
              <option value="">Selecionar cliente...</option>
              {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>
          <Input
            label="Descrição"
            placeholder="Descrição do serviço/contrato"
            error={servicoForm.formState.errors.descricao?.message}
            {...servicoForm.register('descricao', { required: 'Obrigatório' })}
          />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input
              label="Valor Fechado (R$)"
              placeholder="0,00"
              error={servicoForm.formState.errors.valor_fechado?.message}
              {...servicoForm.register('valor_fechado', {
                required: 'Obrigatório',
                pattern: { value: /^\d+([.,]\d{0,2})?$/, message: 'Inválido' },
              })}
            />
            <Input
              label="Gastos (R$)"
              placeholder="0,00"
              {...servicoForm.register('gastos', {
                pattern: { value: /^\d+([.,]\d{0,2})?$/, message: 'Inválido' },
              })}
            />
            <Input
              label="Imposto (R$)"
              placeholder="0,00"
              {...servicoForm.register('imposto', {
                pattern: { value: /^\d+([.,]\d{0,2})?$/, message: 'Inválido' },
              })}
            />
          </div>

          {/* Calculation preview */}
          <div className="bg-zinc-800/60 rounded-xl p-4 space-y-2">
            <h4 className="text-zinc-400 text-xs font-medium uppercase tracking-wider">Cálculo Automático</h4>
            <div className="flex justify-between text-sm">
              <span className="text-zinc-400">Lucro Total</span>
              <span className={`font-semibold tabular-nums ${lucro >= 0 ? 'text-green-400' : 'text-red-400'}`}>{formatBRL(lucro)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-zinc-400">Lucro por Sócio</span>
              <span className="text-amber-400 font-semibold tabular-nums">{formatBRL(lucroCada)}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Data de Vencimento"
              type="date"
              {...servicoForm.register('data_vencimento')}
            />
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-zinc-300">Forma de Pagamento</label>
              <select
                className="bg-zinc-800 border border-white/10 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 text-sm"
                {...servicoForm.register('forma_pagamento')}
              >
                {FORMAS_PAGAMENTO.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" className="flex-1" onClick={() => setIsServicoModalOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" className="flex-1" loading={submitting}>
              Salvar
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
