import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";

export function SettingsPage() {
  return (
    <div className="px-4 py-4 md:py-6 lg:px-6">
      <div className="mx-auto w-full max-w-5xl space-y-6">
        <div className="flex flex-col gap-2">
          <h2 className="font-semibold leading-none">Settings</h2>
          <p className="text-muted-foreground text-sm">
            Manage your account and preferences
          </p>
        </div>

        {/* Account Settings */}
        <Card className="p-6 border border-gray-200 dark:border-zinc-800 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Account
          </h2>
          <div className="space-y-4">
            <div>
              <Label className="text-gray-700 dark:text-gray-300 block mb-2">
                Email
              </Label>
              <Input
                type="email"
                value="user@example.com"
                disabled
                className="bg-gray-100 dark:bg-zinc-900 border-gray-300 dark:border-zinc-700 text-gray-600 dark:text-gray-400"
              />
            </div>
            <div>
              <Label className="text-gray-700 dark:text-gray-300 block mb-2">
                Full Name
              </Label>
              <Input
                type="text"
                placeholder="Your name"
                className="border-gray-300 dark:border-zinc-700"
              />
            </div>
            <Button className="bg-blue-600 hover:bg-blue-700 text-white">
              Save Changes
            </Button>
          </div>
        </Card>

        {/* Preferences */}
        <Card className="p-6 border border-gray-200 dark:border-zinc-800 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Preferences
          </h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-gray-700 dark:text-gray-300">
                  Email Notifications
                </Label>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Receive email updates when generations complete
                </p>
              </div>
              <input type="checkbox" defaultChecked className="w-5 h-5" />
            </div>
          </div>
        </Card>

        {/* Related Links */}
        <div className="space-y-3">
          <Link to="/settings/billing">
            <Card className="p-4 border border-gray-200 dark:border-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-900/50 cursor-pointer transition flex items-center justify-between">
              <div>
                <h3 className="font-medium text-gray-900 dark:text-white">
                  Billing & Subscription
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Manage your plan and payment methods
                </p>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </Card>
          </Link>

          <div className="border-t border-gray-200 dark:border-zinc-800 pt-6">
            <Button
              variant="destructive"
              className="text-red-600 border border-red-200 dark:border-red-900 hover:bg-red-50 dark:hover:bg-red-950 bg-white dark:bg-transparent"
            >
              Delete Account
            </Button>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              This action cannot be undone. All your data will be permanently deleted.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
