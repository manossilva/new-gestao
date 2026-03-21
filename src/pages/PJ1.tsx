import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import {
  format, parseISO, startOfMonth, endOfMonth, isWithinInterval,
  subMonths, addMonths,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  Plus, Trash2, ChevronLeft, ChevronRight,
  CheckCircle2, Circle, FileText, FileX, RefreshCw, Zap,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import type { Pj1Receita } from '../lib/types'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import { Input } from '../components/ui/Input'

interface FormData {
  descricao: string
  valor: string
  quem_pagou: string
  data: string
  recorrente: boolean
}

function formatBRL(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

export default function PJ1() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [receitas, setReceitas] = useState<Pj1Receita[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [toggling, setToggling] = useState<string | null>(null)

  // Month navigation
  const [selectedDate, setSelectedDate] = useState(() => new Date())
  const monthStart = startOfMonth(selectedDate)
  const monthEnd = endOfMonth(selectedDate)
  const isCurrentMonth =
    format(selectedDate, 'yyyy-MM') === format(new Date(), 'yyyy-MM')

  const goToPrev = () => setSelectedDate(d => subMonths(d, 1))
  const goToNext = () => { if (!isCurrentMonth) setSelectedDate(d => addMonths(d, 1)) }
  const goToToday = () => setSelectedDate(new Date())

  // Filter view
  const [filter, setFilter] = useState<'todos' | 'recorrentes' | 'unicas'>('todos')

  // Redirect if not Ramon
  useEffect(() => {
    if (profile && profile.role !== 'ramon') {
      navigate('/dashboard', { replace: true })
    }
  }, [profile, navigate])

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    defaultValues: { data: new Date().toISOString().split('T')[0], recorrente: false },
  })

  const fetchReceitas = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('pj1_receitas')
      .select('*')
      .order('data', { ascending: false })
    const normalized = (data || []).map((r: any) => ({
      ...r,
      pago: r.pago ?? false,
      recorrente: r.recorrente ?? false,
      nota_emitida: r.nota_emitida ?? false,
    }))
    setReceitas(normalized as Pj1Receita[])
    setLoading(false)
  }

  useEffect(() => {
    if (profile?.role === 'ramon') fetchReceitas()
  }, [profile])

  const onSubmit = async (data: FormData) => {
    setSubmitting(true)
    const { error } = await supabase.from('pj1_receitas').insert({
      descricao: data.descricao,
      valor: parseFloat(data.valor.replace(',', '.')),
      quem_pagou: data.quem_pagou,
      data: data.data,
      recorrente: data.recorrente,
      pago: false,
      nota_emitida: false,
    })
    if (!error) {
      await fetchReceitas()
      reset({ data: new Date().toISOString().split('T')[0], recorrente: false })
      setIsModalOpen(false)
    }
    setSubmitting(false)
  }

  const togglePago = async (id: string, current: boolean) => {
    setToggling(id + '-pago')
    const { error } = await supabase.from('pj1_receitas').update({ pago: !current }).eq('id', id)
    if (!error) setReceitas(prev => prev.map(r => r.id === id ? { ...r, pago: !current } : r))
    setToggling(null)
  }

  const toggleNota = async (id: string, current: boolean) => {
    setToggling(id + '-nota')
    const { error } = await supabase.from('pj1_receitas').update({ nota_emitida: !current }).eq('id', id)
    if (!error) setReceitas(prev => prev.map(r => r.id === id ? { ...r, nota_emitida: !current } : r))
    setToggling(null)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Deletar esta receita?')) return
    await supabase.from('pj1_receitas').delete().eq('id', id)
    setReceitas(prev => prev.filter(r => r.id !== id))
  }

  // Filtered by month
  const receitasMes = receitas.filter(r => {
    try { return isWithinInterval(parseISO(r.data), { start: monthStart, end: monthEnd }) } catch { return false }
  })

  // Apply type filter
  const receitasVisiveis = receitasMes.filter(r => {
    if (filter === 'recorrentes') return r.recorrente
    if (filter === 'unicas') return !r.recorrente
    return true
  })

  // Stats (from selected month)
  const totalMes = receitasMes.reduce((s, r) => s + Number(r.valor), 0)
  const recebidoMes = receitasMes.filter(r => r.pago).reduce((s, r) => s + Number(r.valor), 0)
  const aReceberMes = receitasMes.filter(r => !r.pago).reduce((s, r) => s + Number(r.valor), 0)
  const recorrentesCount = receitasMes.filter(r => r.recorrente).length
  const notasEmitidas = receitasMes.filter(r => r.nota_emitida).length

  const pj1Name = profile?.pj1_company_name || 'PJ1'

  if (profile?.role !== 'ramon') return null

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">{pj1Name}</h1>
          <p className="text-zinc-500 text-sm mt-0.5">Receitas da empresa — CNPJ</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Month Navigator */}
          <div className="flex items-center gap-1 bg-zinc-900 border border-white/5 rounded-2xl p-1">
            <button
              onClick={goToPrev}
              className="w-8 h-8 flex items-center justify-center rounded-xl text-zinc-400 hover:text-white hover:bg-white/5"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={goToToday}
              className="px-3 py-1.5 text-sm font-medium text-white min-w-[130px] text-center capitalize hover:text-purple-400 transition-colors"
            >
              {format(selectedDate, 'MMMM yyyy', { locale: ptBR })}
            </button>
            <button
              onClick={goToNext}
              disabled={isCurrentMonth}
              className={`w-8 h-8 flex items-center justify-center rounded-xl transition-colors ${
                isCurrentMonth ? 'text-zinc-700 cursor-not-allowed' : 'text-zinc-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <ChevronRight size={16} />
            </button>
          </div>

          <Button onClick={() => setIsModalOpen(true)}>
            <Plus size={16} /> Nova Receita
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-zinc-900 border border-white/5 rounded-2xl p-4 col-span-1">
          <p className="text-zinc-400 text-xs font-medium uppercase tracking-wide mb-2">Faturado</p>
          <p className="text-xl font-bold text-white tabular-nums">{formatBRL(totalMes)}</p>
        </div>
        <div className="bg-zinc-900 border border-white/5 rounded-2xl p-4">
          <p className="text-zinc-400 text-xs font-medium uppercase tracking-wide mb-2">Recebido</p>
          <p className="text-xl font-bold text-green-400 tabular-nums">{formatBRL(recebidoMes)}</p>
        </div>
        <div className="bg-zinc-900 border border-white/5 rounded-2xl p-4">
          <p className="text-zinc-400 text-xs font-medium uppercase tracking-wide mb-2">A Receber</p>
          <p className="text-xl font-bold text-amber-400 tabular-nums">{formatBRL(aReceberMes)}</p>
        </div>
        <div className="bg-zinc-900 border border-white/5 rounded-2xl p-4">
          <p className="text-zinc-400 text-xs font-medium uppercase tracking-wide mb-2">Recorrentes</p>
          <p className="text-xl font-bold text-purple-400 tabular-nums">{recorrentesCount}</p>
          <p className="text-zinc-600 text-xs mt-0.5">de {receitasMes.length} receitas</p>
        </div>
        <div className="bg-zinc-900 border border-white/5 rounded-2xl p-4">
          <p className="text-zinc-400 text-xs font-medium uppercase tracking-wide mb-2">Notas Emitidas</p>
          <p className="text-xl font-bold text-blue-400 tabular-nums">{notasEmitidas}</p>
          <p className="text-zinc-600 text-xs mt-0.5">de {receitasMes.length} receitas</p>
        </div>
      </div>

      {/* Filter pills */}
      <div className="flex gap-1 bg-zinc-900 border border-white/5 rounded-2xl p-1 w-fit">
        {([
          { id: 'todos', label: 'Todas' },
          { id: 'recorrentes', label: 'Recorrentes' },
          { id: 'unicas', label: 'Únicas' },
        ] as const).map(f => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-150 ${
              filter === f.id
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20'
                : 'text-zinc-400 hover:text-zinc-100 hover:bg-white/5'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-zinc-900 border border-white/5 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
          <h3 className="text-white font-semibold text-sm">
            Receitas — {format(selectedDate, 'MMMM yyyy', { locale: ptBR })}
          </h3>
          <span className="text-zinc-500 text-xs">{receitasVisiveis.length} registro{receitasVisiveis.length !== 1 ? 's' : ''}</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : receitasVisiveis.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-zinc-500 text-sm">Nenhuma receita neste mês</p>
            {filter !== 'todos' && (
              <button onClick={() => setFilter('todos')} className="text-purple-400 text-xs mt-2 hover:underline">
                Ver todas
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left text-zinc-500 text-xs font-medium px-5 py-3 uppercase tracking-wide">Descrição</th>
                  <th className="text-right text-zinc-500 text-xs font-medium px-5 py-3 uppercase tracking-wide">Valor</th>
                  <th className="text-left text-zinc-500 text-xs font-medium px-5 py-3 uppercase tracking-wide hidden sm:table-cell">Quem Pagou</th>
                  <th className="text-left text-zinc-500 text-xs font-medium px-5 py-3 uppercase tracking-wide hidden md:table-cell">Data</th>
                  <th className="text-center text-zinc-500 text-xs font-medium px-5 py-3 uppercase tracking-wide">Pago</th>
                  <th className="text-center text-zinc-500 text-xs font-medium px-5 py-3 uppercase tracking-wide hidden lg:table-cell">Nota</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {receitasVisiveis.map(r => {
                  const isPagoToggling = toggling === r.id + '-pago'
                  const isNotaToggling = toggling === r.id + '-nota'
                  return (
                    <tr key={r.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <p className="text-white text-sm font-medium">{r.descricao}</p>
                          {r.recorrente ? (
                            <span className="flex-shrink-0 flex items-center gap-1 text-xs text-purple-400 bg-purple-400/10 px-1.5 py-0.5 rounded-full">
                              <RefreshCw size={9} /> Recorrente
                            </span>
                          ) : (
                            <span className="flex-shrink-0 flex items-center gap-1 text-xs text-zinc-500 bg-zinc-800 px-1.5 py-0.5 rounded-full">
                              <Zap size={9} /> Única
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <span className="text-green-400 font-semibold text-sm tabular-nums">{formatBRL(Number(r.valor))}</span>
                      </td>
                      <td className="px-5 py-3 hidden sm:table-cell">
                        <span className="text-zinc-400 text-sm">{r.quem_pagou}</span>
                      </td>
                      <td className="px-5 py-3 hidden md:table-cell">
                        <span className="text-zinc-400 text-sm">{format(parseISO(r.data), 'dd/MM/yyyy')}</span>
                      </td>

                      {/* Pago toggle */}
                      <td className="px-5 py-3 text-center">
                        <button
                          onClick={() => togglePago(r.id, r.pago)}
                          disabled={isPagoToggling}
                          className={`transition-all duration-150 ${isPagoToggling ? 'opacity-40' : 'hover:scale-110'}`}
                          title={r.pago ? 'Marcar como não pago' : 'Marcar como pago'}
                        >
                          {r.pago ? (
                            <CheckCircle2 size={18} className="text-green-400" />
                          ) : (
                            <Circle size={18} className="text-zinc-600 hover:text-zinc-400" />
                          )}
                        </button>
                      </td>

                      {/* Nota fiscal toggle */}
                      <td className="px-5 py-3 text-center hidden lg:table-cell">
                        <button
                          onClick={() => toggleNota(r.id, r.nota_emitida)}
                          disabled={isNotaToggling}
                          className={`transition-all duration-150 ${isNotaToggling ? 'opacity-40' : 'hover:scale-110'}`}
                          title={r.nota_emitida ? 'Nota emitida — clique para desfazer' : 'Marcar nota como emitida'}
                        >
                          {r.nota_emitida ? (
                            <FileText size={16} className="text-blue-400" />
                          ) : (
                            <FileX size={16} className="text-zinc-600 hover:text-zinc-400" />
                          )}
                        </button>
                      </td>

                      <td className="px-5 py-3">
                        <button
                          onClick={() => handleDelete(r.id)}
                          className="text-zinc-700 hover:text-red-400 transition-colors"
                        >
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

      {/* Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={`Nova Receita — ${pj1Name}`}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input
            label="Descrição"
            placeholder="Ex: Contrato de assessoria"
            error={errors.descricao?.message}
            {...register('descricao', { required: 'Obrigatório' })}
          />
          <Input
            label="Valor (R$)"
            placeholder="0,00"
            error={errors.valor?.message}
            {...register('valor', {
              required: 'Obrigatório',
              pattern: { value: /^\d+([.,]\d{0,2})?$/, message: 'Valor inválido' },
            })}
          />
          <Input
            label="Quem Pagou"
            placeholder="Nome do cliente ou pagador"
            error={errors.quem_pagou?.message}
            {...register('quem_pagou', { required: 'Obrigatório' })}
          />
          <Input
            label="Data"
            type="date"
            error={errors.data?.message}
            {...register('data', { required: 'Obrigatório' })}
          />

          {/* Recorrente toggle */}
          <div className="flex items-center justify-between bg-zinc-800/60 rounded-xl px-4 py-3">
            <div>
              <p className="text-white text-sm font-medium">Receita Recorrente</p>
              <p className="text-zinc-500 text-xs mt-0.5">Marca se esta receita se repete mensalmente</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" {...register('recorrente')} />
              <div className="w-10 h-6 bg-zinc-700 peer-focus:ring-2 peer-focus:ring-purple-500/50 rounded-full peer peer-checked:bg-purple-600 transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-4" />
            </label>
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" className="flex-1" onClick={() => setIsModalOpen(false)}>
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
