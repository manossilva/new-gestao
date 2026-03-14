import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { format, parseISO, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns'
import { Plus, Trash2, DollarSign, TrendingUp, Calendar, Building2, AlertCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import type { PfReceita, Pj1Receita, Pj2Servico, Pj2Cliente } from '../lib/types'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import { Input, Select } from '../components/ui/Input'
import { StatCard } from '../components/ui/Card'

interface PfFormData {
  descricao: string
  valor: string
  forma_pagamento: string
  data: string
}

interface Pj1FormData {
  descricao: string
  valor: string
  quem_pagou: string
  data: string
}

interface ServicoComCliente extends Pj2Servico {
  cliente?: Pj2Cliente
}

function formatBRL(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

const FORMAS = ['PIX', 'Boleto', 'Dinheiro', 'TED', 'Cartão']

export default function PF() {
  const { user, profile } = useAuth()
  const isRamon = profile?.role === 'ramon'
  const [activeTab, setActiveTab] = useState<'pf' | 'pj1' | 'sociedade'>('pf')

  // PF state
  const [pfReceitas, setPfReceitas] = useState<PfReceita[]>([])
  const [pfLoading, setPfLoading] = useState(true)
  const [pfModalOpen, setPfModalOpen] = useState(false)
  const [pfSubmitting, setPfSubmitting] = useState(false)
  const [pfError, setPfError] = useState('')

  // PJ1 state
  const [pj1Receitas, setPj1Receitas] = useState<Pj1Receita[]>([])
  const [pj1Loading, setPj1Loading] = useState(true)
  const [pj1ModalOpen, setPj1ModalOpen] = useState(false)
  const [pj1Submitting, setPj1Submitting] = useState(false)
  const [pj1Error, setPj1Error] = useState('')

  // PJ2 (Sociedade) state
  const [pj2Servicos, setPj2Servicos] = useState<ServicoComCliente[]>([])
  const [pj2Loading, setPj2Loading] = useState(true)

  const pfForm = useForm<PfFormData>({
    defaultValues: { forma_pagamento: 'PIX', data: new Date().toISOString().split('T')[0] },
  })
  const pj1Form = useForm<Pj1FormData>({
    defaultValues: { data: new Date().toISOString().split('T')[0] },
  })

  const fetchPf = async () => {
    if (!user) return
    setPfLoading(true)
    const { data, error } = await supabase
      .from('pf_receitas')
      .select('*')
      .eq('user_id', user.id)
      .order('data', { ascending: false })
    if (!error) setPfReceitas((data as PfReceita[]) || [])
    setPfLoading(false)
  }

  const fetchPj1 = async () => {
    setPj1Loading(true)
    const { data } = await supabase
      .from('pj1_receitas')
      .select('*')
      .order('data', { ascending: false })
    setPj1Receitas((data as Pj1Receita[]) || [])
    setPj1Loading(false)
  }

  const fetchPj2 = async () => {
    setPj2Loading(true)
    const { data } = await supabase
      .from('pj2_servicos')
      .select('*, pj2_clientes(*)')
      .order('data_vencimento', { ascending: true })
    const servicos = (data || []).map((s: any) => ({ ...s, cliente: s.pj2_clientes }))
    setPj2Servicos(servicos)
    setPj2Loading(false)
  }

  useEffect(() => { if (user) { fetchPf(); fetchPj2() } }, [user])
  useEffect(() => { if (isRamon) fetchPj1() }, [isRamon])

  // PF submit
  const onPfSubmit = async (data: PfFormData) => {
    if (!user) return
    setPfSubmitting(true)
    setPfError('')
    const { error } = await supabase.from('pf_receitas').insert({
      user_id: user.id,
      descricao: data.descricao,
      valor: parseFloat(data.valor.replace(',', '.')),
      forma_pagamento: data.forma_pagamento,
      data: data.data,
    })
    if (error) {
      setPfError(`Erro ao salvar: ${error.message}`)
    } else {
      await fetchPf()
      pfForm.reset({ forma_pagamento: 'PIX', data: new Date().toISOString().split('T')[0] })
      setPfModalOpen(false)
    }
    setPfSubmitting(false)
  }

  // PJ1 submit
  const onPj1Submit = async (data: Pj1FormData) => {
    setPj1Submitting(true)
    setPj1Error('')
    const { error } = await supabase.from('pj1_receitas').insert({
      descricao: data.descricao,
      valor: parseFloat(data.valor.replace(',', '.')),
      quem_pagou: data.quem_pagou,
      data: data.data,
    })
    if (error) {
      setPj1Error(`Erro ao salvar: ${error.message}`)
    } else {
      await fetchPj1()
      pj1Form.reset({ data: new Date().toISOString().split('T')[0] })
      setPj1ModalOpen(false)
    }
    setPj1Submitting(false)
  }

  const handleDeletePf = async (id: string) => {
    if (!confirm('Deletar esta receita?')) return
    await supabase.from('pf_receitas').delete().eq('id', id)
    setPfReceitas(prev => prev.filter(r => r.id !== id))
  }

  const handleDeletePj1 = async (id: string) => {
    if (!confirm('Deletar esta receita?')) return
    await supabase.from('pj1_receitas').delete().eq('id', id)
    setPj1Receitas(prev => prev.filter(r => r.id !== id))
  }

  // Stats
  const now = new Date()
  const monthStart = startOfMonth(now)
  const monthEnd = endOfMonth(now)

  const pfTotal = pfReceitas.reduce((s, r) => s + Number(r.valor), 0)
  const pfThisMonth = pfReceitas
    .filter(r => { try { return isWithinInterval(parseISO(r.data), { start: monthStart, end: monthEnd }) } catch { return false } })
    .reduce((s, r) => s + Number(r.valor), 0)

  const pj1Total = pj1Receitas.reduce((s, r) => s + Number(r.valor), 0)
  const pj1ThisMonth = pj1Receitas
    .filter(r => { try { return isWithinInterval(parseISO(r.data), { start: monthStart, end: monthEnd }) } catch { return false } })
    .reduce((s, r) => s + Number(r.valor), 0)

  // PJ2 stats (user's share = lucro / 2)
  const pj2MinhaParteTotal = pj2Servicos.reduce((s, sv) => {
    const lucro = Number(sv.valor_fechado) - Number(sv.gastos) - Number(sv.imposto)
    return s + lucro / 2
  }, 0)
  const pj2MinhaParteThisMonth = pj2Servicos
    .filter(sv => {
      const dateStr = sv.data_vencimento || sv.created_at?.split('T')[0]
      if (!dateStr) return false
      try { return isWithinInterval(parseISO(dateStr), { start: monthStart, end: monthEnd }) } catch { return false }
    })
    .reduce((s, sv) => {
      const lucro = Number(sv.valor_fechado) - Number(sv.gastos) - Number(sv.imposto)
      return s + lucro / 2
    }, 0)

  const pj1Name = profile?.pj1_company_name || 'PJ1 — Empresa'
  const companyName = profile?.company_name || 'Sociedade'

  const tabs = [
    { id: 'pf' as const, label: 'PF — Pessoal' },
    ...(isRamon ? [{ id: 'pj1' as const, label: pj1Name }] : []),
    { id: 'sociedade' as const, label: `${companyName} (minha parte)` },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">
            {activeTab === 'pf' ? 'PF — Receitas Pessoais'
              : activeTab === 'pj1' ? pj1Name
              : `${companyName} — Minha Parte`}
          </h1>
          <p className="text-zinc-400 text-sm mt-1">
            {activeTab === 'pf' ? `${profile?.name || 'Você'} • Pessoa Física`
              : activeTab === 'pj1' ? 'Empresa Individual'
              : 'Valores da sociedade atribuídos a você'}
          </p>
        </div>
        {activeTab !== 'sociedade' && (
          <Button onClick={() => activeTab === 'pf' ? setPfModalOpen(true) : setPj1ModalOpen(true)}>
            <Plus size={16} /> Nova Receita
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-zinc-900 border border-zinc-800 rounded-xl p-1 w-fit flex-wrap">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-purple-600 text-white'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ===== PF TAB ===== */}
      {activeTab === 'pf' && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard title="Total Recebido PF" value={formatBRL(pfTotal)} icon={<DollarSign size={20} />} accent />
            <StatCard title="Este Mês" value={formatBRL(pfThisMonth)} icon={<Calendar size={20} />} />
            <StatCard title="Nº de Receitas" value={pfReceitas.length.toString()} icon={<TrendingUp size={20} />} />
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
            <div className="p-5 border-b border-zinc-800">
              <h3 className="text-white font-semibold">Receitas PF ({pfReceitas.length})</h3>
            </div>
            {pfLoading ? (
              <div className="flex items-center justify-center py-16">
                <div className="w-7 h-7 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : pfReceitas.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-zinc-500">Nenhuma receita cadastrada</p>
                <Button className="mt-4" onClick={() => setPfModalOpen(true)}>
                  <Plus size={16} /> Adicionar primeira receita
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-zinc-800">
                      <th className="text-left text-zinc-400 text-xs font-medium px-5 py-3">Descrição</th>
                      <th className="text-right text-zinc-400 text-xs font-medium px-5 py-3">Valor</th>
                      <th className="text-left text-zinc-400 text-xs font-medium px-5 py-3 hidden sm:table-cell">Forma</th>
                      <th className="text-left text-zinc-400 text-xs font-medium px-5 py-3 hidden md:table-cell">Data</th>
                      <th className="px-5 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {pfReceitas.map(r => (
                      <tr key={r.id} className="hover:bg-zinc-800/50 transition-colors">
                        <td className="px-5 py-3"><p className="text-white text-sm font-medium">{r.descricao}</p></td>
                        <td className="px-5 py-3 text-right"><span className="text-green-400 font-semibold text-sm">{formatBRL(Number(r.valor))}</span></td>
                        <td className="px-5 py-3 hidden sm:table-cell"><span className="text-zinc-400 text-sm">{r.forma_pagamento}</span></td>
                        <td className="px-5 py-3 hidden md:table-cell">
                          <span className="text-zinc-400 text-sm">{format(parseISO(r.data), 'dd/MM/yyyy')}</span>
                        </td>
                        <td className="px-5 py-3">
                          <button onClick={() => handleDeletePf(r.id)} className="text-zinc-600 hover:text-red-400 transition-colors">
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* ===== PJ1 TAB ===== */}
      {activeTab === 'pj1' && isRamon && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard title={`Total ${pj1Name}`} value={formatBRL(pj1Total)} icon={<DollarSign size={20} />} accent />
            <StatCard title="Este Mês" value={formatBRL(pj1ThisMonth)} icon={<Calendar size={20} />} />
            <StatCard title="Nº de Receitas" value={pj1Receitas.length.toString()} icon={<TrendingUp size={20} />} />
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
            <div className="p-5 border-b border-zinc-800">
              <h3 className="text-white font-semibold">Receitas {pj1Name} ({pj1Receitas.length})</h3>
            </div>
            {pj1Loading ? (
              <div className="flex items-center justify-center py-16">
                <div className="w-7 h-7 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : pj1Receitas.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-zinc-500">Nenhuma receita cadastrada</p>
                <Button className="mt-4" onClick={() => setPj1ModalOpen(true)}>
                  <Plus size={16} /> Adicionar primeira receita
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-zinc-800">
                      <th className="text-left text-zinc-400 text-xs font-medium px-5 py-3">Descrição</th>
                      <th className="text-right text-zinc-400 text-xs font-medium px-5 py-3">Valor</th>
                      <th className="text-left text-zinc-400 text-xs font-medium px-5 py-3 hidden sm:table-cell">Quem Pagou</th>
                      <th className="text-left text-zinc-400 text-xs font-medium px-5 py-3 hidden md:table-cell">Data</th>
                      <th className="px-5 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {pj1Receitas.map(r => (
                      <tr key={r.id} className="hover:bg-zinc-800/50 transition-colors">
                        <td className="px-5 py-3"><p className="text-white text-sm font-medium">{r.descricao}</p></td>
                        <td className="px-5 py-3 text-right"><span className="text-green-400 font-semibold text-sm">{formatBRL(Number(r.valor))}</span></td>
                        <td className="px-5 py-3 hidden sm:table-cell"><span className="text-zinc-400 text-sm">{r.quem_pagou}</span></td>
                        <td className="px-5 py-3 hidden md:table-cell">
                          <span className="text-zinc-400 text-sm">{format(parseISO(r.data), 'dd/MM/yyyy')}</span>
                        </td>
                        <td className="px-5 py-3">
                          <button onClick={() => handleDeletePj1(r.id)} className="text-zinc-600 hover:text-red-400 transition-colors">
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* ===== SOCIEDADE TAB ===== */}
      {activeTab === 'sociedade' && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard title="Minha Parte Total" value={formatBRL(pj2MinhaParteTotal)} icon={<DollarSign size={20} />} accent />
            <StatCard title="Minha Parte Este Mês" value={formatBRL(pj2MinhaParteThisMonth)} icon={<Calendar size={20} />} />
            <StatCard title="Nº de Serviços" value={pj2Servicos.length.toString()} icon={<TrendingUp size={20} />} />
          </div>

          <div className="bg-zinc-900 border border-amber-500/10 rounded-xl overflow-hidden">
            <div className="p-5 border-b border-zinc-800 flex items-center gap-3">
              <Building2 size={18} className="text-amber-400" />
              <h3 className="text-white font-semibold">Serviços da {companyName} — Sua parte (50%)</h3>
              <span className="ml-auto text-zinc-500 text-xs">Somente leitura • gerado automaticamente</span>
            </div>

            {pj2Loading ? (
              <div className="flex items-center justify-center py-16">
                <div className="w-7 h-7 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : pj2Servicos.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-zinc-500">Nenhum serviço cadastrado na sociedade</p>
                <p className="text-zinc-600 text-xs mt-2">Cadastre serviços na aba PJ2 — Sociedade</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-zinc-800">
                      <th className="text-left text-zinc-400 text-xs font-medium px-5 py-3">Descrição</th>
                      <th className="text-left text-zinc-400 text-xs font-medium px-5 py-3 hidden sm:table-cell">Cliente</th>
                      <th className="text-right text-zinc-400 text-xs font-medium px-5 py-3">Valor Fechado</th>
                      <th className="text-right text-zinc-400 text-xs font-medium px-5 py-3">Sua Parte</th>
                      <th className="text-left text-zinc-400 text-xs font-medium px-5 py-3 hidden md:table-cell">Vencimento</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {pj2Servicos.map(sv => {
                      const lucro = Number(sv.valor_fechado) - Number(sv.gastos) - Number(sv.imposto)
                      const minhaParte = lucro / 2
                      const isOverdue = sv.data_vencimento && parseISO(sv.data_vencimento) < now
                      const isThisMonth = sv.data_vencimento
                        ? (() => { try { return isWithinInterval(parseISO(sv.data_vencimento), { start: monthStart, end: monthEnd }) } catch { return false } })()
                        : false

                      return (
                        <tr key={sv.id} className="hover:bg-zinc-800/50 transition-colors">
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-2">
                              <p className="text-white text-sm font-medium">{sv.descricao}</p>
                              {isOverdue && <span title="Vencido"><AlertCircle size={14} className="text-red-400 flex-shrink-0" /></span>}
                              {isThisMonth && !isOverdue && <span className="text-xs bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded-full">Este mês</span>}
                            </div>
                          </td>
                          <td className="px-5 py-3 hidden sm:table-cell">
                            <span className="text-zinc-400 text-sm">{sv.cliente?.nome || '—'}</span>
                          </td>
                          <td className="px-5 py-3 text-right">
                            <span className="text-zinc-300 text-sm">{formatBRL(Number(sv.valor_fechado))}</span>
                          </td>
                          <td className="px-5 py-3 text-right">
                            <span className={`font-semibold text-sm ${minhaParte >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                              {formatBRL(minhaParte)}
                            </span>
                          </td>
                          <td className="px-5 py-3 hidden md:table-cell">
                            {sv.data_vencimento ? (
                              <span className={`text-sm ${isOverdue ? 'text-red-400' : 'text-zinc-400'}`}>
                                {format(parseISO(sv.data_vencimento), 'dd/MM/yyyy')}
                              </span>
                            ) : (
                              <span className="text-zinc-600 text-sm">—</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* PF Modal */}
      <Modal isOpen={pfModalOpen} onClose={() => { setPfModalOpen(false); setPfError('') }} title="Nova Receita PF">
        <form onSubmit={pfForm.handleSubmit(onPfSubmit)} className="space-y-4">
          {pfError && (
            <div className="bg-red-900/30 border border-red-800 rounded-lg p-3">
              <p className="text-red-400 text-sm">{pfError}</p>
            </div>
          )}
          <Input label="Descrição" placeholder="Ex: Consultoria de marketing" error={pfForm.formState.errors.descricao?.message} {...pfForm.register('descricao', { required: 'Obrigatório' })} />
          <Input label="Valor (R$)" placeholder="Ex: 1500.00" error={pfForm.formState.errors.valor?.message} {...pfForm.register('valor', { required: 'Obrigatório', pattern: { value: /^\d+([.,]\d{0,2})?$/, message: 'Valor inválido' } })} />
          <Select label="Forma de Recebimento" {...pfForm.register('forma_pagamento', { required: 'Obrigatório' })}>
            {FORMAS.map(f => <option key={f} value={f}>{f}</option>)}
          </Select>
          <Input label="Data" type="date" error={pfForm.formState.errors.data?.message} {...pfForm.register('data', { required: 'Obrigatório' })} />
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" className="flex-1" onClick={() => { setPfModalOpen(false); setPfError('') }}>Cancelar</Button>
            <Button type="submit" className="flex-1" loading={pfSubmitting}>Salvar</Button>
          </div>
        </form>
      </Modal>

      {/* PJ1 Modal */}
      <Modal isOpen={pj1ModalOpen} onClose={() => { setPj1ModalOpen(false); setPj1Error('') }} title={`Nova Receita ${pj1Name}`}>
        <form onSubmit={pj1Form.handleSubmit(onPj1Submit)} className="space-y-4">
          {pj1Error && (
            <div className="bg-red-900/30 border border-red-800 rounded-lg p-3">
              <p className="text-red-400 text-sm">{pj1Error}</p>
            </div>
          )}
          <Input label="Descrição" placeholder="Ex: Contrato de assessoria" error={pj1Form.formState.errors.descricao?.message} {...pj1Form.register('descricao', { required: 'Obrigatório' })} />
          <Input label="Valor (R$)" placeholder="Ex: 2000.00" error={pj1Form.formState.errors.valor?.message} {...pj1Form.register('valor', { required: 'Obrigatório', pattern: { value: /^\d+([.,]\d{0,2})?$/, message: 'Valor inválido' } })} />
          <Input label="Quem Pagou" placeholder="Nome do cliente ou pagador" error={pj1Form.formState.errors.quem_pagou?.message} {...pj1Form.register('quem_pagou', { required: 'Obrigatório' })} />
          <Input label="Data" type="date" error={pj1Form.formState.errors.data?.message} {...pj1Form.register('data', { required: 'Obrigatório' })} />
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" className="flex-1" onClick={() => { setPj1ModalOpen(false); setPj1Error('') }}>Cancelar</Button>
            <Button type="submit" className="flex-1" loading={pj1Submitting}>Salvar</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
