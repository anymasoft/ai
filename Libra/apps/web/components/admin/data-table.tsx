/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * data-table.tsx
 * Copyright (C) 2025 Nextify Limited
 */

'use client'

import * as m from '@/paraglide/messages'

import type {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
} from '@tanstack/react-table'
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { useState } from 'react'

import { Button } from '@libra/ui/components/button'
import { Input } from '@libra/ui/components/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@libra/ui/components/table'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@libra/ui/components/dropdown-menu'
import { ChevronDown, Search } from 'lucide-react'

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  searchPlaceholder?: string
  searchColumn?: string
  onGlobalFilterChange?: (value: string) => void
  globalFilter?: string
  isLoading?: boolean
  pagination?: {
    pageIndex: number
    pageSize: number
    pageCount: number
    total: number
  }
  onPaginationChange?: (pagination: { pageIndex: number; pageSize: number }) => void
  onSortingChange?: (sorting: SortingState) => void
  sorting?: SortingState
}

export function DataTable<TData, TValue>({
  columns,
  data,
  searchPlaceholder = m["admin.search.placeholder_default"](),
  onGlobalFilterChange,
  globalFilter = "",
  isLoading = false,
  pagination,
  onPaginationChange,
  onSortingChange,
  sorting = [],
}: DataTableProps<TData, TValue>) {
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [rowSelection, setRowSelection] = useState({})

  // Handle sorting change with proper TanStack Table types
  const handleSortingChange = (updaterOrValue: SortingState | ((old: SortingState) => SortingState)) => {
    const newSorting = typeof updaterOrValue === 'function' ? updaterOrValue(sorting) : updaterOrValue
    onSortingChange?.(newSorting)
  }

  // Handle pagination change with proper TanStack Table types
  const handlePaginationChange = (updaterOrValue: { pageIndex: number; pageSize: number } | ((old: { pageIndex: number; pageSize: number }) => { pageIndex: number; pageSize: number })) => {
    const currentPagination = { pageIndex: pagination?.pageIndex ?? 0, pageSize: pagination?.pageSize ?? 10 }
    const newPagination = typeof updaterOrValue === 'function' ? updaterOrValue(currentPagination) : updaterOrValue
    onPaginationChange?.(newPagination)
  }

  const table = useReactTable({
    data,
    columns,
    onSortingChange: onSortingChange ? handleSortingChange : undefined,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
      pagination: pagination ? {
        pageIndex: pagination.pageIndex,
        pageSize: pagination.pageSize,
      } : undefined,
    },
    pageCount: pagination?.pageCount ?? -1,
    manualPagination: !!pagination,
    manualSorting: !!onSortingChange,
    onPaginationChange: onPaginationChange ? handlePaginationChange : undefined,
  })

  return (
    <div className="w-full">
      <div className="flex items-center py-4 gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder={searchPlaceholder}
            value={globalFilter}
            onChange={(event) => onGlobalFilterChange?.(event.target.value)}
            className="pl-10"
          />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="ml-auto">
              {m["admin.table.columns_display"]()} <ChevronDown className="ml-2 h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {table
              .getAllColumns()
              .filter((column) => column.getCanHide())
              .map((column) => {
                return (
                  <DropdownMenuCheckboxItem
                    key={column.id}
                    className="capitalize"
                    checked={column.getIsVisible()}
                    onCheckedChange={(value) =>
                      column.toggleVisibility(!!value)
                    }
                  >
                    {column.id}
                  </DropdownMenuCheckboxItem>
                )
              })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }, () => {
                const rowId = crypto.randomUUID()
                return (
                  <TableRow key={rowId}>
                    {columns.map(() => {
                      const cellId = crypto.randomUUID()
                      return (
                        <TableCell key={cellId}>
                          <div className="h-4 bg-muted animate-pulse rounded" />
                        </TableCell>
                      )
                    })}
                  </TableRow>
                )
              })
            ) : table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  {m["common.no_data"]()}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      {pagination && (
        <div className="flex items-center justify-between space-x-2 py-4">
          <div className="text-sm text-muted-foreground">
            {m["common.pagination_info"]({
              total: pagination.total,
              current: pagination.pageIndex + 1,
              totalPages: pagination.pageCount
            })}
          </div>
          <div className="space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPaginationChange?.({ 
                pageIndex: 0, 
                pageSize: pagination.pageSize 
              })}
              disabled={pagination.pageIndex === 0}
            >
              First
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPaginationChange?.({ 
                pageIndex: pagination.pageIndex - 1, 
                pageSize: pagination.pageSize 
              })}
              disabled={pagination.pageIndex === 0}
            >
              {m["common.previous"]()}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPaginationChange?.({
                pageIndex: pagination.pageIndex + 1,
                pageSize: pagination.pageSize
              })}
              disabled={pagination.pageIndex >= pagination.pageCount - 1}
            >
              {m["common.next"]()}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPaginationChange?.({ 
                pageIndex: pagination.pageCount - 1, 
                pageSize: pagination.pageSize 
              })}
              disabled={pagination.pageIndex >= pagination.pageCount - 1}
            >
              Last
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
