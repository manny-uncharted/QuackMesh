'use client'

import { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'

export function NetworkAnimation() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Set canvas size
    const resizeCanvas = () => {
      canvas.width = canvas.offsetWidth * window.devicePixelRatio
      canvas.height = canvas.offsetHeight * window.devicePixelRatio
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio)
    }

    resizeCanvas()
    window.addEventListener('resize', resizeCanvas)

    // Animation variables
    const devices = [
      { x: 0.2, y: 0.3, type: 'laptop' },
      { x: 0.8, y: 0.2, type: 'phone' },
      { x: 0.1, y: 0.7, type: 'server' },
      { x: 0.9, y: 0.8, type: 'desktop' },
    ]

    const center = { x: 0.5, y: 0.5 }
    const particles: Array<{
      x: number
      y: number
      targetX: number
      targetY: number
      progress: number
      type: 'data' | 'reward'
      fromDevice: number
    }> = []

    let animationId: number

    const animate = () => {
      const width = canvas.offsetWidth
      const height = canvas.offsetHeight

      ctx.clearRect(0, 0, width, height)

      // Draw connections
      ctx.strokeStyle = 'rgba(6, 182, 212, 0.2)'
      ctx.lineWidth = 2
      devices.forEach((device) => {
        ctx.beginPath()
        ctx.moveTo(device.x * width, device.y * height)
        ctx.lineTo(center.x * width, center.y * height)
        ctx.stroke()
      })

      // Draw devices
      devices.forEach((device, index) => {
        const x = device.x * width
        const y = device.y * height
        
        // Device glow
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, 20)
        gradient.addColorStop(0, 'rgba(6, 182, 212, 0.3)')
        gradient.addColorStop(1, 'rgba(6, 182, 212, 0)')
        ctx.fillStyle = gradient
        ctx.beginPath()
        ctx.arc(x, y, 20, 0, Math.PI * 2)
        ctx.fill()

        // Device icon
        ctx.fillStyle = '#06b6d4'
        ctx.beginPath()
        ctx.arc(x, y, 8, 0, Math.PI * 2)
        ctx.fill()
      })

      // Draw center neural network
      const centerX = center.x * width
      const centerY = center.y * height
      
      // Center glow
      const centerGradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, 30)
      centerGradient.addColorStop(0, 'rgba(234, 88, 12, 0.4)')
      centerGradient.addColorStop(1, 'rgba(234, 88, 12, 0)')
      ctx.fillStyle = centerGradient
      ctx.beginPath()
      ctx.arc(centerX, centerY, 30, 0, Math.PI * 2)
      ctx.fill()

      // Center icon
      ctx.fillStyle = '#ea580c'
      ctx.beginPath()
      ctx.arc(centerX, centerY, 12, 0, Math.PI * 2)
      ctx.fill()

      // Neural network connections
      const nodePositions = [
        { x: centerX - 15, y: centerY - 10 },
        { x: centerX + 15, y: centerY - 10 },
        { x: centerX - 15, y: centerY + 10 },
        { x: centerX + 15, y: centerY + 10 },
      ]

      ctx.strokeStyle = 'rgba(234, 88, 12, 0.6)'
      ctx.lineWidth = 1
      nodePositions.forEach((node1, i) => {
        nodePositions.forEach((node2, j) => {
          if (i !== j) {
            ctx.beginPath()
            ctx.moveTo(node1.x, node1.y)
            ctx.lineTo(node2.x, node2.y)
            ctx.stroke()
          }
        })
      })

      // Draw particles
      particles.forEach((particle, index) => {
        particle.progress += 0.01

        if (particle.progress <= 1) {
          // Moving towards center
          particle.x = devices[particle.fromDevice].x + 
            (center.x - devices[particle.fromDevice].x) * particle.progress
          particle.y = devices[particle.fromDevice].y + 
            (center.y - devices[particle.fromDevice].y) * particle.progress

          const x = particle.x * width
          const y = particle.y * height

          if (particle.type === 'data') {
            ctx.fillStyle = '#06b6d4'
            ctx.shadowColor = '#06b6d4'
            ctx.shadowBlur = 10
            ctx.beginPath()
            ctx.arc(x, y, 3, 0, Math.PI * 2)
            ctx.fill()
            ctx.shadowBlur = 0
          }
        } else if (particle.progress <= 2) {
          // Moving back to device as reward
          const returnProgress = particle.progress - 1
          particle.x = center.x + 
            (devices[particle.fromDevice].x - center.x) * returnProgress
          particle.y = center.y + 
            (devices[particle.fromDevice].y - center.y) * returnProgress

          const x = particle.x * width
          const y = particle.y * height

          ctx.fillStyle = '#ea580c'
          ctx.shadowColor = '#ea580c'
          ctx.shadowBlur = 8
          ctx.beginPath()
          ctx.arc(x, y, 4, 0, Math.PI * 2)
          ctx.fill()
          ctx.shadowBlur = 0
        } else {
          // Remove completed particles
          particles.splice(index, 1)
        }
      })

      // Add new particles randomly
      if (Math.random() < 0.02) {
        particles.push({
          x: 0,
          y: 0,
          targetX: 0,
          targetY: 0,
          progress: 0,
          type: 'data',
          fromDevice: Math.floor(Math.random() * devices.length),
        })
      }

      animationId = requestAnimationFrame(animate)
    }

    animate()

    return () => {
      window.removeEventListener('resize', resizeCanvas)
      cancelAnimationFrame(animationId)
    }
  }, [])

  return (
    <motion.div 
      className="relative w-full h-96 bg-gradient-to-br from-slate-50 to-slate-100 rounded-2xl overflow-hidden"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.8, delay: 0.2 }}
    >
      <canvas
        ref={canvasRef}
        className="w-full h-full"
        style={{ width: '100%', height: '100%' }}
      />
      
      {/* Overlay labels */}
      <div className="absolute top-4 left-4 bg-white/80 backdrop-blur-sm rounded-lg px-3 py-2">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-accent-cyan rounded-full animate-pulse"></div>
          <span className="text-sm font-medium text-gray-700">Data Updates</span>
        </div>
      </div>
      
      <div className="absolute top-4 right-4 bg-white/80 backdrop-blur-sm rounded-lg px-3 py-2">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-accent-orange rounded-full animate-pulse"></div>
          <span className="text-sm font-medium text-gray-700">$DUCK Rewards</span>
        </div>
      </div>
      
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-white/80 backdrop-blur-sm rounded-lg px-3 py-2">
        <span className="text-sm font-medium text-gray-700">AI Training Network</span>
      </div>
    </motion.div>
  )
}