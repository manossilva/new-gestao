import { useState, useEffect } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line,
} from 'recharts'
import { DollarSign, TrendingUp, Wallet, ArrowUpRight, Calendar, AlertCircle } from 'lucide-react'
import { format, parseISO, startOfMonth, endOfMonth, isWithinInterval, addDays, isBefore } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { StatCard } from '../components/ui/Card'
import type { PfReceita, Pj1Receita, Pj2Servico, Pj2Cliente } from '../lib/types'

function formatBRL(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

function groupByMonth(items: { data?: string; created_at?: string; valor: number }[]) {
  const map: Record<string, number> = {}
  items.forEach(item => {
    const dateStr = item.data || item.created_at?.split('T')[0] || ''
    if (!dateStr) return
    try {
      const month = format(parseISO(dateStr), 'MMM/yy', { locale: ptBR })
      map[month] = (map[month] || 0) + Number(item.valor)
    } catch {}
  })
  return Object.entries(map).map(([mes, total]) => ({ mes, total })).slice(-6)
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-zinc-800 border border-zinc-700 rounded-lg p-3 text-sm">
        <p className="text-zinc-400 mb-1">{label}</p>
        {payload.map((p: any, i: number) => (
          <p key={i} className="font-semibold" style={{ color: p.color }}>{formatBRL(p.value)}</p>
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
  const [activeTab, setActiveTab] = useState<'pf' | 'pj1' | 'pj2'>('pf')
  const [pfReceitas, setPfReceitas] = useState<PfReceita[]>([])
  const [pj1Receitas, setPj1Receitas] = useState<Pj1Receita[]>([])
  const [pj2Servicos, setPj2Servicos] = useState<ServicoPendente[]>([])
  const [loading, setLoading] = useState(true)

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

  const now = new Date()
  const monthStart = startOfMonth(now)
  const monthEnd = endOfMonth(now)
  const thirtyDaysLater = addDays(now, 30)

  const tabs = [
    { id: 'pf', label: 'PF' },
    ...(profile?.role === 'ramon' ? [{ id: 'pj1', label: profile?.pj1_company_name || 'PJ1' }] : []),
    { id: 'pj2', label: profile?.company_name || 'PJ2 — Sociedade' },
  ] as { id: 'pf' | 'pj1' | 'pj2'; label: string }[]

  // PF stats
  const pfTotal = pfReceitas.reduce((s, r) => s + Number(r.valor), 0)
  const pfThisMonth = pfReceitas
    .filter(r => { try { return isWithinInterval(parseISO(r.data), { start: monthStart, end: monthEnd }) } catch { return false } })
    .reduce((s, r) => s + Number(r.valor), 0)

  // PJ1 stats
  const pj1Total = pj1Receitas.reduce((s, r) => s + Number(r.valor), 0)
  const pj1ThisMonth = pj1Receitas
    .filter(r => { try { return isWithinInterval(parseISO(r.data), { start: monthStart, end: monthEnd }) } catch { return false } })
    .reduce((s, r) => s + Number(r.valor), 0)

  // PJ2 stats
  const pj2ValorFechado = pj2Servicos.reduce((s, sv) => s + Number(sv.valor_fechado), 0)
  const pj2Gastos = pj2Servicos.reduce((s, sv) => s + Number(sv.gastos), 0)
  const pj2Impostos = pj2Servicos.reduce((s, sv) => s + Number(sv.imposto), 0)
  const pj2Lucro = pj2ValorFechado - pj2Gastos - pj2Impostos
  const lucroSocio = pj2Lucro / 2

  const pj2ThisMonth = pj2Servicos
    .filter(s => {
      const dateStr = s.data_vencimento || s.created_at?.split('T')[0]
      if (!dateStr) return false
      try { return isWithinInterval(parseISO(dateStr), { start: monthStart, end: monthEnd }) } catch { return false }
    })
    .reduce((s, sv) => s + (Number(sv.valor_fechado) - Number(sv.gastos) - Number(sv.imposto)), 0)

  // Upcoming payments (next 30 days)
  const upcomingPayments = pj2Servicos.filter(s => {
    if (!s.data_vencimento) return false
    try {
      const due = parseISO(s.data_vencimento)
      return !isBefore(due, now) && isBefore(due, thirtyDaysLater)
    } catch { return false }
  }).sort((a, b) => {
    if (!a.data_vencimento || !b.data_vencimento) return 0
    return parseISO(a.data_vencimento).getTime() - parseISO(b.data_vencimento).getTime()
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-zinc-400 text-sm mt-1">Visão geral financeira • {format(now, "MMMM 'de' yyyy", { locale: ptBR })}</p>
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

      {/* PF Tab */}
      {activeTab === 'pf' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard title="Total Recebido PF" value={formatBRL(pfTotal)} icon={<DollarSign size={20} />} accent />
            <StatCard title="Este Mês" value={formatBRL(pfThisMonth)} icon={<Calendar size={20} />} />
            <StatCard title="Receitas Cadastradas" value={pfReceitas.length.toString()} icon={<TrendingUp size={20} />} />
            <StatCard title="Média por Receita" value={pfReceitas.length > 0 ? formatBRL(pfTotal / pfReceitas.length) : 'R$ 0,00'} icon={<Wallet size={20} />} />
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <h3 className="text-white font-semibold mb-4">Entradas por Mês — PF</h3>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={groupByMonth(pfReceitas.map(r => ({ data: r.data, valor: r.valor })))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis dataKey="mes" stroke="#71717a" tick={{ fontSize: 12 }} />
                <YAxis stroke="#71717a" tick={{ fontSize: 12 }} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} />
                <Tooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="total" stroke="#7c3aed" strokeWidth={2} dot={{ fill: '#7c3aed' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-xl">
            <div className="p-5 border-b border-zinc-800">
              <h3 className="text-white font-semibold">Últimas Receitas PF</h3>
            </div>
            <div className="divide-y divide-zinc-800">
              {pfReceitas.slice(0, 5).map(r => (
                <div key={r.id} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <p className="text-white text-sm font-medium">{r.descricao}</p>
                    <p className="text-zinc-500 text-xs">{r.forma_pagamento} • {format(parseISO(r.data), 'dd/MM/yyyy')}</p>
                  </div>
                  <span className="text-green-400 font-semibold text-sm">{formatBRL(Number(r.valor))}</span>
                </div>
              ))}
              {pfReceitas.length === 0 && (
                <p className="text-zinc-500 text-sm text-center py-8">Nenhuma receita cadastrada</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* PJ1 Tab (Ramon only) */}
      {activeTab === 'pj1' && profile?.role === 'ramon' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard title={`Total ${profile?.pj1_company_name || 'PJ1'}`} value={formatBRL(pj1Total)} icon={<DollarSign size={20} />} accent />
            <StatCard title="Este Mês" value={formatBRL(pj1ThisMonth)} icon={<Calendar size={20} />} />
            <StatCard title="Receitas Cadastradas" value={pj1Receitas.length.toString()} icon={<TrendingUp size={20} />} />
            <StatCard title="Média por Receita" value={pj1Receitas.length > 0 ? formatBRL(pj1Total / pj1Receitas.length) : 'R$ 0,00'} icon={<Wallet size={20} />} />
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <h3 className="text-white font-semibold mb-4">Entradas por Mês — {profile?.pj1_company_name || 'PJ1'}</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={groupByMonth(pj1Receitas.map(r => ({ data: r.data, valor: r.valor })))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis dataKey="mes" stroke="#71717a" tick={{ fontSize: 12 }} />
                <YAxis stroke="#71717a" tick={{ fontSize: 12 }} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="total" fill="#7c3aed" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-xl">
            <div className="p-5 border-b border-zinc-800">
              <h3 className="text-white font-semibold">Últimas Receitas {profile?.pj1_company_name || 'PJ1'}</h3>
            </div>
            <div className="divide-y divide-zinc-800">
              {pj1Receitas.slice(0, 5).map(r => (
                <div key={r.id} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <p className="text-white text-sm font-medium">{r.descricao}</p>
                    <p className="text-zinc-500 text-xs">Pago por: {r.quem_pagou} • {format(parseISO(r.data), 'dd/MM/yyyy')}</p>
                  </div>
                  <span className="text-green-400 font-semibold text-sm">{formatBRL(Number(r.valor))}</span>
                </div>
              ))}
              {pj1Receitas.length === 0 && (
                <p className="text-zinc-500 text-sm text-center py-8">Nenhuma receita cadastrada</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* PJ2 Tab */}
      {activeTab === 'pj2' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard title="Valor Fechado Total" value={formatBRL(pj2ValorFechado)} icon={<Wallet size={20} />} />
            <StatCard title="Total Gastos + Impostos" value={formatBRL(pj2Gastos + pj2Impostos)} icon={<ArrowUpRight size={20} />} />
            <StatCard title="Lucro Total da Empresa" value={formatBRL(pj2Lucro)} icon={<TrendingUp size={20} />} accent />
            <StatCard title="Lucro Este Mês" value={formatBRL(pj2ThisMonth)} icon={<Calendar size={20} />} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <StatCard title="Lucro Ramon" value={formatBRL(lucroSocio)} icon={<DollarSign size={20} />} accent />
            <StatCard title="Lucro Mano" value={formatBRL(lucroSocio)} icon={<DollarSign size={20} />} accent />
          </div>

          {/* Upcoming payments */}
          {upcomingPayments.length > 0 && (
            <div className="bg-zinc-900 border border-amber-500/20 rounded-xl">
              <div className="p-5 border-b border-zinc-800 flex items-center gap-2">
                <AlertCircle size={18} className="text-amber-400" />
                <h3 className="text-white font-semibold">Próximos Vencimentos (30 dias)</h3>
                <span className="ml-auto text-amber-400 text-sm font-medium">{upcomingPayments.length} cliente{upcomingPayments.length > 1 ? 's' : ''}</span>
              </div>
              <div className="divide-y divide-zinc-800">
                {upcomingPayments.map(s => {
                  const daysUntil = s.data_vencimento
                    ? Math.ceil((parseISO(s.data_vencimento).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
                    : 0
                  return (
                    <div key={s.id} className="flex items-center justify-between px-5 py-3 gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-medium truncate">{s.descricao}</p>
                        <p className="text-zinc-500 text-xs">{(s as any).cliente?.nome || 'Cliente não informado'}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-green-400 font-semibold text-sm">{formatBRL(Number(s.valor_fechado))}</p>
                        <p className={`text-xs ${daysUntil <= 7 ? 'text-red-400' : 'text-amber-400'}`}>
                          {daysUntil === 0 ? 'Hoje' : daysUntil === 1 ? 'Amanhã' : `${daysUntil} dias`}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <h3 className="text-white font-semibold mb-4">Lucro por Mês — Sociedade</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={groupByMonth(pj2Servicos.map(s => ({
                data: s.data_vencimento || s.created_at?.split('T')[0],
                valor: Number(s.valor_fechado) - Number(s.gastos) - Number(s.imposto),
              })))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis dataKey="mes" stroke="#71717a" tick={{ fontSize: 12 }} />
                <YAxis stroke="#71717a" tick={{ fontSize: 12 }} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="total" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  )
}
