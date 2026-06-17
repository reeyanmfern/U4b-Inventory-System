import React, { useState, useEffect, useRef } from 'react'
import supabase from '../lib/supabase'
import { v4 as uuidv4 } from 'uuid'
import * as XLSX from 'xlsx'

const INPUT = "w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm bg-slate-50 focus:bg-white transition-colors"
const LABEL = "block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide"

export default function Transactions() {
  const [transactions, setTransactions] = useState([])
  const [filteredTransactions, setFilteredTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const [showSaleModal, setShowSaleModal] = useState(false)
  const [showClearAllModal, setShowClearAllModal] = useState(false)
  const [clearingAll, setClearingAll] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingTx, setEditingTx] = useState(null)
  const [editData, setEditData] = useState({})
  const [editSubmitting, setEditSubmitting] = useState(false)
  const [products, setProducts] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [receiptPreview, setReceiptPreview] = useState(null)
  const galleryInputRef = useRef(null)
  const cameraInputRef = useRef(null)

  const [saleData, setSaleData] = useState({
    event_name: '', product_id: '', quantity: 1, person_name: '',
    receipt_url: '', unit_price: '', discount_percent: '', final_price: ''
  })

  useEffect(() => { fetchTransactions() }, [])
  useEffect(() => { applyFilters() }, [transactions, searchTerm, dateFrom, dateTo])

  async function fetchTransactions() {
    try {
      const { data, error } = await supabase.from('transactions').select('*, products (code, name, category, size, price)').order('created_at', { ascending: false })
      if (error) throw error
      setTransactions(data || []); setFilteredTransactions(data || [])
    } catch (error) { alert('Error fetching transactions: ' + error.message) }
    finally { setLoading(false) }
  }

  async function fetchProducts() {
    try {
      const { data, error } = await supabase.from('products').select('*').gt('quantity', 0).order('name')
      if (error) throw error
      setProducts(data || [])
    } catch (error) { alert('Error loading products: ' + error.message) }
  }

  function openSaleModal() {
    setSaleData({ event_name: '', product_id: '', quantity: 1, person_name: '', receipt_url: '', unit_price: '', discount_percent: '', final_price: '' })
    setReceiptPreview(null); fetchProducts(); setShowSaleModal(true)
  }

  async function handleReceiptFile(file) {
    if (!file) return
    const localPreview = URL.createObjectURL(file)
    setReceiptPreview(localPreview)
    setUploading(true)
    try {
      const fileExt = file.name.split('.').pop() || 'jpg'
      const fileName = `${uuidv4()}.${fileExt}`
      const { error: uploadError } = await supabase.storage.from('receipts').upload(fileName, file)
      if (uploadError) throw uploadError
      const { data: { publicUrl } } = supabase.storage.from('receipts').getPublicUrl(fileName)
      setSaleData(prev => ({ ...prev, receipt_url: publicUrl }))
    } catch (error) { alert('Failed to upload receipt: ' + error.message); setReceiptPreview(null) }
    finally { setUploading(false) }
  }

  function removeReceipt() {
    setReceiptPreview(null); setSaleData(prev => ({ ...prev, receipt_url: '' }))
    if (galleryInputRef.current) galleryInputRef.current.value = ''
    if (cameraInputRef.current) cameraInputRef.current.value = ''
  }

  async function handleRecordSale(e) {
    e.preventDefault()
    if (!saleData.event_name.trim()) { alert('Please enter an event name.'); return }
    if (!saleData.product_id) { alert('Please select a product.'); return }
    if (!saleData.person_name.trim()) { alert('Please enter the person in charge.'); return }

    setSubmitting(true)
    try {
      const { data: product, error: productError } = await supabase.from('products').select('quantity').eq('id', saleData.product_id).single()
      if (productError) throw productError
      if (product.quantity < saleData.quantity) { alert(`Only ${product.quantity} item(s) left in stock!`); setSubmitting(false); return }

      const { error: txError } = await supabase.from('transactions').insert([{
        event_name: saleData.event_name.trim(), product_id: saleData.product_id,
        quantity: saleData.quantity, type: 'checkout',
        person_name: saleData.person_name.trim(), receipt_url: saleData.receipt_url || null,
        unit_price: unitPrice || null, discount_percent: discountPct || null,
        discount_amount: discountAmount || null, final_price: computedFinalPrice || null
      }])
      if (txError) throw txError

      const { error: updateError } = await supabase.from('products').update({ quantity: product.quantity - saleData.quantity }).eq('id', saleData.product_id)
      if (updateError) throw updateError

      await fetchTransactions(); setShowSaleModal(false); setReceiptPreview(null)
      setSaleData({ event_name: '', product_id: '', quantity: 1, person_name: '', receipt_url: '', unit_price: '', discount_percent: '', final_price: '' })
    } catch (error) { alert('Error recording sale: ' + error.message) }
    finally { setSubmitting(false) }
  }

  async function handleDeleteTransaction(tx) {
    if (!window.confirm(`Delete this transaction?\n\n${tx.event_name || 'Unknown event'} — ${tx.products?.code || tx.products?.name || 'Product'} x${tx.quantity}\n\nThis will restore ${tx.quantity} unit(s) back to stock.`)) return
    try {
      if (tx.product_id) {
        const { data: product, error: pe } = await supabase.from('products').select('quantity').eq('id', tx.product_id).single()
        if (!pe && product) await supabase.from('products').update({ quantity: product.quantity + tx.quantity }).eq('id', tx.product_id)
      }
      const { error } = await supabase.from('transactions').delete().eq('id', tx.id)
      if (error) throw error
      await fetchTransactions()
    } catch (error) { alert('Error deleting transaction: ' + error.message) }
  }

  async function handleClearAllTransactions() {
    setClearingAll(true)
    try {
      for (const tx of transactions) {
        if (tx.product_id) {
          const { data: product, error: pe } = await supabase.from('products').select('quantity').eq('id', tx.product_id).single()
          if (!pe && product) await supabase.from('products').update({ quantity: product.quantity + tx.quantity }).eq('id', tx.product_id)
        }
      }
      const { error } = await supabase.from('transactions').delete().not('id', 'is', null)
      if (error) throw error
      await fetchTransactions(); setShowClearAllModal(false)
    } catch (error) { alert('Error clearing transactions: ' + error.message) }
    finally { setClearingAll(false) }
  }

  function openEditModal(tx) {
    setEditingTx(tx)
    setEditData({ event_name: tx.event_name || '', quantity: tx.quantity, person_name: tx.person_name || '', unit_price: tx.unit_price ?? tx.products?.price ?? '', discount_percent: tx.discount_percent || '', final_price: tx.final_price || '' })
    setShowEditModal(true)
  }

  async function handleEditSubmit(e) {
    e.preventDefault(); setEditSubmitting(true)
    const unitP = parseFloat(editData.unit_price) || 0
    const discPct = parseFloat(editData.discount_percent) || 0
    const discAmt = unitP * (discPct / 100)
    const finalP = editData.final_price !== '' && editData.final_price !== null ? parseFloat(editData.final_price) : Math.max(0, unitP - discAmt)
    try {
      const qtyDiff = parseInt(editData.quantity) - editingTx.quantity
      if (qtyDiff !== 0 && editingTx.product_id) {
        const { data: product, error: pe } = await supabase.from('products').select('quantity').eq('id', editingTx.product_id).single()
        if (pe) throw pe
        const newQty = product.quantity - qtyDiff
        if (newQty < 0) { alert(`Not enough stock! Only ${product.quantity} unit(s) available.`); setEditSubmitting(false); return }
        await supabase.from('products').update({ quantity: newQty }).eq('id', editingTx.product_id)
      }
      const { error } = await supabase.from('transactions').update({
        event_name: editData.event_name.trim(), quantity: parseInt(editData.quantity),
        person_name: editData.person_name.trim(), unit_price: unitP || null,
        discount_percent: discPct || null, discount_amount: discAmt || null, final_price: finalP || null
      }).eq('id', editingTx.id)
      if (error) throw error
      await fetchTransactions(); setShowEditModal(false); setEditingTx(null)
    } catch (error) { alert('Error updating transaction: ' + error.message) }
    finally { setEditSubmitting(false) }
  }

  function applyFilters() {
    let f = [...transactions]
    if (searchTerm) f = f.filter(tx => (tx.person_name?.toLowerCase().includes(searchTerm.toLowerCase())) || (tx.products?.name?.toLowerCase().includes(searchTerm.toLowerCase())) || (tx.event_name?.toLowerCase().includes(searchTerm.toLowerCase())))
    if (dateFrom) f = f.filter(tx => new Date(tx.created_at) >= new Date(dateFrom))
    if (dateTo) f = f.filter(tx => new Date(tx.created_at) <= new Date(dateTo))
    setFilteredTransactions(f)
  }

  function exportToExcel() {
    if (filteredTransactions.length === 0) { alert('No transactions to export!'); return }
    const data = filteredTransactions.map(tx => ({
      'Date': new Date(tx.created_at).toLocaleString(), 'Event': tx.event_name || '-',
      'Product': tx.products?.code || tx.products?.name || '-', 'Category': tx.products?.category || '-',
      'Size': tx.products?.size || '-', 'Quantity': tx.quantity, 'Person In Charge': tx.person_name || '-',
      'Unit Price (RM)': tx.unit_price || tx.products?.price || '-', 'Discount (%)': tx.discount_percent || 0,
      'Final Price (RM)': tx.final_price || tx.products?.price || '-',
      'Total (RM)': ((tx.final_price ?? tx.unit_price ?? tx.products?.price ?? 0) * tx.quantity).toLocaleString(),
      'Receipt': tx.receipt_url ? 'Yes' : 'No'
    }))
    const ws = XLSX.utils.json_to_sheet(data); const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Transactions')
    const d = new Date(); XLSX.writeFile(wb, `transactions_${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}.xlsx`)
  }

  const totalSales = filteredTransactions.length
  const totalItems = filteredTransactions.reduce((s, t) => s + t.quantity, 0)
  const totalRevenue = filteredTransactions.reduce((s, t) => s + ((t.final_price ?? t.unit_price ?? t.products?.price ?? 0) * t.quantity), 0)
  const selectedProduct = products.find(p => p.id === saleData.product_id)
  const unitPrice = parseFloat(saleData.unit_price) || 0
  const discountPct = parseFloat(saleData.discount_percent) || 0
  const discountAmount = unitPrice * (discountPct / 100)
  const computedFinalPrice = saleData.final_price !== '' ? parseFloat(saleData.final_price) || 0 : Math.max(0, unitPrice - discountAmount)
  const totalAmount = computedFinalPrice * (parseInt(saleData.quantity) || 1)

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
            <p className="text-indigo-400 text-xs font-semibold uppercase tracking-widest mb-1">Sales</p>
            <h1 className="text-2xl font-bold text-white">Transactions</h1>
            <p className="text-white/40 text-sm mt-0.5">Sales history at events</p>
          </div>
          <div className="flex gap-2">
            {transactions.length > 0 && (
              <button onClick={() => setShowClearAllModal(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 text-sm font-medium transition-colors border border-rose-500/20">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                Clear All
              </button>
            )}
            <button onClick={exportToExcel} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-white text-sm font-medium transition-colors border border-white/10">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
              Export
            </button>
            <button onClick={openSaleModal} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-white text-sm font-semibold transition-colors shadow-lg shadow-indigo-500/30">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              New Sale
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 p-6 overflow-y-auto scrollbar-thin space-y-5">
        {/* Summary */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Total Sales', value: totalSales, color: 'text-indigo-700', bar: 'bg-indigo-500' },
            { label: 'Items Sold', value: totalItems, color: 'text-emerald-700', bar: 'bg-emerald-500' },
            { label: 'Revenue', value: `RM ${totalRevenue.toLocaleString()}`, color: 'text-violet-700', bar: 'bg-violet-500' },
          ].map(card => (
            <div key={card.label} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className={`h-1 ${card.bar}`}></div>
              <div className="p-4">
                <p className={`text-xl font-bold ${card.color}`}>{card.value}</p>
                <p className="text-xs font-semibold text-slate-500 mt-0.5 uppercase tracking-wide">{card.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="relative">
              <svg className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M19 11a8 8 0 11-16 0 8 8 0 0116 0z" /></svg>
              <input type="text" placeholder="Search person, product, event…" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none" />
            </div>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:ring-2 focus:ring-indigo-500 outline-none" />
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:ring-2 focus:ring-indigo-500 outline-none" />
          </div>
          <div className="flex justify-between items-center mt-3">
            <p className="text-xs text-slate-400">{filteredTransactions.length} of {transactions.length} records</p>
            {(searchTerm || dateFrom || dateTo) && <button onClick={() => { setSearchTerm(''); setDateFrom(''); setDateTo('') }} className="text-xs text-indigo-600 hover:text-indigo-700 font-semibold">Clear filters</button>}
          </div>
        </div>

        {/* Transactions Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="text-left py-2.5 px-5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Date</th>
                  <th className="text-left py-2.5 px-4 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Event</th>
                  <th className="text-left py-2.5 px-4 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Product</th>
                  <th className="text-right py-2.5 px-4 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Qty</th>
                  <th className="text-right py-2.5 px-4 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Unit Price</th>
                  <th className="text-right py-2.5 px-4 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Total</th>
                  <th className="text-left py-2.5 px-4 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Person</th>
                  <th className="text-left py-2.5 px-4 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Receipt</th>
                  <th className="py-2.5 px-4"></th>
                </tr>
              </thead>
              <tbody>
                {filteredTransactions.length === 0 ? (
                  <tr><td colSpan="9" className="text-center py-16 text-slate-400 text-sm">No transactions found</td></tr>
                ) : filteredTransactions.map((tx, i) => (
                  <tr key={tx.id} className={`${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'} hover:bg-indigo-50/30 transition-colors`}>
                    <td className="py-3 px-5 text-xs text-slate-500 whitespace-nowrap">{new Date(tx.created_at).toLocaleString()}</td>
                    <td className="py-3 px-4 font-semibold text-slate-800 max-w-[140px] truncate">{tx.event_name || '—'}</td>
                    <td className="py-3 px-4">
                      <p className="font-mono font-bold text-indigo-600 text-xs">{tx.products?.code || tx.products?.name || '—'}</p>
                      <p className="text-[10px] text-slate-400">{tx.products?.category}{tx.products?.size ? ` · ${tx.products.size}` : ''}</p>
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-slate-800">{tx.quantity}</td>
                    <td className="py-3 px-4 text-right text-slate-600 text-xs">RM {(tx.unit_price ?? tx.products?.price ?? 0).toFixed(2)}</td>
                    <td className="py-3 px-4 text-right">
                      <span className="font-bold text-slate-800">RM {((tx.final_price ?? tx.unit_price ?? tx.products?.price ?? 0) * tx.quantity).toFixed(2)}</span>
                      {tx.discount_percent > 0 && <span className="ml-1.5 text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-100 px-1.5 py-0.5 rounded-full font-semibold">-{tx.discount_percent}%</span>}
                    </td>
                    <td className="py-3 px-4 text-slate-600 text-xs">{tx.person_name || '—'}</td>
                    <td className="py-3 px-4">
                      {tx.receipt_url ? (
                        <a href={tx.receipt_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-700 text-xs font-semibold">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                          View
                        </a>
                      ) : <span className="text-slate-300 text-xs">—</span>}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex gap-1">
                        <button onClick={() => openEditModal(tx)} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                        </button>
                        <button onClick={() => handleDeleteTransaction(tx)} className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── New Sale Modal ─────────────────────────────────────────── */}
      {showSaleModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto shadow-2xl scrollbar-thin">
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 sticky top-0 bg-white rounded-t-2xl z-10">
              <div>
                <h2 className="text-lg font-bold text-slate-800">New Sale</h2>
                <p className="text-xs text-slate-400 mt-0.5">Record a stock sale at an event</p>
              </div>
              <button onClick={() => setShowSaleModal(false)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <form onSubmit={handleRecordSale} className="p-6 space-y-4">
              <div>
                <label className={LABEL}>Event Name</label>
                <input type="text" placeholder="e.g. Sunway Pyramid Pop-up, June 2026" className={INPUT} value={saleData.event_name} onChange={e => setSaleData({ ...saleData, event_name: e.target.value })} required />
              </div>
              <div>
                <label className={LABEL}>Product</label>
                <select className={INPUT} value={saleData.product_id} onChange={e => { const p = products.find(x => x.id === e.target.value); setSaleData({ ...saleData, product_id: e.target.value, quantity: 1, unit_price: p?.price || '', discount_percent: '', final_price: '' }) }} required>
                  <option value="">Select product</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.code || p.name} {p.size ? `(${p.size})` : ''} — {p.quantity} in stock</option>)}
                </select>
              </div>
              <div>
                <label className={LABEL}>Quantity {selectedProduct ? `(max ${selectedProduct.quantity})` : ''}</label>
                <input type="number" min="1" max={selectedProduct?.quantity} className={INPUT} value={saleData.quantity} onChange={e => setSaleData({ ...saleData, quantity: parseInt(e.target.value) || 1 })} required />
              </div>
              <div>
                <label className={LABEL}>Person in Charge</label>
                <input type="text" placeholder="Staff name" className={INPUT} value={saleData.person_name} onChange={e => setSaleData({ ...saleData, person_name: e.target.value })} required />
              </div>

              {/* Pricing */}
              {selectedProduct && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                  <p className="text-xs font-bold text-slate-700 uppercase tracking-wide">Pricing</p>
                  <div>
                    <label className={LABEL}>Unit Price (RM)</label>
                    <input type="number" step="0.01" min="0" className={INPUT} value={saleData.unit_price} onChange={e => setSaleData({ ...saleData, unit_price: e.target.value, final_price: '' })} placeholder={`Default: RM ${selectedProduct.price || 0}`} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={LABEL}>Discount (%)</label>
                      <input type="number" min="0" max="100" className={INPUT} value={saleData.discount_percent} onChange={e => setSaleData({ ...saleData, discount_percent: e.target.value, final_price: '' })} placeholder="0" />
                    </div>
                    <div>
                      <label className={LABEL}>Final Price (RM)</label>
                      <input type="number" step="0.01" min="0" className={INPUT} value={saleData.final_price} onChange={e => setSaleData({ ...saleData, final_price: e.target.value, discount_percent: '' })} placeholder={`RM ${computedFinalPrice.toFixed(2)}`} />
                    </div>
                  </div>
                  <div className="flex justify-between items-center pt-1 border-t border-slate-200">
                    <span className="text-xs text-emerald-600 font-medium">{discountPct > 0 ? `${discountPct}% off · save RM ${discountAmount.toFixed(2)}` : ''}</span>
                    <span className="text-sm font-black text-slate-800">Total: RM {totalAmount.toFixed(2)}</span>
                  </div>
                </div>
              )}

              {/* Receipt */}
              <div>
                <label className={LABEL}>Receipt Photo <span className="text-slate-400 font-normal normal-case">(optional)</span></label>
                {receiptPreview ? (
                  <div className="relative">
                    <img src={receiptPreview} alt="Receipt" className="w-full h-40 object-cover rounded-xl border border-slate-200" />
                    {uploading && <div className="absolute inset-0 bg-black/40 rounded-xl flex items-center justify-center"><div className="w-7 h-7 border-3 border-white border-t-transparent rounded-full animate-spin"></div></div>}
                    {!uploading && (
                      <>
                        <button type="button" onClick={removeReceipt} className="absolute top-2 right-2 bg-white/90 hover:bg-white text-slate-700 rounded-full p-1.5 shadow-sm">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                        {saleData.receipt_url && <span className="absolute bottom-2 left-2 bg-emerald-600 text-white text-[10px] px-2 py-0.5 rounded-full font-semibold">Uploaded</span>}
                      </>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <button type="button" onClick={() => cameraInputRef.current?.click()} className="flex flex-col items-center gap-2 py-5 border-2 border-dashed border-slate-200 rounded-xl hover:border-indigo-300 hover:bg-indigo-50/50 text-slate-500 hover:text-indigo-600 transition-colors">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                      <span className="text-xs font-semibold">Camera</span>
                    </button>
                    <button type="button" onClick={() => galleryInputRef.current?.click()} className="flex flex-col items-center gap-2 py-5 border-2 border-dashed border-slate-200 rounded-xl hover:border-indigo-300 hover:bg-indigo-50/50 text-slate-500 hover:text-indigo-600 transition-colors">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                      <span className="text-xs font-semibold">Gallery</span>
                    </button>
                  </div>
                )}
                <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={e => handleReceiptFile(e.target.files?.[0])} />
                <input ref={galleryInputRef} type="file" accept="image/*" className="hidden" onChange={e => handleReceiptFile(e.target.files?.[0])} />
              </div>

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowSaleModal(false)} className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-sm transition-colors">Cancel</button>
                <button type="submit" disabled={submitting || uploading} className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm transition-colors disabled:opacity-60 shadow-lg shadow-indigo-500/20">
                  {submitting ? <span className="flex items-center justify-center gap-2"><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>Recording…</span> : 'Record Sale'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Edit Modal ────────────────────────────────────────────── */}
      {showEditModal && editingTx && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto shadow-2xl scrollbar-thin">
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 sticky top-0 bg-white rounded-t-2xl z-10">
              <div>
                <h2 className="text-lg font-bold text-slate-800">Edit Transaction</h2>
                <p className="text-xs text-slate-400 mt-0.5">Update sale details</p>
              </div>
              <button onClick={() => setShowEditModal(false)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <form onSubmit={handleEditSubmit} className="p-6 space-y-4">
              <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
                <p className="text-xs text-slate-400 font-medium uppercase tracking-wide mb-0.5">Product (read-only)</p>
                <p className="font-bold text-slate-800 text-sm">
                  {editingTx.products?.code || editingTx.products?.name || '—'}
                  {editingTx.products?.size ? ` (${editingTx.products.size})` : ''}
                </p>
              </div>
              <div>
                <label className={LABEL}>Event Name</label>
                <input type="text" className={INPUT} value={editData.event_name} onChange={e => setEditData({ ...editData, event_name: e.target.value })} required />
              </div>
              <div>
                <label className={LABEL}>Quantity</label>
                <input type="number" min="1" className={INPUT} value={editData.quantity} onChange={e => setEditData({ ...editData, quantity: e.target.value })} required />
                <p className="text-xs text-slate-400 mt-1">Changing quantity adjusts stock automatically</p>
              </div>
              <div>
                <label className={LABEL}>Person in Charge</label>
                <input type="text" className={INPUT} value={editData.person_name} onChange={e => setEditData({ ...editData, person_name: e.target.value })} required />
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                <p className="text-xs font-bold text-slate-700 uppercase tracking-wide">Pricing</p>
                <div>
                  <label className={LABEL}>Unit Price (RM)</label>
                  <input type="number" step="0.01" min="0" className={INPUT} value={editData.unit_price} onChange={e => setEditData({ ...editData, unit_price: e.target.value, final_price: '' })} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={LABEL}>Discount (%)</label>
                    <input type="number" min="0" max="100" className={INPUT} value={editData.discount_percent} onChange={e => setEditData({ ...editData, discount_percent: e.target.value, final_price: '' })} placeholder="0" />
                  </div>
                  <div>
                    <label className={LABEL}>Final Price (RM)</label>
                    <input type="number" step="0.01" min="0" className={INPUT} value={editData.final_price} onChange={e => setEditData({ ...editData, final_price: e.target.value, discount_percent: '' })} />
                  </div>
                </div>
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowEditModal(false)} className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-sm transition-colors">Cancel</button>
                <button type="submit" disabled={editSubmitting} className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm transition-colors disabled:opacity-60">
                  {editSubmitting ? <span className="flex items-center justify-center gap-2"><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>Saving…</span> : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Clear All Modal ───────────────────────────────────────── */}
      {showClearAllModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl">
            <div className="w-11 h-11 bg-rose-50 rounded-xl flex items-center justify-center mb-4">
              <svg className="w-5 h-5 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <h2 className="text-lg font-bold text-slate-800 mb-1">Delete all transactions?</h2>
            <p className="text-sm text-slate-500 mb-6">This will permanently delete all {transactions.length} transaction(s) and restore sold quantities back to stock. This cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setShowClearAllModal(false)} disabled={clearingAll} className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-sm">Cancel</button>
              <button onClick={handleClearAllTransactions} disabled={clearingAll} className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold text-sm disabled:opacity-60">
                {clearingAll ? <span className="flex items-center justify-center gap-2"><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>Deleting…</span> : 'Delete All'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
