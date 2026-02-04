'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface TutorialStep {
  id: string
  target: string // CSS selector for the element to highlight
  title: string
  description: string
  position: 'top' | 'bottom' | 'left' | 'right'
  action?: 'click' | 'navigate' | 'input'
  nextRoute?: string // Route to navigate to for next step
}

export interface Tutorial {
  id: string
  name: string
  description: string
  icon: string
  steps: TutorialStep[]
}

interface TutorialState {
  isActive: boolean
  currentTutorial: Tutorial | null
  currentStepIndex: number
  completedTutorials: string[]
  isHydrated: boolean

  // Actions
  startTutorial: (tutorial: Tutorial) => void
  nextStep: () => void
  prevStep: () => void
  endTutorial: () => void
  skipTutorial: () => void
  markCompleted: (tutorialId: string) => void
  setHydrated: (state: boolean) => void
}

export const useTutorialStore = create<TutorialState>()(
  persist(
    (set, get) => ({
      isActive: false,
      currentTutorial: null,
      currentStepIndex: 0,
      completedTutorials: [],
      isHydrated: false,

      startTutorial: (tutorial) => set({
        isActive: true,
        currentTutorial: tutorial,
        currentStepIndex: 0,
      }),

      nextStep: () => {
        const { currentTutorial, currentStepIndex } = get()
        if (!currentTutorial) return

        if (currentStepIndex < currentTutorial.steps.length - 1) {
          set({ currentStepIndex: currentStepIndex + 1 })
        } else {
          // Tutorial completed
          get().markCompleted(currentTutorial.id)
          set({
            isActive: false,
            currentTutorial: null,
            currentStepIndex: 0,
          })
        }
      },

      prevStep: () => {
        const { currentStepIndex } = get()
        if (currentStepIndex > 0) {
          set({ currentStepIndex: currentStepIndex - 1 })
        }
      },

      endTutorial: () => {
        const { currentTutorial } = get()
        if (currentTutorial) {
          get().markCompleted(currentTutorial.id)
        }
        set({
          isActive: false,
          currentTutorial: null,
          currentStepIndex: 0,
        })
      },

      skipTutorial: () => set({
        isActive: false,
        currentTutorial: null,
        currentStepIndex: 0,
      }),

      markCompleted: (tutorialId) => {
        const { completedTutorials } = get()
        if (!completedTutorials.includes(tutorialId)) {
          set({ completedTutorials: [...completedTutorials, tutorialId] })
        }
      },

      setHydrated: (state) => {
        set({ isHydrated: state })
      },
    }),
    {
      name: 'tutorial-storage',
      onRehydrateStorage: () => (state) => {
        state?.setHydrated(true)
      },
    }
  )
)

// Tutorial definitions
export const tutorials: Tutorial[] = [
  {
    id: 'deposit-funds',
    name: 'How to Deposit Funds',
    description: 'Learn how to add money to your wallet',
    icon: 'wallet',
    steps: [
      {
        id: 'step-1',
        target: '[data-tutorial="wallet-menu"]',
        title: 'Open Wallet',
        description: 'Click on the Wallet menu in the sidebar to access your wallet and deposit management.',
        position: 'right',
        action: 'click',
        nextRoute: '/deposits',
      },
      {
        id: 'step-2',
        target: '[data-tutorial="deposit-button"]',
        title: 'Click Add Deposit',
        description: 'Click the "Add Deposit" button to open the deposit form and start adding funds to your wallet.',
        position: 'bottom',
        action: 'click',
      },
      {
        id: 'step-3',
        target: '[data-tutorial="payment-method"]',
        title: 'Select Payment Method (Payway)',
        description: 'Choose your preferred payment method from the dropdown. Options include UPI, Bank Transfer, USDT, etc. Payment details will appear after selection.',
        position: 'bottom',
        action: 'click',
      },
      {
        id: 'step-4',
        target: '[data-tutorial="transaction-id"]',
        title: 'Enter Transaction ID',
        description: 'Enter the unique Transaction ID from your payment. This helps us identify and verify your deposit quickly.',
        position: 'bottom',
        action: 'input',
      },
      {
        id: 'step-5',
        target: '[data-tutorial="amount-input"]',
        title: 'Enter Charge Amount',
        description: 'Enter the exact amount you have paid/transferred. Make sure this matches your actual payment amount.',
        position: 'top',
        action: 'input',
      },
      {
        id: 'step-6',
        target: '[data-tutorial="remarks-input"]',
        title: 'Add Remarks (Optional)',
        description: 'You can add any additional notes or remarks about your deposit. This field is optional.',
        position: 'top',
        action: 'input',
      },
      {
        id: 'step-7',
        target: '[data-tutorial="screenshot-upload"]',
        title: 'Upload Payment Screenshot',
        description: 'Upload a screenshot of your payment confirmation. This is required for verification. Supported formats: PNG, JPG, GIF, SVG, WebP (max 5MB).',
        position: 'top',
        action: 'click',
      },
      {
        id: 'step-8',
        target: '[data-tutorial="confirm-deposit"]',
        title: 'Submit Deposit Request',
        description: 'After filling all required fields, click Submit to send your deposit request for approval. You will be notified once approved.',
        position: 'top',
        action: 'click',
      },
    ],
  },
  {
    id: 'apply-ad-account',
    name: 'How to Apply for Ad Account',
    description: 'Learn how to request a new advertising account',
    icon: 'megaphone',
    steps: [
      {
        id: 'step-1',
        target: '[data-tutorial="facebook-menu"]',
        title: 'Select Platform',
        description: 'Click on Facebook (or another platform) in the sidebar to manage ad accounts.',
        position: 'right',
        action: 'click',
        nextRoute: '/facebook',
      },
      {
        id: 'step-2',
        target: '[data-tutorial="apply-account-btn"]',
        title: 'Open Application Form',
        description: 'Click "Apply Ads Account" in the left menu to open the application form.',
        position: 'right',
        action: 'click',
      },
      {
        id: 'step-3',
        target: '[data-tutorial="license-section"]',
        title: 'Select License Type',
        description: 'Choose "New License" to create a new one, or "Existing License" to use one you already have.',
        position: 'bottom',
      },
      {
        id: 'step-4',
        target: '[data-tutorial="pages-section"]',
        title: 'Add Facebook Pages',
        description: 'Select how many pages you need and enter your Facebook Page URLs. First 5 pages are free.',
        position: 'bottom',
      },
      {
        id: 'step-5',
        target: '[data-tutorial="share-profile-checkbox"]',
        title: 'Confirm Profile Sharing',
        description: 'First, share your Facebook page with the profile URL shown below. Then check this checkbox to confirm you have shared the page.',
        position: 'bottom',
      },
      {
        id: 'step-6',
        target: '[data-tutorial="ad-accounts-section"]',
        title: 'Configure Ad Accounts',
        description: 'Set how many ad accounts you need (1-5), enter account names, timezones, and initial deposit amounts.',
        position: 'top',
      },
      {
        id: 'step-7',
        target: '[data-tutorial="submit-application"]',
        title: 'Submit Application',
        description: 'Review the total cost, ensure you have enough balance, and click Submit to send your application.',
        position: 'top',
        action: 'click',
      },
    ],
  },
  {
    id: 'apply-paylink',
    name: 'How to Apply for Pay Link',
    description: 'Learn how to request a payment link for deposits',
    icon: 'link',
    steps: [
      {
        id: 'step-1',
        target: '[data-tutorial="wallet-menu"]',
        title: 'Open Wallet',
        description: 'Click on the Wallet menu in the sidebar to access your wallet management.',
        position: 'right',
        action: 'click',
        nextRoute: '/deposits',
      },
      {
        id: 'step-2',
        target: '[data-tutorial="paylink-tab"]',
        title: 'Go to Pay Link Tab',
        description: 'Click on the "Pay Link" tab to view and manage your payment link requests.',
        position: 'bottom',
        action: 'click',
      },
      {
        id: 'step-3',
        target: '[data-tutorial="create-paylink-btn"]',
        title: 'Create Pay Link',
        description: 'Click the "Create Paylink" button to open the application form for a new payment link.',
        position: 'bottom',
        action: 'click',
      },
      {
        id: 'step-4',
        target: '[data-tutorial="paylink-type-toggle"]',
        title: 'Select Account Type',
        description: 'Choose between "Individual User" for personal use or "Company" for business accounts. Company accounts require additional details.',
        position: 'bottom',
      },
      {
        id: 'step-5',
        target: '[data-tutorial="paylink-name-email"]',
        title: 'Enter Personal Details',
        description: 'Enter your full name and email address. These details will be used to create your payment link.',
        position: 'bottom',
        action: 'input',
      },
      {
        id: 'step-6',
        target: '[data-tutorial="paylink-country-amount"]',
        title: 'Enter Country & Amount',
        description: 'Enter your country and the deposit amount you want to add. This helps us create the right payment link for you.',
        position: 'top',
        action: 'input',
      },
      {
        id: 'step-7',
        target: '[data-tutorial="paylink-note"]',
        title: 'Important Note',
        description: 'After submission, our team will review your request and create a personalized payment link for you.',
        position: 'top',
      },
      {
        id: 'step-8',
        target: '[data-tutorial="paylink-submit"]',
        title: 'Submit Request',
        description: 'Click Submit to send your pay link request. You will be notified once your payment link is ready.',
        position: 'top',
        action: 'click',
      },
    ],
  },
  {
    id: 'get-bm-access',
    name: 'How to Get Ad Account in Business Manager',
    description: 'Learn how to get access to your ad account in Facebook Business Manager',
    icon: 'briefcase',
    steps: [
      {
        id: 'step-1',
        target: '[data-tutorial="facebook-menu"]',
        title: 'Go to Facebook',
        description: 'Click on Facebook in the sidebar to access your Facebook ad accounts management.',
        position: 'right',
        action: 'click',
        nextRoute: '/facebook',
      },
      {
        id: 'step-2',
        target: '[data-tutorial="account-manage-section"]',
        title: 'Open Account Manage',
        description: 'Click on "Account Manage" to expand the account management options.',
        position: 'right',
        action: 'click',
      },
      {
        id: 'step-3',
        target: '[data-tutorial="account-list-btn"]',
        title: 'View Account List',
        description: 'Click on "Account List" to see all your approved ad accounts.',
        position: 'right',
        action: 'click',
      },
      {
        id: 'step-4',
        target: '[data-tutorial="get-bm-access-btn"]',
        title: 'Click Get Access',
        description: 'Click the "Get Access" button next to any ad account to get it shared to your Facebook Business Manager.',
        position: 'left',
        action: 'click',
      },
      {
        id: 'step-5',
        target: '[data-tutorial="bm-id-input"]',
        title: 'Enter Your BM ID',
        description: 'Enter your Facebook Business Manager ID. You can find this in your Business Manager Settings under Business Info.',
        position: 'bottom',
        action: 'input',
      },
      {
        id: 'step-6',
        target: '[data-tutorial="bm-share-submit"]',
        title: 'Submit Request',
        description: 'Click Submit to request BM access. Once approved, the ad account will appear in your Business Manager.',
        position: 'top',
        action: 'click',
      },
    ],
  },
  {
    id: 'recharge-ad-account',
    name: 'How to Recharge Ad Account',
    description: 'Learn how to add funds to your advertising accounts',
    icon: 'credit-card',
    steps: [
      {
        id: 'step-1',
        target: '[data-tutorial="facebook-menu"]',
        title: 'Go to Facebook',
        description: 'Click on Facebook in the sidebar to access your Facebook ad accounts.',
        position: 'right',
        action: 'click',
        nextRoute: '/facebook',
      },
      {
        id: 'step-2',
        target: '[data-tutorial="deposit-manage-section"]',
        title: 'Open Deposit Manage',
        description: 'Click on "Deposit Manage" to expand the deposit management options.',
        position: 'right',
        action: 'click',
      },
      {
        id: 'step-3',
        target: '[data-tutorial="deposit-menu-btn"]',
        title: 'Click Deposit',
        description: 'Click on "Deposit" to open the deposit form where you can add funds to your ad accounts.',
        position: 'right',
        action: 'click',
      },
      {
        id: 'step-4',
        target: '[data-tutorial="deposit-row-first"]',
        title: 'Select Ad Account & Amount',
        description: 'Choose an ad account from the dropdown and enter the deposit amount. Minimum deposit is $100 and must be in $50 increments.',
        position: 'bottom',
        action: 'input',
      },
      {
        id: 'step-5',
        target: '[data-tutorial="deposit-cost-breakdown"]',
        title: 'Review Cost Breakdown',
        description: 'Review the total cost including service fee. Make sure you have enough wallet balance to cover the deposit.',
        position: 'top',
      },
      {
        id: 'step-6',
        target: '[data-tutorial="deposit-submit-btn"]',
        title: 'Submit Deposit Request',
        description: 'Click to submit your deposit request. Funds will be added to your ad account once approved.',
        position: 'top',
        action: 'click',
      },
    ],
  },
  {
    id: 'view-dashboard',
    name: 'Dashboard Overview',
    description: 'Get familiar with your dashboard',
    icon: 'layout',
    steps: [
      {
        id: 'step-1',
        target: '[data-tutorial="dashboard-menu"]',
        title: 'Dashboard',
        description: 'This is your main dashboard where you can see all your activity.',
        position: 'right',
        action: 'click',
        nextRoute: '/dashboard',
      },
      {
        id: 'step-2',
        target: '[data-tutorial="balance-card"]',
        title: 'Your Balance',
        description: 'Here you can see your current wallet balance. Click "Add Money" to deposit funds.',
        position: 'bottom',
      },
      {
        id: 'step-3',
        target: '[data-tutorial="stats-section"]',
        title: 'Statistics',
        description: 'View your spending overview and platform breakdown. The donut chart shows spend distribution.',
        position: 'bottom',
      },
      {
        id: 'step-4',
        target: '[data-tutorial="recent-activity"]',
        title: 'Recent Activity',
        description: 'Track all your active ad accounts and their status across different platforms.',
        position: 'top',
      },
    ],
  },
]
