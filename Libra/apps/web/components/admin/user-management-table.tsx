/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * user-management-table.tsx
 * Copyright (C) 2025 Nextify Limited
 */
'use no memo'

'use client'

import { useCallback, useMemo, useState } from 'react'

import { useQuery } from '@tanstack/react-query'
import type { SortingState } from '@tanstack/react-table'

import { authClient } from '@libra/auth/auth-client'
import * as m from '@/paraglide/messages'

import type {
  GlobalFilterState,
  PaginationState
} from '@/lib/types/admin'

import { createColumns } from './columns'
import { DataTable } from './data-table'

const DEFAULT_PAGE_SIZE = 10

export function UserManagementTable() {
  // Table state
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: DEFAULT_PAGE_SIZE,
  })
  
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'createdAt', desc: true }
  ])
  
  const [globalFilter, setGlobalFilter] = useState<GlobalFilterState>({
    searchField: 'email',
    searchValue: '',
  })

  // Build query parameters for better-auth admin API
  const queryParams = useMemo(() => {
    const params: Record<string, string | number> = {
      limit: pagination.pageSize,
      offset: pagination.pageIndex * pagination.pageSize,
    }

    // Add sorting
    if (sorting.length > 0) {
      const sort = sorting[0]
      if (sort) {
        params.sortBy = sort.id
        params.sortDirection = sort.desc ? 'desc' : 'asc'
      }
    }

    // Add search filter
    if (globalFilter.searchValue.trim()) {
      params.searchField = globalFilter.searchField
      params.searchOperator = 'contains'
      params.searchValue = globalFilter.searchValue.trim()
    }

    return params
  }, [pagination, sorting, globalFilter])

  // Fetch users using better-auth admin API
  const {
    data: usersResponse,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['admin-users', queryParams],
    queryFn: async () => {
      try {
        const response = await authClient.admin.listUsers({
          query: queryParams,
        })
        // better-auth returns data in response.data, so we need to extract it
        return response.data || response
      } catch (error) {
        console.error('Failed to fetch users:', error)
        throw error
      }
    },
    staleTime: 30000, // 30 seconds
    refetchOnWindowFocus: true,
  })

  // Handle pagination changes
  const handlePaginationChange = useCallback((newPagination: { pageIndex: number; pageSize: number }) => {
    setPagination(newPagination)
  }, [])

  // Handle sorting changes
  const handleSortingChange = useCallback((newSorting: SortingState) => {
    setSorting(newSorting)
    // Reset to first page when sorting changes
    setPagination(prev => ({ ...prev, pageIndex: 0 }))
  }, [])

  // Handle global filter changes
  const handleGlobalFilterChange = useCallback((value: string) => {
    setGlobalFilter(prev => ({ ...prev, searchValue: value }))
    // Reset to first page when filter changes
    setPagination(prev => ({ ...prev, pageIndex: 0 }))
  }, [])

  // Calculate pagination info
  const paginationInfo = useMemo(() => {
    if (!usersResponse || !('total' in usersResponse)) {
      return {
        pageIndex: 0,
        pageSize: DEFAULT_PAGE_SIZE,
        pageCount: 0,
        total: 0,
      }
    }

    const total = usersResponse.total
    const pageCount = Math.ceil(total / pagination.pageSize)

    return {
      pageIndex: pagination.pageIndex,
      pageSize: pagination.pageSize,
      pageCount,
      total,
    }
  }, [usersResponse, pagination])

  // Handle search field change
  const handleSearchFieldChange = useCallback((field: 'email' | 'name') => {
    setGlobalFilter(prev => ({ ...prev, searchField: field }))
    // Reset to first page when search field changes
    setPagination(prev => ({ ...prev, pageIndex: 0 }))
  }, [])

  const users = (usersResponse && 'users' in usersResponse) ? usersResponse.users : []

  // Create columns with refetch callback
  const columns = useMemo(() => createColumns(refetch), [refetch])

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-4">
        <div className="text-destructive text-lg font-medium">{m["admin.loading_failed"]()}</div>
        <div className="text-muted-foreground text-sm">
          {error instanceof Error ? error.message : m["common.error"]()}
        </div>
        <button
          type="button"
          onClick={() => refetch()}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
        >
          {m["common.retry"]()}
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Search Field Selector */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{m["admin.search_field"]()}</span>
          <select
            value={globalFilter.searchField}
            onChange={(e) => handleSearchFieldChange(e.target.value as 'email' | 'name')}
            className="px-3 py-1 border border-input rounded-md text-sm bg-background"
          >
            <option value="email">{m["admin.search.field_email"]()}</option>
            <option value="name">{m["admin.search.field_name"]()}</option>
          </select>
        </div>
        <div className="text-sm text-muted-foreground">
          {m["admin.total_users"]({ count: paginationInfo.total })}
        </div>
      </div>

      {/* Data Table */}
      <DataTable
        columns={columns}
        data={users}
        searchPlaceholder={globalFilter.searchField === 'email' ? m["admin.search.placeholder_email"]() : m["admin.search.placeholder_name"]()}
        globalFilter={globalFilter.searchValue}
        onGlobalFilterChange={handleGlobalFilterChange}
        isLoading={isLoading}
        pagination={paginationInfo}
        onPaginationChange={handlePaginationChange}
        sorting={sorting}
        onSortingChange={handleSortingChange}
      />
    </div>
  )
}
