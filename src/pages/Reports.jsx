import React, { useState, useEffect } from 'react'
import supabase from '../lib/supabase'
import * as XLSX from 'xlsx'

export default function Reports() {
  const [loading, setLoading] = useState(true)
  const [reportData, setReportData] = useState({
    totalStockValue: 0, totalItems: 0, lowStockItems: [],
    outOfStockItems: [], categorySummary: [], topProducts: [], slowMovingItems: []
  })
  const [reportType, setReportType] = useState('inventory')

  useEffect(() => { fetchReportData() }, [])

  async function fetchReportData() {
    setLoading(true)
    try {
      const { data: products, error } = await supabase.from('products').select('*, product_variations (*)')
      if (error) throw error

      let totalValue = 0, totalQty = 0
      const categoryMap = {}, productStockMap = [], lowStock = [], outOfStock = []

      products.forEach(product => {
        let pQty = 0, pVal = 0
        if (product.product_variations?.length > 0) {
          product.product_variations.forEach(v => {
            const q = v.quantity || 0
            pQty += q; pVal += q * (product.price || 0)
            if (q > 0 && q < 10) lowStock.push({ name: `${product.name} - ${v.variation_value}`, category: product.category, quantity: q, sku: v.sku })
            else if (q === 0) outOfStock.push({ name: `${product.name} - ${v.variation_value}`, category: product.category, sku: v.sku })
          })
        } else {
          const q = product.quantity || 0
          pQty = q; pVal = q * (product.price || 0)
          if (q > 0 && q < 10) lowStock.push({ name: product.name, category: product.category, quantity: q, sku: product.main_sku })
          else if (q === 0) outOfStock.push({ name: product.name, category: product.category, sku: product.main_sku })
        }
        totalQty += pQty; totalValue += pVal
        const cat = product.category || 'Uncategorized'
        if (!categoryMap[cat]) categoryMap[cat] = { quantity: 0, value: 0, count: 0 }
        categoryMap[cat].quantity += pQty; categoryMap[cat].value += pVal; categoryMap[cat].count++
        productStockMap.push({ name: product.name, code: product.code, category: product.category, quantity: pQty, value: pVal, price: product.price })
      })

      setReportData({
        totalStockValue: totalValue, totalItems: totalQty, lowStockItems: lowStock, outOfStockItems: outOfStock,
        categorySummary: Object.entries(categoryMap).map(([name, d]) => ({ name, ...d })),
        topProducts: [...productStockMap].sort((a, b) => b.quantity - a.quantity).slice(0, 10),
        slowMovingItems: [...productStockMap].filter(p => p.quantity > 0 && p.quantity < 20).sort((a, b) => a.quantity - b.quantity).slice(0, 10)
      })
    } catch (error) { alert('Error generating report: ' + error.message) }
    finally { setLoading(false) }
  }

  function exportToExcel() {
    let data = []
    if (reportType === 'inventory') data = reportData.categorySummary.map(c => ({ 'Category': c.name, 'Products': c.count, 'Quantity': c.quantity, 'Value (RM)': c.value.toFixed(2) }))
    else if (reportType === 'lowstock') data = reportData.lowStockItems.map(i => ({ 'Product': i.name, 'Category': i.category, 'Stock': i.quantity, 'SKU': i.sku }))
    else if (reportType === 'top') data = reportData.topProducts.map((p, i) => ({ 'Rank': i + 1, 'Product': p.name, 'Code': p.code, 'Qty': p.quantity, 'Value (RM)': p.value.toFixed(2) }))
    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Report')
    const d = new Date()
    XLSX.writeFile(wb, `${reportType}_report_${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}.xlsx`)
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-[#3C78A0] border-t-transparent rounded-full animate-spin"></div>
    </div>
  )

  const tabs = [
    { id: 'inventory', label: 'By Category', icon: '📦' },
    { id: 'lowstock', label: 'Stock Alerts', icon: '⚠️' },
    { id: 'top', label: 'Top Products', icon: '🏆' },
  ]

  const rankStyle = (i) => i === 0 ? 'bg-amber-100 text-amber-700 font-black' : i === 1 ? 'bg-slate-200 text-slate-600 font-black' : i === 2 ? 'bg-orange-100 text-orange-700 font-black' : 'bg-slate-50 text-slate-400 font-semibold'

  return (
    <div className="flex flex-col h-full">
      {/* Page Header */}
      <div className="page-header px-6 py-6 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[#5A96BE] text-xs font-semibold uppercase tracking-widest mb-1">Insights</p>
            <h1 className="text-2xl font-bold text-white">Reports</h1>
            <p className="text-white/40 text-sm mt-0.5">Stock value, category breakdown & alerts</p>
          </div>
          <button onClick={exportToExcel} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-white text-sm font-medium transition-colors border border-white/10">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
            Export
          </button>
        </div>
      </div>

      <div className="flex-1 p-6 overflow-y-auto scrollbar-thin space-y-5">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Inventory Value', value: `RM ${reportData.totalStockValue.toLocaleString()}`, color: 'emerald', bar: 'bg-emerald-500' },
            { label: 'Total Units', value: reportData.totalItems.toLocaleString(), color: 'indigo', bar: 'bg-[#3C78A0]' },
            { label: 'Low Stock', value: reportData.lowStockItems.length, color: 'amber', bar: 'bg-amber-500' },
            { label: 'Out of Stock', value: reportData.outOfStockItems.length, color: 'rose', bar: 'bg-rose-500' },
          ].map(card => (
            <div key={card.label} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className={`h-1 ${card.bar}`}></div>
              <div className="p-4">
                <p className={`text-xl font-bold ${card.color === 'emerald' ? 'text-emerald-700' : card.color === 'indigo' ? 'text-[#2C5F80]' : card.color === 'amber' ? 'text-amber-700' : 'text-rose-700'}`}>{card.value}</p>
                <p className="text-xs font-semibold text-slate-500 mt-0.5 uppercase tracking-wide">{card.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-1 flex gap-1">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setReportType(t.id)} className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${reportType === t.id ? 'bg-[#0F1A24] text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Inventory by Category */}
        {reportType === 'inventory' && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <h2 className="text-sm font-bold text-slate-800">Inventory by Category</h2>
              <p className="text-xs text-slate-400 mt-0.5">Stock distribution and value breakdown</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="text-left py-2.5 px-5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Category</th>
                    <th className="text-right py-2.5 px-4 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Products</th>
                    <th className="text-right py-2.5 px-4 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Quantity</th>
                    <th className="text-right py-2.5 px-4 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Value (RM)</th>
                    <th className="py-2.5 px-5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Share</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.categorySummary.map((cat, i) => {
                    const pct = reportData.totalStockValue > 0 ? (cat.value / reportData.totalStockValue * 100).toFixed(1) : 0
                    return (
                      <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                        <td className="py-3 px-5 font-semibold text-slate-800">{cat.name}</td>
                        <td className="py-3 px-4 text-right text-slate-500">{cat.count}</td>
                        <td className="py-3 px-4 text-right font-semibold text-slate-700">{cat.quantity.toLocaleString()}</td>
                        <td className="py-3 px-4 text-right font-bold text-slate-800">{cat.value.toLocaleString()}</td>
                        <td className="py-3 px-5">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-slate-100 rounded-full h-1.5">
                              <div className="bg-[#3C78A0] rounded-full h-1.5" style={{ width: `${pct}%` }}></div>
                            </div>
                            <span className="text-xs text-slate-500 w-10 text-right">{pct}%</span>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                  <tr className="bg-slate-50 border-t border-slate-200 font-bold">
                    <td className="py-3 px-5 text-slate-800">Total</td>
                    <td className="py-3 px-4 text-right text-slate-700">{reportData.categorySummary.reduce((a, b) => a + b.count, 0)}</td>
                    <td className="py-3 px-4 text-right text-slate-700">{reportData.totalItems.toLocaleString()}</td>
                    <td className="py-3 px-4 text-right text-slate-800">RM {reportData.totalStockValue.toLocaleString()}</td>
                    <td className="py-3 px-5 text-xs text-slate-400">100%</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Stock Alerts */}
        {reportType === 'lowstock' && (
          <div className="space-y-4">
            {reportData.lowStockItems.length > 0 && (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100">
                  <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center">
                    <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-slate-800">Low Stock — {reportData.lowStockItems.length} items</h2>
                    <p className="text-xs text-slate-400">Fewer than 10 units remaining</p>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="bg-slate-50 border-b border-slate-100">
                      <th className="text-left py-2.5 px-5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Product</th>
                      <th className="text-left py-2.5 px-4 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Category</th>
                      <th className="text-right py-2.5 px-5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Stock Left</th>
                    </tr></thead>
                    <tbody>{reportData.lowStockItems.map((item, i) => (
                      <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                        <td className="py-3 px-5 font-medium text-slate-800">{item.name}</td>
                        <td className="py-3 px-4 text-slate-500">{item.category}</td>
                        <td className="py-3 px-5 text-right"><span className="bg-amber-50 text-amber-700 border border-amber-100 font-bold text-xs px-2.5 py-1 rounded-full">{item.quantity}</span></td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              </div>
            )}
            {reportData.outOfStockItems.length > 0 && (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100">
                  <div className="w-8 h-8 bg-rose-50 rounded-lg flex items-center justify-center">
                    <svg className="w-4 h-4 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-slate-800">Out of Stock — {reportData.outOfStockItems.length} items</h2>
                    <p className="text-xs text-slate-400">Needs immediate restocking</p>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="bg-slate-50 border-b border-slate-100">
                      <th className="text-left py-2.5 px-5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Product</th>
                      <th className="text-left py-2.5 px-5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Category</th>
                    </tr></thead>
                    <tbody>{reportData.outOfStockItems.map((item, i) => (
                      <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                        <td className="py-3 px-5 font-medium text-slate-800">{item.name}</td>
                        <td className="py-3 px-5 text-slate-500">{item.category}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              </div>
            )}
            {reportData.lowStockItems.length === 0 && reportData.outOfStockItems.length === 0 && (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center">
                <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <p className="text-slate-700 font-semibold">All stock levels healthy</p>
                <p className="text-slate-400 text-xs mt-1">No items need attention right now</p>
              </div>
            )}
          </div>
        )}

        {/* Top Products */}
        {reportType === 'top' && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <h2 className="text-sm font-bold text-slate-800">Top 10 Products by Quantity</h2>
              <p className="text-xs text-slate-400 mt-0.5">Most-stocked items right now</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="bg-slate-50 border-b border-slate-100">
                  <th className="text-left py-2.5 px-5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider w-12">#</th>
                  <th className="text-left py-2.5 px-4 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Product</th>
                  <th className="text-left py-2.5 px-4 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Category</th>
                  <th className="text-right py-2.5 px-4 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Qty</th>
                  <th className="text-right py-2.5 px-5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Value (RM)</th>
                </tr></thead>
                <tbody>{reportData.topProducts.map((p, i) => (
                  <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                    <td className="py-3 px-5"><span className={`inline-flex items-center justify-center w-7 h-7 rounded-lg text-xs ${rankStyle(i)}`}>{i + 1}</span></td>
                    <td className="py-3 px-4">
                      <p className="font-semibold text-slate-800">{p.name}</p>
                      {p.code && <p className="text-[10px] font-mono text-[#3C78A0] mt-0.5">{p.code}</p>}
                    </td>
                    <td className="py-3 px-4 text-slate-500">{p.category}</td>
                    <td className="py-3 px-4 text-right font-bold text-slate-700">{p.quantity.toLocaleString()}</td>
                    <td className="py-3 px-5 text-right font-bold text-emerald-700">{p.value.toLocaleString()}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
