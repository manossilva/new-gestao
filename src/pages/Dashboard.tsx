import { useState, useEffect, useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend,
} from 'recharts'
import {
  DollarSign, TrendingUp, Wallet, ArrowUpRight, Calendar, AlertCircle,
  ChevronLeft, ChevronRight, CheckCircle2, Clock, Receipt, TrendingDown,
  CreditCard,
} from 'lucide-react'
import {
  format, parseISO, startOfMonth, endOfMonth, isWithinInterval,
  addMonths, subMonths, addDays, isBefore,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { StatCard } from '../components/ui/Card'
import type { PfReceita, Pj1Receita, Pj2Servico, Pj2Cliente } from '../lib/types'

function formatBRL(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

function filterByDate(
  items: Array<{ data?: string; data_vencimento?: string | null; created_at?: string }>,
  start: Date,
  end: Date,
  field: 'data' | 'data_vencimento' = 'data',
) {
  return items.filter(item => {
    const dateStr =
      field === 'data_vencimento'
        ? (item.data_vencimento || item.created_at?.split('T')[0])
        : (item.data || item.created_at?.split('T')[0])
    if (!dateStr) return false
    try {
      return isWithinInterval(parseISO(dateStr), { start, end })
    } catch {
      return false
    }
  })
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-zinc-900 border border-white/10 rounded-xl p-3 text-sm shadow-xl">
        <p className="text-zinc-400 mb-2 text-xs font-medium uppercase tracking-wide">{label}</p>
        {payload.map((p: any, i: number) => (
          <p key={i} className="font-semibold tabular-nums" style={{ color: p.color }}>
            {p.name}: {formatBRL(p.value)}
          </p>
        ))}
      </div>
    )
  }
  return null
}

interface ServicoPendente extends Pj2Servico {
  cliente?: Pj2Cliente
}

export default function Dashboard() {
  const { profile } = useAuth()
  const [activeTab, setActiveTab] = useState<'pf' | 'pj1' | 'empresa'>('pf')
  const [pfReceitas, setPfReceitas] = useState<PfReceita[]>([])
  const [pj1Receitas, setPj1Receitas] = useState<Pj1Receita[]>([])
  const [pj2Servicos, setPj2Servicos] = useState<ServicoPendente[]>([])
  const [loading, setLoading] = useState(true)

  // Month navigation
  const [selectedDate, setSelectedDate] = useState(() => new Date())
  const monthStart = startOfMonth(selectedDate)
  const monthEnd = endOfMonth(selectedDate)
  const isCurrentMonth =
    format(selectedDate, 'yyyy-MM') === format(new Date(), 'yyyy-MM')
  const isFutureMonth = selectedDate > endOfMonth(new Date())

  const goToPrev = () => setSelectedDate(d => subMonths(d, 1))
  const goToNext = () => { if (!isCurrentMonth) setSelectedDate(d => addMonths(d, 1)) }
  const goToToday = () => setSelectedDate(new Date())

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true)
      const [pfRes, pj2Res] = await Promise.all([
        supabase.from('pf_receitas').select('*').order('data', { ascending: false }),
        supabase.from('pj2_servicos').select('*, pj2_clientes(*)').order('created_at', { ascending: false }),
      ])
      setPfReceitas((pfRes.data as PfReceita[]) || [])
      const servicos = (pj2Res.data || []).map((s: any) => ({
        ...s,
        pago: s.pago ?? false,
        impostos_pagos: s.impostos_pagos ?? false,
        forma_pagamento: s.forma_pagamento ?? null,
        cliente: s.pj2_clientes,
      }))
      setPj2Servicos(servicos)

      if (profile?.role === 'ramon') {
        const pj1Res = await supabase.from('pj1_receitas').select('*').order('data', { ascending: false })
        setPj1Receitas((pj1Res.data as Pj1Receita[]) || [])
      }
      setLoading(false)
    }
    if (profile) fetchAll()
  }, [profile])

  // ── PF ─────────────────────────────────────────────────────────────────────
  const pfFiltered = filterByDate(pfReceitas, monthStart, monthEnd) as PfReceita[]
  const pfFaturamento = pfFiltered.reduce((s, r) => s + Number(r.valor), 0)

  // ── PJ1 ────────────────────────────────────────────────────────────────────
  const pj1Filtered = filterByDate(pj1Receitas, monthStart, monthEnd) as Pj1Receita[]
  const pj1Faturamento = pj1Filtered.reduce((s, r) => s + Number(r.valor), 0)

  // ── PJ2 ────────────────────────────────────────────────────────────────────
  const pj2Filtered = filterByDate(pj2Servicos, monthStart, monthEnd, 'data_vencimento') as ServicoPendente[]
  const pj2Faturamento = pj2Filtered.reduce((s, sv) => s + Number(sv.valor_fechado), 0)
  const pj2Despesas = pj2Filtered.reduce((s, sv) => s + Number(sv.gastos), 0)
  const pj2Impostos = pj2Filtered.reduce((s, sv) => s + Number(sv.imposto), 0)
  const pj2DespeJustMaisImp = pj2Despesas + pj2Impostos
  const pj2Lucro = pj2Faturamento - pj2DespeJustMaisImp
  const pj2Recebido = pj2Filtered.filter(s => s.pago).reduce((s, sv) => s + Number(sv.valor_fechado), 0)
  const pj2AReceber = pj2Filtered.filter(s => !s.pago).reduce((s, sv) => s + Number(sv.valor_fechado), 0)
  const pj2ImpostosPagos = pj2Filtered.filter(s => s.impostos_pagos).reduce((s, sv) => s + Number(sv.imposto), 0)
  const pj2ImpostosAPagar = pj2Impostos - pj2ImpostosPagos

  // ── Chart data: last 6 months ──────────────────────────────────────────────
  const chartData = useMemo(() => {
    return Array.from({ length: 6 }, (_, i) => {
      const d = subMonths(new Date(), 5 - i)
      const start = startOfMonth(d)
      const end = endOfMonth(d)
      const label = format(d, 'MMM', { locale: ptBR })

      const pfMonth = (filterByDate(pfReceitas, start, end) as PfReceita[])
        .reduce((s, r) => s + Number(r.valor), 0)
      const pj1Month = (filterByDate(pj1Receitas, start, end) as Pj1Receita[])
        .reduce((s, r) => s + Number(r.valor), 0)
      const pj2Month = filterByDate(pj2Servicos, start, end, 'data_vencimento') as ServicoPendente[]
      const pj2Fat = pj2Month.reduce((s, sv) => s + Number(sv.valor_fechado), 0)
      const pj2Lucr = pj2Month.reduce((s, sv) => s + Number(sv.valor_fechado) - Number(sv.gastos) - Number(sv.imposto), 0)
      const pj2Desp = pj2Month.reduce((s, sv) => s + Number(sv.gastos), 0)
      const pj2Imp = pj2Month.reduce((s, sv) => s + Number(sv.imposto), 0)

      return { mes: label, pf: pfMonth, pj1: pj1Month, faturamento: pj2Fat, lucro: pj2Lucr, despesas: pj2Desp, impostos: pj2Imp }
    })
  }, [pfReceitas, pj1Receitas, pj2Servicos])

  // ── Upcoming payments (next 30 days, PJ2 unpaid) ──────────────────────────
  const now = new Date()
  const thirtyDaysLater = addDays(now, 30)
  const upcomingPayments = pj2Servicos.filter(s => {
    if (!s.data_vencimento || s.pago) return false
    try {
      const due = parseISO(s.data_vencimento)
      return !isBefore(due, now) && isBefore(due, thirtyDaysLater)
    } catch { return false }
  }).sort((a, b) => {
    if (!a.data_vencimento || !b.data_vencimento) return 0
    return parseISO(a.data_vencimento).getTime() - parseISO(b.data_vencimento).getTime()
  })

  const tabs = [
    { id: 'pf' as const, label: 'PF — CPF' },
    ...(profile?.role === 'ramon' ? [{ id: 'pj1' as const, label: `${profile?.pj1_company_name || 'PJ1'} — CNPJ` }] : []),
    { id: 'empresa' as const, label: profile?.company_name || 'Empresa' },
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Dashboard</h1>
          <p className="text-zinc-500 text-sm mt-0.5">Demonstrativo financeiro mensal</p>
        </div>

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
            className="px-3 py-1.5 text-sm font-medium text-white min-w-[140px] text-center capitalize hover:text-purple-400 transition-colors"
          >
            {format(selectedDate, 'MMMM yyyy', { locale: ptBR })}
          </button>
          <button
            onClick={goToNext}
            disabled={isCurrentMonth}
            className={`w-8 h-8 flex items-center justify-center rounded-xl transition-colors ${
              isCurrentMonth
                ? 'text-zinc-700 cursor-not-allowed'
                : 'text-zinc-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Entity Tabs */}
      <div className="flex gap-1 bg-zinc-900 border border-white/5 rounded-2xl p-1 w-fit flex-wrap">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-150 ${
              activeTab === tab.id
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20'
                : 'text-zinc-400 hover:text-zinc-100 hover:bg-white/5'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── PF TAB ───────────────────────────────────────────────────────────── */}
      {activeTab === 'pf' && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard
              title="Faturamento do Mês"
              value={formatBRL(pfFaturamento)}
              icon={<DollarSign size={16} />}
              color="purple"
            />
            <StatCard
              title="Receitas no Mês"
              value={pfFiltered.length.toString()}
              icon={<Receipt size={16} />}
              color="blue"
            />
            <StatCard
              title="Média por Receita"
              value={pfFiltered.length > 0 ? formatBRL(pfFaturamento / pfFiltered.length) : 'R$ 0,00'}
              icon={<TrendingUp size={16} />}
              color="green"
            />
          </div>

          {/* Chart */}
          <div className="bg-zinc-900 border border-white/5 rounded-2xl p-5">
            <h3 className="text-white font-semibold mb-1 text-sm">Faturamento PF — últimos 6 meses</h3>
            <p className="text-zinc-500 text-xs mb-5">Entradas registradas no CPF</p>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="mes" stroke="#52525b" tick={{ fontSize: 11, fill: '#71717a' }} />
                <YAxis stroke="#52525b" tick={{ fontSize: 11, fill: '#71717a' }} tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`} />
                <Tooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="pf" name="PF" stroke="#a855f7" strokeWidth={2} dot={{ fill: '#a855f7', r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Transaction list */}
          <div className="bg-zinc-900 border border-white/5 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
              <h3 className="text-white font-semibold text-sm">Receitas de {format(selectedDate, 'MMMM', { locale: ptBR })}</h3>
              <span className="text-zinc-500 text-xs">{pfFiltered.length} registro{pfFiltered.length !== 1 ? 's' : ''}</span>
            </div>
            <div className="divide-y divide-white/5">
              {pfFiltered.length === 0 ? (
                <p className="text-zinc-500 text-sm text-center py-10">Nenhuma receita neste mês</p>
              ) : (
                pfFiltered.map(r => (
                  <div key={r.id} className="flex items-center justify-between px-5 py-3 hover:bg-white/[0.02]">
                    <div>
                      <p className="text-white text-sm font-medium">{r.descricao}</p>
                      <p className="text-zinc-500 text-xs mt-0.5">
                        {r.forma_pagamento} · {format(parseISO(r.data), 'dd/MM/yyyy')}
                      </p>
                    </div>
                    <span className="text-green-400 font-semibold text-sm tabular-nums">{formatBRL(Number(r.valor))}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── PJ1 TAB (Ramon only) ─────────────────────────────────────────────── */}
      {activeTab === 'pj1' && profile?.role === 'ramon' && (
        <div className="space-y-5">
          {/* CPF vs CNPJ comparison */}
          <div className="bg-zinc-900 border border-white/5 rounded-2xl p-5">
            <h3 className="text-white font-semibold text-sm mb-1">CPF vs CNPJ — {format(selectedDate, 'MMMM yyyy', { locale: ptBR })}</h3>
            <p className="text-zinc-500 text-xs mb-5">Movimentação total entre suas entidades</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-zinc-800/50 rounded-xl p-4">
                <p className="text-zinc-400 text-xs font-medium uppercase tracking-wide mb-2">PF — CPF</p>
                <p className="text-2xl font-bold text-purple-400 tabular-nums">{formatBRL(pfFaturamento)}</p>
                <p className="text-zinc-500 text-xs mt-1">{pfFiltered.length} receita{pfFiltered.length !== 1 ? 's' : ''}</p>
              </div>
              <div className="bg-zinc-800/50 rounded-xl p-4">
                <p className="text-zinc-400 text-xs font-medium uppercase tracking-wide mb-2">{profile?.pj1_company_name || 'PJ1'} — CNPJ</p>
                <p className="text-2xl font-bold text-amber-400 tabular-nums">{formatBRL(pj1Faturamento)}</p>
                <p className="text-zinc-500 text-xs mt-1">{pj1Filtered.length} receita{pj1Filtered.length !== 1 ? 's' : ''}</p>
              </div>
              <div className="bg-purple-600/10 border border-purple-500/20 rounded-xl p-4">
                <p className="text-zinc-400 text-xs font-medium uppercase tracking-wide mb-2">Total Movimentado</p>
                <p className="text-2xl font-bold text-white tabular-nums">{formatBRL(pfFaturamento + pj1Faturamento)}</p>
                <p className="text-zinc-500 text-xs mt-1">CPF + CNPJ</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <StatCard
              title={`${profile?.pj1_company_name || 'PJ1'} — CNPJ`}
              value={formatBRL(pj1Faturamento)}
              icon={<DollarSign size={16} />}
              color="amber"
            />
            <StatCard
              title="Média por Receita CNPJ"
              value={pj1Filtered.length > 0 ? formatBRL(pj1Faturamento / pj1Filtered.length) : 'R$ 0,00'}
              icon={<TrendingUp size={16} />}
              color="purple"
            />
          </div>

          {/* CPF vs CNPJ Chart */}
          <div className="bg-zinc-900 border border-white/5 rounded-2xl p-5">
            <h3 className="text-white font-semibold text-sm mb-1">CPF vs CNPJ — últimos 6 meses</h3>
            <p className="text-zinc-500 text-xs mb-5">Comparativo mensal de entradas</p>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="mes" stroke="#52525b" tick={{ fontSize: 11, fill: '#71717a' }} />
                <YAxis stroke="#52525b" tick={{ fontSize: 11, fill: '#71717a' }} tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12, color: '#71717a' }} />
                <Bar dataKey="pf" name="CPF (PF)" fill="#a855f7" radius={[4, 4, 0, 0]} maxBarSize={32} />
                <Bar dataKey="pj1" name={`CNPJ (${profile?.pj1_company_name || 'PJ1'})`} fill="#f59e0b" radius={[4, 4, 0, 0]} maxBarSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* PJ1 transaction list */}
          <div className="bg-zinc-900 border border-white/5 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
              <h3 className="text-white font-semibold text-sm">Receitas CNPJ — {format(selectedDate, 'MMMM', { locale: ptBR })}</h3>
              <span className="text-zinc-500 text-xs">{pj1Filtered.length} registro{pj1Filtered.length !== 1 ? 's' : ''}</span>
            </div>
            <div className="divide-y divide-white/5">
              {pj1Filtered.length === 0 ? (
                <p className="text-zinc-500 text-sm text-center py-10">Nenhuma receita neste mês</p>
              ) : (
                pj1Filtered.map(r => (
                  <div key={r.id} className="flex items-center justify-between px-5 py-3 hover:bg-white/[0.02]">
                    <div>
                      <p className="text-white text-sm font-medium">{r.descricao}</p>
                      <p className="text-zinc-500 text-xs mt-0.5">
                        {r.quem_pagou} · {format(parseISO(r.data), 'dd/MM/yyyy')}
                      </p>
                    </div>
                    <span className="text-green-400 font-semibold text-sm tabular-nums">{formatBRL(Number(r.valor))}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── EMPRESA TAB (PJ2) ─────────────────────────────────────────────────── */}
      {activeTab === 'empresa' && (
        <div className="space-y-5">
          {/* Financial Breakdown Cards */}
          <div>
            <p className="text-zinc-500 text-xs font-medium uppercase tracking-wider mb-3">Demonstrativo — {format(selectedDate, 'MMMM yyyy', { locale: ptBR })}</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              <StatCard
                title="Faturamento"
                value={formatBRL(pj2Faturamento)}
                icon={<DollarSign size={14} />}
                color="blue"
              />
              <StatCard
                title="Despesas"
                value={formatBRL(pj2Despesas)}
                icon={<TrendingDown size={14} />}
                color="red"
              />
              <StatCard
                title="Impostos"
                value={formatBRL(pj2Impostos)}
                icon={<Receipt size={14} />}
                color="amber"
              />
              <StatCard
                title="Desp + Impostos"
                value={formatBRL(pj2DespeJustMaisImp)}
                icon={<ArrowUpRight size={14} />}
                color="red"
              />
              <StatCard
                title="Lucro da Empresa"
                value={formatBRL(pj2Lucro)}
                icon={<TrendingUp size={14} />}
                color={pj2Lucro >= 0 ? 'green' : 'red'}
              />
            </div>
          </div>

          {/* Partner split */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <StatCard
              title="Lucro Ramon (50%)"
              value={formatBRL(pj2Lucro / 2)}
              icon={<Wallet size={14} />}
              color="purple"
            />
            <StatCard
              title="Lucro Mano (50%)"
              value={formatBRL(pj2Lucro / 2)}
              icon={<Wallet size={14} />}
              color="purple"
            />
          </div>

          {/* Payment Status */}
          <div>
            <p className="text-zinc-500 text-xs font-medium uppercase tracking-wider mb-3">Status de Pagamentos</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="bg-zinc-900 border border-white/5 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle2 size={14} className="text-green-400" />
                  <span className="text-zinc-400 text-xs font-medium uppercase tracking-wide">Recebido</span>
                </div>
                <p className="text-xl font-bold text-green-400 tabular-nums">{formatBRL(pj2Recebido)}</p>
                <p className="text-zinc-500 text-xs mt-1">
                  {pj2Filtered.filter(s => s.pago).length} de {pj2Filtered.length} serviços
                </p>
              </div>
              <div className="bg-zinc-900 border border-white/5 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Clock size={14} className="text-amber-400" />
                  <span className="text-zinc-400 text-xs font-medium uppercase tracking-wide">A Receber</span>
                </div>
                <p className="text-xl font-bold text-amber-400 tabular-nums">{formatBRL(pj2AReceber)}</p>
                <p className="text-zinc-500 text-xs mt-1">
                  {pj2Filtered.filter(s => !s.pago).length} serviços pendentes
                </p>
              </div>
              <div className="bg-zinc-900 border border-white/5 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle2 size={14} className="text-blue-400" />
                  <span className="text-zinc-400 text-xs font-medium uppercase tracking-wide">Impostos Pagos</span>
                </div>
                <p className="text-xl font-bold text-blue-400 tabular-nums">{formatBRL(pj2ImpostosPagos)}</p>
                <p className="text-zinc-500 text-xs mt-1">
                  {pj2Filtered.filter(s => s.impostos_pagos).length} recolhidos
                </p>
              </div>
              <div className="bg-zinc-900 border border-white/5 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <AlertCircle size={14} className="text-orange-400" />
                  <span className="text-zinc-400 text-xs font-medium uppercase tracking-wide">Impostos a Pagar</span>
                </div>
                <p className="text-xl font-bold text-orange-400 tabular-nums">{formatBRL(pj2ImpostosAPagar)}</p>
                <p className="text-zinc-500 text-xs mt-1">
                  {pj2Filtered.filter(s => !s.impostos_pagos && Number(s.imposto) > 0).length} pendentes
                </p>
              </div>
            </div>
          </div>

          {/* Chart */}
          <div className="bg-zinc-900 border border-white/5 rounded-2xl p-5">
            <h3 className="text-white font-semibold text-sm mb-1">Faturamento vs Lucro — últimos 6 meses</h3>
            <p className="text-zinc-500 text-xs mb-5">Visão geral da empresa</p>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="mes" stroke="#52525b" tick={{ fontSize: 11, fill: '#71717a' }} />
                <YAxis stroke="#52525b" tick={{ fontSize: 11, fill: '#71717a' }} tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12, color: '#71717a' }} />
                <Bar dataKey="faturamento" name="Faturamento" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={28} />
                <Bar dataKey="despesas" name="Despesas" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={28} />
                <Bar dataKey="impostos" name="Impostos" fill="#f59e0b" radius={[4, 4, 0, 0]} maxBarSize={28} />
                <Bar dataKey="lucro" name="Lucro" fill="#22c55e" radius={[4, 4, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Upcoming payments alert */}
          {upcomingPayments.length > 0 && (
            <div className="bg-zinc-900 border border-amber-500/15 rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-white/5 flex items-center gap-2">
                <AlertCircle size={15} className="text-amber-400" />
                <h3 className="text-white font-semibold text-sm">Próximos Vencimentos</h3>
                <span className="ml-auto bg-amber-500/10 text-amber-400 text-xs font-medium px-2 py-0.5 rounded-full">
                  {upcomingPayments.length} em 30 dias
                </span>
              </div>
              <div className="divide-y divide-white/5">
                {upcomingPayments.map(s => {
                  const daysUntil = s.data_vencimento
                    ? Math.ceil((parseISO(s.data_vencimento).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
                    : 0
                  return (
                    <div key={s.id} className="flex items-center justify-between px-5 py-3 gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-medium truncate">{s.descricao}</p>
                        <p className="text-zinc-500 text-xs mt-0.5">{s.cliente?.nome || 'Cliente não informado'}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-zinc-200 font-semibold text-sm tabular-nums">{formatBRL(Number(s.valor_fechado))}</p>
                        <p className={`text-xs mt-0.5 ${daysUntil <= 3 ? 'text-red-400' : daysUntil <= 7 ? 'text-orange-400' : 'text-amber-400'}`}>
                          {daysUntil === 0 ? 'Hoje' : daysUntil === 1 ? 'Amanhã' : `em ${daysUntil} dias`}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Services list for selected month */}
          <div className="bg-zinc-900 border border-white/5 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
              <h3 className="text-white font-semibold text-sm">Serviços de {format(selectedDate, 'MMMM', { locale: ptBR })}</h3>
              <span className="text-zinc-500 text-xs">{pj2Filtered.length} serviço{pj2Filtered.length !== 1 ? 's' : ''}</span>
            </div>
            <div className="divide-y divide-white/5">
              {pj2Filtered.length === 0 ? (
                <p className="text-zinc-500 text-sm text-center py-10">Nenhum serviço neste mês</p>
              ) : (
                pj2Filtered.map(s => {
                  const lucro = Number(s.valor_fechado) - Number(s.gastos) - Number(s.imposto)
                  return (
                    <div key={s.id} className="flex items-center justify-between px-5 py-3 hover:bg-white/[0.02] gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-white text-sm font-medium truncate">{s.descricao}</p>
                          {s.pago ? (
                            <span className="flex-shrink-0 flex items-center gap-1 text-xs text-green-400 bg-green-400/10 px-1.5 py-0.5 rounded-full">
                              <CheckCircle2 size={10} /> Pago
                            </span>
                          ) : (
                            <span className="flex-shrink-0 flex items-center gap-1 text-xs text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded-full">
                              <Clock size={10} /> Pendente
                            </span>
                          )}
                        </div>
                        <p className="text-zinc-500 text-xs mt-0.5">
                          {s.cliente?.nome || '—'}
                          {s.forma_pagamento ? ` · ${s.forma_pagamento}` : ''}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-zinc-200 text-sm font-medium tabular-nums">{formatBRL(Number(s.valor_fechado))}</p>
                        <p className={`text-xs mt-0.5 tabular-nums ${lucro >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          Lucro: {formatBRL(lucro)}
                        </p>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
