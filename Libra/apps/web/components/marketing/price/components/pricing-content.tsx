/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * pricing-content.tsx
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

import * as m from '@/paraglide/messages'
import { useTRPC } from '@/trpc/client'
import { Switch } from '@libra/ui/components/switch'
import { useQuery } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { useState } from 'react'
import { useSubscription } from '../hooks/use-subscription'
import type { ApiPlan, Plan } from '../types'
import { createEnterprisePlan, transformApiPlanToPlan } from '../utils/plan-utils'
import { EnterpriseHorizontal, PricingColumn } from './pricing-column'

interface PricingContentProps {
  title?: string
  description?: string
  yearlyDiscount: number
  propPlans?: Plan[]
  showEnterprise: boolean
}

export function PricingContent({ title, description, yearlyDiscount, propPlans, showEnterprise }: PricingContentProps) {
  const [isYearly, setIsYearly] = useState(false)
  const { isAuthenticated, handleUpgradeSubscription, handleManageSubscription } = useSubscription()

  const trpc = useTRPC()
  const plansQuery = useQuery(trpc.stripe.getUserPlans.queryOptions())
  const { data: plansData, isLoading, error } = plansQuery

  // Transform API data to Plan objects
  const plans =
    plansData?.data && plansData.data.length > 0
      ? plansData.data.map((plan: ApiPlan) =>
          transformApiPlanToPlan(
            plan,
            isAuthenticated,
            (planName, seats) => handleUpgradeSubscription(planName, seats, isYearly),
            handleManageSubscription,
            plansData.hasPaidSubscription
          )
        )
      : propPlans || []

  const enterprisePlan = createEnterprisePlan()

  return (
    <>
      {(title || description) && (
        <div className='flex flex-col items-center gap-4 text-center sm:gap-6 md:gap-8'>
          {title && (
            <h2 className='text-2xl leading-tight font-semibold text-balance sm:text-3xl md:text-4xl lg:text-5xl sm:leading-tight'>
              {title}
            </h2>
          )}
          {description && (
            <p className='text-base text-muted-foreground max-w-full sm:max-w-[720px] md:max-w-[920px] font-medium text-balance sm:text-lg md:text-xl'>
              {description}
            </p>
          )}
        </div>
      )}

      <div className='flex flex-col items-center gap-4'>
        <div className='flex flex-wrap items-center justify-center gap-3 sm:gap-4'>
          <span className='text-sm'>{m['pricing.monthly']()}</span>
          <Switch
            checked={isYearly}
            onCheckedChange={setIsYearly}
            className='data-[state=checked]:bg-brand'
          />
          <span className='text-sm'>
            {m['pricing.yearly']()}
            <span className='bg-brand/10 text-brand ml-1.5 rounded-full px-2 py-0.5 text-xs'>
              {m['pricing.save_up_to']({ discount: yearlyDiscount })}
            </span>
          </span>
        </div>
      </div>

      {isLoading ? (
        <div className='flex flex-col items-center gap-4 py-12'>
          <Loader2 className='h-8 w-8 animate-spin text-brand' />
          <p>{m['pricing.loading']()}</p>
        </div>
      ) : error ? (
        <div className='flex flex-col items-center gap-4 py-12'>
          <p className='text-red-500'>{m['pricing.error']()}</p>
        </div>
      ) : (
        <>
          <div className='max-w-container mx-auto grid w-full grid-cols-1 gap-6 sm:gap-8 sm:grid-cols-2 lg:grid-cols-3'>
            {plans
              .filter((plan) => !plan.isEnterprise)
              .map((plan) => (
                <PricingColumn
                  key={plan.id}
                  name={plan.name}
                  icon={plan.icon}
                  description={plan.description}
                  price={isYearly ? Math.round(plan.yearlyPrice / 12) : plan.monthlyPrice}
                  isYearly={isYearly}
                  monthlyPrice={plan.monthlyPrice}
                  yearlyPrice={plan.yearlyPrice}
                  cta={plan.cta}
                  features={plan.features}
                  marketingFeatures={plan.marketingFeatures}
                  variant={plan.variant}
                  isCurrentPlan={plan.isCurrentPlan}
                />
              ))}
          </div>

          {showEnterprise && (
            <div className='w-full mt-8 sm:mt-10 md:mt-12'>
              <EnterpriseHorizontal
                name={enterprisePlan.name}
                icon={enterprisePlan.icon}
                description={enterprisePlan.description}
                cta={enterprisePlan.cta}
                features={enterprisePlan.features}
                marketingFeatures={enterprisePlan.marketingFeatures}
                variant='enterprise'
              />
            </div>
          )}
        </>
      )}
    </>
  )
}
