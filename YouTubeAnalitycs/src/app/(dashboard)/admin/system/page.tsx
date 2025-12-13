"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Loader2, RefreshCcw } from "lucide-react"
import { toast } from "sonner"

interface SystemFlags {
  enableTrending: boolean
  enableComparison: boolean
  enableReports: boolean
  enableCooldown: boolean
  maintenanceMode: boolean
}

export default function AdminSystemPage() {
  const [flags, setFlags] = useState<SystemFlags>({
    enableTrending: true,
    enableComparison: true,
    enableReports: false,
    enableCooldown: false,
    maintenanceMode: false,
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchFlags()
  }, [])

  async function fetchFlags() {
    try {
      setLoading(true)
      const res = await fetch("/api/admin/system")
      if (!res.ok) throw new Error("Failed to fetch flags")
      const data = await res.json()
      setFlags(data.flags || flags)
    } catch (error) {
      console.error("Error:", error)
      toast.error("Failed to load system flags")
    } finally {
      setLoading(false)
    }
  }

  async function saveFlags() {
    try {
      setSaving(true)
      const res = await fetch("/api/admin/system", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ flags }),
      })
      if (!res.ok) throw new Error("Failed to save flags")
      toast.success("System flags updated")
    } catch (error) {
      console.error("Error:", error)
      toast.error("Failed to update flags")
    } finally {
      setSaving(false)
    }
  }

  const handleToggle = (key: keyof SystemFlags) => {
    setFlags((prev) => ({
      ...prev,
      [key]: !prev[key],
    }))
  }

  const flagConfig = [
    {
      key: "enableTrending" as const,
      label: "Enable Trending",
      description: "Allow users to access trending insights",
    },
    {
      key: "enableComparison" as const,
      label: "Enable Comparison",
      description: "Allow users to compare competitors",
    },
    {
      key: "enableReports" as const,
      label: "Enable Reports",
      description: "Allow users to generate PDF reports",
    },
    {
      key: "enableCooldown" as const,
      label: "Enable Cooldown",
      description: "Enforce cooldown period between operations",
    },
    {
      key: "maintenanceMode" as const,
      label: "Maintenance Mode",
      description: "Disable all user access (coming soon)",
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">System Settings</h1>
          <p className="text-muted-foreground">Configure system-wide feature flags</p>
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={fetchFlags}
          disabled={loading}
        >
          <RefreshCcw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Feature Flags</CardTitle>
          <CardDescription>
            Enable or disable features globally without redeployment
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-6">
              {flagConfig.map((config) => (
                <div key={config.key} className="flex items-center justify-between pb-4 border-b last:border-0">
                  <div className="space-y-1">
                    <Label className="text-base font-medium">{config.label}</Label>
                    <p className="text-sm text-muted-foreground">{config.description}</p>
                  </div>
                  <Switch
                    checked={flags[config.key]}
                    onCheckedChange={() => handleToggle(config.key)}
                  />
                </div>
              ))}

              <div className="flex gap-2 pt-4">
                <Button onClick={saveFlags} disabled={saving}>
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Changes"
                  )}
                </Button>
                <Button variant="outline" onClick={fetchFlags}>
                  Discard
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="bg-muted/50">
        <CardHeader>
          <CardTitle className="text-sm">Info</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>• Feature flags are applied immediately to all users</p>
          <p>• Currently NOT enforced in product (only stored)</p>
          <p>• Maintenance Mode: not yet integrated into authentication flow</p>
          <p>• Integration with product pages will be done in separate task</p>
        </CardContent>
      </Card>
    </div>
  )
}
