import React, { useState, useEffect } from 'react'
import supabase from '../lib/supabase'

export default function Dashboard() {
  const [stats, setStats] = useState({
    totalProducts: 0,
    totalStock: 0,
    totalValue: 0,
    lowStockCount: 0,
    outOfStockCount: 0
  })
  const [recentMovements, setRecentMovements] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchDashboardData() }, [])

  async function fetchDashboardData() {
    try {
      const { data: products, error } = await supabase
        .from('products')
        .select('*, product_variations (*)')
      if (error) throw error

      let totalStock = 0, totalValue = 0, lowStock = 0, outOfStock = 0

      products.forEach(product => {
        let pQty = 0, pVal = 0
        if (product.product_variations?.length > 0) {
          product.product_variations.forEach(v => {
            const q = v.quantity || 0
            pQty += q; pVal += q * (product.price || 0)
            if (q > 0 && q < 10) lowStock++
            if (q === 0) outOfStock++
          })
        } else {
          const q = product.quantity || 0
          pQty = q; pVal = q * (product.price || 0)
          if (q > 0 && q < 10) lowStock++
          if (q === 0) outOfStock++
        }
        totalStock += pQty; totalValue += pVal
      })

      const { data: movements } = await supabase
        .from('inventory_movements')
        .select('*, products (name, code)')
        .order('created_at', { ascending: false })
        .limit(10)

      setStats({ totalProducts: products.length, totalStock, totalValue, lowStockCount: lowStock, outOfStockCount: outOfStock })
      setRecentMovements(movements || [])
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-[#3C78A0] border-t-transparent rounded-full animate-spin"></div>
    </div>
  )

  const cards = [
    { label: 'Total Products', value: stats.totalProducts, sub: 'in catalog', color: 'indigo', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" /> },
    { label: 'Units in Stock', value: stats.totalStock.toLocaleString(), sub: 'total quantity', color: 'emerald', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /> },
    { label: 'Inventory Value', value: `RM ${stats.totalValue.toLocaleString()}`, sub: 'at selling price', color: 'violet', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /> },
    { label: 'Low Stock', value: stats.lowStockCount, sub: 'under 10 units', color: 'amber', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /> },
    { label: 'Out of Stock', value: stats.outOfStockCount, sub: 'needs restocking', color: 'rose', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /> },
  ]

  const colorMap = {
    indigo: { bar: 'bg-[#3C78A0]', icon: 'bg-[#EBF4FA] text-[#3C78A0]', val: 'text-[#2C5F80]' },
    emerald: { bar: 'bg-emerald-500', icon: 'bg-emerald-50 text-emerald-600', val: 'text-emerald-700' },
    violet: { bar: 'bg-violet-500', icon: 'bg-violet-50 text-violet-600', val: 'text-violet-700' },
    amber: { bar: 'bg-amber-500', icon: 'bg-amber-50 text-amber-600', val: 'text-amber-700' },
    rose: { bar: 'bg-rose-500', icon: 'bg-rose-50 text-rose-600', val: 'text-rose-700' },
  }

  return (
    <div className="flex flex-col h-full">
      {/* Page Header */}
      <div className="page-header px-6 py-6 flex-shrink-0">
        <p className="text-[#5A96BE] text-xs font-semibold uppercase tracking-widest mb-1">Overview</p>
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-white/40 text-sm mt-0.5">Real-time inventory snapshot</p>
      </div>

      {/* Content */}
      <div className="flex-1 p-6 overflow-y-auto scrollbar-thin space-y-6">
        {/* Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {cards.map(card => {
            const c = colorMap[card.color]
            return (
              <div key={card.label} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className={`h-1 ${c.bar}`}></div>
                <div className="p-4">
                  <div className={`w-9 h-9 rounded-lg ${c.icon} flex items-center justify-center mb-3`}>
                    <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">{card.icon}</svg>
                  </div>
                  <p className={`text-xl font-bold ${c.val}`}>{card.value}</p>
                  <p className="text-xs font-semibold text-slate-700 mt-0.5">{card.label}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">{card.sub}</p>
                </div>
              </div>
            )
          })}
        </div>

        {/* Recent Movements */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <div>
              <h2 className="text-sm font-bold text-slate-800">Recent Stock Movements</h2>
              <p className="text-xs text-slate-400 mt-0.5">Latest activity across inventory</p>
            </div>
            <span className="text-xs bg-slate-100 text-slate-500 px-2.5 py-1 rounded-full font-medium">{recentMovements.length} records</span>
          </div>
          {recentMovements.length === 0 ? (
            <div className="text-center py-16 px-6">
              <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75z" />
                </svg>
              </div>
              <p className="text-slate-500 text-sm font-medium">No movements yet</p>
              <p className="text-slate-400 text-xs mt-1">Activity will appear here as stock changes</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="text-left py-2.5 px-5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Product</th>
                    <th className="text-left py-2.5 px-4 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Type</th>
                    <th className="text-right py-2.5 px-4 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Qty</th>
                    <th className="text-left py-2.5 px-4 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Reason</th>
                    <th className="text-left py-2.5 px-5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {recentMovements.map((m, i) => (
                    <tr key={m.id} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                      <td className="py-3 px-5 font-medium text-slate-800">
                        {m.products?.name || '-'}
                        {m.products?.code && <span className="text-slate-400 font-normal ml-1.5 text-xs">({m.products.code})</span>}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${m.movement_type === 'in' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${m.movement_type === 'in' ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                          {m.movement_type === 'in' ? 'Stock In' : 'Stock Out'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-slate-700">{m.quantity}</td>
                      <td className="py-3 px-4 text-slate-500 text-xs">{m.reason || '—'}</td>
                      <td className="py-3 px-5 text-slate-400 text-xs">{new Date(m.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
