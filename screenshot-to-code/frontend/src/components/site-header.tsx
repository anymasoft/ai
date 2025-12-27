"use client"

import * as React from "react"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { ModeToggle } from "@/components/mode-toggle"
import { Button } from "@/components/ui/button"
import { Coins } from "lucide-react"
import { useEffect, useState } from "react"
import { fetchJSON } from "@/lib/api"
import { useNavigate, Link } from "react-router-dom"

export function SiteHeader() {
  const navigate = useNavigate()
  const [balance, setBalance] = useState<number | null>(null)
  const [loadingBalance, setLoadingBalance] = useState(true)

  useEffect(() => {
    const loadBalance = async () => {
      try {
        const data = await fetchJSON<{ credits: number }>("/api/billing/balance")
        setBalance(data.credits)
      } catch (err) {
        console.error("Error loading balance:", err)
        setBalance(null)
      } finally {
        setLoadingBalance(false)
      }
    }

    loadBalance()

    // Refresh balance every 30 seconds
    const interval = setInterval(loadBalance, 30000)
    return () => clearInterval(interval)
  }, [])

  // Listen for balance updates from other components (e.g., after payment)
  useEffect(() => {
    const handleBalanceUpdated = async () => {
      try {
        const data = await fetchJSON<{ credits: number }>("/api/billing/balance")
        setBalance(data.credits)
      } catch (err) {
        console.error("Error refreshing balance:", err)
      }
    }

    window.addEventListener("balance-updated", handleBalanceUpdated)
    return () => window.removeEventListener("balance-updated", handleBalanceUpdated)
  }, [])

  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-1 px-4 py-3 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mx-2 data-[orientation=vertical]:h-4"
        />
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0"
        >
          <Link to="/dashboard">
            <img
              src="/logo/logo-navbar.webp"
              alt="Screen2Code"
              className="h-6 w-6"
            />
          </Link>
        </Button>
        <div className="flex-1" />
        <div className="flex items-center gap-3">
          {balance !== null && !loadingBalance && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/settings/billing")}
              className="gap-1 text-sm"
            >
              <Coins className="h-4 w-4" />
              <span>{balance}</span>
            </Button>
          )}
          <ModeToggle />
        </div>
      </div>
    </header>
  )
}
