import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";

export function BillingPage() {
  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Billing
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Manage your subscription and billing information
          </p>
        </div>

        {/* Current Plan */}
        <Card className="p-6 border border-gray-200 dark:border-zinc-800 mb-8">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Current Plan
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Plan Name</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                Free
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Billing Cycle</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                Always Free
              </p>
            </div>
          </div>
          <div className="mt-6 pt-6 border-t border-gray-200 dark:border-zinc-800">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
              Usage this month
            </p>
            <div className="w-full bg-gray-200 dark:bg-zinc-800 rounded-full h-2">
              <div className="bg-blue-600 h-2 rounded-full" style={{ width: "0%" }} />
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
              0 / 10 generations
            </p>
          </div>
        </Card>

        {/* Pricing Plans */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Upgrade Your Plan
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Free Plan */}
            <Card className="p-6 border border-gray-200 dark:border-zinc-800 relative">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Free</h3>
              <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
                $0<span className="text-lg text-gray-600 dark:text-gray-400">/mo</span>
              </p>
              <Button
                disabled
                className="w-full mt-4 bg-blue-100 text-blue-900 dark:bg-blue-900 dark:text-blue-100 cursor-not-allowed"
              >
                Current Plan
              </Button>
              <ul className="space-y-3 mt-6 text-sm">
                <li className="flex gap-3">
                  <Check className="w-5 h-5 text-green-600 flex-shrink-0" />
                  <span className="text-gray-700 dark:text-gray-300">10 generations/month</span>
                </li>
                <li className="flex gap-3">
                  <Check className="w-5 h-5 text-green-600 flex-shrink-0" />
                  <span className="text-gray-700 dark:text-gray-300">Basic AI models</span>
                </li>
                <li className="flex gap-3">
                  <Check className="w-5 h-5 text-green-600 flex-shrink-0" />
                  <span className="text-gray-700 dark:text-gray-300">Community support</span>
                </li>
              </ul>
            </Card>

            {/* Pro Plan */}
            <Card className="p-6 border-2 border-blue-600 dark:border-blue-500 relative">
              <div className="absolute -top-3 left-4 bg-blue-600 text-white px-3 py-1 rounded text-xs font-semibold">
                Most Popular
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Pro</h3>
              <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
                $29<span className="text-lg text-gray-600 dark:text-gray-400">/mo</span>
              </p>
              <Button className="w-full mt-4 bg-blue-600 hover:bg-blue-700 text-white">
                Upgrade to Pro
              </Button>
              <ul className="space-y-3 mt-6 text-sm">
                <li className="flex gap-3">
                  <Check className="w-5 h-5 text-green-600 flex-shrink-0" />
                  <span className="text-gray-700 dark:text-gray-300">Unlimited generations</span>
                </li>
                <li className="flex gap-3">
                  <Check className="w-5 h-5 text-green-600 flex-shrink-0" />
                  <span className="text-gray-700 dark:text-gray-300">All AI models</span>
                </li>
                <li className="flex gap-3">
                  <Check className="w-5 h-5 text-green-600 flex-shrink-0" />
                  <span className="text-gray-700 dark:text-gray-300">Priority support</span>
                </li>
                <li className="flex gap-3">
                  <Check className="w-5 h-5 text-green-600 flex-shrink-0" />
                  <span className="text-gray-700 dark:text-gray-300">API access</span>
                </li>
              </ul>
            </Card>

            {/* Enterprise Plan */}
            <Card className="p-6 border border-gray-200 dark:border-zinc-800">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Enterprise</h3>
              <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
                Custom<span className="text-lg text-gray-600 dark:text-gray-400">/mo</span>
              </p>
              <Button variant="outline" className="w-full mt-4">
                Contact Sales
              </Button>
              <ul className="space-y-3 mt-6 text-sm">
                <li className="flex gap-3">
                  <Check className="w-5 h-5 text-green-600 flex-shrink-0" />
                  <span className="text-gray-700 dark:text-gray-300">Everything in Pro</span>
                </li>
                <li className="flex gap-3">
                  <Check className="w-5 h-5 text-green-600 flex-shrink-0" />
                  <span className="text-gray-700 dark:text-gray-300">Team management</span>
                </li>
                <li className="flex gap-3">
                  <Check className="w-5 h-5 text-green-600 flex-shrink-0" />
                  <span className="text-gray-700 dark:text-gray-300">SSO & advanced security</span>
                </li>
                <li className="flex gap-3">
                  <Check className="w-5 h-5 text-green-600 flex-shrink-0" />
                  <span className="text-gray-700 dark:text-gray-300">Dedicated support</span>
                </li>
              </ul>
            </Card>
          </div>
        </div>

        {/* Payment History */}
        <Card className="p-6 border border-gray-200 dark:border-zinc-800">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Payment History
          </h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between py-3 border-b border-gray-200 dark:border-zinc-800">
              <div>
                <p className="font-medium text-gray-900 dark:text-white">Free Plan - Active</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">Started Dec 22, 2024</p>
              </div>
              <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">$0.00</span>
            </div>
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
}
