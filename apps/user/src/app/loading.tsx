export default function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8F9FA]">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 rounded-full border-3 border-gray-100 border-t-[#8B5CF6] animate-spin" style={{ borderWidth: '3px' }} />
        <p className="text-xs text-gray-400 font-medium">Loading...</p>
      </div>
    </div>
  )
}
