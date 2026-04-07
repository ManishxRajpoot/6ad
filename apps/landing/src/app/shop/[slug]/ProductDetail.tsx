'use client'

import { useState } from 'react'
import CheckoutModal from './CheckoutModal'
import { trackInitiateCheckout } from '@/lib/tracking'

type Props = {
  product: {
    id: string
    title: string
    price: number
    slug: string
    stock: number | null
  }
}

export default function ProductDetail({ product }: Props) {
  const [showCheckout, setShowCheckout] = useState(false)
  const outOfStock = product.stock !== null && product.stock === 0

  return (
    <>
      <button
        onClick={() => { trackInitiateCheckout(product); setShowCheckout(true) }}
        disabled={outOfStock}
        className="w-full py-3.5 rounded-xl bg-blue-500 hover:bg-blue-600 text-white font-semibold text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {outOfStock ? 'Out of Stock' : 'Buy with USDT'}
      </button>

      {showCheckout && (
        <CheckoutModal
          product={product}
          onClose={() => setShowCheckout(false)}
        />
      )}
    </>
  )
}
