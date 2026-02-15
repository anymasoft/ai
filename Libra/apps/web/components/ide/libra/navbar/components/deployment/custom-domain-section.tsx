/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * custom-domain-section.tsx
 * Copyright (C) 2025 Nextify Limited
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 *
 */

'use client'

import { useId, useState } from 'react'
import { Check, Copy, Globe, Loader2, Plus, RefreshCw, X, Settings } from 'lucide-react'
import { Button } from '@libra/ui/components/button'
import { Input } from '@libra/ui/components/input'
import { cn } from '@libra/ui/lib/utils'
import { FeatureGate } from '@/components/common/membership/feature-gate'
import type { CustomDomainStatus } from '../../types/deployment'
import {
  useDnsRecords,
  getStatusColor,
  getStatusText,
  isApexDomain
} from './hooks/use-dns-records'
import { useAsyncOperation } from './hooks/use-loading-state'
import * as m from '@/paraglide/messages'

interface CustomDomainSectionProps {
  customDomainStatus?: CustomDomainStatus
  onSetCustomDomain?: (domain: string) => Promise<void>
  onVerifyCustomDomain?: () => Promise<void>
  onRemoveCustomDomain?: () => Promise<void>
  isLoading?: boolean
}



export function CustomDomainSection({
  customDomainStatus,
  onSetCustomDomain,
  onVerifyCustomDomain,
  onRemoveCustomDomain,
  isLoading = false
}: CustomDomainSectionProps) {
  const [showAddDomain, setShowAddDomain] = useState(false)
  const [customDomain, setCustomDomain] = useState('')
  const [domainInputError, setDomainInputError] = useState('')
  const domainInputId = useId()

  const [copiedField, setCopiedField] = useState<string | null>(null)

  // Use DNS records hook
  const dnsRecords = useDnsRecords(customDomainStatus)

  // Async operations management
  const setDomainOperation = useAsyncOperation({
    onSuccess: () => {
      setShowAddDomain(false)
      setCustomDomain('')
      setDomainInputError('')
    }
  })

  const verifyDomainOperation = useAsyncOperation()
  const removeDomainOperation = useAsyncOperation()

  const handleCopy = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedField(field)
      setTimeout(() => setCopiedField(null), 2000)
    } catch {
      // Handle copy error silently
    }
  }

  const validateDomain = (domain: string): boolean => {
    if (!domain.trim()) {
      setDomainInputError(m["ide.deployment.dialog.domainRequired"]())
      return false
    }

    // Remove protocol if present and clean the domain
    const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/\/$/, '').toLowerCase()

    // More comprehensive domain validation
    const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/
    if (!domainRegex.test(cleanDomain)) {
      setDomainInputError(m["ide.deployment.dialog.invalidDomainFormat"]())
      return false
    }

    // Update the domain value with cleaned version
    if (cleanDomain !== domain) {
      setCustomDomain(cleanDomain)
    }

    return true
  }

  const handleSetCustomDomain = async () => {
    if (!validateDomain(customDomain) || !onSetCustomDomain) return

    await setDomainOperation.execute(() => onSetCustomDomain(customDomain))
  }

  const handleCustomDomainChange = (value: string) => {
    setCustomDomain(value)
    setDomainInputError('')
  }





  return (
    <div className="space-y-4">
      {/* Section Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500/10 to-pink-500/10 flex items-center justify-center">
          <Settings className="w-5 h-5 text-purple-600 dark:text-purple-400" />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-foreground">{m["ide.deployment.customDomain.customDomain"]()}</h3>
          <p className="text-xs text-muted-foreground">
            {m["ide.deployment.dialog.useCustomDomain"]()}
          </p>
        </div>
      </div>

      {/* Current Custom Domain */}
      {customDomainStatus?.customDomain ? (
        <div className="space-y-4">
          {/* Domain Status Card */}
          <div className="bg-gradient-to-r from-muted/30 to-muted/10 rounded-lg border border-border/50 p-3 sm:p-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Globe className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                </div>
                <div className="space-y-1 min-w-0">
                  <h4 className="text-sm sm:text-base font-medium text-foreground break-all">{customDomainStatus.customDomain}</h4>
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "inline-flex items-center px-2 py-1 rounded text-xs font-medium",
                      getStatusColor(customDomainStatus.status || undefined)
                    )}>
                      {getStatusText(customDomainStatus.status || undefined)}
                    </span>
                    {customDomainStatus.status === 'active' && customDomainStatus.sslStatus === 'active' && (
                      <div className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                        <div className="h-1.5 w-1.5 rounded-full bg-green-500" />
                        <span>{m["ide.deployment.dialog.live"]()}</span>
                      </div>
                    )}
                    {customDomainStatus.status === 'active' && customDomainStatus.sslStatus === 'pending_validation' && (
                      <div className="flex items-center gap-1 text-xs text-yellow-600 dark:text-yellow-400">
                        <div className="h-1.5 w-1.5 rounded-full bg-yellow-500" />
                        <span>{m["ide.deployment.customDomain.configuring"]()}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {onVerifyCustomDomain && (customDomainStatus.status === 'pending' || customDomainStatus.status === 'failed' || customDomainStatus.status === 'verified' || (customDomainStatus.status === 'active' && customDomainStatus.sslStatus === 'pending_validation')) && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => verifyDomainOperation.execute(() => onVerifyCustomDomain())}
                    disabled={verifyDomainOperation.isLoading || isLoading}
                    className="h-8 px-3 text-xs"
                  >
                    {verifyDomainOperation.isLoading ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <>
                        <RefreshCw className="mr-1 h-3 w-3" />
                        {m["ide.deployment.customDomain.verify"]()}
                      </>
                    )}
                  </Button>
                )}
                {onRemoveCustomDomain && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => removeDomainOperation.execute(() => onRemoveCustomDomain())}
                    disabled={removeDomainOperation.isLoading || isLoading}
                    className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    {removeDomainOperation.isLoading ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <X className="h-3 w-3" />
                    )}
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* DNS Configuration */}
          {((customDomainStatus.ownershipVerification && (customDomainStatus.status === 'pending' || customDomainStatus.status === 'failed')) ||
           (customDomainStatus.status === 'verified') ||
           (customDomainStatus.status === 'active' && customDomainStatus.sslStatus === 'pending_validation')) && (
            <div className="space-y-3">
              <div className="space-y-1">
                <h4 className="text-sm font-medium text-foreground">
                  {(customDomainStatus.status === 'verified' ||
                    (customDomainStatus.status === 'active' && customDomainStatus.sslStatus === 'pending_validation'))
                    ? m["ide.deployment.customDomain.domainConfiguration"]()
                    : m["ide.deployment.customDomain.domainVerification"]()}
                </h4>
                <p className="text-xs text-muted-foreground">
                  {(customDomainStatus.status === 'verified' ||
                    (customDomainStatus.status === 'active' && customDomainStatus.sslStatus === 'pending_validation'))
                    ? (customDomainStatus.customDomain && isApexDomain(customDomainStatus.customDomain)
                        ? m["ide.deployment.customDomain.addDnsRecordsApex"]()
                        : m["ide.deployment.customDomain.addDnsRecordsSubdomain"]())
                    : m["ide.deployment.customDomain.addDnsRecord"]()
                  }
                </p>
              </div>

              <div className="space-y-2">
                {dnsRecords.map((record) => {
                  // Generate unique identifiers for each record's copy buttons
                  const recordKey = `${record.type}-${record.name}`;
                  const nameFieldKey = `name-${recordKey}`;
                  const targetFieldKey = `target-${recordKey}`;

                  return (
                    <div key={recordKey} className="bg-muted/20 rounded border p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono font-medium">{record.type}</span>
                        <span className={cn(
                          "text-xs px-2 py-1 rounded",
                          record.status === 'pending' ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-300" : ""
                        )}>
                          {getStatusText(record.status)}
                        </span>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center gap-2 p-2 bg-background rounded border">
                          <span className="text-xs text-muted-foreground w-12 flex-shrink-0">{m["ide.deployment.customDomain.name"]()}:</span>
                          <code className="flex-1 text-xs font-mono break-all">{record.name}</code>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCopy(record.name, nameFieldKey)}
                            className="h-6 w-6 p-0 flex-shrink-0"
                          >
                            {copiedField === nameFieldKey ? (
                              <Check className="h-3 w-3 text-green-600" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </Button>
                        </div>

                        <div className="flex items-center gap-2 p-2 bg-background rounded border">
                          <span className="text-xs text-muted-foreground w-12 flex-shrink-0">{m["ide.deployment.customDomain.target"]()}:</span>
                          <code className="flex-1 text-xs font-mono break-all">{record.target}</code>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCopy(record.target, targetFieldKey)}
                            className="h-6 w-6 p-0 flex-shrink-0"
                          >
                            {copiedField === targetFieldKey ? (
                              <Check className="h-3 w-3 text-green-600" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Status Message */}
              <div className={cn(
                "rounded p-2 text-xs",
                customDomainStatus.status === 'failed' && "bg-orange-50 dark:bg-orange-950/20 text-orange-800 dark:text-orange-200",
                customDomainStatus.status === 'verified' && "bg-blue-50 dark:bg-blue-950/20 text-blue-800 dark:text-blue-200",
                customDomainStatus.status === 'pending' && "bg-blue-50 dark:bg-blue-950/20 text-blue-800 dark:text-blue-200"
              )}>
                {customDomainStatus.status === 'failed'
                  ? m["ide.deployment.customDomain.verificationFailed"]()
                  : customDomainStatus.status === 'verified'
                    ? m["ide.deployment.customDomain.ownershipVerified"]()
                    : m["ide.deployment.customDomain.dnsHint"]()
                }
              </div>

              {/* Additional CNAME flattening info for apex domains */}
              {customDomainStatus.status === 'verified' &&
               customDomainStatus.customDomain &&
               isApexDomain(customDomainStatus.customDomain) && (
                <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded p-2 text-xs text-amber-800 dark:text-amber-200">
                  <div className="font-medium mb-1">{m["ide.deployment.customDomain.cnameFlattening"]()}</div>
                  <div>{m["ide.deployment.customDomain.cnameAlternative"]()}</div>
                </div>
              )}
            </div>
          )}

          {/* SSL Status */}
          {customDomainStatus.sslStatus === 'active' && customDomainStatus.status === 'active' && (
            <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-green-500" />
                <span className="text-sm font-medium text-green-800 dark:text-green-200">
                  {m["ide.deployment.dialog.sslCertificateActive"]()}
                </span>
              </div>
              <p className="text-xs text-green-600 dark:text-green-300 mt-1">
                {m["ide.deployment.dialog.sslCertificateDescription"]()}
              </p>
            </div>
          )}

          {/* SSL Pending Validation Status */}
          {customDomainStatus.sslStatus === 'pending_validation' && customDomainStatus.status === 'verified' && (
            <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-yellow-500" />
                <span className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                  {m["ide.deployment.customDomain.sslPendingValidation"]()}
                </span>
              </div>
              <p className="text-xs text-yellow-600 dark:text-yellow-300 mt-1">
                {m["ide.deployment.customDomain.sslPendingDescription"]()}
              </p>
            </div>
          )}
        </div>
      ) : (
        /* Add Custom Domain with Feature Gate */
        <FeatureGate
          feature="customDomains"
          upgradePrompt={{
            title: m["ide.deployment.dialog.premiumFeature"](),
            message: m["ide.deployment.dialog.customDomainsPremiumFeature"](),
            variant: "inline",
            size: "sm"
          }}
        >
          {!showAddDomain ? (
            <button
              type="button"
              onClick={() => setShowAddDomain(true)}
              className="w-full rounded-lg p-4 border border-dashed border-border hover:border-primary/50 hover:bg-muted/50 transition-all duration-200 group"
            >
              <div className="flex items-center justify-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                  <Plus className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
                </div>
                <span className="text-sm font-medium text-foreground">{m["ide.deployment.customDomain.addCustomDomain"]()}</span>
              </div>
            </button>
          ) : (
            <div className="bg-muted/20 rounded-lg p-3 sm:p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium">{m["ide.deployment.customDomain.addCustomDomain"]()}</h4>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAddDomain(false)}
                  className="h-6 w-6 p-0"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>

              <div className="space-y-3">
                <div className="relative">
                  <Globe className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id={domainInputId}
                    placeholder="example.com"
                    value={customDomain}
                    onChange={(e) => handleCustomDomainChange(e.target.value)}
                    className={cn("pl-10", domainInputError && "border-destructive")}
                  />
                </div>
                {domainInputError && (
                  <p className="text-xs text-destructive">{domainInputError}</p>
                )}

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setShowAddDomain(false)}
                    size="sm"
                    className="flex-1 h-8 text-xs"
                  >
                    {m["ide.deployment.customDomain.cancel"]()}
                  </Button>
                  <Button
                    onClick={handleSetCustomDomain}
                    disabled={setDomainOperation.isLoading || !customDomain.trim()}
                    size="sm"
                    className="flex-1 h-8 text-xs"
                  >
                    {setDomainOperation.isLoading ? (
                      <>
                        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                        {m["ide.deployment.customDomain.setting"]()}
                      </>
                    ) : (
                      m["ide.deployment.customDomain.setDomain"]()
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </FeatureGate>
      )}
    </div>
  )
}
