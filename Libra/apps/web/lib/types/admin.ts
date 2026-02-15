/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * admin.ts
 * Copyright (C) 2025 Nextify Limited
 */

/**
 * User data structure from better-auth admin API
 */
export interface AdminUser {
  id: string
  name: string
  email: string
  emailVerified: boolean
  image?: string | null
  createdAt: Date | string
  updatedAt: Date | string
  role?: string
  banned?: boolean | null
  banReason?: string | null
  banExpires?: Date | string | null
}

/**
 * User list response from better-auth admin API
 */
export interface AdminUserListResponse {
  users: AdminUser[]
  total: number
  limit?: number
  offset?: number
}

/**
 * Query parameters for listing users
 */
export interface AdminUserListQuery {
  searchField?: 'email' | 'name'
  searchOperator?: 'contains' | 'starts_with' | 'ends_with'
  searchValue?: string
  limit?: number
  offset?: number
  sortBy?: string
  sortDirection?: 'asc' | 'desc'
  filterField?: string
  filterOperator?: 'eq' | 'contains' | 'starts_with' | 'ends_with'
  filterValue?: string
}

/**
 * Ban user parameters
 */
export interface BanUserParams {
  userId: string
  banReason?: string
  banExpiresIn?: number
}

/**
 * Unban user parameters
 */
export interface UnbanUserParams {
  userId: string
}

/**
 * Table column sorting state
 */
export interface SortingState {
  id: string
  desc: boolean
}

/**
 * Table pagination state
 */
export interface PaginationState {
  pageIndex: number
  pageSize: number
}

/**
 * Global filter state for search
 */
export interface GlobalFilterState {
  searchField: 'email' | 'name'
  searchValue: string
}
