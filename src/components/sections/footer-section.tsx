import React from 'react'

export function FooterSection() {
  return (
    <footer className="bg-black text-white py-6 px-4">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4 text-sm font-medium">
        <div className="flex gap-8">
          <a href="#" className="hover:text-magenta-500 transition-colors">Termini e assistenza</a>
          <a href="#" className="hover:text-magenta-500 transition-colors">Normativa sulla privacy</a>
        </div>
        
        <div className="text-white/50">
          Creato con <span className="font-bold text-white italic">Canva</span>
        </div>
      </div>
    </footer>
  )
}
