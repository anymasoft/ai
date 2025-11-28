import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function CompetitorsPage() {
  return (
    <div className="container mx-auto px-4 md:px-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Competitors Analysis</h1>
        <p className="text-muted-foreground">Track and analyze your competition</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Coming Soon</CardTitle>
            <CardDescription>
              Competitor tracking features will be available soon
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
