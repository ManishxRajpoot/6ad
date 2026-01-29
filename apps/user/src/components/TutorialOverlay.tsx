'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useTutorialStore } from '@/store/tutorial'
import { X, ChevronLeft, ChevronRight, MousePointer2 } from 'lucide-react'

interface TooltipPosition {
  top: number
  left: number
  arrowPosition: 'top' | 'bottom' | 'left' | 'right'
}

interface TargetRect {
  top: number
  left: number
  width: number
  height: number
  bottom: number
  right: number
}

// Helper function to find the closest scrollable parent
function getScrollableParent(element: HTMLElement): HTMLElement | Window {
  let parent = element.parentElement
  while (parent) {
    const { overflow, overflowY } = window.getComputedStyle(parent)
    if (
      overflow === 'auto' || overflow === 'scroll' ||
      overflowY === 'auto' || overflowY === 'scroll'
    ) {
      return parent
    }
    parent = parent.parentElement
  }
  return window
}

// Helper function to check if element is visible in viewport
function isElementInViewport(element: HTMLElement): boolean {
  const rect = element.getBoundingClientRect()
  return (
    rect.top >= 0 &&
    rect.left >= 0 &&
    rect.bottom <= window.innerHeight &&
    rect.right <= window.innerWidth
  )
}

// Helper function to scroll element into view within its scrollable container
function scrollElementIntoView(element: HTMLElement) {
  // First check if element is already visible
  if (isElementInViewport(element)) {
    return // Already visible, no need to scroll
  }

  const scrollableParent = getScrollableParent(element)

  if (scrollableParent === window) {
    // Use native scrollIntoView for window
    element.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
      inline: 'nearest'
    })
  } else {
    // Manual scroll for nested scrollable containers
    const parentElement = scrollableParent as HTMLElement
    const elementRect = element.getBoundingClientRect()
    const parentRect = parentElement.getBoundingClientRect()

    // Calculate the element's position relative to the scrollable parent
    const elementTop = elementRect.top - parentRect.top + parentElement.scrollTop
    const elementCenter = elementTop - (parentElement.clientHeight / 2) + (element.offsetHeight / 2)

    parentElement.scrollTo({
      top: Math.max(0, elementCenter),
      behavior: 'smooth'
    })
  }
}

export function TutorialOverlay() {
  const router = useRouter()
  const pathname = usePathname()
  const {
    isActive,
    currentTutorial,
    currentStepIndex,
    nextStep,
    prevStep,
    skipTutorial,
    endTutorial
  } = useTutorialStore()

  const [targetRect, setTargetRect] = useState<TargetRect | null>(null)
  const [tooltipPosition, setTooltipPosition] = useState<TooltipPosition | null>(null)
  const [isNavigating, setIsNavigating] = useState(false)
  const [waitingForElement, setWaitingForElement] = useState(false)
  const retryCountRef = useRef(0)
  const maxRetries = 20 // Max 2 seconds of retries

  const currentStep = currentTutorial?.steps[currentStepIndex]
  const previousStep = currentStepIndex > 0 ? currentTutorial?.steps[currentStepIndex - 1] : null
  const isLastStep = currentTutorial ? currentStepIndex === currentTutorial.steps.length - 1 : false
  const isFirstStep = currentStepIndex === 0

  // Find and highlight target element
  const updateTargetPosition = useCallback(() => {
    if (!currentStep) return

    const targetElement = document.querySelector(currentStep.target) as HTMLElement
    if (targetElement) {
      // Scroll element into view with custom function that handles nested scrollable containers
      scrollElementIntoView(targetElement)

      // Wait a bit for scroll to complete, then update position
      setTimeout(() => {
        const rect = targetElement.getBoundingClientRect()

        // Only proceed if the element has valid dimensions
        if (rect.width <= 0 || rect.height <= 0) {
          // Element might be hidden or has no dimensions, try scrolling again
          scrollElementIntoView(targetElement)
          setTimeout(() => {
            const newRect = targetElement.getBoundingClientRect()
            if (newRect.width > 0 && newRect.height > 0) {
              // Convert DOMRect to plain object to ensure React state works correctly
              setTargetRect({
                top: newRect.top,
                left: newRect.left,
                width: newRect.width,
                height: newRect.height,
                bottom: newRect.bottom,
                right: newRect.right
              })
              calculateTooltipPosition(newRect)
            }
          }, 200)
          return
        }

        // Set the target rect for the highlight - convert DOMRect to plain object
        setTargetRect({
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
          bottom: rect.bottom,
          right: rect.right
        })
        setWaitingForElement(false)
        retryCountRef.current = 0

        // Calculate tooltip position
        calculateTooltipPosition(rect)
      }, 400) // Wait for scroll animation (slightly longer for nested containers)

      function calculateTooltipPosition(rect: DOMRect) {
        const tooltipWidth = 320
        const tooltipHeight = 220 // Increased height to ensure buttons are visible
        const padding = 20
        const arrowSize = 12

        let top = 0
        let left = 0
        let arrowPosition: 'top' | 'bottom' | 'left' | 'right' = 'top'

        // Calculate available space in each direction
        const spaceBelow = window.innerHeight - rect.bottom
        const spaceAbove = rect.top
        const spaceRight = window.innerWidth - rect.right
        const spaceLeft = rect.left

        // Determine best position based on available space
        let preferredPosition = currentStep?.position || 'bottom'

        // If preferred position doesn't have enough space, find a better one
        if (preferredPosition === 'bottom' && spaceBelow < tooltipHeight + padding * 2) {
          if (spaceAbove > tooltipHeight + padding * 2) {
            preferredPosition = 'top'
          } else if (spaceRight > tooltipWidth + padding * 2) {
            preferredPosition = 'right'
          } else if (spaceLeft > tooltipWidth + padding * 2) {
            preferredPosition = 'left'
          }
        } else if (preferredPosition === 'top' && spaceAbove < tooltipHeight + padding * 2) {
          if (spaceBelow > tooltipHeight + padding * 2) {
            preferredPosition = 'bottom'
          } else if (spaceRight > tooltipWidth + padding * 2) {
            preferredPosition = 'right'
          } else if (spaceLeft > tooltipWidth + padding * 2) {
            preferredPosition = 'left'
          }
        }

        switch (preferredPosition) {
          case 'bottom':
            top = rect.bottom + padding + arrowSize
            left = rect.left + (rect.width / 2) - (tooltipWidth / 2)
            arrowPosition = 'top'
            break
          case 'top':
            top = rect.top - tooltipHeight - padding - arrowSize
            left = rect.left + (rect.width / 2) - (tooltipWidth / 2)
            arrowPosition = 'bottom'
            break
          case 'right':
            top = rect.top + (rect.height / 2) - (tooltipHeight / 2)
            left = rect.right + padding + arrowSize
            arrowPosition = 'left'
            break
          case 'left':
            top = rect.top + (rect.height / 2) - (tooltipHeight / 2)
            left = rect.left - tooltipWidth - padding - arrowSize
            arrowPosition = 'right'
            break
        }

        // Keep tooltip in viewport with extra padding
        if (left < padding) left = padding
        if (left + tooltipWidth > window.innerWidth - padding) {
          left = window.innerWidth - tooltipWidth - padding
        }
        if (top < padding) top = padding
        if (top + tooltipHeight > window.innerHeight - padding) {
          top = window.innerHeight - tooltipHeight - padding
        }

        setTooltipPosition({ top, left, arrowPosition })
      }
    } else {
      setTargetRect(null)
      setTooltipPosition(null)
    }
  }, [currentStep])

  // Try to click the previous step's target to open modal/dropdown
  const tryOpenPreviousTarget = useCallback(() => {
    if (!previousStep) return false

    const prevTarget = document.querySelector(previousStep.target) as HTMLElement
    if (prevTarget && previousStep.action === 'click') {
      prevTarget.click()
      return true
    }
    return false
  }, [previousStep])

  // Update position on step change, resize, and scroll
  useEffect(() => {
    if (!isActive || !currentStep) return

    retryCountRef.current = 0

    // Function to find element with retries
    const findElement = () => {
      const targetElement = document.querySelector(currentStep.target)

      if (targetElement) {
        updateTargetPosition()
        setWaitingForElement(false)
      } else if (retryCountRef.current < maxRetries) {
        // Element not found, try to open it
        if (retryCountRef.current === 0 && previousStep?.action === 'click') {
          // First retry: click the previous step's target to open modal
          tryOpenPreviousTarget()
        }

        retryCountRef.current++
        setWaitingForElement(true)
        setTimeout(findElement, 100) // Retry every 100ms
      } else {
        // Max retries reached, element not found
        setWaitingForElement(false)
        setTargetRect(null)
        setTooltipPosition(null)
      }
    }

    // Initial attempt
    const timer = setTimeout(findElement, 100)

    // Listen for resize - update after scroll completes
    const handleResize = () => {
      setTimeout(updateTargetPosition, 100)
    }

    window.addEventListener('resize', handleResize)

    return () => {
      clearTimeout(timer)
      window.removeEventListener('resize', handleResize)
    }
  }, [isActive, currentStep, currentStepIndex, updateTargetPosition, previousStep, tryOpenPreviousTarget, pathname])

  // Handle next step with possible navigation
  const handleNext = () => {
    if (!currentStep) return

    // If there's a next step with a different route, navigate first
    const nextStepData = currentTutorial?.steps[currentStepIndex + 1]
    if (nextStepData?.nextRoute && pathname !== nextStepData.nextRoute) {
      setIsNavigating(true)
      router.push(nextStepData.nextRoute)
      setTimeout(() => {
        setIsNavigating(false)
        nextStep()
      }, 500)
    } else {
      nextStep()
    }
  }

  // Handle clicking on the highlighted area
  const handleTargetClick = () => {
    if (!currentStep) return

    // Actually click the target element
    const targetElement = document.querySelector(currentStep.target) as HTMLElement
    if (targetElement) {
      targetElement.click()
    }

    // If current step has a nextRoute, navigate and go to next step
    if (currentStep.nextRoute) {
      setIsNavigating(true)
      router.push(currentStep.nextRoute)
      setTimeout(() => {
        setIsNavigating(false)
        nextStep()
      }, 500)
    } else if (currentStep.action === 'click') {
      // For click actions without navigation, wait a bit for any animations then go to next step
      setTimeout(() => {
        nextStep()
      }, 300)
    }
  }

  if (!isActive || !currentTutorial || !currentStep) return null

  return (
    <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 9999 }}>
      {/* Dark overlay for when target is not yet found - clicks blocked */}
      {(!targetRect || targetRect.width <= 0 || targetRect.height <= 0) && (
        <div
          className="absolute inset-0 bg-black/75 pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
        />
      )}

      {/* Highlight border around target - uses massive box-shadow to create spotlight effect */}
      {/* The box-shadow creates the dark overlay, so we don't need a separate overlay div when target is visible */}
      {targetRect && targetRect.width > 0 && targetRect.height > 0 && (
        <>
          {/* Invisible click blocker for the entire screen */}
          <div
            className="fixed inset-0 pointer-events-auto"
            style={{ zIndex: 9998 }}
            onClick={(e) => e.stopPropagation()}
          />
          {/* The spotlight highlight box */}
          <div
            className="fixed rounded-xl pointer-events-auto cursor-pointer"
            style={{
              top: targetRect.top - 8,
              left: targetRect.left - 8,
              width: targetRect.width + 16,
              height: targetRect.height + 16,
              border: '3px solid #8B5CF6',
              boxShadow: `
                0 0 0 9999px rgba(0, 0, 0, 0.75),
                0 0 0 6px rgba(139, 92, 246, 0.4),
                0 0 30px rgba(139, 92, 246, 0.5)
              `,
              zIndex: 10000,
              background: 'transparent',
              animation: 'tutorial-pulse 2s ease-in-out infinite',
            }}
            onClick={handleTargetClick}
          >
            {/* Click indicator */}
            {currentStep.action === 'click' && (
              <div
                className="absolute -top-10 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-[#8B5CF6] text-white px-4 py-1.5 rounded-full text-xs font-medium shadow-lg whitespace-nowrap"
                style={{ zIndex: 10001 }}
              >
                <MousePointer2 className="w-3.5 h-3.5" />
                Click here
              </div>
            )}
          </div>
        </>
      )}

      {/* CSS for pulse animation on the border */}
      <style jsx global>{`
        @keyframes tutorial-pulse {
          0%, 100% {
            border-color: #8B5CF6;
          }
          50% {
            border-color: #7C3AED;
          }
        }
      `}</style>

      {/* Loading state when waiting for element */}
      {waitingForElement && !targetRect && (
        <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-2xl shadow-2xl p-6 pointer-events-auto">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 border-2 border-[#8B5CF6] border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-gray-600">Opening...</span>
          </div>
        </div>
      )}

      {/* Tooltip */}
      {tooltipPosition && (
        <div
          className="fixed bg-white rounded-2xl shadow-2xl p-5 pointer-events-auto"
          style={{
            top: tooltipPosition.top,
            left: tooltipPosition.left,
            width: 320,
            zIndex: 10001, // Above highlight
          }}
        >
          {/* Arrow */}
          <div
            className={`absolute w-4 h-4 bg-white transform rotate-45 ${
              tooltipPosition.arrowPosition === 'top'
                ? '-top-2 left-1/2 -translate-x-1/2'
                : tooltipPosition.arrowPosition === 'bottom'
                ? '-bottom-2 left-1/2 -translate-x-1/2'
                : tooltipPosition.arrowPosition === 'left'
                ? 'top-1/2 -left-2 -translate-y-1/2'
                : 'top-1/2 -right-2 -translate-y-1/2'
            }`}
          />

          {/* Close button */}
          <button
            onClick={skipTutorial}
            className="absolute top-3 right-3 p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Content */}
          <div className="pr-8">
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2 py-0.5 bg-[#8B5CF6]/10 text-[#8B5CF6] text-xs font-medium rounded-full">
                Step {currentStepIndex + 1} of {currentTutorial.steps.length}
              </span>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {currentStep.title}
            </h3>
            <p className="text-sm text-gray-600 leading-relaxed">
              {currentStep.description}
            </p>
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
            <button
              onClick={prevStep}
              disabled={isFirstStep}
              className={`flex items-center gap-1 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                isFirstStep
                  ? 'text-gray-300 cursor-not-allowed'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </button>

            <div className="flex items-center gap-1">
              {currentTutorial.steps.map((_, idx) => (
                <div
                  key={idx}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    idx === currentStepIndex
                      ? 'bg-[#8B5CF6]'
                      : idx < currentStepIndex
                      ? 'bg-[#8B5CF6]/40'
                      : 'bg-gray-200'
                  }`}
                />
              ))}
            </div>

            <button
              onClick={isLastStep ? endTutorial : handleNext}
              className="flex items-center gap-1 px-4 py-2 bg-[#8B5CF6] text-white text-sm font-medium rounded-lg hover:bg-[#7C3AED] transition-colors"
            >
              {isLastStep ? 'Finish' : 'Next'}
              {!isLastStep && <ChevronRight className="w-4 h-4" />}
            </button>
          </div>
        </div>
      )}

      {/* Skip tutorial button */}
      <button
        onClick={skipTutorial}
        className="fixed bottom-6 right-6 px-4 py-2 bg-white/90 backdrop-blur-sm text-gray-600 text-sm font-medium rounded-lg shadow-lg hover:bg-white transition-colors pointer-events-auto"
      >
        Skip Tutorial
      </button>
    </div>
  )
}
