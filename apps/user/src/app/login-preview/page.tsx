'use client'

import { useState } from 'react'
import { Shield, ArrowRight, Mail, Lock, Eye, Award, TrendingUp, Users, Zap, CheckCircle2, Star, Globe, Sparkles } from 'lucide-react'

// Platform icons
const FacebookIcon = () => (
  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
  </svg>
)
const GoogleIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
)
const TikTokIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/>
  </svg>
)
const SnapchatIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12.206.793c.99 0 4.347.276 5.93 3.821.529 1.193.403 3.219.299 4.847l-.003.06c-.012.18-.022.345-.03.51.075.045.203.09.401.09.3-.016.659-.12 1.033-.301.129-.06.264-.09.399-.09.198 0 .396.06.557.174.264.135.39.345.39.585 0 .196-.076.375-.21.515-.15.135-.39.27-.795.39-.06.016-.12.03-.18.045-.165.045-.345.09-.51.135-.075.016-.15.045-.225.075-.15.06-.255.135-.3.225-.045.105-.045.225 0 .36.09.195.18.39.285.585.12.24.375.705.66 1.125.36.54.78.99 1.245 1.35.27.195.54.36.81.495.15.075.27.15.375.225.27.165.42.39.435.6.03.21-.075.435-.285.615a1.665 1.665 0 0 1-.765.345c-.255.06-.54.09-.84.12-.225.015-.45.045-.675.105-.15.045-.285.12-.405.21-.21.165-.315.33-.315.465 0 .27.135.54.39.81.255.27.39.585.345.885-.045.405-.345.72-.735.84-.21.06-.435.09-.66.09-.21 0-.405-.03-.585-.075a4.065 4.065 0 0 0-.675-.12c-.345-.03-.69.015-1.035.09-.255.06-.51.135-.765.225l-.09.03c-.255.09-.54.18-.84.255a4.62 4.62 0 0 1-1.095.135c-1.5 0-2.835-.675-3.705-1.74-.87-1.065-1.275-2.475-1.275-3.885 0-.5.045-1 .135-1.49-.87-.18-1.665-.57-2.34-1.14-.675-.57-1.2-1.305-1.5-2.16-.3-.855-.36-1.785-.18-2.67.18-.885.6-1.71 1.2-2.37.6-.66 1.35-1.14 2.19-1.38.84-.24 1.725-.24 2.565 0 .06.015.12.03.18.06V.793z"/>
  </svg>
)
const BingIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24">
    <path fill="#008373" d="M5 3v16.5l4.5 2.5 8-4.5v-4L9.5 10V5.5L5 3z"/>
    <path fill="#00A99D" d="M9.5 5.5V10l8 3.5v4l-8 4.5L5 19.5V3l4.5 2.5z"/>
  </svg>
)

const platforms = [
  { name: 'Facebook', icon: <FacebookIcon /> },
  { name: 'Google', icon: <GoogleIcon /> },
  { name: 'TikTok', icon: <TikTokIcon /> },
  { name: 'Snapchat', icon: <SnapchatIcon /> },
  { name: 'Bing', icon: <BingIcon /> },
]

// Six Media Logo
const SixMediaLogo = ({ size = 'small' }: { size?: 'small' | 'normal' }) => {
  const iconW = size === 'small' ? 'w-11' : 'w-14'
  const iconH = size === 'small' ? 'h-6' : 'h-8'
  const textSize = size === 'small' ? 'text-[17px]' : 'text-[22px]'
  const tagSize = size === 'small' ? 'text-[8px]' : 'text-[9px]'
  return (
    <div className={`flex items-center ${size === 'small' ? 'gap-2' : 'gap-3'}`}>
      <svg viewBox="0 0 48 28" className={`${iconW} ${iconH}`} fill="none">
        <defs>
          <linearGradient id={`prev${size}1`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#6366F1"/><stop offset="100%" stopColor="#8B5CF6"/>
          </linearGradient>
          <linearGradient id={`prev${size}2`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#8B5CF6"/><stop offset="100%" stopColor="#EC4899"/>
          </linearGradient>
        </defs>
        <path d="M4 14 C4 6, 10 2, 18 8 C22 11, 24 14, 24 14 C24 14, 22 17, 18 20 C10 26, 4 22, 4 14" fill={`url(#prev${size}1)`}/>
        <path d="M44 14 C44 6, 38 2, 30 8 C26 11, 24 14, 24 14 C24 14, 26 17, 30 20 C38 26, 44 22, 44 14" fill={`url(#prev${size}2)`}/>
        <ellipse cx="24" cy="14" rx="4" ry="5" fill="white" opacity="0.15"/>
      </svg>
      <div className="flex flex-col leading-none">
        <span className={`${textSize} font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 bg-clip-text text-transparent tracking-tight`}>SIXMEDIA</span>
        <span className={`${tagSize} font-semibold tracking-[0.2em] text-gray-400 mt-0.5`}>ADVERTISING</span>
      </div>
    </div>
  )
}

// White logo for dark backgrounds
const SixMediaLogoWhite = () => (
  <div className="flex items-center gap-2">
    <svg viewBox="0 0 48 28" className="w-11 h-6" fill="none">
      <path d="M4 14 C4 6, 10 2, 18 8 C22 11, 24 14, 24 14 C24 14, 22 17, 18 20 C10 26, 4 22, 4 14" fill="white" opacity="0.9"/>
      <path d="M44 14 C44 6, 38 2, 30 8 C26 11, 24 14, 24 14 C24 14, 26 17, 30 20 C38 26, 44 22, 44 14" fill="white" opacity="0.7"/>
      <ellipse cx="24" cy="14" rx="4" ry="5" fill="white" opacity="0.15"/>
    </svg>
    <div className="flex flex-col leading-none">
      <span className="text-[17px] font-bold text-white tracking-tight">SIXMEDIA</span>
      <span className="text-[8px] font-semibold tracking-[0.2em] text-white/60 mt-0.5">ADVERTISING</span>
    </div>
  </div>
)

// Shared form component
const LoginForm = () => (
  <div className="space-y-5">
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">Email or Username</label>
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          <Mail className="h-5 w-5 text-gray-400" />
        </div>
        <input type="text" placeholder="Enter your email" defaultValue="demo_user" className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:bg-white focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all" />
      </div>
    </div>
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          <Lock className="h-5 w-5 text-gray-400" />
        </div>
        <input type="password" defaultValue="12345678" className="w-full pl-12 pr-12 py-3.5 bg-gray-50 border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:bg-white focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all" />
        <button type="button" className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400">
          <Eye className="h-5 w-5" />
        </button>
      </div>
    </div>
    <button className="w-full py-4 px-4 bg-gradient-to-r from-purple-600 to-purple-500 text-white font-semibold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-purple-500/25 group">
      Sign In <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
    </button>
  </div>
)

// ============================================
// VARIATION A: Original Reference (Ecom|Black style)
// ============================================
const VariationA = () => (
  <div className="w-[375px] h-[812px] bg-white rounded-3xl overflow-hidden shadow-2xl border border-gray-200 flex flex-col relative">
    {/* Logo Pill */}
    <div className="relative z-20 flex justify-center -mb-6 pt-4">
      <div className="bg-white rounded-full px-5 py-2.5 shadow-lg border border-gray-100">
        <SixMediaLogo size="small" />
      </div>
    </div>
    {/* Gradient Hero */}
    <div className="relative bg-gradient-to-br from-purple-700 via-purple-600 to-indigo-600 px-6 pt-12 pb-14 overflow-hidden">
      {/* Particles */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="particle p1" /><div className="particle p2" /><div className="particle p3" />
        <div className="particle p4" /><div className="particle p5" /><div className="particle p6" />
      </div>
      {/* Orbit Rings */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-[200px] h-[200px] rounded-full border border-white/10 pulse-ring" />
        <div className="absolute w-[300px] h-[300px] rounded-full border border-white/[0.05]" />
      </div>
      <div className="relative z-10 text-center">
        <h2 className="text-2xl font-bold text-white mb-1">SIXMEDIA</h2>
        <p className="text-purple-200 text-sm mb-5">Premium Ad Accounts Platform</p>
        {/* Stat Badges */}
        <div className="flex justify-center gap-2 mb-5">
          <div className="bg-white/15 backdrop-blur-sm rounded-xl px-3 py-2 border border-white/20">
            <div className="flex items-center gap-1.5 mb-0.5">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-300" />
              <span className="text-white font-bold text-sm">$2.5M+</span>
            </div>
            <p className="text-purple-200 text-[10px]">Ad Spend</p>
          </div>
          <div className="bg-white/15 backdrop-blur-sm rounded-xl px-3 py-2 border border-white/20">
            <div className="flex items-center gap-1.5 mb-0.5">
              <Users className="w-3.5 h-3.5 text-blue-300" />
              <span className="text-white font-bold text-sm">10K+</span>
            </div>
            <p className="text-purple-200 text-[10px]">Advertisers</p>
          </div>
          <div className="bg-white/15 backdrop-blur-sm rounded-xl px-3 py-2 border border-white/20">
            <div className="flex items-center gap-1.5 mb-0.5">
              <Award className="w-3.5 h-3.5 text-yellow-300" />
              <span className="text-white font-bold text-sm">500+</span>
            </div>
            <p className="text-purple-200 text-[10px]">FB Accounts</p>
          </div>
        </div>
        {/* Platform Carousel */}
        <div className="flex justify-center">
          <div className="overflow-hidden" style={{ maxWidth: '260px' }}>
            <div className="flex items-center gap-2.5 carousel-slide">
              {[...platforms, ...platforms].map((p, i) => (
                <div key={i} className="w-9 h-9 rounded-xl bg-white/15 backdrop-blur-sm border border-white/20 flex items-center justify-center flex-shrink-0">
                  <div className="brightness-0 invert opacity-90">{p.icon}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
    {/* Form */}
    <div className="flex-1 bg-white -mt-6 rounded-t-3xl relative z-10 p-6 overflow-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Welcome back!</h1>
      <p className="text-gray-500 mb-6 text-sm">Sign in to access your account</p>
      <LoginForm />
      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200" /></div>
        <div className="relative flex justify-center text-sm"><span className="px-4 bg-white text-gray-400">Secure login</span></div>
      </div>
      <div className="flex items-center justify-center gap-6">
        <div className="flex items-center gap-2 text-gray-500"><Shield className="w-4 h-4 text-emerald-500" /><span className="text-xs">SSL Encrypted</span></div>
        <div className="flex items-center gap-2 text-gray-500"><Zap className="w-4 h-4 text-purple-500" /><span className="text-xs">2FA Protected</span></div>
      </div>
    </div>
  </div>
)

// ============================================
// VARIATION B: Dark Theme with Glow
// ============================================
const VariationB = () => (
  <div className="w-[375px] h-[812px] bg-[#0F0F1A] rounded-3xl overflow-hidden shadow-2xl border border-gray-800 flex flex-col relative">
    {/* Top gradient glow */}
    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[300px] h-[300px] bg-purple-600/30 rounded-full blur-[100px]" />
    <div className="absolute top-20 right-0 w-[150px] h-[150px] bg-pink-500/20 rounded-full blur-[80px]" />

    {/* Hero Content */}
    <div className="relative z-10 px-6 pt-8 pb-6 text-center">
      {/* Logo */}
      <div className="flex justify-center mb-6">
        <div className="bg-white/10 backdrop-blur-md rounded-2xl px-5 py-3 border border-white/10">
          <SixMediaLogoWhite />
        </div>
      </div>
      <h2 className="text-3xl font-bold text-white mb-2">Welcome Back</h2>
      <p className="text-gray-400 text-sm mb-6">Sign in to your premium ad platform</p>

      {/* Stats Row */}
      <div className="flex justify-center gap-3 mb-6">
        <div className="text-center">
          <p className="text-xl font-bold text-white">$2.5M+</p>
          <p className="text-gray-500 text-[10px] uppercase tracking-wider">Ad Spend</p>
        </div>
        <div className="w-px bg-gray-700" />
        <div className="text-center">
          <p className="text-xl font-bold text-white">10K+</p>
          <p className="text-gray-500 text-[10px] uppercase tracking-wider">Users</p>
        </div>
        <div className="w-px bg-gray-700" />
        <div className="text-center">
          <p className="text-xl font-bold text-white">500+</p>
          <p className="text-gray-500 text-[10px] uppercase tracking-wider">Accounts</p>
        </div>
      </div>

      {/* Platform icons */}
      <div className="flex justify-center gap-2 mb-4">
        {platforms.map((p, i) => (
          <div key={i} className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center glow-icon">
            <div className="brightness-0 invert opacity-80">{p.icon}</div>
          </div>
        ))}
      </div>
    </div>

    {/* Form Card */}
    <div className="flex-1 bg-white rounded-t-3xl relative z-10 p-6 overflow-auto">
      <LoginForm />
      <div className="flex items-center justify-center gap-6 mt-6">
        <div className="flex items-center gap-2 text-gray-500"><Shield className="w-4 h-4 text-emerald-500" /><span className="text-xs">SSL Encrypted</span></div>
        <div className="flex items-center gap-2 text-gray-500"><Zap className="w-4 h-4 text-purple-500" /><span className="text-xs">2FA Protected</span></div>
      </div>
    </div>
  </div>
)

// ============================================
// VARIATION C: Split Card with Wave
// ============================================
const VariationC = () => (
  <div className="w-[375px] h-[812px] bg-gray-50 rounded-3xl overflow-hidden shadow-2xl border border-gray-200 flex flex-col relative">
    {/* Hero with wave bottom */}
    <div className="relative bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 px-6 pt-8 pb-20 overflow-hidden">
      {/* Animated circles */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full border-2 border-white/10 orbit-ring" />
        <div className="absolute bottom-5 -left-10 w-32 h-32 rounded-full border border-white/10 orbit-ring-reverse" />
        <div className="particle p1" /><div className="particle p2" /><div className="particle p3" />
        <div className="particle p4" /><div className="particle p5" />
      </div>

      <div className="relative z-10 text-center">
        {/* Logo */}
        <div className="flex justify-center mb-4">
          <SixMediaLogoWhite />
        </div>
        <p className="text-white/70 text-xs uppercase tracking-[0.2em] mb-3">Premium Ad Account Platform</p>

        {/* Stats */}
        <div className="flex justify-center gap-2">
          <div className="bg-white/20 backdrop-blur-sm rounded-full px-3 py-1.5 flex items-center gap-1.5">
            <div className="w-5 h-5 rounded-full bg-emerald-400 flex items-center justify-center"><CheckCircle2 className="w-3 h-3 text-white" /></div>
            <span className="text-white text-xs font-semibold">10K+ Users</span>
          </div>
          <div className="bg-white/20 backdrop-blur-sm rounded-full px-3 py-1.5 flex items-center gap-1.5">
            <div className="w-5 h-5 rounded-full bg-yellow-400 flex items-center justify-center"><Star className="w-3 h-3 text-white" /></div>
            <span className="text-white text-xs font-semibold">4.9 Rating</span>
          </div>
        </div>
      </div>

      {/* Wave SVG */}
      <div className="absolute bottom-0 left-0 right-0">
        <svg viewBox="0 0 375 40" className="w-full" preserveAspectRatio="none">
          <path d="M0 20 Q93 0 187 20 Q281 40 375 20 L375 40 L0 40 Z" fill="#F9FAFB" />
        </svg>
      </div>
    </div>

    {/* Form */}
    <div className="flex-1 px-6 pb-6 -mt-2 relative z-10 overflow-auto">
      {/* Platform icons */}
      <div className="flex justify-center gap-2 mb-6">
        {platforms.map((p, i) => (
          <div key={i} className="w-10 h-10 rounded-xl bg-white border border-gray-200 shadow-sm flex items-center justify-center hover:shadow-md transition-shadow">
            {p.icon}
          </div>
        ))}
      </div>

      <h1 className="text-2xl font-bold text-gray-900 mb-1 text-center">Welcome back!</h1>
      <p className="text-gray-500 mb-6 text-sm text-center">Sign in to manage your ad accounts</p>
      <LoginForm />
      <p className="text-center text-[10px] text-gray-400 mt-4">By signing in, you agree to our Terms of Service</p>
    </div>
  </div>
)

// ============================================
// VARIATION D: Minimal Gradient Top Bar
// ============================================
const VariationD = () => (
  <div className="w-[375px] h-[812px] bg-white rounded-3xl overflow-hidden shadow-2xl border border-gray-200 flex flex-col relative">
    {/* Compact gradient bar */}
    <div className="relative bg-gradient-to-r from-purple-700 via-violet-600 to-indigo-600 px-6 pt-6 pb-10 overflow-hidden">
      {/* Particles */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="particle p1" /><div className="particle p2" /><div className="particle p3" /><div className="particle p4" />
      </div>
      <div className="relative z-10 flex items-center justify-between">
        <SixMediaLogoWhite />
        <div className="flex items-center gap-1.5">
          {platforms.slice(0, 3).map((p, i) => (
            <div key={i} className="w-7 h-7 rounded-lg bg-white/15 border border-white/20 flex items-center justify-center">
              <div className="brightness-0 invert opacity-80 scale-75">{p.icon}</div>
            </div>
          ))}
        </div>
      </div>
    </div>

    {/* Form card overlapping */}
    <div className="flex-1 -mt-4 relative z-10 overflow-auto">
      <div className="mx-4 bg-white rounded-2xl shadow-xl border border-gray-100 p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Welcome back!</h1>
        <p className="text-gray-500 mb-2 text-sm">Sign in to access your account</p>

        {/* Inline stats */}
        <div className="flex gap-3 mb-6 py-3 border-y border-gray-100">
          <div className="flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-purple-500" />
            <span className="text-xs text-gray-600"><strong>$2.5M+</strong> Spend</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-purple-500" />
            <span className="text-xs text-gray-600"><strong>10K+</strong> Users</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Globe className="w-3.5 h-3.5 text-purple-500" />
            <span className="text-xs text-gray-600"><strong>500+</strong> Accts</span>
          </div>
        </div>

        <LoginForm />
      </div>

      <div className="flex items-center justify-center gap-6 mt-4 mb-4">
        <div className="flex items-center gap-2 text-gray-500"><Shield className="w-4 h-4 text-emerald-500" /><span className="text-xs">SSL Encrypted</span></div>
        <div className="flex items-center gap-2 text-gray-500"><Zap className="w-4 h-4 text-purple-500" /><span className="text-xs">2FA Protected</span></div>
      </div>
    </div>
  </div>
)

export default function LoginPreviewPage() {
  const [selected, setSelected] = useState<string | null>(null)

  const variations = [
    { id: 'A', name: 'Gradient Hero', desc: 'Full gradient hero with pill logo, stat badges, particles & platform carousel', component: <VariationA /> },
    { id: 'B', name: 'Dark Glow', desc: 'Dark theme with glowing background, clean stats dividers, platform icons row', component: <VariationB /> },
    { id: 'C', name: 'Wave Split', desc: 'Gradient hero with wave SVG transition, pill badges, orbit ring animations', component: <VariationC /> },
    { id: 'D', name: 'Minimal Bar', desc: 'Compact gradient top bar with overlapping form card, inline stats row', component: <VariationD /> },
  ]

  return (
    <div className="min-h-screen bg-gray-950 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Mobile Login Design Variations</h1>
          <p className="text-gray-400">Click a design to select it. All variations include loop animations.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-8 justify-items-center">
          {variations.map((v) => (
            <div key={v.id} className="flex flex-col items-center gap-4">
              {/* Label */}
              <div className="text-center">
                <span className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-semibold ${
                  selected === v.id ? 'bg-purple-600 text-white' : 'bg-gray-800 text-gray-300'
                }`}>
                  {v.id}. {v.name}
                  {selected === v.id && <CheckCircle2 className="w-4 h-4" />}
                </span>
                <p className="text-gray-500 text-xs mt-2 max-w-[300px]">{v.desc}</p>
              </div>

              {/* Phone Preview */}
              <div
                onClick={() => setSelected(v.id)}
                className={`cursor-pointer transition-all duration-300 ${
                  selected === v.id
                    ? 'ring-4 ring-purple-500 ring-offset-4 ring-offset-gray-950 rounded-3xl scale-[1.02]'
                    : 'hover:scale-[1.01] opacity-90 hover:opacity-100'
                }`}
              >
                {v.component}
              </div>
            </div>
          ))}
        </div>

        {selected && (
          <div className="text-center mt-8">
            <p className="text-emerald-400 text-lg font-semibold">Selected: Variation {selected}</p>
          </div>
        )}
      </div>

      {/* Animations */}
      <style jsx global>{`
        .particle {
          position: absolute;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.2);
          animation: float-p linear infinite;
        }
        .p1 { width: 6px; height: 6px; top: 15%; left: 10%; animation-duration: 6s; animation-delay: 0s; }
        .p2 { width: 4px; height: 4px; top: 55%; left: 85%; animation-duration: 8s; animation-delay: 1s; }
        .p3 { width: 8px; height: 8px; top: 35%; left: 50%; animation-duration: 7s; animation-delay: 2s; }
        .p4 { width: 5px; height: 5px; top: 70%; left: 25%; animation-duration: 9s; animation-delay: 0.5s; }
        .p5 { width: 3px; height: 3px; top: 10%; left: 65%; animation-duration: 5s; animation-delay: 3s; }
        .p6 { width: 7px; height: 7px; top: 50%; left: 35%; animation-duration: 10s; animation-delay: 1.5s; }

        @keyframes float-p {
          0% { transform: translateY(0px) translateX(0px) scale(0); opacity: 0; }
          15% { opacity: 1; transform: translateY(-5px) translateX(3px) scale(1); }
          85% { opacity: 1; }
          100% { transform: translateY(-50px) translateX(25px) scale(0.5); opacity: 0; }
        }

        .carousel-slide {
          animation: carousel-move 12s linear infinite;
        }
        @keyframes carousel-move {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }

        .pulse-ring {
          animation: pulse-ring-anim 3s ease-in-out infinite;
        }
        @keyframes pulse-ring-anim {
          0%, 100% { opacity: 0.3; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(1.05); }
        }

        .orbit-ring {
          animation: orbit-spin 15s linear infinite;
        }
        @keyframes orbit-spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        .orbit-ring-reverse {
          animation: orbit-spin 20s linear infinite reverse;
        }

        .glow-icon {
          animation: icon-glow 3s ease-in-out infinite;
        }
        @keyframes icon-glow {
          0%, 100% { box-shadow: 0 0 0 rgba(139, 92, 246, 0); }
          50% { box-shadow: 0 0 15px rgba(139, 92, 246, 0.3); }
        }
      `}</style>
    </div>
  )
}
