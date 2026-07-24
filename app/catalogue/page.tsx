'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import BottomNav from '@/components/BottomNav'
import type { Item, Supplier } from '@/types'

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

const UNIT_OPTIONS = ['kg', 'litre', 'piece', 'bundle', 'packet', 'dozen', 'gram']
const CATEGORY_OPTIONS = ['raw_material', 'finished_product', 'packaging', 'misc']

/* ════════════════════════════════════════════════
   CATALOGUE PAGE
════════════════════════════════════════════════ */
export default function CataloguePage() {
  const router = useRouter()

  const [vendorId, setVendorId]         = useState<string | null>(null)
  const [activeTab, setActiveTab]       = useState<'items' | 'suppliers'>('items')
  const [isLoading, setIsLoading]       = useState(true)

  // Items state
  const [items, setItems]               = useState<Item[]>([])
  const [showAddItem, setShowAddItem]   = useState(false)
  const [itemSearch, setItemSearch]     = useState('')
  const [deletingItem, setDeletingItem] = useState<string | null>(null)

  // Suppliers state
  const [suppliers, setSuppliers]           = useState<Supplier[]>([])
  const [showAddSupplier, setShowAddSupplier] = useState(false)
  const [deletingSupplier, setDeletingSupplier] = useState<string | null>(null)

  useEffect(() => { init() }, [])

  async function init() {
    const res = await fetch('/api/vendor')
    if (!res.ok) { router.push('/onboarding'); return }
    const vendor = await res.json()
    setVendorId(vendor.id)
    await Promise.all([loadItems(vendor.id), loadSuppliers(vendor.id)])
    setIsLoading(false)
  }

  /* ── Items ── */
  async function loadItems(vid: string) {
    const { data } = await sb()
      .from('items')
      .select('*')
      .or(`vendor_id.is.null,vendor_id.eq.${vid}`)
      .order('name')
    setItems((data as Item[]) ?? [])
  }

  async function deleteItem(id: string) {
    setDeletingItem(id)
    await sb().from('items').delete().eq('id', id)
    setItems(prev => prev.filter(i => i.id !== id))
    setDeletingItem(null)
  }

  /* ── Suppliers ── */
  async function loadSuppliers(vid: string) {
    const { data } = await sb()
      .from('suppliers')
      .select('*')
      .eq('vendor_id', vid)
      .order('name')
    setSuppliers((data as Supplier[]) ?? [])
  }

  async function deleteSupplier(id: string) {
    setDeletingSupplier(id)
    await sb().from('suppliers').delete().eq('id', id)
    setSuppliers(prev => prev.filter(s => s.id !== id))
    setDeletingSupplier(null)
  }

  // Filtered items
  const filteredItems = items.filter(i =>
    i.name.toLowerCase().includes(itemSearch.toLowerCase()) ||
    i.aliases?.some(a => a.toLowerCase().includes(itemSearch.toLowerCase()))
  )
  const globalItems = filteredItems.filter(i => !i.vendor_id)
  const myItems     = filteredItems.filter(i => !!i.vendor_id)

  /* ════════════════════════════════════════════════ */
  return (
    <div className="min-h-screen bg-cream-50 max-w-[480px] mx-auto">

      {/* ─── Header ─── */}
      <header
        className="px-5 pt-safe"
        style={{
          background: 'linear-gradient(155deg, #0F3D2E 0%, #1B5B45 100%)',
          paddingBottom: 24,
        }}
      >
        <div className="pt-4">
          <h1
            className="text-xl font-bold text-white"
            style={{ fontFamily: 'var(--font-baloo)' }}
          >
            Catalogue
          </h1>
          <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.45)' }}>
            Manage your items & suppliers
          </p>
        </div>

        {/* Tab switcher */}
        <div
          className="flex mt-4 rounded-xl overflow-hidden"
          style={{ background: 'rgba(0,0,0,0.2)' }}
        >
          {(['items', 'suppliers'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="flex-1 py-2.5 text-sm font-semibold transition-all capitalize"
              style={{
                background: activeTab === tab ? '#F2A93B' : 'transparent',
                color: activeTab === tab ? '#0F3D2E' : 'rgba(255,255,255,0.55)',
                borderRadius: 10,
              }}
            >
              {tab === 'items'
                ? `Items (${items.length})`
                : `Suppliers (${suppliers.length})`}
            </button>
          ))}
        </div>
      </header>

      {/* ─── Content ─── */}
      <div className="px-4 pt-4 pb-32">

        {/* Loading */}
        {isLoading && (
          <div className="space-y-2.5">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="rounded-2xl shimmer" style={{ background: 'white', height: 64 }} />
            ))}
          </div>
        )}

        {/* ════ ITEMS TAB ════ */}
        {!isLoading && activeTab === 'items' && (
          <div className="space-y-4">

            {/* Search */}
            <div
              className="flex items-center gap-2.5 px-4 py-3 rounded-2xl"
              style={{ background: 'white', border: '1px solid #EFE4CC' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8A8272" strokeWidth="2" strokeLinecap="round">
                <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
              </svg>
              <input
                type="text"
                placeholder="Search items or aliases…"
                value={itemSearch}
                onChange={e => setItemSearch(e.target.value)}
                className="flex-1 bg-transparent text-sm text-charcoal-800 placeholder-muted-500 focus:outline-none"
              />
              {itemSearch && (
                <button onClick={() => setItemSearch('')} className="text-muted-500 text-lg leading-none">×</button>
              )}
            </div>

            {/* Add custom item */}
            {!showAddItem ? (
              <button
                onClick={() => setShowAddItem(true)}
                className="w-full py-3 rounded-2xl flex items-center justify-center gap-2 font-semibold text-sm transition-all active:scale-[0.98]"
                style={{
                  background: 'linear-gradient(135deg, #F2A93B 0%, #DB8F1F 100%)',
                  color: '#0F3D2E',
                }}
              >
                <span className="text-lg">+</span> Add Custom Item
              </button>
            ) : (
              <AddItemForm
                vendorId={vendorId!}
                onAdd={item => { setItems(prev => [...prev, item]); setShowAddItem(false) }}
                onCancel={() => setShowAddItem(false)}
              />
            )}

            {/* My custom items */}
            {myItems.length > 0 && (
              <Section title="My Items" count={myItems.length} accent="#F2A93B">
                {myItems.map(item => (
                  <ItemRow
                    key={item.id}
                    item={item}
                    isCustom
                    isDeleting={deletingItem === item.id}
                    onDelete={() => deleteItem(item.id)}
                  />
                ))}
              </Section>
            )}

            {/* Global catalogue */}
            <Section title="Global Catalogue" count={globalItems.length} accent="#2C7A5E">
              {globalItems.length === 0 && (
                <p className="text-sm text-muted-500 text-center py-4">No items match your search.</p>
              )}
              {globalItems.map(item => (
                <ItemRow key={item.id} item={item} isCustom={false} isDeleting={false} onDelete={() => {}} />
              ))}
            </Section>
          </div>
        )}

        {/* ════ SUPPLIERS TAB ════ */}
        {!isLoading && activeTab === 'suppliers' && (
          <div className="space-y-4">

            {/* Add supplier */}
            {!showAddSupplier ? (
              <button
                onClick={() => setShowAddSupplier(true)}
                className="w-full py-3 rounded-2xl flex items-center justify-center gap-2 font-semibold text-sm transition-all active:scale-[0.98]"
                style={{
                  background: 'linear-gradient(135deg, #F2A93B 0%, #DB8F1F 100%)',
                  color: '#0F3D2E',
                }}
              >
                <span className="text-lg">+</span> Add Supplier
              </button>
            ) : (
              <AddSupplierForm
                vendorId={vendorId!}
                onAdd={s => { setSuppliers(prev => [...prev, s]); setShowAddSupplier(false) }}
                onCancel={() => setShowAddSupplier(false)}
              />
            )}

            {/* Supplier list */}
            {suppliers.length === 0 && (
              <div className="text-center py-16">
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4"
                  style={{ background: '#DDEDE5' }}
                >
                  🏪
                </div>
                <p className="font-semibold text-charcoal-800 mb-1">No suppliers yet</p>
                <p className="text-sm text-muted-500">
                  Add suppliers so Munafa can track who you buy from.
                </p>
              </div>
            )}

            {suppliers.length > 0 && (
              <Section title="Your Suppliers" count={suppliers.length} accent="#2C7A5E">
                {suppliers.map(s => (
                  <SupplierRow
                    key={s.id}
                    supplier={s}
                    isDeleting={deletingSupplier === s.id}
                    onDelete={() => deleteSupplier(s.id)}
                  />
                ))}
              </Section>
            )}
          </div>
        )}
      </div>

      <BottomNav
        activeTab="catalogue"
        onTabChange={tab => {
          if (tab === 'home')    router.push('/dashboard')
          if (tab === 'history') router.push('/history')
        }}
      />
    </div>
  )
}

/* ────────────────────────────────────────────────
   Section wrapper
──────────────────────────────────────────────── */
function Section({ title, count, accent, children }: {
  title: string; count: number; accent: string; children: React.ReactNode
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2 px-1">
        <div className="w-1.5 h-4 rounded-full" style={{ background: accent }} />
        <p className="text-xs font-bold uppercase tracking-widest text-muted-500">{title}</p>
        <span
          className="ml-auto text-xs font-bold px-2 py-0.5 rounded-full"
          style={{ background: accent + '22', color: accent }}
        >
          {count}
        </span>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  )
}

/* ────────────────────────────────────────────────
   Item Row
──────────────────────────────────────────────── */
function ItemRow({ item, isCustom, isDeleting, onDelete }: {
  item: Item; isCustom: boolean; isDeleting: boolean; onDelete: () => void
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ background: 'white', border: '1px solid #EFE4CC' }}
    >
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left"
      >
        {/* Icon */}
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center text-base flex-shrink-0"
          style={{ background: isCustom ? '#FCE8C4' : '#DDEDE5' }}
        >
          {isCustom ? '⭐' : '🌾'}
        </div>
        {/* Name */}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-charcoal-800 text-sm capitalize">{item.name}</p>
          <p className="text-xs text-muted-500 truncate">
            {item.default_unit} · {item.category?.replace('_', ' ')}
          </p>
        </div>
        {/* Chevron */}
        <svg
          width="14" height="14" viewBox="0 0 24 24" fill="none"
          stroke="#8A8272" strokeWidth="2.5" strokeLinecap="round"
          style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div
          className="px-4 pb-4 pt-1 anim-fade-up"
          style={{ borderTop: '1px solid #EFE4CC' }}
        >
          {/* Aliases */}
          {(item.aliases ?? []).length > 0 && (
            <div className="mb-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-500 mb-1.5">
                Known as
              </p>
              <div className="flex flex-wrap gap-1.5">
                {item.aliases!.map((a, i) => (
                  <span
                    key={i}
                    className="text-xs px-2.5 py-1 rounded-full"
                    style={{ background: '#EFE4CC', color: '#2A2622' }}
                  >
                    {a}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Delete — only for custom items */}
          {isCustom && (
            <button
              onClick={onDelete}
              disabled={isDeleting}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl transition-all active:scale-95"
              style={{ background: '#FDE8E4', color: '#C9563B' }}
            >
              {isDeleting ? 'Deleting…' : '🗑 Remove this item'}
            </button>
          )}
          {!isCustom && (
            <p className="text-xs text-muted-500">Global item — shared across all vendors.</p>
          )}
        </div>
      )}
    </div>
  )
}

/* ────────────────────────────────────────────────
   Supplier Row
──────────────────────────────────────────────── */
function SupplierRow({ supplier, isDeleting, onDelete }: {
  supplier: Supplier; isDeleting: boolean; onDelete: () => void
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ background: 'white', border: '1px solid #EFE4CC' }}
    >
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left"
      >
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center text-base flex-shrink-0"
          style={{ background: '#DDEDE5' }}
        >
          🏪
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-charcoal-800 text-sm capitalize">{supplier.name}</p>
          {(supplier.aliases ?? []).length > 0 && (
            <p className="text-xs text-muted-500 truncate">
              Also: {supplier.aliases!.join(', ')}
            </p>
          )}
        </div>
        <svg
          width="14" height="14" viewBox="0 0 24 24" fill="none"
          stroke="#8A8272" strokeWidth="2.5" strokeLinecap="round"
          style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {expanded && (
        <div
          className="px-4 pb-4 pt-1 anim-fade-up"
          style={{ borderTop: '1px solid #EFE4CC' }}
        >
          {(supplier.aliases ?? []).length > 0 && (
            <div className="mb-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-500 mb-1.5">Aliases</p>
              <div className="flex flex-wrap gap-1.5">
                {supplier.aliases!.map((a, i) => (
                  <span key={i} className="text-xs px-2.5 py-1 rounded-full" style={{ background: '#EFE4CC', color: '#2A2622' }}>
                    {a}
                  </span>
                ))}
              </div>
            </div>
          )}
          <button
            onClick={onDelete}
            disabled={isDeleting}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl transition-all active:scale-95"
            style={{ background: '#FDE8E4', color: '#C9563B' }}
          >
            {isDeleting ? 'Removing…' : '🗑 Remove supplier'}
          </button>
        </div>
      )}
    </div>
  )
}

/* ────────────────────────────────────────────────
   Add Item Form
──────────────────────────────────────────────── */
function AddItemForm({ vendorId, onAdd, onCancel }: {
  vendorId: string
  onAdd: (item: Item) => void
  onCancel: () => void
}) {
  const [name, setName]         = useState('')
  const [unit, setUnit]         = useState('kg')
  const [category, setCategory] = useState('raw_material')
  const [aliases, setAliases]   = useState('')
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')

  async function handleSave() {
    if (!name.trim()) { setError('Item name is required'); return }
    setSaving(true)
    setError('')

    const aliasArr = aliases.split(',').map(a => a.trim()).filter(Boolean)

    const { data, error: dbErr } = await sb()
      .from('items')
      .insert({
        vendor_id: vendorId,
        name: name.toLowerCase().trim(),
        aliases: aliasArr.length ? aliasArr : null,
        category,
        default_unit: unit,
      })
      .select()
      .single()

    if (dbErr) { setError(dbErr.message); setSaving(false); return }
    onAdd(data as Item)
  }

  return (
    <div
      className="rounded-2xl p-5 space-y-4 anim-step-in"
      style={{ background: 'white', border: '1.5px solid #F2A93B', boxShadow: '0 4px 20px rgba(242,169,59,0.12)' }}
    >
      <p className="font-bold text-charcoal-800 text-sm">New Custom Item</p>

      <div className="space-y-3">
        {/* Name */}
        <div>
          <label className="text-[10px] font-bold uppercase tracking-widest text-muted-500 block mb-1.5">
            Item Name *
          </label>
          <input
            autoFocus
            type="text"
            placeholder="e.g. chhole, masala"
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl text-sm font-medium text-charcoal-800 focus:outline-none"
            style={{ background: '#FFFBF3', border: '1.5px solid #EFE4CC' }}
          />
        </div>

        {/* Unit + Category */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-500 block mb-1.5">Unit</label>
            <select
              value={unit}
              onChange={e => setUnit(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl text-sm font-medium text-charcoal-800 focus:outline-none appearance-none"
              style={{ background: '#FFFBF3', border: '1.5px solid #EFE4CC' }}
            >
              {UNIT_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-500 block mb-1.5">Category</label>
            <select
              value={category}
              onChange={e => setCategory(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl text-sm font-medium text-charcoal-800 focus:outline-none appearance-none"
              style={{ background: '#FFFBF3', border: '1.5px solid #EFE4CC' }}
            >
              {CATEGORY_OPTIONS.map(c => (
                <option key={c} value={c}>{c.replace('_', ' ')}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Aliases */}
        <div>
          <label className="text-[10px] font-bold uppercase tracking-widest text-muted-500 block mb-1.5">
            Aliases <span className="normal-case font-normal">(comma separated, optional)</span>
          </label>
          <input
            type="text"
            placeholder="e.g. chickpeas, kabuli chana"
            value={aliases}
            onChange={e => setAliases(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl text-sm font-medium text-charcoal-800 focus:outline-none"
            style={{ background: '#FFFBF3', border: '1.5px solid #EFE4CC' }}
          />
        </div>
      </div>

      {error && <p className="text-xs text-alert-500">{error}</p>}

      <div className="flex gap-2">
        <button
          onClick={onCancel}
          className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
          style={{ background: '#EFE4CC', color: '#8A8272' }}
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saving || !name.trim()}
          className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-40"
          style={{ background: 'linear-gradient(135deg, #F2A93B, #DB8F1F)', color: '#0F3D2E' }}
        >
          {saving ? 'Saving…' : 'Save Item'}
        </button>
      </div>
    </div>
  )
}

/* ────────────────────────────────────────────────
   Add Supplier Form
──────────────────────────────────────────────── */
function AddSupplierForm({ vendorId, onAdd, onCancel }: {
  vendorId: string
  onAdd: (supplier: Supplier) => void
  onCancel: () => void
}) {
  const [name, setName]       = useState('')
  const [aliases, setAliases] = useState('')
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState('')

  async function handleSave() {
    if (!name.trim()) { setError('Supplier name is required'); return }
    setSaving(true)
    setError('')

    const aliasArr = aliases.split(',').map(a => a.trim()).filter(Boolean)

    const { data, error: dbErr } = await sb()
      .from('suppliers')
      .insert({
        vendor_id: vendorId,
        name: name.trim(),
        aliases: aliasArr.length ? aliasArr : null,
      })
      .select()
      .single()

    if (dbErr) { setError(dbErr.message); setSaving(false); return }
    onAdd(data as Supplier)
  }

  return (
    <div
      className="rounded-2xl p-5 space-y-4 anim-step-in"
      style={{ background: 'white', border: '1.5px solid #F2A93B', boxShadow: '0 4px 20px rgba(242,169,59,0.12)' }}
    >
      <p className="font-bold text-charcoal-800 text-sm">New Supplier</p>

      <div className="space-y-3">
        <div>
          <label className="text-[10px] font-bold uppercase tracking-widest text-muted-500 block mb-1.5">
            Supplier Name *
          </label>
          <input
            autoFocus
            type="text"
            placeholder="e.g. Ramesh bhaiya, Mandi wala"
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl text-sm font-medium text-charcoal-800 focus:outline-none"
            style={{ background: '#FFFBF3', border: '1.5px solid #EFE4CC' }}
          />
        </div>

        <div>
          <label className="text-[10px] font-bold uppercase tracking-widest text-muted-500 block mb-1.5">
            Nicknames / Aliases <span className="normal-case font-normal">(optional, comma separated)</span>
          </label>
          <input
            type="text"
            placeholder="e.g. ramesh, bhaiya"
            value={aliases}
            onChange={e => setAliases(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl text-sm font-medium text-charcoal-800 focus:outline-none"
            style={{ background: '#FFFBF3', border: '1.5px solid #EFE4CC' }}
          />
          <p className="text-[10px] text-muted-500 mt-1">
            The AI uses these to recognise supplier names when you speak.
          </p>
        </div>
      </div>

      {error && <p className="text-xs text-alert-500">{error}</p>}

      <div className="flex gap-2">
        <button
          onClick={onCancel}
          className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
          style={{ background: '#EFE4CC', color: '#8A8272' }}
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saving || !name.trim()}
          className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-40"
          style={{ background: 'linear-gradient(135deg, #F2A93B, #DB8F1F)', color: '#0F3D2E' }}
        >
          {saving ? 'Saving…' : 'Save Supplier'}
        </button>
      </div>
    </div>
  )
}
