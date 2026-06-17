import React, { useState, useEffect } from 'react'
import supabase from '../lib/supabase'
import * as XLSX from 'xlsx'

export default function MultiChannel() {
  const [products, setProducts] = useState([])
  const [filteredProducts, setFilteredProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [categories, setCategories] = useState(['All'])

  useEffect(() => { fetchProducts(); fetchCategories() }, [])
  useEffect(() => { applyFilters() }, [products, searchTerm, selectedCategory])

  async function fetchProducts() {
    try {
      setLoading(true)
      const { data, error } = await supabase.from('products').select('*, product_variations (*)').order('created_at', { ascending: false })
      if (error) throw error
      setProducts(data || []); setFilteredProducts(data || [])
    } catch (error) { console.error(error) }
    finally { setLoading(false) }
  }

  async function fetchCategories() {
    try {
      const { data, error } = await supabase.from('products').select('category').not('category', 'is', null)
      if (error) throw error
      if (data) setCategories(['All', ...new Set(data.map(p => p.category))])
    } catch (error) { console.error(error) }
  }

  function applyFilters() {
    let f = [...products]
    if (searchTerm) f = f.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()))
    if (selectedCategory !== 'All') f = f.filter(p => p.category === selectedCategory)
    setFilteredProducts(f)
  }

  function getChannelStock(product, channel) {
    if (product.product_variations?.length > 0) return product.product_variations.reduce((s, v) => s + (v[`stock_${channel}`] || 0), 0)
    return product[`stock_${channel}`] || 0
  }

  function getTotalStock(product) {
    if (product.product_variations?.length > 0) return product.product_variations.reduce((s, v) => s + (v.quantity || 0), 0)
    return product.quantity || 0
  }

  function exportToExcel() {
    const data = filteredProducts.map(p => ({
      'Code': p.code, 'Product': p.name, 'Category': p.category,
      'U4B': getChannelStock(p, 'u4b'), '1World': getChannelStock(p, '1world'),
      'Zalora': getChannelStock(p, 'zalora'), 'Website': getChannelStock(p, 'website'),
      'Total': getTotalStock(p)
    }))
    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Multi_Channel')
    const d = new Date()
    XLSX.writeFile(wb, `multi_channel_${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}.xlsx`)
  }

  const channelTotals = {
    u4b: products.reduce((s, p) => s + getChannelStock(p, 'u4b'), 0),
    '1world': products.reduce((s, p) => s + getChannelStock(p, '1world'), 0),
    zalora: products.reduce((s, p) => s + getChannelStock(p, 'zalora'), 0),
    website: products.reduce((s, p) => s + getChannelStock(p, 'website'), 0),
  }

  const channels = [
    { key: 'u4b', label: 'U4B Label', color: 'text-violet-700', bar: 'bg-violet-500', card: 'bg-violet-50 border-violet-100' },
    { key: '1world', label: '1World', color: 'text-blue-700', bar: 'bg-blue-500', card: 'bg-blue-50 border-blue-100' },
    { key: 'zalora', label: 'Zalora', color: 'text-pink-700', bar: 'bg-pink-500', card: 'bg-pink-50 border-pink-100' },
    { key: 'website', label: 'Website', color: 'text-emerald-700', bar: 'bg-emerald-500', card: 'bg-emerald-50 border-emerald-100' },
  ]

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
    </div>
  )

  return (
    <div className="flex flex-col h-full">
      {/* Page Header */}
      <div className="page-header px-6 py-6 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-indigo-400 text-xs font-semibold uppercase tracking-widest mb-1">Distribution</p>
            <h1 className="text-2xl font-bold text-white">Multi-Channel</h1>
            <p className="text-white/40 text-sm mt-0.5">Stock allocation across all sales channels</p>
          </div>
          <button onClick={exportToExcel} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-white text-sm font-medium transition-colors border border-white/10">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
            Export
          </button>
        </div>
      </div>

      <div className="flex-1 p-6 overflow-y-auto scrollbar-thin space-y-5">
        {/* Channel Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {channels.map(ch => (
            <div key={ch.key} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className={`h-1 ${ch.bar}`}></div>
              <div className="p-4">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">{ch.label}</p>
                <p className={`text-2xl font-bold ${ch.color}`}>{channelTotals[ch.key].toLocaleString()}</p>
                <p className="text-xs text-slate-400 mt-0.5">units allocated</p>
              </div>
            </div>
          ))}
        </div>

        {/* Filter */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <svg className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M19 11a8 8 0 11-16 0 8 8 0 0116 0z" /></svg>
              <input type="text" placeholder="Search products…" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-colors" />
            </div>
            <select value={selectedCategory} onChange={e => setSelectedCategory(e.target.value)} className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:ring-2 focus:ring-indigo-500 outline-none">
              {categories.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="text-left py-2.5 px-5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Product</th>
                  <th className="text-left py-2.5 px-4 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Category</th>
                  <th className="text-right py-2.5 px-4 text-[11px] font-semibold text-violet-400 uppercase tracking-wider">U4B</th>
                  <th className="text-right py-2.5 px-4 text-[11px] font-semibold text-blue-400 uppercase tracking-wider">1World</th>
                  <th className="text-right py-2.5 px-4 text-[11px] font-semibold text-pink-400 uppercase tracking-wider">Zalora</th>
                  <th className="text-right py-2.5 px-4 text-[11px] font-semibold text-emerald-400 uppercase tracking-wider">Website</th>
                  <th className="text-right py-2.5 px-5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Total</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.length === 0 ? (
                  <tr><td colSpan="7" className="text-center py-12 text-slate-400 text-sm">No products found</td></tr>
                ) : filteredProducts.map((p, i) => (
                  <tr key={p.id} className={i % 2 === 0 ? 'bg-white hover:bg-slate-50' : 'bg-slate-50/50 hover:bg-slate-100/50'}>
                    <td className="py-3 px-5">
                      <p className="font-semibold text-slate-800">{p.name}</p>
                      {p.code && <p className="text-[10px] font-mono text-indigo-500 mt-0.5">{p.code}</p>}
                    </td>
                    <td className="py-3 px-4 text-slate-500">{p.category}</td>
                    <td className="py-3 px-4 text-right font-bold text-violet-700">{getChannelStock(p, 'u4b').toLocaleString()}</td>
                    <td className="py-3 px-4 text-right font-bold text-blue-700">{getChannelStock(p, '1world').toLocaleString()}</td>
                    <td className="py-3 px-4 text-right font-bold text-pink-700">{getChannelStock(p, 'zalora').toLocaleString()}</td>
                    <td className="py-3 px-4 text-right font-bold text-emerald-700">{getChannelStock(p, 'website').toLocaleString()}</td>
                    <td className="py-3 px-5 text-right font-black text-slate-800">{getTotalStock(p).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
              {filteredProducts.length > 0 && (
                <tfoot>
                  <tr className="bg-slate-900 text-white">
                    <td className="py-3 px-5 font-bold text-sm" colSpan="2">Totals</td>
                    <td className="py-3 px-4 text-right font-bold text-violet-300">{channelTotals.u4b.toLocaleString()}</td>
                    <td className="py-3 px-4 text-right font-bold text-blue-300">{channelTotals['1world'].toLocaleString()}</td>
                    <td className="py-3 px-4 text-right font-bold text-pink-300">{channelTotals.zalora.toLocaleString()}</td>
                    <td className="py-3 px-4 text-right font-bold text-emerald-300">{channelTotals.website.toLocaleString()}</td>
                    <td className="py-3 px-5 text-right font-black">{Object.values(channelTotals).reduce((a, b) => a + b, 0).toLocaleString()}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
