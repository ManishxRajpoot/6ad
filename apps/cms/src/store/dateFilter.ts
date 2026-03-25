import { create } from 'zustand'

type DateFilterState = {
  startDate: Date | null
  endDate: Date | null
  setDateRange: (start: Date | null, end: Date | null) => void
  clearDateRange: () => void
}

export const useDateFilterStore = create<DateFilterState>((set) => ({
  startDate: null,
  endDate: null,
  setDateRange: (start, end) => set({ startDate: start, endDate: end }),
  clearDateRange: () => set({ startDate: null, endDate: null }),
}))
