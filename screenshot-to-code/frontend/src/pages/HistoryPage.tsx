import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Eye, Copy, Trash2, Search } from "lucide-react";

export function HistoryPage() {
  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            History
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            View and manage your previous generations
          </p>
        </div>

        {/* Search and Filters */}
        <div className="mb-6 flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search generations..."
              className="pl-10 border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-900"
            />
          </div>
          <select className="px-3 py-2 border border-gray-300 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-900 text-gray-900 dark:text-white text-sm">
            <option>All Models</option>
            <option>Claude 3.7</option>
            <option>GPT-4o</option>
            <option>Gemini</option>
          </select>
          <select className="px-3 py-2 border border-gray-300 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-900 text-gray-900 dark:text-white text-sm">
            <option>Newest First</option>
            <option>Oldest First</option>
            <option>Most Used</option>
          </select>
        </div>

        {/* Empty State */}
        <Card className="border border-gray-200 dark:border-zinc-800 p-12 text-center">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-gray-100 dark:bg-zinc-900 rounded-lg flex items-center justify-center">
              <Eye className="w-8 h-8 text-gray-400" />
            </div>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            No generations yet
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Create your first generation in the Playground to see it here
          </p>
          <Button className="bg-blue-600 hover:bg-blue-700 text-white">
            Go to Playground
          </Button>
        </Card>

        {/* Example Generation Items (hidden by default) */}
        <div className="hidden space-y-4">
          {[1, 2, 3].map((i) => (
            <Card
              key={i}
              className="p-4 border border-gray-200 dark:border-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-900/50 transition"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 dark:text-white">
                    HTML Navbar Component
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Generated 5 minutes ago • Claude 3.7 • HTML + Tailwind
                  </p>
                </div>
                <div className="flex gap-2 ml-4">
                  <Button variant="outline" size="sm">
                    <Eye className="w-4 h-4" />
                  </Button>
                  <Button variant="outline" size="sm">
                    <Copy className="w-4 h-4" />
                  </Button>
                  <Button variant="outline" size="sm" className="text-red-600">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
