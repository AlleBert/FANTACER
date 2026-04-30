'use client'

import { motion } from 'framer-motion'
import { Trophy } from 'lucide-react'

export function SplashPreloader({ isExiting = false }: { isExiting?: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 1 }}
      animate={{ opacity: isExiting ? 0 : 1 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-background"
    >
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ 
          scale: isExiting ? 1.1 : 1, 
          opacity: isExiting ? 0 : 1 
        }}
        transition={{ 
          duration: 0.5, 
          delay: 0.1,
          ease: "easeOut" 
        }}
        className="flex flex-col items-center gap-6"
      >
        <motion.div
          animate={{ 
            rotate: isExiting ? 15 : [0, -5, 5, 0],
            scale: isExiting ? 0.9 : 1
          }}
          transition={{ 
            duration: 0.8,
            repeat: isExiting ? 0 : 2,
            repeatDelay: 0.5
          }}
          className="p-5 bg-accent/10 rounded-3xl"
        >
          <Trophy className="h-20 w-20 text-accent" />
        </motion.div>
        
        <motion.span
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: isExiting ? -20 : 0, opacity: isExiting ? 0 : 1 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="font-bold text-6xl tracking-tighter text-foreground"
        >
          FANTACER
        </motion.span>
        
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: isExiting ? 0 : 0.7 }}
          transition={{ duration: 0.3, delay: 0.4 }}
          className="text-muted-foreground font-medium tracking-widest text-sm uppercase"
        >
          Loading Excellence
        </motion.div>
      </motion.div>
    </motion.div>
  )
}