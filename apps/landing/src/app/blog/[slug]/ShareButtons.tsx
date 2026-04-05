'use client'

import { useState } from 'react'

export function ShareButtons({ title, url }: { title: string; url: string }) {
  const [copied, setCopied] = useState(false)

  const copy = () => {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const encoded = encodeURIComponent(url)
  const encodedTitle = encodeURIComponent(title)

  const socials = [
    { name: 'Copy Link', color: '#34d399', href: '', icon: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg> },
    { name: 'Share on LinkedIn', color: '#0077b5', href: `https://www.linkedin.com/sharing/share-offsite/?url=${encoded}`, icon: <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg> },
    { name: 'Share on X', color: '#e2e8f0', href: `https://twitter.com/intent/tweet?text=${encodedTitle}&url=${encoded}`, icon: <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.742l7.733-8.835L1.254 2.25H8.08l4.253 5.622 5.911-5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg> },
    { name: 'Share on Facebook', color: '#1877f2', href: `https://www.facebook.com/sharer/sharer.php?u=${encoded}`, icon: <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg> },
  ]

  return (
    <div className="space-y-4">
      {/* Share — floating pill buttons */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/20 mb-2.5 px-1">Share</p>
        <div className="space-y-1.5">
          {socials.map(s => {
            const inner = (
              <div className="w-full flex items-center gap-2.5 px-3.5 py-2 rounded-full text-left hover:scale-[1.02] transition-all"
                style={{ background: `${s.color}08`, border: `1px solid ${s.color}18`, color: s.color }}>
                <span className="opacity-60">{s.icon}</span>
                <span className="text-[11.5px] font-medium opacity-60">{s.name}</span>
                {s.name === 'Copy Link' && copied && (
                  <span className="ml-auto text-[9px] font-bold opacity-90 bg-emerald-500/15 px-2 py-0.5 rounded-full">Copied!</span>
                )}
              </div>
            )

            if (!s.href) {
              return <button key={s.name} onClick={copy} className="w-full">{inner}</button>
            }
            return <a key={s.name} href={s.href} target="_blank" rel="noopener noreferrer" className="block">{inner}</a>
          })}
        </div>
      </div>

      {/* CTA — floating gradient border */}
      <div className="relative rounded-2xl overflow-hidden">
        {/* Gradient border */}
        <div className="absolute inset-0 rounded-2xl p-[1px]">
          <div className="absolute inset-0 rounded-2xl" style={{ background: 'linear-gradient(135deg, rgba(59,130,246,0.4), rgba(139,92,246,0.4), rgba(59,130,246,0.2))' }} />
        </div>
        <div className="relative rounded-2xl m-[1px]" style={{ background: 'linear-gradient(145deg, #0c1629, #0f0f2d)' }}>
          <div className="p-5">
            {/* Stats row */}
            <div className="grid grid-cols-3 gap-2 mb-5">
              {[
                { val: '450+', label: 'Clients' },
                { val: '99.9%', label: 'Uptime' },
                { val: '<5min', label: 'Setup' },
              ].map(s => (
                <div key={s.label} className="text-center py-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)' }}>
                  <p className="text-[14px] font-bold text-blue-400">{s.val}</p>
                  <p className="text-[9px] text-white/25 uppercase tracking-wider">{s.label}</p>
                </div>
              ))}
            </div>

            <p className="text-[14px] font-bold text-white text-center mb-1">Scale Without Limits</p>
            <p className="text-[11px] text-white/30 text-center mb-4">Premium agency ad accounts for Facebook, Google, TikTok & more</p>

            <div className="space-y-2 mb-5">
              {[
                'Ban-proof agency accounts',
                'Unlimited spending capacity',
                'Lower CPM rates guaranteed',
                '24/7 dedicated support',
              ].map(text => (
                <div key={text} className="flex items-center gap-2 text-[11.5px] text-white/45">
                  <svg className="w-3.5 h-3.5 text-blue-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                  {text}
                </div>
              ))}
            </div>

            <a href="/#contact" className="block w-full text-center py-3 rounded-xl text-[13px] font-bold text-white transition-all hover:shadow-[0_0_25px_rgba(59,130,246,0.4)]"
              style={{ background: 'linear-gradient(135deg, #3b82f6, #7c3aed)', boxShadow: '0 4px 20px rgba(59,130,246,0.3)' }}>
              Get Ad Account →
            </a>

            <div className="flex items-center justify-center gap-2 mt-3">
              <div className="flex -space-x-1.5">
                {['/arjun-thakur.jpg', '/nikhil-kumar.jpg', '/rohit-mehta.jpg'].map((src, i) => (
                  <img key={i} src={src} alt="" className="w-5 h-5 rounded-full border-2 border-[#0c1629] object-cover" />
                ))}
              </div>
              <div className="flex gap-0.5">
                {[1,2,3,4,5].map(i => (
                  <svg key={i} className="w-2.5 h-2.5 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
                  </svg>
                ))}
              </div>
              <span className="text-[9px] text-white/20">4.9/5</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
