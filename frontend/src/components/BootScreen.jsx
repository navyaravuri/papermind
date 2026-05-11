import { useEffect, useState } from 'react'

// Full-screen wordmark on first paint. Fades in, holds, fades out, unmounts.
// Renders above everything else so the main app can lay out underneath
// without flashing on screen.
export default function BootScreen() {
  const [phase, setPhase] = useState('in') // 'in' | 'out' | 'gone'

  useEffect(() => {
    const fadeOutAt = setTimeout(() => setPhase('out'), 1100)
    const goneAt = setTimeout(() => setPhase('gone'), 1500)
    return () => {
      clearTimeout(fadeOutAt)
      clearTimeout(goneAt)
    }
  }, [])

  if (phase === 'gone') return null

  return (
    <div
      className={`fixed inset-0 z-[100] bg-bg flex items-center justify-center pointer-events-none ${
        phase === 'out' ? 'boot-fade-out' : 'boot-fade-in'
      }`}
      aria-hidden="true"
    >
      <div className="text-4xl md:text-5xl font-semibold tracking-tight text-text-primary">
        PaperMind
      </div>
    </div>
  )
}
