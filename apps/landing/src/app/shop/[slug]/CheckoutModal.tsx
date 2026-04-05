'use client'

import { useState, Fragment, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001'

type Props = {
  product: { id: string; title: string; price: number; slug: string }
  onClose: () => void
}

type PaymentMethod = 'USDT_TRC20' | 'USDT_BEP20' | 'UPI'
type ContactMethod = 'telegram' | 'whatsapp'

const COUNTRY_CODES = [
  { code: '+91', country: 'India', flag: 'IN' },
  { code: '+1', country: 'United States', flag: 'US' },
  { code: '+44', country: 'United Kingdom', flag: 'GB' },
  { code: '+971', country: 'UAE', flag: 'AE' },
  { code: '+86', country: 'China', flag: 'CN' },
  { code: '+852', country: 'Hong Kong', flag: 'HK' },
  { code: '+65', country: 'Singapore', flag: 'SG' },
  { code: '+60', country: 'Malaysia', flag: 'MY' },
  { code: '+62', country: 'Indonesia', flag: 'ID' },
  { code: '+63', country: 'Philippines', flag: 'PH' },
  { code: '+66', country: 'Thailand', flag: 'TH' },
  { code: '+84', country: 'Vietnam', flag: 'VN' },
  { code: '+82', country: 'South Korea', flag: 'KR' },
  { code: '+81', country: 'Japan', flag: 'JP' },
  { code: '+49', country: 'Germany', flag: 'DE' },
  { code: '+33', country: 'France', flag: 'FR' },
  { code: '+39', country: 'Italy', flag: 'IT' },
  { code: '+34', country: 'Spain', flag: 'ES' },
  { code: '+55', country: 'Brazil', flag: 'BR' },
  { code: '+7', country: 'Russia', flag: 'RU' },
  { code: '+234', country: 'Nigeria', flag: 'NG' },
  { code: '+27', country: 'South Africa', flag: 'ZA' },
  { code: '+20', country: 'Egypt', flag: 'EG' },
  { code: '+92', country: 'Pakistan', flag: 'PK' },
  { code: '+880', country: 'Bangladesh', flag: 'BD' },
  { code: '+94', country: 'Sri Lanka', flag: 'LK' },
  { code: '+977', country: 'Nepal', flag: 'NP' },
  { code: '+61', country: 'Australia', flag: 'AU' },
  { code: '+64', country: 'New Zealand', flag: 'NZ' },
  { code: '+90', country: 'Turkey', flag: 'TR' },
  { code: '+966', country: 'Saudi Arabia', flag: 'SA' },
  { code: '+974', country: 'Qatar', flag: 'QA' },
  { code: '+968', country: 'Oman', flag: 'OM' },
  { code: '+973', country: 'Bahrain', flag: 'BH' },
  { code: '+965', country: 'Kuwait', flag: 'KW' },
]

export default function CheckoutModal({ product, onClose }: Props) {
  const [step, setStep] = useState(1)
  const [stepDirection, setStepDirection] = useState<'forward' | 'back'>('forward')
  const [animating, setAnimating] = useState(false)

  const goToStep = (newStep: number) => {
    setStepDirection(newStep > step ? 'forward' : 'back')
    setAnimating(true)
    setTimeout(() => {
      setStep(newStep)
      setTimeout(() => setAnimating(false), 50)
    }, 150)
  }
  const [email, setEmail] = useState('')
  const [contactMethod, setContactMethod] = useState<ContactMethod>('telegram')
  const [telegramUsername, setTelegramUsername] = useState('')
  const [countryCode, setCountryCode] = useState('+91')
  const [whatsappNumber, setWhatsappNumber] = useState('')
  const [showCountryDropdown, setShowCountryDropdown] = useState(false)
  const [countrySearch, setCountrySearch] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('USDT_BEP20')
  const [walletAddress, setWalletAddress] = useState('')
  const [orderId, setOrderId] = useState('')
  const [orderNumber, setOrderNumber] = useState('')
  const [txHash, setTxHash] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [showManualTx, setShowManualTx] = useState(false)
  const [detectedTxHash, setDetectedTxHash] = useState('')
  const [confirmations, setConfirmations] = useState(0)
  const [expiresAt, setExpiresAt] = useState<number>(0)
  const [timeLeft, setTimeLeft] = useState('')
  const [inrRate, setInrRate] = useState(0)
  const [inrAmount, setInrAmount] = useState(0)
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null)
  const [screenshotPreview, setScreenshotPreview] = useState('')
  const [closing, setClosing] = useState(false)
  const countryBtnRef = useRef<HTMLButtonElement>(null)

  const handleClose = () => {
    setClosing(true)
    setTimeout(() => onClose(), 250)
  }

  const filteredCodes = COUNTRY_CODES.filter(c =>
    c.country.toLowerCase().includes(countrySearch.toLowerCase()) || c.code.includes(countrySearch)
  )

  const contactInfo = contactMethod === 'telegram'
    ? telegramUsername.trim()
    : `${countryCode}${whatsappNumber.trim()}`

  const handleCreateOrder = async () => {
    if (!email.trim()) return setError('Email is required')
    if (contactMethod === 'telegram' && !telegramUsername.trim()) return setError('Telegram username is required')
    if (contactMethod === 'whatsapp' && !whatsappNumber.trim()) return setError('WhatsApp number is required')
    setError('')
    setLoading(true)
    try {
      const res = await fetch(`${API}/shop/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          telegramUsername: contactMethod === 'telegram' ? telegramUsername.trim() : `WhatsApp: ${contactInfo}`,
          items: [{ productId: product.id, quantity: 1 }],
          paymentMethod,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create order')
      setOrderId(data.order?.id || data.id)
      setOrderNumber(data.order?.orderNumber || data.orderNumber || '')
      setWalletAddress(data.walletAddress || data.order?.walletAddress || '')
      setExpiresAt(Date.now() + 60 * 60 * 1000) // 1 hour expiry

      // Fetch USD to INR rate for UPI
      if (paymentMethod === 'UPI') {
        try {
          const rateRes = await fetch('https://api.exchangerate-api.com/v4/latest/USD')
          const rateData = await rateRes.json()
          const rate = rateData.rates?.INR || 85
          setInrRate(rate)
          const amountWithMarkup = Math.ceil(product.price * rate * 1.05) // +7%
          setInrAmount(amountWithMarkup)
        } catch {
          const fallbackRate = 85
          setInrRate(fallbackRate)
          setInrAmount(Math.ceil(product.price * fallbackRate * 1.05))
        }
      }

      goToStep(2)
    } catch (err: any) {
      setError(err.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmitTxHash = async () => {
    if (!txHash.trim()) return setError('Transaction hash is required')
    setError('')
    setLoading(true)
    try {
      const res = await fetch(`${API}/shop/orders/${orderId}/txhash`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ txHash: txHash.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to submit')
      goToStep(3)
    } catch (err: any) {
      setError(err.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const handleScreenshotUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setScreenshotFile(file)
    const reader = new FileReader()
    reader.onload = () => setScreenshotPreview(reader.result as string)
    reader.readAsDataURL(file)
  }

  const submitUpiPayment = async () => {
    if (!screenshotFile) return setError('Please upload payment screenshot')
    setError('')
    setLoading(true)
    try {
      // Upload screenshot (public endpoint, no auth needed)
      const formData = new FormData()
      formData.append('file', screenshotFile, screenshotFile.name)
      const uploadRes = await fetch(`${API}/shop/upload-proof`, { method: 'POST', body: formData })
      const uploadData = await uploadRes.json()
      console.log('Upload response:', uploadData)
      if (!uploadData.url) throw new Error(uploadData.error || 'Upload failed')
      const screenshotUrl = uploadData.url

      // Update order with screenshot — mark as PROCESSING (not PAID) for manual verification
      const res = await fetch(`${API}/shop/orders/${orderId}/upi-proof`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ screenshotUrl }),
      })
      if (!res.ok) throw new Error('Failed to submit')
      goToStep(3)
    } catch (err: any) {
      setError(err.message || 'Failed to submit payment proof')
    } finally {
      setLoading(false)
    }
  }

  const checkPaymentStatus = async () => {
    setError('')
    setLoading(true)
    try {
      // Tell backend to check for incoming transactions
      const res = await fetch(`${API}/shop/orders/${orderId}`)
      const data = await res.json()
      if (data.order?.status === 'DELIVERED') {
        goToStep(3)
      } else if (data.order?.status === 'PAID') {
        goToStep(3)
      } else {
        setError('Payment not detected yet. Please wait a few minutes and try again, or enter the transaction hash manually.')
        setShowManualTx(true)
      }
    } catch {
      setError('Could not check payment status. Try again.')
    } finally {
      setLoading(false)
    }
  }

  // Auto-poll for payment detection + countdown timer when on step 2
  useEffect(() => {
    if (step !== 2 || !orderId) return
    let active = true

    const poll = async () => {
      try {
        const res = await fetch(`${API}/shop/orders/${orderId}`)
        const data = await res.json()
        if (!active) return
        if (data.order?.txHash) {
          setDetectedTxHash(data.order.txHash)
        }
        if (data.order?.status === 'PAID' || data.order?.status === 'DELIVERED' || data.order?.status === 'PROCESSING') {
          if (!detectedTxHash) setDetectedTxHash(data.order.txHash || 'confirmed')
          setConfirmations(5)
          // Quick transition: show confirmed, then go to step 3 after 1.5s
          setTimeout(() => { if (active) goToStep(3) }, 1500)
        }
      } catch {}
    }

    poll()
    const pollInterval = setInterval(poll, 8000)

    // Countdown timer
    const timerInterval = setInterval(() => {
      if (!active || !expiresAt) return
      const diff = expiresAt - Date.now()
      if (diff <= 0) {
        setTimeLeft('00:00:00')
      } else {
        const h = Math.floor(diff / 3600000)
        const m = Math.floor((diff % 3600000) / 60000)
        const s = Math.floor((diff % 60000) / 1000)
        setTimeLeft(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`)
      }
    }, 1000)

    return () => { active = false; clearInterval(pollInterval); clearInterval(timerInterval) }
  }, [step, orderId, expiresAt])

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${closing ? 'animate-[fadeOutOverlay_0.25s_ease_forwards]' : 'animate-[fadeInOverlay_0.2s_ease]'}`} onClick={handleClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md" />

      {/* Modal */}
      <div className={`relative w-full max-w-[440px] rounded-2xl overflow-hidden ${closing ? 'animate-[slideDownModal_0.25s_cubic-bezier(0.4,0,1,1)_forwards]' : 'animate-[slideUpModal_0.35s_cubic-bezier(0.16,1,0.3,1)]'}`} onClick={e => e.stopPropagation()}>
        <style>{`
          @keyframes fadeInOverlay { from { opacity: 0; } to { opacity: 1; } }
          @keyframes fadeOutOverlay { from { opacity: 1; } to { opacity: 0; } }
          @keyframes slideUpModal { from { opacity: 0; transform: translateY(30px) scale(0.97); } to { opacity: 1; transform: translateY(0) scale(1); } }
          @keyframes slideDownModal { from { opacity: 1; transform: translateY(0) scale(1); } to { opacity: 0; transform: translateY(30px) scale(0.95); } }
          @keyframes stepSlideInRight { from { opacity: 0; transform: translateX(30px); } to { opacity: 1; transform: translateX(0); } }
          @keyframes stepSlideInLeft { from { opacity: 0; transform: translateX(-30px); } to { opacity: 1; transform: translateX(0); } }
          @keyframes stepFadeOut { from { opacity: 1; } to { opacity: 0; } }
          .step-enter-forward { animation: stepSlideInRight 0.3s cubic-bezier(0.16,1,0.3,1); }
          .step-enter-back { animation: stepSlideInLeft 0.3s cubic-bezier(0.16,1,0.3,1); }
          .step-exit { animation: stepFadeOut 0.15s ease; }
        `}</style>
        {/* Top gradient accent */}
        <div className="h-1 bg-gradient-to-r from-blue-500 via-cyan-400 to-blue-600" />

        <div className="bg-[#0c0c28] border border-white/[0.08] border-t-0 rounded-b-2xl max-h-[85vh] overflow-y-auto">
          {/* Header */}
          <div className="px-6 pt-5 pb-4 border-b border-white/[0.05]">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-white/30 text-[11px] uppercase tracking-widest font-medium mb-1">Checkout</p>
                <h2 className="text-white font-bold text-[15px] leading-snug pr-6">{product.title}</h2>
              </div>
              <button onClick={handleClose} className="mt-1 p-1 rounded-lg hover:bg-white/[0.06] text-white/25 hover:text-white/50 transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="flex items-center gap-3 mt-3">
              <span className="text-2xl font-extrabold text-white">${product.price}</span>
              <span className="text-white/20 text-sm">USDT</span>
            </div>
          </div>

          {/* Step indicator */}
          <div className="px-6 py-3 flex items-center gap-1.5 border-b border-white/[0.04]">
            {['Contact', 'Payment', 'Done'].map((label, i) => (
              <Fragment key={i}>
                <div className={`flex items-center gap-1.5 ${step > i + 1 ? 'text-green-400' : step === i + 1 ? 'text-blue-400' : 'text-white/15'}`}>
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold border ${
                    step > i + 1 ? 'bg-green-500/15 border-green-500/30' : step === i + 1 ? 'bg-blue-500/15 border-blue-500/30' : 'border-white/[0.08]'
                  }`}>
                    {step > i + 1 ? <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg> : i + 1}
                  </div>
                  <span className="text-[11px] font-medium">{label}</span>
                </div>
                {i < 2 && <div className={`flex-1 h-[1px] ${step > i + 1 ? 'bg-green-500/30' : 'bg-white/[0.06]'}`} />}
              </Fragment>
            ))}
          </div>

          {/* Error */}
          {error && (
            <div className="mx-6 mt-4 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-[12px]">{error}</div>
          )}

          {/* Body */}
          <div className="px-6 py-5">
            {/* ═══ STEP 1 ═══ */}
            {step === 1 && (
              <div className={animating ? 'step-exit' : stepDirection === 'forward' ? 'step-enter-forward' : 'step-enter-back'}>
              <div className="space-y-4">
                {/* Email */}
                <div>
                  <label className="block text-white/40 text-[11px] font-semibold uppercase tracking-wider mb-1.5">Email for delivery</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@email.com"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white text-sm placeholder:text-white/15 focus:outline-none focus:border-blue-500/40 transition-colors" />
                </div>

                {/* Contact method selector */}
                <div>
                  <label className="block text-white/40 text-[11px] font-semibold uppercase tracking-wider mb-1.5">Contact method</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => setContactMethod('telegram')}
                      className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                        contactMethod === 'telegram'
                          ? 'border-[#229ED9]/40 bg-[#229ED9]/10 text-[#229ED9]'
                          : 'border-white/[0.06] text-white/30 hover:border-white/[0.12]'
                      }`}>
                      <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>
                      Telegram
                    </button>
                    <button onClick={() => setContactMethod('whatsapp')}
                      className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                        contactMethod === 'whatsapp'
                          ? 'border-[#25D366]/40 bg-[#25D366]/10 text-[#25D366]'
                          : 'border-white/[0.06] text-white/30 hover:border-white/[0.12]'
                      }`}>
                      <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                      WhatsApp
                    </button>
                  </div>
                </div>

                {/* Telegram username */}
                {contactMethod === 'telegram' && (
                  <div>
                    <label className="block text-white/40 text-[11px] font-semibold uppercase tracking-wider mb-1.5">Telegram username</label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/20 text-sm">@</span>
                      <input type="text" value={telegramUsername} onChange={e => setTelegramUsername(e.target.value)} placeholder="username"
                        className="w-full pl-8 pr-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white text-sm placeholder:text-white/15 focus:outline-none focus:border-[#229ED9]/40 transition-colors" />
                    </div>
                  </div>
                )}

                {/* WhatsApp number with country code */}
                {contactMethod === 'whatsapp' && (
                  <div>
                    <label className="block text-white/40 text-[11px] font-semibold uppercase tracking-wider mb-1.5">WhatsApp number</label>
                    <div className="flex gap-2">
                      {/* Country code picker */}
                      <div className="relative">
                        <button
                          ref={countryBtnRef}
                          onClick={() => setShowCountryDropdown(!showCountryDropdown)}
                          className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white text-sm hover:border-white/[0.15] transition-colors min-w-[90px]"
                        >
                          <span className="text-white/60">{countryCode}</span>
                          <svg className={`w-3 h-3 text-white/20 transition-transform ${showCountryDropdown ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                        </button>
                        {showCountryDropdown && typeof document !== 'undefined' && createPortal(
                          <div
                            className="fixed inset-0 z-[200]"
                            onClick={() => setShowCountryDropdown(false)}
                          >
                            <div
                              className="absolute w-72 max-h-64 overflow-y-auto rounded-xl bg-[#12123a] border border-white/[0.12] shadow-2xl"
                              style={{
                                top: (countryBtnRef.current?.getBoundingClientRect().bottom ?? 0) + 4,
                                left: countryBtnRef.current?.getBoundingClientRect().left ?? 0,
                              }}
                              onClick={e => e.stopPropagation()}
                            >
                              <div className="sticky top-0 p-2 bg-[#12123a] border-b border-white/[0.06]">
                                <input type="text" value={countrySearch} onChange={e => setCountrySearch(e.target.value)} placeholder="Search country..."
                                  className="w-full px-3 py-1.5 rounded-lg bg-white/[0.05] border border-white/[0.08] text-white text-xs placeholder:text-white/20 focus:outline-none" autoFocus />
                              </div>
                              {filteredCodes.map(c => (
                                <button key={c.code} onClick={() => { setCountryCode(c.code); setShowCountryDropdown(false); setCountrySearch('') }}
                                  className={`w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-white/[0.04] transition-colors ${countryCode === c.code ? 'bg-blue-500/10 text-blue-400' : 'text-white/60'}`}>
                                  <span className="text-white/30 w-10 text-right font-mono">{c.code}</span>
                                  <span className="truncate">{c.country}</span>
                                </button>
                              ))}
                            </div>
                          </div>,
                          document.body
                        )}
                      </div>
                      {/* Number input */}
                      <input type="tel" value={whatsappNumber} onChange={e => setWhatsappNumber(e.target.value.replace(/\D/g, ''))} placeholder="Phone number"
                        className="flex-1 px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white text-sm placeholder:text-white/15 focus:outline-none focus:border-[#25D366]/40 transition-colors" />
                    </div>
                  </div>
                )}

                {/* Payment method */}
                <div>
                  <label className="block text-white/40 text-[11px] font-semibold uppercase tracking-wider mb-2">Payment method</label>
                  <div className="flex flex-col gap-1.5">
                    {([
                      { id: 'USDT_BEP20' as const, name: 'USDT (BEP20)', desc: 'BSC Network — Fast confirmation — Low fee', icon: <img src="https://storage.cryptomus.com/currencies/USDT.svg" alt="USDT BEP20" className="w-5 h-5" />, color: '#F3BA2F', badge: 'Auto Delivery', badgeColor: 'bg-green-500/15 text-green-400 border-green-500/20' },
                      { id: 'USDT_TRC20' as const, name: 'USDT (TRC20)', desc: 'Tron Network — Low fees', icon: <img src="https://storage.cryptomus.com/currencies/USDT.svg" alt="USDT" className="w-5 h-5" />, color: '#26A17B', badge: 'Auto Delivery', badgeColor: 'bg-green-500/15 text-green-400 border-green-500/20' },
                      { id: 'UPI' as const, name: 'UPI / Bank Transfer', desc: 'India — INR payment', icon: <img src="https://pub-ab628c238a58431a980c671b4352cc87.r2.dev/shop/upi-logo.png" alt="UPI" className="w-5 h-5 object-contain rounded bg-white p-[3px]" />, color: '#5F259F', badge: 'Manual Delivery', badgeColor: 'bg-amber-500/15 text-amber-400 border-amber-500/20' },
                    ] as const).map(method => (
                      <button key={method.id} onClick={() => setPaymentMethod(method.id)}
                        className={`flex items-center gap-3 px-3.5 py-3 rounded-xl border transition-all text-left ${
                          paymentMethod === method.id
                            ? 'border-blue-500/40 bg-blue-500/[0.08]'
                            : 'border-white/[0.06] hover:border-white/[0.1] bg-white/[0.02]'
                        }`}>
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${paymentMethod === method.id ? 'bg-white/[0.08]' : 'bg-white/[0.03]'}`}
                          style={{ border: `1px solid ${paymentMethod === method.id ? method.color + '40' : 'rgba(255,255,255,0.06)'}` }}>
                          {method.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className={`text-sm font-semibold ${paymentMethod === method.id ? 'text-white' : 'text-white/50'}`}>{method.name}</p>
                            <span className={`text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${method.badgeColor}`}>{method.badge}</span>
                          </div>
                          <p className={`text-[10px] ${paymentMethod === method.id ? 'text-white/30' : 'text-white/15'}`}>{method.desc}</p>
                        </div>
                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                          paymentMethod === method.id ? 'border-blue-500' : 'border-white/15'
                        }`}>
                          {paymentMethod === method.id && <div className="w-2 h-2 rounded-full bg-blue-500" />}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <button onClick={handleCreateOrder} disabled={loading}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-bold text-sm transition-all disabled:opacity-50 shadow-lg shadow-blue-600/20">
                  {loading ? 'Creating Order...' : 'Continue to Payment'}
                </button>
              </div>
              </div>
            )}

            {/* ═══ STEP 2 — UPI Payment ═══ */}
            {step === 2 && paymentMethod === 'UPI' && (
              <div className={animating ? 'step-exit' : stepDirection === 'forward' ? 'step-enter-forward' : 'step-enter-back'}>
              <div className="space-y-3">
                {/* Amount in INR */}
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-extrabold text-white">{inrAmount ? `₹${inrAmount.toLocaleString()}` : 'Calculating...'}</span>
                    </div>
                    <p className="text-white/25 text-[10px] mt-0.5">
                      ${product.price} USD × ₹{inrRate.toFixed(1)} + 5% = <span className="text-white/40">₹{inrAmount.toLocaleString()}</span>
                    </p>
                  </div>
                  <button onClick={() => goToStep(1)} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06] text-white/30 hover:text-white/60 hover:border-white/[0.12] transition-all text-[10px] font-medium">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" /></svg>
                    Change
                  </button>
                </div>

                {/* UPI ID card */}
                <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <img src="https://pub-ab628c238a58431a980c671b4352cc87.r2.dev/shop/upi-logo.png" alt="UPI" className="w-8 h-8 object-contain rounded-lg bg-white p-1" />
                    <div>
                      <p className="text-white/30 text-[10px] uppercase tracking-wider font-medium">Pay to UPI ID</p>
                      <div className="flex items-center gap-1.5">
                        <code className="text-sm text-white/80 font-mono font-semibold">{walletAddress}</code>
                        <button onClick={() => copyToClipboard(walletAddress)} className={`transition-colors ${copied ? 'text-green-400' : 'text-white/20 hover:text-blue-400'}`}>
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Instructions */}
                  <div className="space-y-2 text-[11px] text-white/30">
                    <div className="flex items-start gap-2">
                      <span className="w-4 h-4 rounded-full bg-blue-500/15 text-blue-400 text-[9px] font-bold flex items-center justify-center shrink-0 mt-0.5">1</span>
                      <span>Open any UPI app (GPay, PhonePe, Paytm, etc.)</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="w-4 h-4 rounded-full bg-blue-500/15 text-blue-400 text-[9px] font-bold flex items-center justify-center shrink-0 mt-0.5">2</span>
                      <span>Send exactly <span className="text-white/60 font-bold">₹{inrAmount.toLocaleString()}</span> to the UPI ID above</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="w-4 h-4 rounded-full bg-blue-500/15 text-blue-400 text-[9px] font-bold flex items-center justify-center shrink-0 mt-0.5">3</span>
                      <span>Take a screenshot of the payment confirmation</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="w-4 h-4 rounded-full bg-blue-500/15 text-blue-400 text-[9px] font-bold flex items-center justify-center shrink-0 mt-0.5">4</span>
                      <span>Upload the screenshot below and submit</span>
                    </div>
                  </div>
                </div>

                {/* Screenshot upload */}
                <div>
                  <label className="block text-white/40 text-[11px] font-semibold uppercase tracking-wider mb-1.5">Payment Screenshot</label>
                  <div
                    onClick={() => document.getElementById('upi-screenshot-input')?.click()}
                    className="relative w-full rounded-xl border-2 border-dashed border-white/[0.08] hover:border-blue-500/30 bg-white/[0.02] flex flex-col items-center justify-center cursor-pointer transition-colors overflow-hidden"
                    style={{ minHeight: screenshotPreview ? 'auto' : '100px' }}
                  >
                    {screenshotPreview ? (
                      <>
                        <img src={screenshotPreview} alt="Screenshot" className="w-full max-h-[200px] object-contain" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                          <span className="text-white text-xs font-medium">Change Screenshot</span>
                        </div>
                      </>
                    ) : (
                      <div className="py-6 text-center">
                        <svg className="w-8 h-8 text-white/15 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" /></svg>
                        <p className="text-white/25 text-xs">Tap to upload screenshot</p>
                      </div>
                    )}
                    <input id="upi-screenshot-input" type="file" accept="image/*" onChange={handleScreenshotUpload} className="hidden" />
                  </div>
                </div>

                <button onClick={submitUpiPayment} disabled={loading || !screenshotFile}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-bold text-sm transition-all disabled:opacity-30 shadow-lg shadow-blue-600/20">
                  {loading ? 'Submitting...' : 'Submit Payment Proof'}
                </button>

                <p className="text-white/15 text-[9px] text-center">Manual verification — delivery within 15-30 minutes after confirmation</p>
              </div>
              </div>
            )}

            {/* ═══ STEP 2 — Crypto Payment Gateway ═══ */}
            {step === 2 && paymentMethod !== 'UPI' && (
              <div className={animating ? 'step-exit' : stepDirection === 'forward' ? 'step-enter-forward' : 'step-enter-back'}>
              <div className="space-y-3">
                {/* Amount + Network header */}
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-extrabold text-white">{product.price} USDT</span>
                      <button onClick={() => copyToClipboard(String(product.price))} className="text-white/20 hover:text-white/50 transition-colors">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                      </button>
                    </div>
                    <p className="text-white/30 text-xs mt-0.5">
                      Network · <span className="text-white/50 font-semibold">{paymentMethod === 'USDT_TRC20' ? 'TRC20' : paymentMethod === 'USDT_BEP20' ? 'BSC' : 'UPI'}</span>
                    </p>
                  </div>
                  <button onClick={() => goToStep(1)} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06] text-white/30 hover:text-white/60 hover:border-white/[0.12] transition-all text-[10px] font-medium">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" /></svg>
                    Change
                  </button>
                </div>

                {/* QR + Address card */}
                <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4">
                  <div className="flex items-start gap-4">
                    {/* QR Code */}
                    {walletAddress && walletAddress !== 'WALLET_NOT_SET' && (
                      <div className="shrink-0 p-2 bg-white rounded-xl">
                        <img
                          src={`https://quickchart.io/qr?text=${encodeURIComponent(walletAddress)}&size=150&centerImageUrl=${encodeURIComponent('https://pub-ab628c238a58431a980c671b4352cc87.r2.dev/shop/ads360-icon.png')}&centerImageSizeRatio=0.2&margin=1&ecLevel=H`}
                          alt="QR Code"
                          className="w-[100px] h-[100px]"
                          onError={(e) => { (e.target as HTMLImageElement).src = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(walletAddress)}&margin=3&ecc=H` }}
                        />
                      </div>
                    )}
                    {/* Address info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-white/30 text-[10px] uppercase tracking-wider font-medium mb-1">Recipient's wallet address</p>
                      <div className="flex items-center gap-1.5 mb-2">
                        <code className="text-[10px] text-cyan-300/80 font-mono truncate">{walletAddress || 'Loading...'}</code>
                        <button onClick={() => copyToClipboard(walletAddress)} className={`shrink-0 transition-colors ${copied ? 'text-green-400' : 'text-white/20 hover:text-blue-400'}`}>
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                        </button>
                      </div>
                      <p className="text-white/15 text-[10px] leading-relaxed mb-2">
                        Payment will be detected automatically once confirmed on the blockchain.
                      </p>

                      {/* Transaction status — inline */}
                      {!detectedTxHash ? (
                        <div className="flex items-center gap-1.5">
                          <div className="w-3 h-3 rounded-full border-[1.5px] border-blue-400/30 border-t-blue-400 animate-spin shrink-0" />
                          <p className="text-blue-400/50 text-[10px]">Scanning...</p>
                        </div>
                      ) : confirmations < 5 ? (
                        <div>
                          <div className="flex items-center gap-1.5 mb-1">
                            <div className="w-3 h-3 rounded-full border-[1.5px] border-amber-400/30 border-t-amber-400 animate-spin shrink-0" />
                            <p className="text-amber-400 text-[10px] font-semibold">Tx found — confirming...</p>
                          </div>
                          <code className="text-[8px] text-amber-300/30 font-mono break-all">{detectedTxHash}</code>
                        </div>
                      ) : (
                        <div>
                          <div className="flex items-center gap-1.5 mb-1">
                            <svg className="w-3 h-3 text-green-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                            <p className="text-green-400 text-[10px] font-semibold">Payment confirmed!</p>
                          </div>
                          <code className="text-[8px] text-green-300/30 font-mono break-all">{detectedTxHash}</code>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Expiration + Confirmations row */}
                <div className="grid grid-cols-2 gap-2">
                  {/* Expiration timer */}
                  <div className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-3">
                    <div className="flex items-center gap-2.5">
                      {/* Circular timer */}
                      <div className="relative w-10 h-10 shrink-0">
                        <svg className="w-10 h-10 -rotate-90" viewBox="0 0 40 40">
                          <circle cx="20" cy="20" r="17" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="2.5" />
                          <circle cx="20" cy="20" r="17" fill="none" stroke={timeLeft === '00:00:00' ? '#ef4444' : '#22c55e'} strokeWidth="2.5" strokeDasharray={`${2 * Math.PI * 17}`}
                            strokeDashoffset={`${2 * Math.PI * 17 * (1 - (expiresAt ? Math.max(0, (expiresAt - Date.now()) / 3600000) : 1))}`}
                            strokeLinecap="round" className="transition-all duration-1000" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-white/30 text-[9px] uppercase tracking-wider">Expiration</p>
                        <p className={`text-sm font-bold font-mono ${timeLeft === '00:00:00' ? 'text-red-400' : 'text-green-400'}`}>{timeLeft || '01:00:00'}</p>
                      </div>
                    </div>
                  </div>

                  {/* Confirmations */}
                  <div className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-3">
                    <div className="flex items-center gap-2.5">
                      <div className="relative w-10 h-10 shrink-0">
                        <svg className="w-10 h-10 -rotate-90" viewBox="0 0 40 40">
                          <circle cx="20" cy="20" r="17" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="2.5" />
                          <circle cx="20" cy="20" r="17" fill="none" stroke={confirmations >= 5 ? '#22c55e' : '#3b82f6'} strokeWidth="2.5"
                            strokeDasharray={`${2 * Math.PI * 17}`}
                            strokeDashoffset={`${2 * Math.PI * 17 * (1 - confirmations / 5)}`}
                            strokeLinecap="round" className="transition-all duration-500" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-white/30 text-[9px] uppercase tracking-wider">Confirmations</p>
                        <p className={`text-sm font-bold ${confirmations >= 5 ? 'text-green-400' : 'text-blue-400'}`}>{confirmations} from 5</p>
                      </div>
                    </div>
                  </div>
                </div>

              </div>
              </div>
            )}

            {/* ═══ STEP 3 ═══ */}
            {step === 3 && (
              <div className={animating ? 'step-exit' : 'step-enter-forward'}>
              <div className="text-center py-4">
                <div className="w-16 h-16 rounded-2xl bg-green-500/10 border border-green-500/20 flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                </div>
                <h3 className="text-lg font-bold text-white mb-1">Order Submitted</h3>
                {orderNumber && (
                  <p className="text-white/30 text-sm font-mono mb-3">#{orderNumber}</p>
                )}
                <p className="text-white/25 text-[13px] leading-relaxed mb-5 max-w-xs mx-auto">
                  Your payment is being verified. You'll receive delivery details via {contactMethod === 'telegram' ? 'Telegram' : 'WhatsApp'} and email once confirmed.
                </p>
                <button onClick={handleClose}
                  className="px-6 py-2.5 rounded-xl border border-white/[0.08] text-white/50 hover:text-white hover:border-white/[0.15] text-sm font-medium transition-colors">
                  Close
                </button>
              </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
