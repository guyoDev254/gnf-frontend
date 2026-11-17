'use client'

import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { ArrowLeft, BarChart3, LogOut, Pencil, Plus, Search, Ticket, X } from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:6001/api'

type TicketRecord = {
  id: string
  slug: string
  name: string
  detail: string
  priceMinor: number
  active: boolean
  capacity: number | null
  slotsAvailable: number | null
  slotsReserved: number
  slotsSold: number
}

type OrderRecord = {
  id: string
  reference: string
  buyerName: string
  email: string
  phone: string
  county: string
  quantity: number
  amountMinor: number
  currency: string
  status: 'PENDING' | 'PAID' | 'FAILED'
  createdAt: string
  paidAt: string | null
  expiresAt: string | null
  reservationReleasedAt: string | null
  ticketType: { name: string; slug: string }
}

type DashboardData = {
  orders: { PENDING: number; PAID: number; FAILED: number }
  paidSales: { count: number; amountMinor: number; tickets: number; currency: string }
  activeTickets: number
  recentOrders: OrderRecord[]
}

type OrdersResult = {
  items: OrderRecord[]
  total: number
  page: number
  limit: number
  pages: number
}

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  })
  const result: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    const body = result as { message?: string | string[] } | null
    throw new Error(Array.isArray(body?.message) ? body.message.join(', ') : body?.message ?? 'Request failed.')
  }
  return result as T
}

function money(amountMinor: number, currency = 'KES') {
  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amountMinor / 100)
}

const inputClass = 'mt-1 w-full rounded-lg border border-[#d9c9b4] bg-white px-3 py-2.5 text-sm text-[#163b35] outline-none focus:border-[#e46c3b]'
const buttonClass = 'inline-flex items-center justify-center gap-2 rounded-full bg-[#163b35] px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#24574e] disabled:cursor-not-allowed disabled:opacity-50'

export function AdminDashboard() {
  const [email, setEmail] = useState('')
  const [authenticated, setAuthenticated] = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [loginBusy, setLoginBusy] = useState(false)
  const [loginError, setLoginError] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [tab, setTab] = useState<'overview' | 'tickets' | 'orders'>('overview')
  const [dashboard, setDashboard] = useState<DashboardData | null>(null)
  const [ticketTypes, setTicketTypes] = useState<TicketRecord[]>([])
  const [orders, setOrders] = useState<OrdersResult | null>(null)
  const [orderStatus, setOrderStatus] = useState('')
  const [orderSearch, setOrderSearch] = useState('')
  const [submittedSearch, setSubmittedSearch] = useState('')
  const [orderPage, setOrderPage] = useState(1)
  const [editingTicket, setEditingTicket] = useState<TicketRecord | null>(null)
  const [ticketFormOpen, setTicketFormOpen] = useState(false)
  const [ticketSaving, setTicketSaving] = useState(false)
  const [formSlug, setFormSlug] = useState('')
  const [formName, setFormName] = useState('')
  const [formDetail, setFormDetail] = useState('')
  const [formPrice, setFormPrice] = useState('')
  const [formCapacity, setFormCapacity] = useState('')
  const [formActive, setFormActive] = useState(true)

  const loadAdminData = useCallback(async () => {
    const [overview, tickets] = await Promise.all([
      apiRequest<DashboardData>('/admin/dashboard'),
      apiRequest<TicketRecord[]>('/admin/tickets'),
    ])
    setDashboard(overview)
    setTicketTypes(tickets)
  }, [])

  const loadOrders = useCallback(async () => {
    const params = new URLSearchParams({ page: String(orderPage), limit: '15' })
    if (orderStatus) params.set('status', orderStatus)
    if (submittedSearch) params.set('search', submittedSearch)
    const result = await apiRequest<OrdersResult>(`/admin/orders?${params}`)
    setOrders(result)
  }, [orderPage, orderStatus, submittedSearch])

  useEffect(() => {
    let active = true
    apiRequest<{ email: string }>('/admin/auth/session')
      .then(async (session) => {
        if (!active) return
        setEmail(session.email)
        setAuthenticated(true)
        try {
          await loadAdminData()
        } catch (loadError) {
          if (active) setError(loadError instanceof Error ? loadError.message : 'Unable to load admin data.')
        }
      })
      .catch(() => {
        if (active) setAuthenticated(false)
      })
      .finally(() => {
        if (active) setCheckingSession(false)
      })
    return () => {
      active = false
    }
  }, [loadAdminData])

  useEffect(() => {
    if (!authenticated || tab !== 'orders') return
    loadOrders().catch((loadError: unknown) => {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load orders.')
    })
  }, [authenticated, loadOrders, tab])

  const signIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLoginBusy(true)
    setLoginError('')
    setError('')
    try {
      const session = await apiRequest<{ email: string }>('/admin/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      })
      setEmail(session.email)
      setAuthenticated(true)
      setLoginPassword('')
      try {
        await loadAdminData()
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Unable to load admin data.')
      }
    } catch (loginRequestError) {
      setLoginError(loginRequestError instanceof Error ? loginRequestError.message : 'Unable to sign in.')
    } finally {
      setLoginBusy(false)
    }
  }

  const signOut = async () => {
    try {
      await apiRequest<{ success: boolean }>('/admin/auth/logout', { method: 'POST' })
      setAuthenticated(false)
      setDashboard(null)
      setTicketTypes([])
      setOrders(null)
    } catch (logoutError) {
      setError(logoutError instanceof Error ? logoutError.message : 'Unable to sign out.')
    }
  }

  const openNewTicket = () => {
    setEditingTicket(null)
    setFormSlug('')
    setFormName('')
    setFormDetail('')
    setFormPrice('')
    setFormCapacity('')
    setFormActive(true)
    setTicketFormOpen(true)
    setError('')
  }

  const openEditTicket = (ticket: TicketRecord) => {
    setEditingTicket(ticket)
    setFormSlug(ticket.slug)
    setFormName(ticket.name)
    setFormDetail(ticket.detail)
    setFormPrice(String(ticket.priceMinor / 100))
    setFormCapacity(ticket.capacity === null ? '' : String(ticket.capacity))
    setFormActive(ticket.active)
    setTicketFormOpen(true)
    setError('')
  }

  const saveTicket = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const amount = Number(formPrice)
    if (!Number.isFinite(amount) || amount <= 0 || !Number.isInteger(amount * 100)) {
      setError('Enter a valid ticket price in KES.')
      return
    }
    const capacity = formCapacity.trim() === '' ? null : Number(formCapacity)
    if (capacity !== null && (!Number.isInteger(capacity) || capacity < 1 || capacity > 10_000_000)) {
      setError('Capacity must be a whole number from 1 to 10,000,000, or left blank for unlimited slots.')
      return
    }
    setTicketSaving(true)
    setError('')
    try {
      const payload = {
        slug: formSlug.trim().toLowerCase(),
        name: formName.trim(),
        detail: formDetail.trim(),
        priceMinor: Math.round(amount * 100),
        capacity,
        active: formActive,
      }
      if (editingTicket) {
        await apiRequest<TicketRecord>(`/admin/tickets/${editingTicket.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        })
        setNotice('Ticket type updated.')
      } else {
        await apiRequest<TicketRecord>('/admin/tickets', {
          method: 'POST',
          body: JSON.stringify(payload),
        })
        setNotice('Ticket type created.')
      }
      setTicketFormOpen(false)
      await loadAdminData()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save ticket type.')
    } finally {
      setTicketSaving(false)
    }
  }

  const archiveTicket = async (ticket: TicketRecord) => {
    if (!window.confirm(`Archive the ${ticket.name} ticket? Existing orders will remain intact.`)) return
    setError('')
    try {
      await apiRequest<TicketRecord>(`/admin/tickets/${ticket.id}`, { method: 'DELETE' })
      setNotice('Ticket type archived.')
      await loadAdminData()
    } catch (archiveError) {
      setError(archiveError instanceof Error ? archiveError.message : 'Unable to archive ticket.')
    }
  }

  const refreshOrders = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setOrderPage(1)
    setSubmittedSearch(orderSearch.trim())
  }

  if (checkingSession) {
    return <main className="flex min-h-screen items-center justify-center bg-[#f7f1e7] text-[#547069]">Loading admin…</main>
  }

  if (!authenticated) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f7f1e7] px-5 py-12 text-[#163b35]">
        <form onSubmit={signIn} className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">
          <a href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-[#547069] hover:text-[#163b35]"><ArrowLeft size={16} /> Festival website</a>
          <p className="mt-8 text-xs font-bold uppercase tracking-[0.2em] text-[#c34b2b]">Festival administration</p>
          <h1 className="mt-2 font-serif text-4xl font-bold">Admin sign in</h1>
          <p className="mt-3 text-sm leading-relaxed text-[#547069]">Sign in with the admin credentials configured for this API.</p>
          <label className="mt-7 block text-sm font-semibold">Email
            <input required type="email" autoComplete="username" value={loginEmail} onChange={(event) => setLoginEmail(event.target.value)} className={inputClass} />
          </label>
          <label className="mt-4 block text-sm font-semibold">Password
            <input required type="password" autoComplete="current-password" value={loginPassword} onChange={(event) => setLoginPassword(event.target.value)} className={inputClass} />
          </label>
          {loginError && <p role="alert" className="mt-4 text-sm text-red-700">{loginError}</p>}
          <button type="submit" disabled={loginBusy} className={`${buttonClass} mt-6 w-full`}>{loginBusy ? 'Signing in…' : 'Sign in'}</button>
        </form>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#f7f1e7] text-[#163b35]">
      <header className="bg-[#163b35] text-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-5 lg:px-10">
          <div>
            <a href="/" className="text-xs font-bold uppercase tracking-[0.18em] text-[#f4d49b]">Northern Kenya Festival</a>
            <h1 className="mt-1 font-serif text-2xl font-bold">Admin dashboard</h1>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <span className="hidden text-white/70 sm:inline">{email}</span>
            <button type="button" onClick={signOut} className="inline-flex items-center gap-2 rounded-full border border-white/30 px-4 py-2 font-semibold hover:bg-white/10"><LogOut size={16} /> Sign out</button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-5 py-8 lg:px-10">
        <nav className="mb-7 flex flex-wrap gap-2" aria-label="Admin sections">
          {([
            ['overview', 'Overview', BarChart3],
            ['tickets', 'Tickets', Ticket],
            ['orders', 'Orders', Search],
          ] as const).map(([id, label, Icon]) => (
            <button key={id} type="button" onClick={() => { setTab(id); setError(''); setNotice('') }} className={`inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold ${tab === id ? 'bg-[#e46c3b] text-white' : 'bg-white text-[#315850] hover:bg-[#e9dfcf]'}`}>
              <Icon size={16} />{label}
            </button>
          ))}
        </nav>

        {error && <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}
        {notice && <p role="status" className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900">{notice}</p>}

        {tab === 'overview' && (
          <section aria-labelledby="overview-heading">
            <div className="mb-6 flex items-end justify-between gap-4">
              <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#c34b2b]">Festival operations</p><h2 id="overview-heading" className="mt-2 font-serif text-4xl font-bold">Overview</h2></div>
              <button type="button" onClick={() => loadAdminData().catch((loadError: unknown) => setError(loadError instanceof Error ? loadError.message : 'Unable to refresh dashboard.'))} className={buttonClass}>Refresh</button>
            </div>
            {!dashboard ? <p className="rounded-2xl bg-white p-8 text-center text-[#547069]">Dashboard data is not available yet. Use Refresh to try again.</p> : <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard label="Paid revenue" value={money(dashboard.paidSales.amountMinor)} detail={`${dashboard.paidSales.count} paid orders`} />
              <StatCard label="Tickets sold" value={dashboard.paidSales.tickets.toLocaleString()} detail="From verified payments" />
              <StatCard label="Pending orders" value={dashboard.orders.PENDING.toLocaleString()} detail={`${dashboard.orders.FAILED} failed orders`} />
              <StatCard label="Active ticket types" value={dashboard.activeTickets.toLocaleString()} detail="Available for purchase" />
            </div>
            <section className="mt-8 overflow-hidden rounded-2xl bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-[#e9dfcf] px-5 py-4"><h3 className="font-serif text-xl font-bold">Recent orders</h3><button type="button" onClick={() => setTab('orders')} className="text-sm font-bold text-[#c34b2b]">View all</button></div>
              <OrdersTable orders={dashboard.recentOrders} />
            </section>
            </>}
          </section>
        )}

        {tab === 'tickets' && (
          <section aria-labelledby="tickets-heading">
            <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
              <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#c34b2b]">Catalog</p><h2 id="tickets-heading" className="mt-2 font-serif text-4xl font-bold">Ticket types</h2></div>
              <button type="button" onClick={openNewTicket} className={buttonClass}><Plus size={16} /> Add ticket</button>
            </div>
            <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full min-w-240 text-left text-sm">
                  <thead className="bg-[#e9dfcf] text-xs uppercase tracking-wide text-[#547069]"><tr><th className="px-5 py-3">Ticket</th><th className="px-5 py-3">Slug</th><th className="px-5 py-3">Price</th><th className="px-5 py-3">Capacity</th><th className="px-5 py-3">Available</th><th className="px-5 py-3">Sold / held</th><th className="px-5 py-3">Status</th><th className="px-5 py-3 text-right">Actions</th></tr></thead>
                  <tbody className="divide-y divide-[#eee6da]">
                    {ticketTypes.map((ticket) => <tr key={ticket.id}>
                      <td className="px-5 py-4"><p className="font-bold">{ticket.name}</p><p className="mt-1 max-w-md text-xs text-[#547069]">{ticket.detail}</p></td>
                      <td className="px-5 py-4 font-mono text-xs">{ticket.slug}</td>
                      <td className="px-5 py-4 font-semibold">{money(ticket.priceMinor)}</td>
                      <td className="px-5 py-4">{ticket.capacity?.toLocaleString() ?? 'Unlimited'}</td>
                      <td className="px-5 py-4 font-semibold">{ticket.slotsAvailable?.toLocaleString() ?? 'Unlimited'}{ticket.active && ticket.slotsAvailable === 0 && <span className="ml-2 text-xs text-red-700">Sold out</span>}</td>
                      <td className="px-5 py-4">{ticket.slotsSold.toLocaleString()} / {ticket.slotsReserved.toLocaleString()}</td>
                      <td className="px-5 py-4"><StatusBadge status={ticket.active ? 'ACTIVE' : 'ARCHIVED'} /></td>
                      <td className="px-5 py-4 text-right"><div className="inline-flex gap-2">
                        <button type="button" onClick={() => openEditTicket(ticket)} className="rounded-full border border-[#d9c9b4] p-2 hover:bg-[#f7f1e7]" aria-label={`Edit ${ticket.name}`}><Pencil size={15} /></button>
                        {ticket.active && <button type="button" onClick={() => archiveTicket(ticket)} className="rounded-full border border-[#d9c9b4] px-3 py-2 text-xs font-bold hover:bg-[#f7f1e7]">Archive</button>}
                      </div></td>
                    </tr>)}
                    {ticketTypes.length === 0 && <tr><td colSpan={8} className="px-5 py-10 text-center text-[#547069]">No ticket types found.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}

        {tab === 'orders' && (
          <section aria-labelledby="orders-heading">
            <div className="mb-6"><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#c34b2b]">Transactions</p><h2 id="orders-heading" className="mt-2 font-serif text-4xl font-bold">Ticket orders</h2></div>
            <form onSubmit={refreshOrders} className="mb-5 flex flex-wrap gap-3 rounded-2xl bg-white p-4 shadow-sm">
              <label className="min-w-55 flex-1 text-xs font-bold uppercase tracking-wide text-[#547069]">Search orders
                <span className="relative mt-1 block"><Search size={16} className="absolute left-3 top-3 text-[#547069]" /><input value={orderSearch} onChange={(event) => setOrderSearch(event.target.value)} placeholder="Name, email, phone or reference" className={`${inputClass} pl-9`} /></span>
              </label>
              <label className="w-full sm:w-48 text-xs font-bold uppercase tracking-wide text-[#547069]">Payment status
                <select value={orderStatus} onChange={(event) => { setOrderStatus(event.target.value); setOrderPage(1) }} className={inputClass}><option value="">All statuses</option><option value="PAID">Paid</option><option value="PENDING">Pending</option><option value="FAILED">Failed</option></select>
              </label>
              <button type="submit" className={`${buttonClass} self-end`}><Search size={16} /> Search</button>
            </form>
            <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
              {orders ? <OrdersTable orders={orders.items} /> : <p className="p-8 text-center text-[#547069]">Loading orders…</p>}
              {orders && <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#e9dfcf] px-5 py-4 text-sm text-[#547069]">
                <span>{orders.total.toLocaleString()} orders · Page {orders.page} of {Math.max(orders.pages, 1)}</span>
                <div className="flex gap-2">
                  <button type="button" disabled={orderPage <= 1} onClick={() => setOrderPage((page) => page - 1)} className="rounded-full border border-[#d9c9b4] px-4 py-2 font-bold disabled:opacity-40">Previous</button>
                  <button type="button" disabled={orderPage >= orders.pages} onClick={() => setOrderPage((page) => page + 1)} className="rounded-full border border-[#d9c9b4] px-4 py-2 font-bold disabled:opacity-40">Next</button>
                </div>
              </div>}
            </div>
          </section>
        )}
      </div>

      {ticketFormOpen && <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[#102f2c]/75 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="ticket-form-title">
        <form onSubmit={saveTicket} className="my-4 w-full max-w-lg rounded-2xl bg-[#f7f1e7] p-6 text-[#163b35] shadow-2xl sm:p-8">
          <div className="flex items-start justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#c34b2b]">Ticket catalog</p><h2 id="ticket-form-title" className="mt-2 font-serif text-3xl font-bold">{editingTicket ? 'Edit ticket' : 'Add ticket'}</h2></div><button type="button" onClick={() => setTicketFormOpen(false)} aria-label="Close form" className="rounded-full p-2 hover:bg-white"><X size={20} /></button></div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-semibold">Ticket name<input required minLength={2} maxLength={80} value={formName} onChange={(event) => setFormName(event.target.value)} className={inputClass} /></label>
            <label className="text-sm font-semibold">Slug<input required pattern="[a-z0-9]+(-[a-z0-9]+)*" maxLength={40} value={formSlug} onChange={(event) => setFormSlug(event.target.value)} className={inputClass} /><span className="mt-1 block text-xs font-normal text-[#547069]">Lowercase letters, digits and hyphens.</span></label>
            <label className="text-sm font-semibold sm:col-span-2">Description<textarea required minLength={5} maxLength={500} rows={3} value={formDetail} onChange={(event) => setFormDetail(event.target.value)} className={inputClass} /></label>
            <label className="text-sm font-semibold">Price in KES<input required type="number" min="1" step="1" value={formPrice} onChange={(event) => setFormPrice(event.target.value)} className={inputClass} /></label>
            <label className="text-sm font-semibold">Available slots<input type="number" min="1" max="10000000" step="1" value={formCapacity} onChange={(event) => setFormCapacity(event.target.value)} placeholder="Unlimited" className={inputClass} /><span className="mt-1 block text-xs font-normal text-[#547069]">Total capacity. Leave blank for unlimited. Checkout holds slots for 30 minutes.</span></label>
            <label className="flex items-center gap-2 self-end pb-3 text-sm font-semibold"><input type="checkbox" checked={formActive} onChange={(event) => setFormActive(event.target.checked)} className="h-4 w-4 accent-[#e46c3b]" /> Active and available</label>
          </div>
          <button type="submit" disabled={ticketSaving} className={`${buttonClass} mt-7 w-full`}>{ticketSaving ? 'Saving…' : editingTicket ? 'Save changes' : 'Create ticket'}</button>
        </form>
      </div>}
    </main>
  )
}

function StatCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <article className="rounded-2xl border border-[#e9dfcf] bg-white p-5 shadow-sm"><p className="text-xs font-bold uppercase tracking-[0.14em] text-[#547069]">{label}</p><p className="mt-3 font-serif text-3xl font-bold">{value}</p><p className="mt-2 text-sm text-[#547069]">{detail}</p></article>
}

function StatusBadge({ status }: { status: OrderRecord['status'] | 'ACTIVE' | 'ARCHIVED' }) {
  const color = status === 'PAID' || status === 'ACTIVE'
    ? 'bg-green-100 text-green-800'
    : status === 'FAILED' || status === 'ARCHIVED'
      ? 'bg-stone-200 text-stone-700'
      : 'bg-amber-100 text-amber-800'
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${color}`}>{status}</span>
}

function OrdersTable({ orders }: { orders: OrderRecord[] }) {
  return <div className="overflow-x-auto">
    <table className="w-full min-w-195 text-left text-sm">
      <thead className="bg-[#e9dfcf] text-xs uppercase tracking-wide text-[#547069]"><tr><th className="px-5 py-3">Buyer</th><th className="px-5 py-3">Ticket</th><th className="px-5 py-3">Total</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Date</th></tr></thead>
      <tbody className="divide-y divide-[#eee6da]">
        {orders.map((order) => <tr key={order.id}>
          <td className="px-5 py-4"><p className="font-bold">{order.buyerName}</p><p className="mt-1 text-xs text-[#547069]">{order.email} · {order.phone}</p><p className="mt-1 font-mono text-[10px] text-[#547069]">{order.reference}</p></td>
          <td className="px-5 py-4"><p className="font-semibold">{order.ticketType.name} × {order.quantity}</p><p className="mt-1 text-xs text-[#547069]">{order.county}</p></td>
          <td className="px-5 py-4 font-semibold">{money(order.amountMinor, order.currency)}</td>
          <td className="px-5 py-4"><StatusBadge status={order.status} />{order.status === 'PENDING' && order.reservationReleasedAt && <p className="mt-1 text-[10px] text-[#547069]">Checkout hold expired</p>}</td>
          <td className="px-5 py-4 text-xs text-[#547069]">{new Date(order.createdAt).toLocaleString('en-KE')}</td>
        </tr>)}
        {orders.length === 0 && <tr><td colSpan={5} className="px-5 py-10 text-center text-[#547069]">No orders match your filters.</td></tr>}
      </tbody>
    </table>
  </div>
}
