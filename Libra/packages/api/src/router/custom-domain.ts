/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * custom-domain.ts
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

import { log, tryCatch } from '@libra/common'
import { project } from '@libra/db/schema/project-schema'
import { TRPCError } from '@trpc/server'
import { eq } from 'drizzle-orm'
import {
  customDomainSchema,
  removeCustomDomainSchema,
  verifyCustomDomainSchema,
} from '../schemas/project-schema'
import { createTRPCRouter, organizationProcedure } from '../trpc'
import { env } from '../../env.mjs'
import {
  createCustomHostname,
  deleteCustomHostname,
  generateDCVRecord,
  getCustomHostnameStatus,
  verifyDomainOwnership,
} from '../utils/cloudflare-domain'
import { ensureOrgAccess, fetchProject, getBusinessDb, requireOrgAndUser, withDbCleanup } from '../utils/project'
import { requirePremiumMembership, getMembershipStatus, requireCustomDomainAccess } from '../utils/membership-validation'

export const customDomainRouter = createTRPCRouter({
  setCustomDomain: organizationProcedure
    .input(customDomainSchema)
    .mutation(async ({ ctx, input }) => {
      const { projectId, customDomain } = input
      const context = {
        userId: ctx.session.user.id,
        organizationId: ctx.orgId,
        projectId,
        operation: 'setCustomDomain',
      }

      log.deployment('info', 'Setting custom domain for project', {
        ...context,
        customDomain,
      })

      const [result, error] = await tryCatch(async () => {
        // Verify user permissions and get project data
        const { orgId } = await requireOrgAndUser(ctx)

        // Check premium membership for custom domain feature
        await requirePremiumMembership(orgId, 'custom domains')

        return await withDbCleanup(async (db) => {
          const projectData = await fetchProject(db, projectId)
          ensureOrgAccess(projectData, orgId, 'access')

        // Check if domain is already in use by another project
        const existingProject = await db
          .select()
          .from(project)
          .where(eq(project.customDomain, customDomain))
          .limit(1)

        if (existingProject.length > 0 && existingProject[0]?.id !== projectId) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'This domain is already in use by another project',
          })
        }

        // Create custom hostname using Cloudflare for SaaS API
        const saasZoneId = env.CLOUDFLARE_SAAS_ZONE_ID

        if (!saasZoneId) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'SaaS zone configuration missing',
          })
        }

        const hostnameResult = await createCustomHostname(customDomain, saasZoneId)

        if (!hostnameResult.success) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: hostnameResult.error || 'Failed to create custom hostname',
          })
        }

        // Update project with custom domain and Cloudflare data
        await db
          .update(project)
          .set({
            customDomain,
            customDomainStatus: 'pending',
            customDomainVerifiedAt: null,
            customHostnameId: hostnameResult.customHostnameId,
            ownershipVerification: JSON.stringify(hostnameResult.ownershipVerification),
            sslStatus: hostnameResult.sslStatus as 'pending' | 'pending_validation' | 'active' | 'failed',
          })
          .where(eq(project.id, projectId))

        log.deployment('info', 'Custom domain set successfully', {
          ...context,
          customDomain,
          customHostnameId: hostnameResult.customHostnameId,
        })

          return {
            success: true,
            message:
              'Custom domain created successfully. Please add the TXT record to verify ownership.',
            domain: customDomain,
            status: 'pending',
            ownershipVerification: hostnameResult.ownershipVerification,
          }
        })
      })

      if (error) {
        if (error instanceof TRPCError) {
          throw error
        }

        log.deployment(
          'error',
          'Failed to set custom domain',
          context,
          error instanceof Error ? error : new Error(String(error))
        )

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to set custom domain',
        })
      }

      return result
    }),

  verifyCustomDomain: organizationProcedure
    .input(verifyCustomDomainSchema)
    .mutation(async ({ ctx, input }) => {
      const { projectId } = input
      const context = {
        userId: ctx.session.user.id,
        organizationId: ctx.orgId,
        projectId,
        operation: 'verifyCustomDomain',
      }

      log.deployment('info', 'Verifying custom domain for project', context)

      try {
        // Verify user permissions and get project data
        const { orgId } = await requireOrgAndUser(ctx)

        return await withDbCleanup(async (db) => {
          const projectData = await fetchProject(db, projectId)
          ensureOrgAccess(projectData, orgId, 'access')

        if (!projectData.customDomain || !projectData.customHostnameId) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'No custom domain configured for this project',
          })
        }

        // Get custom hostname status from Cloudflare
        const saasZoneId = env.CLOUDFLARE_SAAS_ZONE_ID

        if (!saasZoneId) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'SaaS zone configuration missing',
          })
        }

        const statusResult = await getCustomHostnameStatus(projectData.customHostnameId, saasZoneId)

        if (!statusResult.success) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: statusResult.error || 'Failed to check domain verification status',
          })
        }

        // Log the full status result for debugging
        log.deployment('info', 'Cloudflare custom hostname status check', {
          ...context,
          customDomain: projectData.customDomain,
          cloudflareStatus: statusResult.status,
          sslStatus: statusResult.sslStatus,
          verificationErrors: statusResult.verificationErrors,
          ownershipVerification: statusResult.ownershipVerification
        })

        // Check if there are verification errors
        if (statusResult.verificationErrors && statusResult.verificationErrors.length > 0) {
          const errorMessage = statusResult.verificationErrors.join('; ')

          await db
            .update(project)
            .set({
              customDomainStatus: 'failed',
            })
            .where(eq(project.id, projectId))

          log.deployment('warn', 'Domain verification failed with errors', {
            ...context,
            customDomain: projectData.customDomain,
            verificationErrors: statusResult.verificationErrors
          })

          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `Domain verification failed: ${errorMessage}`,
          })
        }

        // Check domain verification status and determine appropriate action
        let newStatus: string
        let shouldUpdateDatabase = true
        let successMessage = ''

        if (statusResult.status === 'active') {
          // Hostname verification is complete, now check SSL status
          if (statusResult.sslStatus === 'pending_validation') {
            // TXT verification succeeded, but SSL certificate validation is pending
            // Show DCV and domain resolution records
            newStatus = 'verified'
            successMessage = 'Domain ownership verified successfully. Please configure the DNS records below to complete SSL certificate validation and domain resolution.'
          } else if (statusResult.sslStatus === 'active') {
            // Both hostname and SSL verification are complete
            newStatus = 'active'
            successMessage = 'Domain verified and activated successfully'
          } else {
            // SSL verification failed or other status
            newStatus = 'verified'
            successMessage = 'Domain ownership verified. SSL certificate validation is in progress. Please configure the DNS records below.'
          }
        } else if (statusResult.status === 'pending') {
          // Still waiting for TXT record verification
          newStatus = 'pending'
          shouldUpdateDatabase = false

          log.deployment('info', 'Domain verification still pending', {
            ...context,
            customDomain: projectData.customDomain,
            cloudflareStatus: statusResult.status
          })

          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Domain verification is still pending. Please ensure the required TXT record is correctly configured and DNS changes have propagated.',
          })
        } else {
          // Verification failed or other status
          newStatus = 'failed'
          shouldUpdateDatabase = false

          await db
            .update(project)
            .set({
              customDomainStatus: 'failed',
            })
            .where(eq(project.id, projectId))

          log.deployment('warn', 'Domain verification failed', {
            ...context,
            customDomain: projectData.customDomain,
            cloudflareStatus: statusResult.status
          })

          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Domain ownership verification failed. Please ensure the required TXT record is correctly configured.',
          })
        }

        if (shouldUpdateDatabase) {
          await db
            .update(project)
            .set({
              customDomainStatus: newStatus as 'pending' | 'verified' | 'active' | 'failed',
              customDomainVerifiedAt: new Date().toISOString(),
              sslStatus: statusResult.sslStatus as 'pending' | 'pending_validation' | 'active' | 'failed',
            })
            .where(eq(project.id, projectId))

          log.deployment('info', 'Custom domain verification status updated', {
            ...context,
            customDomain: projectData.customDomain,
            cloudflareStatus: statusResult.status,
            sslStatus: statusResult.sslStatus,
            finalStatus: newStatus,
          })
        }

        return {
          success: true,
          message: successMessage,
          domain: projectData.customDomain,
          status: newStatus,
          sslStatus: statusResult.sslStatus,
          cloudflareStatus: statusResult.status,
        }
        })
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error
        }

        log.deployment(
          'error',
          'Failed to verify custom domain',
          context,
          error instanceof Error ? error : new Error(String(error))
        )

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to verify custom domain',
        })
      }
    }),

  removeCustomDomain: organizationProcedure
    .input(removeCustomDomainSchema)
    .mutation(async ({ ctx, input }) => {
      const { projectId } = input
      const context = {
        userId: ctx.session.user.id,
        organizationId: ctx.orgId,
        projectId,
        operation: 'removeCustomDomain',
      }

      log.deployment('info', 'Removing custom domain for project', context)

      try {
        // Verify user permissions and get project data
        const { orgId } = await requireOrgAndUser(ctx)

        return await withDbCleanup(async (db) => {
          const projectData = await fetchProject(db, projectId)
          ensureOrgAccess(projectData, orgId, 'access')

        // Delete custom hostname from Cloudflare if it exists
        if (projectData.customHostnameId) {
          const saasZoneId = env.CLOUDFLARE_SAAS_ZONE_ID
          if (saasZoneId) {
            await deleteCustomHostname(projectData.customHostnameId, saasZoneId)
          }
        }

        // Remove custom domain
        await db
          .update(project)
          .set({
            customDomain: null,
            customDomainStatus: null,
            customDomainVerifiedAt: null,
            customHostnameId: null,
            ownershipVerification: null,
            sslStatus: null,
          })
          .where(eq(project.id, projectId))

        log.deployment('info', 'Custom domain removed successfully', {
          ...context,
          removedDomain: projectData.customDomain,
        })

          return {
            success: true,
            message: 'Custom domain removed successfully',
          }
        })
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error
        }

        log.deployment(
          'error',
          'Failed to remove custom domain',
          context,
          error instanceof Error ? error : new Error(String(error))
        )

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to remove custom domain',
        })
      }
    }),

  getCustomDomainStatus: organizationProcedure
    .input(verifyCustomDomainSchema)
    .query(async ({ ctx, input }) => {
      const { projectId } = input
      const context = {
        userId: ctx.session.user.id,
        organizationId: ctx.orgId,
        projectId,
        operation: 'getCustomDomainStatus',
      }

      const [result, error] = await tryCatch(async () => {
        // Verify user permissions and get project data
        const { orgId } = await requireOrgAndUser(ctx)

        return await withDbCleanup(async (db) => {
          const projectData = await fetchProject(db, projectId)
          ensureOrgAccess(projectData, orgId, 'access')

        // Parse ownership verification if it exists
        let ownershipVerification = null
        if (projectData.ownershipVerification) {
          const [parsed, parseError] = tryCatch(() => {
            return JSON.parse(projectData.ownershipVerification)
          })
          if (!parseError) {
            ownershipVerification = parsed
          }
        }

        return {
          customDomain: projectData.customDomain,
          status: projectData.customDomainStatus,
          verifiedAt: projectData.customDomainVerifiedAt,
          customHostnameId: projectData.customHostnameId,
          ownershipVerification,
          sslStatus: projectData.sslStatus,
        }
        })
      })

      if (error) {
        if (error instanceof TRPCError) {
          throw error
        }

        log.deployment(
          'error',
          'Failed to get custom domain status',
          context,
          error instanceof Error ? error : new Error(String(error))
        )

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to get custom domain status',
        })
      }

      return result
    }),

  getMembershipStatus: organizationProcedure
    .query(async ({ ctx }) => {
      const context = {
        userId: ctx.session.user.id,
        organizationId: ctx.orgId,
        operation: 'getMembershipStatus',
      }

      const [membershipStatus, error] = await tryCatch(async () => {
        // Verify user permissions
        const { orgId } = await requireOrgAndUser(ctx)

        // Get membership status for the organization
        const status = await getMembershipStatus(orgId)

        log.subscription('info', 'Membership status retrieved', {
          ...context,
          membershipStatus: status,
        })

        return status
      })

      if (error) {
        if (error instanceof TRPCError) {
          throw error
        }

        log.subscription(
          'error',
          'Failed to get membership status',
          context,
          error instanceof Error ? error : new Error(String(error))
        )

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to get membership status',
        })
      }

      return membershipStatus
    }),
})
