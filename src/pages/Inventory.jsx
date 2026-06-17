import React, { useState, useEffect, useRef } from 'react'
import supabase from '../lib/supabase'
import { v4 as uuidv4 } from 'uuid'
import * as XLSX from 'xlsx'

// ─── Shared input style ────────────────────────────────────────────────────
const INPUT = "w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#3C78A0] focus:border-[#3C78A0] outline-none text-sm bg-slate-50 focus:bg-white transition-colors"
const LABEL = "block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide"

export default function Inventory() {
  const [products, setProducts] = useState([])
  const [filteredProducts, setFilteredProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingProduct, setEditingProduct] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [pastedImage, setPastedImage] = useState(null)
  const imageInputRef = useRef(null)

  const [showStockModal, setShowStockModal] = useState(false)
  const [stockTarget, setStockTarget] = useState(null)
  const [stockUpdate, setStockUpdate] = useState({ type: 'add', quantity: 1, reason: '' })

  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [categories, setCategories] = useState(['All'])

  const [formData, setFormData] = useState({
    code: '', name: '', category: 'Bags', sub_category: '', size: 'One Size',
    variety: '', material: '', weight_grams: '', dimensions: '', price: 0,
    main_sku: '', image_url: '', status: 'active', quantity: 0
  })

  useEffect(() => { fetchProducts(); fetchCategories() }, [])
  useEffect(() => { applyFilters() }, [products, searchTerm, selectedCategory])

  async function fetchProducts() {
    try {
      setLoading(true)
      const { data, error } = await supabase.from('products').select('*, product_variations (*)').order('created_at', { ascending: false })
      if (error) throw error
      setProducts(data || [])
      setFilteredProducts(data || [])
    } catch (error) {
      alert('Error fetching products: ' + error.message)
    } finally { setLoading(false) }
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

  async function uploadImage(file) {
    if (!file) return null
    setUploading(true)
    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `${uuidv4()}.${fileExt}`
      const { error: uploadError } = await supabase.storage.from('product-images').upload(fileName, file)
      if (uploadError) throw uploadError
      const { data: { publicUrl } } = supabase.storage.from('product-images').getPublicUrl(fileName)
      return publicUrl
    } catch (error) { alert('Failed to upload image'); return null }
    finally { setUploading(false) }
  }

  const handlePaste = async (e) => {
    for (let i = 0; i < e.clipboardData.items.length; i++) {
      if (e.clipboardData.items[i].type.indexOf('image') !== -1) {
        const file = e.clipboardData.items[i].getAsFile()
        if (file) { const url = await uploadImage(file); if (url) { setFormData({ ...formData, image_url: url }); setPastedImage(url) } }
        break
      }
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    const sanitized = {
      ...formData,
      weight_grams: formData.weight_grams === '' || formData.weight_grams === null ? null : parseInt(formData.weight_grams) || null,
      price: formData.price === '' || formData.price === null ? 0 : parseFloat(formData.price) || 0,
      quantity: formData.quantity === '' || formData.quantity === null ? 0 : parseInt(formData.quantity) || 0,
    }
    try {
      if (editingProduct) {
        const { error } = await supabase.from('products').update(sanitized).eq('id', editingProduct.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('products').insert([sanitized])
        if (error) throw error
      }
      await fetchProducts(); setShowModal(false); resetForm()
    } catch (error) { alert('Error saving product: ' + error.message) }
    finally { setLoading(false) }
  }

  async function handleDeleteProduct(id) {
    if (confirm('Delete this product?')) {
      try {
        const { error } = await supabase.from('products').delete().eq('id', id)
        if (error) throw error
        await fetchProducts()
      } catch (error) { alert('Error deleting product: ' + error.message) }
    }
  }

  function openProductStockModal(product, actionType) {
    setStockTarget({ type: 'product', data: product, productName: product.name, currentStock: product.quantity || 0 })
    setStockUpdate({ type: actionType, quantity: 1, reason: '' }); setShowStockModal(true)
  }

  function openVariationStockModal(variation, productName, actionType) {
    setStockTarget({ type: 'variation', data: variation, productName, variationName: `${variation.variation_type}: ${variation.variation_value}`, currentStock: variation.quantity || 0 })
    setStockUpdate({ type: actionType, quantity: 1, reason: '' }); setShowStockModal(true)
  }

  async function submitStockUpdate() {
    const { type, data } = stockTarget
    const newQty = stockUpdate.type === 'add' ? (data.quantity || 0) + stockUpdate.quantity : (data.quantity || 0) - stockUpdate.quantity
    if (newQty < 0) { alert('Cannot reduce stock below 0!'); return }
    if (type === 'product') {
      setProducts(prev => prev.map(p => p.id === data.id ? { ...p, quantity: newQty } : p))
    } else {
      setProducts(prev => prev.map(p => ({ ...p, product_variations: p.product_variations?.map(v => v.id === data.id ? { ...v, quantity: newQty } : v) })))
    }
    setShowStockModal(false)
    try {
      if (type === 'product') { const { error } = await supabase.from('products').update({ quantity: newQty }).eq('id', data.id); if (error) throw error }
      else { const { error } = await supabase.from('product_variations').update({ quantity: newQty }).eq('id', data.id); if (error) throw error }
    } catch (error) { alert('Error updating stock: ' + error.message); await fetchProducts() }
  }

  function exportToExcel() {
    const exportData = filteredProducts.map(p => ({
      'Code': p.code, 'Product Name': p.name, 'Category': p.category,
      'Sub Category': p.sub_category, 'Size': p.size, 'Material': p.material,
      'Price (RM)': p.price,
      'Stock': p.product_variations?.length > 0 ? p.product_variations.reduce((s, v) => s + (v.quantity || 0), 0) : (p.quantity || 0),
      'Status': p.status
    }))
    const ws = XLSX.utils.json_to_sheet(exportData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Inventory')
    const d = new Date()
    XLSX.writeFile(wb, `inventory_${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}.xlsx`)
  }

  function resetForm() {
    setFormData({ code: '', name: '', category: 'Bags', sub_category: '', size: 'One Size', variety: '', material: '', weight_grams: '', dimensions: '', price: 0, main_sku: '', image_url: '', status: 'active', quantity: 0 })
    setPastedImage(null); setEditingProduct(null)
  }

  function editProduct(product) {
    setEditingProduct(product)
    setFormData({ code: product.code || '', name: product.name, category: product.category, sub_category: product.sub_category || '', size: product.size, variety: product.variety || '', material: product.material || '', weight_grams: product.weight_grams || '', dimensions: product.dimensions || '', price: product.price || 0, main_sku: product.main_sku || '', image_url: product.image_url || '', status: product.status || 'active', quantity: product.quantity || 0 })
    setShowModal(true)
  }

  const totalStock = products.reduce((s, p) => s + (p.product_variations?.length > 0 ? p.product_variations.reduce((a, v) => a + (v.quantity || 0), 0) : (p.quantity || 0)), 0)
  const totalValue = products.reduce((s, p) => { const q = p.product_variations?.length > 0 ? p.product_variations.reduce((a, v) => a + (v.quantity || 0), 0) : (p.quantity || 0); return s + q * (p.price || 0) }, 0)

  const qColor = (q) => q === 0 ? 'text-rose-600 font-bold' : q < 10 ? 'text-amber-600 font-bold' : 'text-emerald-600 font-bold'
  const qBadge = (q) => q === 0 ? 'bg-rose-50 text-rose-700 border border-rose-100' : q < 10 ? 'bg-amber-50 text-amber-700 border border-amber-100' : 'bg-emerald-50 text-emerald-700 border border-emerald-100'

  return (
    <div className="flex flex-col h-full">
      {/* Page Header */}
      <div className="page-header px-6 py-6 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[#5A96BE] text-xs font-semibold uppercase tracking-widest mb-1">Catalog</p>
            <h1 className="text-2xl font-bold text-white">Inventory</h1>
            <p className="text-white/40 text-sm mt-0.5">{products.length} products · {totalStock.toLocaleString()} units · RM {totalValue.toLocaleString()} value</p>
          </div>
          <div className="flex gap-2">
            <button onClick={exportToExcel} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-white text-sm font-medium transition-colors border border-white/10">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
              Export
            </button>
            <button onClick={() => { resetForm(); setShowModal(true) }} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#3C78A0] hover:bg-[#5A96BE] text-white text-sm font-semibold transition-colors shadow-lg shadow-[#3C78A0]/30">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              Add Product
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 p-6 overflow-y-auto scrollbar-thin space-y-4">
        {/* Search & Filter */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <svg className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M19 11a8 8 0 11-16 0 8 8 0 0116 0z" /></svg>
              <input type="text" placeholder="Search products…" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#3C78A0] focus:border-[#3C78A0] outline-none transition-colors" />
            </div>
            <select value={selectedCategory} onChange={e => setSelectedCategory(e.target.value)} className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:ring-2 focus:ring-[#3C78A0] outline-none transition-colors">
              {categories.map(c => <option key={c}>{c}</option>)}
            </select>
            {(searchTerm || selectedCategory !== 'All') && (
              <button onClick={() => { setSearchTerm(''); setSelectedCategory('All') }} className="px-3 py-2 text-sm text-[#3C78A0] hover:text-[#2C5F80] font-medium">Clear</button>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-2">{filteredProducts.length} of {products.length} products</p>
        </div>

        {/* Products */}
        {loading ? (
          <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-2 border-[#3C78A0] border-t-transparent rounded-full animate-spin"></div></div>
        ) : filteredProducts.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm text-center py-16">
            <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" /></svg>
            </div>
            <p className="text-slate-500 text-sm font-medium">No products found</p>
            <p className="text-slate-400 text-xs mt-1">Try adjusting your search or filters</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredProducts.map(product => {
              const hasVariations = product.product_variations?.length > 0
              const totalProductStock = hasVariations ? product.product_variations.reduce((s, v) => s + (v.quantity || 0), 0) : (product.quantity || 0)
              return (
                <div key={product.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden hover:border-[#A0C8DC] transition-colors">
                  <div className="p-5">
                    <div className="flex gap-4">
                      {/* Image */}
                      {product.image_url ? (
                        <img src={product.image_url} alt={product.name} className="w-16 h-16 object-cover rounded-lg border border-slate-100 flex-shrink-0" />
                      ) : (
                        <div className="w-16 h-16 bg-slate-50 border border-slate-100 rounded-lg flex items-center justify-center flex-shrink-0">
                          <svg className="w-6 h-6 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                        </div>
                      )}

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-bold text-slate-800 text-sm">{product.name}</h3>
                              <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wide ${product.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{product.status}</span>
                            </div>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1">
                              {product.code && <span className="text-xs font-mono font-bold text-[#3C78A0] bg-[#EBF4FA] px-1.5 py-0.5 rounded">{product.code}</span>}
                              {product.main_sku && <span className="text-xs text-slate-400">SKU: {product.main_sku}</span>}
                              <span className="text-xs text-slate-400">{product.category}{product.sub_category && ` · ${product.sub_category}`}</span>
                              {product.size && product.size !== 'One Size' && <span className="text-xs text-slate-400">{product.size}</span>}
                              {product.material && <span className="text-xs text-slate-400">{product.material}</span>}
                            </div>
                            <p className="text-sm font-bold text-slate-700 mt-1.5">RM {product.price}</p>
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-1 flex-shrink-0">
                            {!hasVariations && (
                              <div className="flex items-center gap-1.5 mr-2">
                                <span className={`text-sm font-bold px-2.5 py-1 rounded-lg ${qBadge(product.quantity || 0)}`}>{product.quantity || 0}</span>
                                <button onClick={() => openProductStockModal(product, 'add')} className="w-7 h-7 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center font-bold text-base transition-colors">+</button>
                                <button onClick={() => openProductStockModal(product, 'remove')} className="w-7 h-7 rounded-lg bg-rose-500 hover:bg-rose-600 text-white flex items-center justify-center font-bold text-base transition-colors">−</button>
                              </div>
                            )}
                            <button onClick={() => editProduct(product)} className="p-2 text-slate-400 hover:text-[#3C78A0] hover:bg-[#EBF4FA] rounded-lg transition-colors">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                            </button>
                            <button onClick={() => handleDeleteProduct(product.id)} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                          </div>
                        </div>

                        {/* Variations */}
                        {hasVariations && (
                          <div className="mt-4 border-t border-slate-100 pt-3">
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Variations</p>
                              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${qBadge(totalProductStock)}`}>{totalProductStock} units total</span>
                            </div>
                            <div className="overflow-x-auto -mx-1">
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="border-b border-slate-100">
                                    <th className="text-left py-1.5 px-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Type</th>
                                    <th className="text-left py-1.5 px-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Value</th>
                                    <th className="text-left py-1.5 px-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wide">SKU</th>
                                    <th className="text-right py-1.5 px-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Stock</th>
                                    <th className="text-center py-1.5 px-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Adjust</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {product.product_variations.map(v => (
                                    <tr key={v.id} className="border-b border-slate-50 hover:bg-slate-50">
                                      <td className="py-2 px-2 text-slate-600">{v.variation_type}</td>
                                      <td className="py-2 px-2 font-semibold text-slate-800">{v.variation_value}</td>
                                      <td className="py-2 px-2 text-slate-400 font-mono">{v.sku || '—'}</td>
                                      <td className="py-2 px-2 text-right"><span className={`font-bold ${qColor(v.quantity || 0)}`}>{v.quantity || 0}</span></td>
                                      <td className="py-2 px-2">
                                        <div className="flex gap-1 justify-center">
                                          <button onClick={() => openVariationStockModal(v, product.name, 'add')} className="w-6 h-6 bg-emerald-500 hover:bg-emerald-600 text-white rounded font-bold flex items-center justify-center transition-colors">+</button>
                                          <button onClick={() => openVariationStockModal(v, product.name, 'remove')} className="w-6 h-6 bg-rose-500 hover:bg-rose-600 text-white rounded font-bold flex items-center justify-center transition-colors">−</button>
                                        </div>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Stock Update Modal */}
      {showStockModal && stockTarget && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl">
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-4 ${stockUpdate.type === 'add' ? 'bg-emerald-50' : 'bg-rose-50'}`}>
              <svg className={`w-5 h-5 ${stockUpdate.type === 'add' ? 'text-emerald-600' : 'text-rose-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {stockUpdate.type === 'add' ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /> : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />}
              </svg>
            </div>
            <h2 className="text-lg font-bold text-slate-800 mb-0.5">{stockUpdate.type === 'add' ? 'Add Stock' : 'Remove Stock'}</h2>
            <p className="text-sm text-slate-500 mb-1 font-medium">{stockTarget.productName}</p>
            {stockTarget.variationName && <p className="text-xs text-slate-400 mb-1">{stockTarget.variationName}</p>}
            <p className="text-xs text-slate-400 mb-4">Current stock: <span className="font-bold text-slate-700">{stockTarget.currentStock}</span></p>
            <div className="space-y-3 mb-5">
              <div><label className={LABEL}>Quantity</label><input type="number" min="1" value={stockUpdate.quantity} onChange={e => setStockUpdate({ ...stockUpdate, quantity: parseInt(e.target.value) || 1 })} className={INPUT} autoFocus /></div>
              <div><label className={LABEL}>Reason (optional)</label><input type="text" value={stockUpdate.reason} onChange={e => setStockUpdate({ ...stockUpdate, reason: e.target.value })} placeholder="e.g. New batch, Sold" className={INPUT} /></div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowStockModal(false)} className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-sm transition-colors">Cancel</button>
              <button onClick={submitStockUpdate} className={`flex-1 py-2.5 rounded-xl text-white font-semibold text-sm transition-colors ${stockUpdate.type === 'add' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'}`}>
                {stockUpdate.type === 'add' ? 'Add Stock' : 'Remove Stock'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Product Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl scrollbar-thin" onPaste={handlePaste}>
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 sticky top-0 bg-white rounded-t-2xl z-10">
              <div>
                <h2 className="text-lg font-bold text-slate-800">{editingProduct ? 'Edit Product' : 'Add New Product'}</h2>
                <p className="text-xs text-slate-400 mt-0.5">{editingProduct ? 'Update product details below' : 'Fill in the details to add to catalog'}</p>
              </div>
              <button onClick={() => setShowModal(false)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { label: 'Product Code', key: 'code', type: 'text' },
                  { label: 'Product Name *', key: 'name', type: 'text', required: true },
                  { label: 'Main SKU', key: 'main_sku', type: 'text' },
                  { label: 'Sub Category', key: 'sub_category', type: 'text' },
                  { label: 'Size', key: 'size', type: 'text' },
                  { label: 'Material', key: 'material', type: 'text' },
                  { label: 'Dimensions', key: 'dimensions', type: 'text' },
                  { label: 'Weight (grams)', key: 'weight_grams', type: 'number' },
                  { label: 'Price (RM)', key: 'price', type: 'number', step: '0.01' },
                  { label: 'Initial Stock', key: 'quantity', type: 'number' },
                ].map(f => (
                  <div key={f.key}>
                    <label className={LABEL}>{f.label}</label>
                    <input type={f.type} step={f.step} className={INPUT} value={formData[f.key]} onChange={e => setFormData({ ...formData, [f.key]: e.target.value })} required={f.required} />
                  </div>
                ))}
                <div>
                  <label className={LABEL}>Category *</label>
                  <select className={INPUT} value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })}>
                    <option>Bags</option><option>Home & Decor</option><option>Pet</option><option>Accessories</option>
                  </select>
                </div>
                <div>
                  <label className={LABEL}>Status</label>
                  <select className={INPUT} value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value })}>
                    <option value="active">Active</option><option value="discontinued">Discontinued</option><option value="draft">Draft</option>
                  </select>
                </div>
              </div>

              {/* Image upload */}
              <div className="mt-4">
                <label className={LABEL}>Product Image</label>
                <div className="border-2 border-dashed border-slate-200 rounded-xl p-5 text-center hover:border-[#A0C8DC] transition-colors" onPaste={handlePaste}>
                  <svg className="w-7 h-7 text-slate-300 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                  <p className="text-xs text-slate-400">Paste image (Ctrl+V) or <button type="button" onClick={() => imageInputRef.current?.click()} className="text-[#3C78A0] hover:underline">upload file</button></p>
                  <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={async e => { const f = e.target.files[0]; if (f) { const url = await uploadImage(f); if (url) setFormData({ ...formData, image_url: url }) } }} />
                </div>
                {formData.image_url && (
                  <div className="mt-3 relative inline-block">
                    <img src={formData.image_url} alt="Preview" className="w-24 h-24 object-cover rounded-xl border border-slate-100" />
                    <button type="button" onClick={() => setFormData({ ...formData, image_url: '' })} className="absolute -top-2 -right-2 w-6 h-6 bg-rose-500 hover:bg-rose-600 text-white rounded-full text-xs font-bold flex items-center justify-center">✕</button>
                  </div>
                )}
                {uploading && <p className="text-xs text-[#3C78A0] mt-2 flex items-center gap-1.5"><span className="w-3 h-3 border border-indigo-600 border-t-transparent rounded-full animate-spin inline-block"></span>Uploading…</p>}
              </div>

              <div className="flex gap-3 mt-6">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-sm transition-colors">Cancel</button>
                <button type="submit" className="flex-1 py-2.5 rounded-xl bg-[#3C78A0] hover:bg-[#2C5F80] text-white font-semibold text-sm transition-colors shadow-lg shadow-[#3C78A0]/20">Save Product</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
