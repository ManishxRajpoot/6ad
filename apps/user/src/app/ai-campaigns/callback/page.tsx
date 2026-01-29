'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2, CheckCircle2, XCircle } from 'lucide-react'

function CallbackContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const handleCallback = async () => {
      const code = searchParams.get('code')
      const errorParam = searchParams.get('error')
      const errorDescription = searchParams.get('error_description')

      // Check for errors from Facebook
      if (errorParam) {
        setStatus('error')
        setError(errorDescription || 'Facebook authorization was denied')
        return
      }

      // If we have a code, redirect back to localhost with the code
      // The localhost app will handle the token exchange since it can reach the API
      if (code) {
        setStatus('success')
        setTimeout(() => {
          // Pass the code to localhost for token exchange
          window.location.href = `http://localhost:3003/ai-campaigns?fb_code=${encodeURIComponent(code)}`
        }, 1500)
        return
      }

      // No code received
      setStatus('error')
      setError('No authorization code received from Facebook')
    }

    handleCallback()
  }, [searchParams, router])

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white p-8 rounded-2xl shadow-lg max-w-md w-full text-center">
        {status === 'loading' && (
          <>
            <div className="w-16 h-16 mx-auto mb-4 bg-blue-100 rounded-full flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-[#1877F2] animate-spin" />
            </div>
            <h2 className="text-xl font-semibold text-[#1E293B] mb-2">
              Connecting to Facebook...
            </h2>
            <p className="text-gray-500">
              Please wait while we complete the authorization
            </p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="w-16 h-16 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-xl font-semibold text-[#1E293B] mb-2">
              Successfully Connected!
            </h2>
            <p className="text-gray-500">
              Redirecting you to AI Campaigns...
            </p>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
              <XCircle className="w-8 h-8 text-red-600" />
            </div>
            <h2 className="text-xl font-semibold text-[#1E293B] mb-2">
              Connection Failed
            </h2>
            <p className="text-gray-500 mb-4">
              {error || 'Something went wrong. Please try again.'}
            </p>
            <button
              onClick={() => router.push('/ai-campaigns')}
              className="px-6 py-2 bg-[#8B5CF6] hover:bg-[#7C3AED] text-white rounded-xl transition-colors"
            >
              Go Back
            </button>
          </>
        )}
      </div>
    </div>
  )
}

export default function FacebookCallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-2xl shadow-lg max-w-md w-full text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-blue-100 rounded-full flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-[#1877F2] animate-spin" />
          </div>
          <h2 className="text-xl font-semibold text-[#1E293B] mb-2">
            Loading...
          </h2>
        </div>
      </div>
    }>
      <CallbackContent />
    </Suspense>
  )
}
