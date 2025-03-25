"use client"
import { Button } from "@/components/ui/button"
import { Brain } from "lucide-react"
import Link from "next/link"
import React from 'react'
import 'swiper/css'
import 'swiper/css/effect-cards'
import Carousel from "@/components/carousel";

export default function Home() {
  return (
      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-6">
            <div className="inline-block rounded-lg bg-primary/10 p-2">
              <Brain className="h-6 w-6 text-primary" />
            </div>
            <h1 className="text-4xl font-bold tracking-tight">
              Leveraging Emotional Cues for Real-Time Deception Detection
            </h1>
            <p className="text-lg text-muted-foreground">
              Advanced AI-powered platform for detecting deception by analyzing facial micro-expressions
              in real-time. Perfect for research, security, and human behavior analysis.
            </p>
            <div className="flex gap-4">
              <Link href="/model">
                <Button size="lg">Access the Model</Button>
              </Link>
              <Link href="/about">
                <Button variant="outline" size="lg">Learn More</Button>
              </Link>
            </div>
          </div>
          <div className="flex-1 h-[80vh] rounded-xl overflow-hidden flex items-center justify-center">
            <Carousel />
          </div>
        </div>
      </main>
  )
}