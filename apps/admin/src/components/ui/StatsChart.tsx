'use client'

import { useEffect, useState, useRef } from 'react'

interface StatsChartProps {
  value: number
  color: string // hex color like "#0D9488"
  filterId: string // unique ID for SVG filter
  gradientId: string // unique ID for gradient
  clipId: string // unique ID for clip path
}

// Generate dynamic chart path based on count - creates wave peaks for each item
function generateChartPath(count: number): string {
  if (count === 0) {
    return 'M0,38 L120,38'
  }

  const numPeaks = Math.min(count, 6)
  const segmentWidth = 120 / numPeaks
  let path = 'M0,35'

  for (let i = 0; i < numPeaks; i++) {
    const startX = i * segmentWidth
    const peakX = startX + segmentWidth * 0.5
    const endX = (i + 1) * segmentWidth
    const baseHeight = 8
    const variation = (i % 2 === 0) ? 0 : 8
    const peakY = baseHeight + variation + (i * 2)
    const cp1x = startX + segmentWidth * 0.2
    const cp2x = peakX - segmentWidth * 0.15
    const cp3x = peakX + segmentWidth * 0.15
    const cp4x = startX + segmentWidth * 0.8

    path += ` C${cp1x},35 ${cp2x},${peakY} ${peakX},${peakY}`
    path += ` C${cp3x},${peakY} ${cp4x},35 ${endX},35`
  }

  return path
}

function generateFillPath(count: number): string {
  const linePath = generateChartPath(count)
  if (count === 0) {
    return 'M0,38 L120,38 L120,60 L0,60 Z'
  }
  return `${linePath} L120,60 L0,60 Z`
}

export function StatsChart({ value, color, filterId, gradientId, clipId }: StatsChartProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [pathLength, setPathLength] = useState(300)
  const pathRef = useRef<SVGPathElement>(null)

  const hasData = value > 0
  const opacity = hasData ? 1 : 0.3
  const chartPath = generateChartPath(value)
  const fillPath = generateFillPath(value)

  useEffect(() => {
    // Reset animation state
    setIsVisible(false)

    // Get path length for stroke animation
    const timer1 = setTimeout(() => {
      if (pathRef.current) {
        try {
          const length = pathRef.current.getTotalLength()
          setPathLength(length)
        } catch (e) {
          setPathLength(300)
        }
      }
    }, 10)

    // Trigger animation
    const timer2 = setTimeout(() => {
      setIsVisible(true)
    }, 100)

    return () => {
      clearTimeout(timer1)
      clearTimeout(timer2)
    }
  }, [value])

  return (
    <svg
      className="absolute bottom-0 right-0 w-28 h-14 overflow-visible"
      viewBox="0 0 120 60"
      style={{ borderBottomRightRadius: '12px' }}
    >
      <defs>
        <filter id={filterId} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2.5" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={color} stopOpacity="0.08"/>
          <stop offset="100%" stopColor={color} stopOpacity="0.25"/>
        </linearGradient>
        <clipPath id={clipId}>
          <rect x="0" y="0" width="120" height="60" rx="12" ry="12"/>
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        {/* Gradient fill - grows from bottom */}
        <g style={{
          transform: isVisible ? 'translateY(0)' : 'translateY(20px)',
          opacity: isVisible ? opacity : 0,
          transition: 'transform 0.7s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.4s ease-out',
        }}>
          <path
            d={fillPath}
            fill={`url(#${gradientId})`}
          />
        </g>
        {/* Line stroke - draws from left to right */}
        <path
          ref={pathRef}
          d={chartPath}
          fill="none"
          stroke={color}
          strokeWidth="2.5"
          strokeLinecap="round"
          filter={`url(#${filterId})`}
          opacity={opacity}
          strokeDasharray={pathLength}
          strokeDashoffset={isVisible ? 0 : pathLength}
          style={{
            transition: 'stroke-dashoffset 1s ease-out 0.1s',
          }}
        />
      </g>
    </svg>
  )
}
