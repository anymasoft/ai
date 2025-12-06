import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function ReportsPage() {
  return (
    <div className="container mx-auto px-4 md:px-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Reports</h1>
        <p className="text-muted-foreground">Generate and export your analytics reports</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Coming Soon</CardTitle>
            <CardDescription>
              Report generation features will be available soon
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Stay tuned for updates
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
