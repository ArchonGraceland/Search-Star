import Link from 'next/link'

export function PublicFooter() {
  return (
    <footer className="bg-[#1a1a1a] text-white/55 py-8">
      <div className="max-w-[1120px] mx-auto px-8">
        <div className="font-body text-xs flex justify-between">
          <div><strong className="text-white/80">Search Star</strong> — Specification v0.5 · MIT License</div>
          <div className="flex gap-6">
            <Link href="/spec.html" className="text-white/50 no-underline font-medium tracking-[0.1em] uppercase hover:text-white/80">Spec</Link>
            <a href="https://github.com/ArchonGraceland/Search-Star" className="text-white/50 no-underline font-medium tracking-[0.1em] uppercase hover:text-white/80">GitHub</a>
          </div>
        </div>
      </div>
    </footer>
  )
}
