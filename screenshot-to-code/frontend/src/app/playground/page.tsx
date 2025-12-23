import { BaseLayout } from "@/components/layouts/base-layout"
import { Card } from "@/components/ui/card"

export default function PlaygroundPage() {
  return (
    <BaseLayout
      title="Playground"
      description="Code generation workspace (stub)"
    >
      <div className="@container/main px-4 lg:px-6 space-y-6">
        <Card className="p-6">
          <p className="text-muted-foreground">UI ready. Logic will be connected next step.</p>
        </Card>
      </div>
    </BaseLayout>
  )
}
