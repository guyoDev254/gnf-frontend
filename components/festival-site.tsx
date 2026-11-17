'use client'

import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import {
  ArrowRight,
  CalendarDays,
  Check,
  Globe2,
  Handshake,
  Lightbulb,
  Menu,
  Minus,
  Music2,
  Plus,
  Ticket,
  Trophy,
  X,
} from 'lucide-react'

const activities = [
  { icon: Music2, label: 'Cultural performances', text: 'Stories, rhythm and traditions from across the region.' },
  { icon: Lightbulb, label: 'Innovation showcases', text: 'Bold ideas built by the next generation of Northern Kenya.' },
  { icon: Trophy, label: 'Youth talent competitions', text: 'A stage for emerging voices, makers and creators.' },
  { icon: Handshake, label: 'Mentorship & networking', text: 'Make meaningful connections that move ideas forward.' },
]

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:6001/api'

type TicketCatalogItem = {
  slug: string
  name: string
  detail: string
  priceMinor: number
  currency: string
  slotsAvailable: number | null
  capacity: number | null
}

function isTicketCatalog(value: unknown): value is TicketCatalogItem[] {
  return Array.isArray(value) && value.every((ticket) =>
    typeof ticket === 'object' &&
    ticket !== null &&
    'slug' in ticket && typeof ticket.slug === 'string' &&
    'name' in ticket && typeof ticket.name === 'string' &&
    'detail' in ticket && typeof ticket.detail === 'string' &&
    'priceMinor' in ticket && typeof ticket.priceMinor === 'number' &&
    'currency' in ticket && typeof ticket.currency === 'string' &&
    'slotsAvailable' in ticket && (ticket.slotsAvailable === null || typeof ticket.slotsAvailable === 'number') &&
    'capacity' in ticket && (ticket.capacity === null || typeof ticket.capacity === 'number'),
  )
}

export function FestivalSite() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [ticketType, setTicketType] = useState('regular')
  const [ticketCount, setTicketCount] = useState(1)
  const [showTicketModal, setShowTicketModal] = useState(false)
  const [purchaseComplete, setPurchaseComplete] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [checkoutError, setCheckoutError] = useState('')
  const [paymentMessage, setPaymentMessage] = useState('')
  const [ticketReference, setTicketReference] = useState('')
  const [ticketEmailStatus, setTicketEmailStatus] = useState<'sent' | 'pending'>('pending')
  const [ticketCatalog, setTicketCatalog] = useState<TicketCatalogItem[]>([])
  const [catalogLoading, setCatalogLoading] = useState(true)
  const [catalogError, setCatalogError] = useState('')
  const defaultTicket = ticketCatalog.find((ticket) => ticket.slug === 'regular' && ticket.slotsAvailable !== 0)
    ?? ticketCatalog.find((ticket) => ticket.slotsAvailable !== 0)
  const selectedTicket = ticketCatalog.find((ticket) => ticket.slug === ticketType) ?? defaultTicket
  const maximumTicketCount = Math.min(10, selectedTicket?.slotsAvailable ?? 10)
  const totalPrice = selectedTicket ? selectedTicket.priceMinor * ticketCount : 0
  const formatPrice = (amountMinor: number, currency = 'KES') => new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amountMinor / 100)

  useEffect(() => {
    let active = true
    fetch(`${API_URL}/tickets`)
      .then(async (response) => {
        const result: unknown = await response.json()
        if (!response.ok) throw new Error('Unable to load ticket prices.')
        if (!isTicketCatalog(result)) throw new Error('The ticket catalog response was invalid.')
        return result
      })
      .then((result) => {
        if (active) setTicketCatalog(result)
      })
      .catch((error: unknown) => {
        if (active) setCatalogError(error instanceof Error ? error.message : 'Unable to load ticket prices.')
      })
      .finally(() => {
        if (active) setCatalogLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const reference = params.get('reference') ?? params.get('trxref')
    if (!reference) return

    let active = true
    setTicketReference(reference)
    setShowTicketModal(true)
    setPaymentMessage('Confirming your payment...')

    fetch(`${API_URL}/payments/verify/${encodeURIComponent(reference)}`)
      .then(async (response) => {
        const result = await response.json()
        if (!response.ok) throw new Error(result.message ?? 'Unable to confirm payment.')
        return result as {
          status: 'paid' | 'pending' | 'failed'
          ticketEmailStatus?: 'sent' | 'pending'
        }
      })
      .then((result) => {
        if (!active) return
        if (result.status === 'paid') {
          setPurchaseComplete(true)
          setTicketEmailStatus(result.ticketEmailStatus ?? 'pending')
          setPaymentMessage('Payment confirmed. Your tickets are booked.')
        } else if (result.status === 'pending') {
          setPaymentMessage('Your payment is still processing. Please check again shortly.')
        } else {
          setPaymentMessage('Payment was not completed. You can try booking again.')
        }
      })
      .catch((error: unknown) => {
        if (active) setPaymentMessage(error instanceof Error ? error.message : 'Unable to confirm payment.')
      })

    return () => {
      active = false
    }
  }, [])

  const openTickets = (type?: string) => {
    const ticket = (type ? ticketCatalog.find((item) => item.slug === type) : undefined)
      ?? defaultTicket
    if (!ticket) {
      setCheckoutError(catalogLoading ? 'Loading tickets. Please try again shortly.' : 'Tickets are not available right now.')
      setShowTicketModal(true)
      return
    }
    if (ticket.slotsAvailable === 0) {
      setCheckoutError('This ticket is sold out. Please choose another ticket.')
      setShowTicketModal(true)
      return
    }
    setTicketType(ticket.slug)
    setTicketCount(1)
    setCheckoutError('')
    setTicketReference('')
    setTicketEmailStatus('pending')
    setPurchaseComplete(false)
    setPaymentMessage('')
    setShowTicketModal(true)
  }

  const startCheckout = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedTicket || selectedTicket.slotsAvailable === 0) {
      setCheckoutError('This ticket is no longer available. Please choose another ticket.')
      return
    }
    setIsSubmitting(true)
    setCheckoutError('')
    const formData = new FormData(event.currentTarget)

    try {
      const response = await fetch(`${API_URL}/payments/initialize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticketType: ticketType,
          quantity: ticketCount,
          name: formData.get('name'),
          email: formData.get('email'),
          phone: formData.get('phone'),
          county: formData.get('county'),
        }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.message ?? 'Unable to start checkout.')
      if (typeof result.authorizationUrl !== 'string') throw new Error('Checkout could not be started.')
      window.location.assign(result.authorizationUrl)
    } catch (error) {
      setCheckoutError(error instanceof Error ? error.message : 'Unable to start checkout.')
      setIsSubmitting(false)
    }
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[#f7f1e7] text-[#163b35]">
      <div className="bg-[#163b35] px-5 py-2 text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-[#f4d49b] sm:text-xs">
        Northern Kenya&apos;s biggest celebration of culture, ideas & opportunity
      </div>

      <header className="absolute z-20 w-full border-b border-white/20 text-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 lg:px-10">
          <a href="#top" className="flex items-center gap-3" aria-label="Northern Kenya Festival home">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#e46c3b] font-serif text-xl font-bold text-white">N</span>
            <span className="font-serif text-lg font-bold leading-none sm:text-xl">Northern Kenya<br /><span className="font-sans text-[10px] font-semibold uppercase tracking-[0.22em] text-[#f4d49b]">Festival of Culture</span></span>
          </a>
          <nav className="hidden items-center gap-8 text-sm font-medium md:flex" aria-label="Primary navigation">
            <a href="#about" className="transition-colors hover:text-[#f4d49b]">About</a>
            <a href="#experience" className="transition-colors hover:text-[#f4d49b]">Experience</a>
            <a href="#tickets" className="transition-colors hover:text-[#f4d49b]">Tickets</a>
            <a href="#partner" className="transition-colors hover:text-[#f4d49b]">Partner with us</a>
          </nav>
          <a href="#tickets" className="hidden rounded-full bg-[#e46c3b] px-5 py-2.5 text-sm font-bold transition-transform hover:scale-105 md:block">Get tickets <ArrowRight className="ml-2 inline h-4 w-4" /></a>
          <button className="md:hidden" onClick={() => setMenuOpen(!menuOpen)} aria-label={menuOpen ? 'Close menu' : 'Open menu'}>{menuOpen ? <X /> : <Menu />}</button>
        </div>
        {menuOpen && <nav className="border-t border-white/20 bg-[#163b35] px-5 py-4 md:hidden"><div className="flex flex-col gap-4 text-sm font-medium"><a href="#about" onClick={() => setMenuOpen(false)}>About</a><a href="#experience" onClick={() => setMenuOpen(false)}>Experience</a><a href="#tickets" onClick={() => setMenuOpen(false)}>Tickets</a><a href="#partner" onClick={() => setMenuOpen(false)}>Partner with us</a><a href="#tickets" onClick={() => setMenuOpen(false)} className="w-fit rounded-full bg-[#e46c3b] px-4 py-2 font-bold">Get tickets</a></div></nav>}
      </header>

      <section id="top" className="relative flex min-h-[720px] items-end overflow-hidden bg-[#163b35] pt-28 text-white">
        <img src="/northern-kenya-festival.png" alt="Festival attendees and performers celebrating together outdoors" className="absolute inset-0 h-full w-full object-cover opacity-60" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#102f2c]/95 via-[#163b35]/60 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#163b35]/90 via-transparent to-[#163b35]/10" />
        <div className="relative mx-auto w-full max-w-7xl px-5 pb-24 lg:px-10 lg:pb-28">
          <div className="max-w-3xl">
            <p className="mb-6 flex items-center gap-3 text-xs font-bold uppercase tracking-[0.24em] text-[#f4d49b]"><span className="h-px w-10 bg-[#e46c3b]" /> 4th edition · Thika, Kenya</p>
            <h1 className="font-serif text-[clamp(3.5rem,9vw,8rem)] font-bold leading-[0.86] tracking-[-0.05em]">Grand Northerners<br /><span className="text-[#e46c3b]">Festival.</span></h1>
            <p className="mt-8 max-w-xl text-base leading-relaxed text-white/80 sm:text-lg">A vibrant gathering of people, cultures, ideas and talent — creating a platform for Northern Kenya to be seen, heard and celebrated.</p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row"><a href="#tickets" className="rounded-full bg-[#e46c3b] px-7 py-4 text-center text-sm font-bold text-white shadow-lg shadow-black/20 transition-transform hover:scale-105">Reserve your place <ArrowRight className="ml-2 inline h-4 w-4" /></a><a href="#experience" className="rounded-full border border-white/40 px-7 py-4 text-center text-sm font-bold text-white transition-colors hover:bg-white/10">Explore the festival</a></div>
          </div>
        </div>
        <div className="absolute bottom-6 right-5 hidden items-center gap-3 text-xs font-semibold uppercase tracking-[0.18em] text-white/60 lg:flex"><span className="h-px w-16 bg-white/40" /> Rotating across counties</div>
      </section>

      <section id="about" className="mx-auto grid max-w-7xl gap-10 px-5 py-20 lg:grid-cols-[0.8fr_1.2fr] lg:gap-24 lg:px-10 lg:py-28">
        <div><p className="text-xs font-bold uppercase tracking-[0.2em] text-[#c34b2b]">Why we gather</p><h2 className="mt-4 max-w-md font-serif text-5xl font-bold leading-[0.95] tracking-tight sm:text-6xl">A place to belong, build & become.</h2></div>
        <div className="max-w-2xl"><p className="text-xl leading-relaxed text-[#315850]">The Northern Kenya Festival of Culture, Innovation & Opportunity brings our communities together to celebrate where we come from and imagine where we can go.</p><p className="mt-6 leading-relaxed text-[#547069]">From a powerful performance to a pitch that changes a life, every moment is designed to spark pride, possibility and connection. Come discover local talent, explore new opportunities and help shape the future of Northern Kenya.</p><div className="mt-8 flex flex-wrap gap-3"><span className="rounded-full border border-[#d9c9b4] px-4 py-2 text-xs font-bold uppercase tracking-wider">Annual</span><span className="rounded-full border border-[#d9c9b4] px-4 py-2 text-xs font-bold uppercase tracking-wider">All ages welcome</span><span className="rounded-full border border-[#d9c9b4] px-4 py-2 text-xs font-bold uppercase tracking-wider">County by county</span></div></div>
      </section>

      <section id="experience" className="bg-[#e9dfcf] px-5 py-20 lg:px-10 lg:py-28"><div className="mx-auto max-w-7xl"><div className="mb-12 flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-[#c34b2b]">The experience</p><h2 className="mt-3 font-serif text-5xl font-bold tracking-tight sm:text-6xl">There&apos;s room for<br /><em className="font-normal text-[#c34b2b]">every kind of dream.</em></h2></div><p className="max-w-xs text-sm leading-relaxed text-[#547069]">Come curious. Leave connected — to your community, your creativity and what&apos;s possible.</p></div><div className="grid gap-px overflow-hidden rounded-2xl bg-[#cdbfae] md:grid-cols-2 lg:grid-cols-4">{activities.map(({ icon: Icon, label, text }, index) => <article key={label} className="group bg-[#f7f1e7] p-7 transition-colors hover:bg-[#163b35] hover:text-white"><span className="mb-14 flex h-12 w-12 items-center justify-center rounded-full bg-[#f4d49b] text-[#163b35]"><Icon className="h-5 w-5" /></span><p className="mb-3 text-xs font-bold text-[#c34b2b]">0{index + 1}</p><h3 className="font-serif text-2xl font-bold leading-tight">{label}</h3><p className="mt-3 text-sm leading-relaxed text-[#547069] group-hover:text-white/70">{text}</p></article>)}</div></div></section>

      <section id="tickets" className="relative bg-[#163b35] px-5 py-20 text-white lg:px-10 lg:py-28">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#f4d49b]">Join the movement</p>
              <h2 className="mt-3 font-serif text-5xl font-bold tracking-tight sm:text-6xl">Your ticket is<br /><span className="text-[#e46c3b]">your invitation.</span></h2>
            </div>
            <p className="max-w-sm text-sm leading-relaxed text-white/65">Choose your way in. Every ticket helps us keep the festival accessible and invest in the people and ideas that make Northern Kenya extraordinary.</p>
          </div>
          {catalogError && <p role="alert" className="mt-8 rounded-lg bg-white/10 p-4 text-sm text-white">Ticket prices are unavailable: {catalogError}</p>}
          {catalogLoading && <p role="status" className="mt-8 text-sm text-white/70">Loading ticket options…</p>}
          {!catalogLoading && !catalogError && ticketCatalog.length === 0 && <p className="mt-8 text-sm text-white/70">Tickets are not available right now.</p>}
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {ticketCatalog.map((ticket) => {
              const featured = ticket.slug === 'regular'
              return (
                <article key={ticket.slug} className={`relative rounded-2xl border p-7 ${featured ? 'border-[#e46c3b] bg-[#e46c3b]' : 'border-white/20 bg-white/5'}`}>
                  {featured && <span className="absolute right-6 top-6 rounded-full bg-[#f4d49b] px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[#163b35]">Most popular</span>}
                  <Ticket className="h-6 w-6 text-[#f4d49b]" />
                  <h3 className="mt-8 font-serif text-3xl font-bold">{ticket.name}</h3>
                  <p className="mt-2 min-h-12 text-sm text-white/65">{ticket.detail}</p>
                  <p className="mt-7 font-serif text-4xl font-bold">{formatPrice(ticket.priceMinor, ticket.currency)}</p>
                  {ticket.slotsAvailable !== null && <p className="mt-2 text-xs font-semibold text-white/75">{ticket.slotsAvailable.toLocaleString()} slots remaining</p>}
                  <button
                    type="button"
                    disabled={ticket.slotsAvailable === 0}
                    onClick={() => openTickets(ticket.slug)}
                    className={`mt-7 w-full rounded-full px-5 py-3 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-50 ${featured ? 'bg-[#163b35] text-white' : 'bg-white text-[#163b35]'}`}
                  >
                    {ticket.slotsAvailable === 0 ? 'Sold out' : <>Select ticket <ArrowRight className="ml-2 inline h-4 w-4" /></>}
                  </button>
                </article>
              )
            })}
          </div>
          <p className="mt-8 flex items-center gap-2 text-xs text-white/55"><Check className="h-4 w-4 text-[#f4d49b]" /> Secure Paystack checkout · KES payments · Payment confirmation</p>
        </div>
      </section>

      <section id="partner" className="bg-[#e46c3b] px-5 py-16 lg:px-10"><div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-8 md:flex-row md:items-center"><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-[#163b35]">Build with us</p><h2 className="mt-3 max-w-xl font-serif text-4xl font-bold leading-tight text-white sm:text-5xl">Have an idea, a business or a story to share?</h2></div><a href="mailto:info@tawitech.io?subject=Festival%20partnership%20enquiry" className="inline-flex items-center rounded-full bg-[#163b35] px-6 py-3.5 text-sm font-bold text-white">Become a partner <ArrowRight className="ml-2 inline h-4 w-4" /></a></div></section>

      <footer className="bg-[#102f2c] px-5 py-10 text-white lg:px-10"><div className="mx-auto flex max-w-7xl flex-col justify-between gap-8 sm:flex-row"><div><p className="font-serif text-xl font-bold">Northern Kenya Festival</p><p className="mt-2 text-sm text-white/50">Celebrating our heritage. Building our future.</p></div><div className="flex flex-col gap-2 text-sm text-white/60 sm:items-end"><p className="flex items-center gap-2"><CalendarDays className="h-4 w-4" /> Annual · Rotating across counties</p><p className="flex items-center gap-2"><Globe2 className="h-4 w-4" /> Northern Kenya, Kenya</p></div></div><div className="mx-auto mt-10 max-w-7xl border-t border-white/10 pt-5 text-xs text-white/35">© 2026 Northern Kenya Festival of Culture, Innovation & Opportunity</div></footer>

      {showTicketModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[#102f2c]/80 p-5 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="ticket-dialog-title"
        >
          <div className="my-5 w-full max-w-md rounded-2xl bg-[#f7f1e7] p-7 text-[#163b35] shadow-2xl">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#c34b2b]">Festival tickets</p>
                <h2 id="ticket-dialog-title" className="mt-2 font-serif text-3xl font-bold">
                  {purchaseComplete ? "You're on the list!" : 'Complete your booking'}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => { setShowTicketModal(false); setPurchaseComplete(false); setPaymentMessage(''); setTicketReference('') }}
                aria-label="Close ticket dialog"
              >
                <X />
              </button>
            </div>
            {purchaseComplete ? (
              <div className="mt-7 rounded-xl bg-white p-5 text-center">
                <Check className="mx-auto h-10 w-10 text-[#c34b2b]" />
                <p className="mt-3 font-semibold">{paymentMessage || 'Payment confirmed. Your tickets are booked.'}</p>
                <p className="mt-2 text-sm text-[#547069]">
                  {ticketEmailStatus === 'sent'
                    ? 'A PDF ticket has been sent to your email.'
                    : 'Ticket email delivery is pending. You can download your ticket below.'}
                </p>
                {ticketReference && (
                  <a
                    href={`${API_URL}/payments/ticket/${encodeURIComponent(ticketReference)}/download`}
                    className="mt-5 block w-full rounded-full border border-[#d9c9b4] px-5 py-3 text-sm font-bold text-[#163b35] hover:bg-[#f7f1e7]"
                  >
                    Download ticket (PDF)
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => { setShowTicketModal(false); setPurchaseComplete(false); setPaymentMessage(''); setTicketReference('') }}
                  className="mt-6 w-full rounded-full bg-[#e46c3b] px-5 py-4 text-sm font-bold text-white"
                >
                  Done
                </button>
              </div>
            ) : paymentMessage ? (
              <div className="mt-7 rounded-xl bg-white p-5 text-center">
                <p role="status" className="font-semibold">{paymentMessage}</p>
                <button
                  type="button"
                  onClick={() => { setShowTicketModal(false); setPaymentMessage('') }}
                  className="mt-6 w-full rounded-full bg-[#e46c3b] px-5 py-4 text-sm font-bold text-white"
                >
                  Close
                </button>
              </div>
            ) : (
              <form onSubmit={startCheckout}>
                <div className="mt-7 rounded-xl bg-white p-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-[#547069]">Selected ticket</p>
                  <p className="mt-1 font-serif text-2xl font-bold">{selectedTicket?.name ?? ticketType}</p>
                  {selectedTicket && (
                    <div className="mt-3 flex items-center justify-between text-sm">
                      <span className="text-[#547069]">Price per ticket</span>
                      <span className="font-semibold">{formatPrice(selectedTicket.priceMinor, selectedTicket.currency)}</span>
                    </div>
                  )}
                  <div className="mt-5 flex items-center justify-between">
                    <span className="text-sm font-semibold">Number of tickets</span>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        disabled={ticketCount <= 1}
                        onClick={() => setTicketCount((count) => Math.max(1, count - 1))}
                        className="flex h-8 w-8 items-center justify-center rounded-full border border-[#d9c9b4] disabled:cursor-not-allowed disabled:opacity-50"
                        aria-label="Decrease tickets"
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <span className="w-5 text-center font-bold">{ticketCount}</span>
                      <button
                        type="button"
                        disabled={ticketCount >= maximumTicketCount}
                        onClick={() => setTicketCount((count) => Math.min(maximumTicketCount, count + 1))}
                        className="flex h-8 w-8 items-center justify-center rounded-full border border-[#d9c9b4] disabled:cursor-not-allowed disabled:opacity-50"
                        aria-label="Increase tickets"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  {selectedTicket && (
                    <div className="mt-4 flex items-center justify-between border-t border-[#eee6da] pt-3">
                      <span className="text-sm font-bold">Total</span>
                      <span className="font-serif text-xl font-bold">{formatPrice(totalPrice, selectedTicket.currency)}</span>
                    </div>
                  )}
                  {selectedTicket?.slotsAvailable !== null && selectedTicket?.slotsAvailable !== undefined && (
                    <p className="mt-2 text-right text-xs text-[#547069]">{selectedTicket.slotsAvailable.toLocaleString()} slots available</p>
                  )}
                </div>
                <div className="mt-4 grid gap-3">
                  <label className="text-sm font-semibold">Full name<input required name="name" type="text" autoComplete="name" placeholder="Your full name" className="mt-1 w-full rounded-lg border border-[#d9c9b4] bg-white px-3 py-3 text-sm outline-none focus:border-[#e46c3b]" /></label>
                  <label className="text-sm font-semibold">Email address<input required name="email" type="email" autoComplete="email" placeholder="you@example.com" className="mt-1 w-full rounded-lg border border-[#d9c9b4] bg-white px-3 py-3 text-sm outline-none focus:border-[#e46c3b]" /></label>
                  <label className="text-sm font-semibold">Phone number<input required name="phone" type="tel" autoComplete="tel" placeholder="+254 7XX XXX XXX" className="mt-1 w-full rounded-lg border border-[#d9c9b4] bg-white px-3 py-3 text-sm outline-none focus:border-[#e46c3b]" /></label>
                  <label className="text-sm font-semibold">County<select required name="county" defaultValue="" className="mt-1 w-full rounded-lg border border-[#d9c9b4] bg-white px-3 py-3 text-sm outline-none focus:border-[#e46c3b]"><option value="" disabled>Select your county</option><option>Marsabit</option><option>Isiolo</option><option>Laikipia</option><option>Samburu</option><option>Turkana</option><option>Wajir</option><option>Garissa</option><option>Mandera</option></select></label>
                </div>
                {checkoutError && <p role="alert" className="mt-4 text-sm text-[#b42318]">{checkoutError}</p>}
                <button
                  type="submit"
                  disabled={isSubmitting || !selectedTicket || maximumTicketCount === 0}
                  className="mt-6 w-full rounded-full bg-[#e46c3b] px-5 py-4 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmitting ? 'Connecting to Paystack…' : 'Continue to payment'}
                  {!isSubmitting && <ArrowRight className="ml-2 inline h-4 w-4" />}
                </button>
                <p className="mt-4 text-center text-xs text-[#547069]">Enter your details to pay securely with Paystack.</p>
              </form>
            )}
          </div>
        </div>
      )}
    </main>
  )
}
