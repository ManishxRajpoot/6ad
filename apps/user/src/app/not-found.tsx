'use client'

import { Home, ArrowLeft } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="max-w-md w-full text-center">
        <h1 className="text-[120px] font-extrabold text-gray-200 leading-none mb-4">
          404
        </h1>
        <h2 className="text-2xl font-semibold text-gray-900 mb-3">
          Page Not Found
        </h2>
        <p className="text-gray-500 mb-8">
          The page you are looking for doesn't exist or has been moved.
        </p>

        <div className="flex gap-3 justify-center">
          <button
            onClick={() => window.history.back()}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Go Back
          </button>
          <a
            href="/"
            className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2"
          >
            <Home className="w-4 h-4" />
            Home
          </a>
        </div>
      </div>
    </div>
  )
}
