/**
 * Zod schemas для API валидации
 * SSOT для всех input/output типов
 */

import { z } from "zod"

/**
 * DASHBOARD APIs
 */
export const dashboardKpiSchema = z.object({
  totalCompetitors: z.number().int().min(0),
  totalSubscribers: z.number().int().min(0),
  totalVideos: z.number().int().min(0),
  totalViews: z.number().int().min(0),
  avgMomentum: z.number().min(0),
  topMomentumVideo: z.string().nullable(),
  totalScriptsGenerated: z.number().int().min(0),
})

export type DashboardKPI = z.infer<typeof dashboardKpiSchema>

/**
 * COMPETITORS APIs
 */
export const competitorIdSchema = z
  .string()
  .min(1, "Competitor ID is required")
  .max(255, "Competitor ID is too long")

export const addCompetitorSchema = z.object({
  handle: z
    .string()
    .min(1, "Handle is required")
    .max(100, "Handle is too long"),
  platform: z.enum(["youtube", "tiktok", "instagram"]).default("youtube"),
})

export type AddCompetitorInput = z.infer<typeof addCompetitorSchema>

/**
 * CHANNEL APIs
 */
export const channelIdSchema = z
  .string()
  .min(1, "Channel ID is required")
  .max(255, "Channel ID is too long")

export const channelSyncSchema = z.object({
  channelId: channelIdSchema,
})

export const channelAudienceSchema = z.object({
  channelId: channelIdSchema,
})

/**
 * SCRIPTS APIs
 */
export const videoIdSchema = z
  .string()
  .min(1, "Video ID is required")
  .max(255, "Video ID is too long")

export const generateScriptSchema = z.object({
  videoIds: z
    .array(videoIdSchema)
    .min(1, "At least one video is required")
    .max(10, "Maximum 10 videos at a time"),
  topic: z.string().min(1, "Topic is required").max(500),
})

export type GenerateScriptInput = z.infer<typeof generateScriptSchema>

/**
 * API Response schemas
 */
export const apiErrorSchema = z.object({
  ok: z.literal(false),
  error: z.string(),
  message: z.string().optional(),
  statusCode: z.number().optional(),
})

export const apiSuccessSchema = <T extends z.ZodType>(dataSchema: T) =>
  z.object({
    ok: z.literal(true),
    data: dataSchema,
  })

export type ApiError = z.infer<typeof apiErrorSchema>

/**
 * Helper для создания success response
 */
export function createApiSuccess<T>(data: T) {
  return {
    ok: true as const,
    data,
  }
}

/**
 * Helper для создания error response
 */
export function createApiError(error: string, message?: string, statusCode?: number) {
  return {
    ok: false as const,
    error,
    message,
    statusCode,
  }
}
