'use client'

import { useEffect, useState } from 'react'

interface ConfettiPiece {
  id: number
  x: number
  y: number
  rotation: number
  color: string
  scale: number
  speedX: number
  speedY: number
  rotationSpeed: number
}

interface ConfettiProps {
  active: boolean
  duration?: number
  particleCount?: number
  onComplete?: () => void
}

const colors = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
  '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
  '#F8B500', '#FF6F61', '#6B5B95', '#88B04B', '#F7CAC9'
]

export function Confetti({ active, duration = 3000, particleCount = 100, onComplete }: ConfettiProps) {
  const [pieces, setPieces] = useState<ConfettiPiece[]>([])
  const [isActive, setIsActive] = useState(false)

  useEffect(() => {
    if (active && !isActive) {
      setIsActive(true)

      // Create confetti pieces
      const newPieces: ConfettiPiece[] = []
      for (let i = 0; i < particleCount; i++) {
        newPieces.push({
          id: i,
          x: Math.random() * 100,
          y: -10 - Math.random() * 20,
          rotation: Math.random() * 360,
          color: colors[Math.floor(Math.random() * colors.length)],
          scale: 0.5 + Math.random() * 0.5,
          speedX: (Math.random() - 0.5) * 3,
          speedY: 2 + Math.random() * 3,
          rotationSpeed: (Math.random() - 0.5) * 10
        })
      }
      setPieces(newPieces)

      // Clear after duration
      const timer = setTimeout(() => {
        setPieces([])
        setIsActive(false)
        onComplete?.()
      }, duration)

      return () => clearTimeout(timer)
    }
  }, [active, isActive, duration, particleCount, onComplete])

  if (!isActive || pieces.length === 0) return null

  return (
    <div className="fixed inset-0 pointer-events-none z-[9999] overflow-hidden">
      <style jsx>{`
        @keyframes confettiFall {
          0% {
            transform: translateY(0) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(100vh) rotate(720deg);
            opacity: 0;
          }
        }
        .confetti-piece {
          position: absolute;
          width: 10px;
          height: 10px;
          animation: confettiFall linear forwards;
        }
      `}</style>
      {pieces.map((piece) => (
        <div
          key={piece.id}
          className="confetti-piece"
          style={{
            left: `${piece.x}%`,
            top: `${piece.y}%`,
            backgroundColor: piece.color,
            transform: `scale(${piece.scale}) rotate(${piece.rotation}deg)`,
            animationDuration: `${2 + Math.random() * 2}s`,
            animationDelay: `${Math.random() * 0.5}s`,
            borderRadius: Math.random() > 0.5 ? '50%' : '0',
          }}
        />
      ))}
    </div>
  )
}

// Hook to trigger confetti
export function useConfetti() {
  const [showConfetti, setShowConfetti] = useState(false)

  const triggerConfetti = () => {
    setShowConfetti(true)
  }

  const stopConfetti = () => {
    setShowConfetti(false)
  }

  return { showConfetti, triggerConfetti, stopConfetti }
}
