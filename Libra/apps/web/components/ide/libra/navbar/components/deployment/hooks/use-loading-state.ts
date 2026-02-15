/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * use-loading-state.ts
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

import { useCallback, useState } from 'react'

/**
 * Loading state types
 */
export type LoadingState = 'idle' | 'loading' | 'success' | 'error'

/**
 * Loading state management hook
 */
interface UseLoadingStateReturn {
  state: LoadingState
  isLoading: boolean
  isSuccess: boolean
  isError: boolean
  isIdle: boolean
  setLoading: () => void
  setSuccess: () => void
  setError: () => void
  setIdle: () => void
  reset: () => void
}

/**
 * Custom hook for managing loading states in deployment components
 */
export function useLoadingState(initialState: LoadingState = 'idle'): UseLoadingStateReturn {
  const [state, setState] = useState<LoadingState>(initialState)

  const setLoading = useCallback(() => setState('loading'), [])
  const setSuccess = useCallback(() => setState('success'), [])
  const setError = useCallback(() => setState('error'), [])
  const setIdle = useCallback(() => setState('idle'), [])
  const reset = useCallback(() => setState('idle'), [])

  return {
    state,
    isLoading: state === 'loading',
    isSuccess: state === 'success',
    isError: state === 'error',
    isIdle: state === 'idle',
    setLoading,
    setSuccess,
    setError,
    setIdle,
    reset
  }
}

/**
 * Async operation wrapper with loading state management
 */
interface UseAsyncOperationOptions<T> {
  onSuccess?: (result: T) => void
  onError?: (error: Error) => void
  onFinally?: () => void
}

interface UseAsyncOperationReturn<T> {
  execute: (operation: () => Promise<T>) => Promise<T | undefined>
  state: LoadingState
  isLoading: boolean
  isSuccess: boolean
  isError: boolean
  error: Error | null
  result: T | null
  reset: () => void
}

/**
 * Hook for managing async operations with loading states
 */
export function useAsyncOperation<T = any>(
  options: UseAsyncOperationOptions<T> = {}
): UseAsyncOperationReturn<T> {
  const loadingState = useLoadingState()
  const [error, setError] = useState<Error | null>(null)
  const [result, setResult] = useState<T | null>(null)

  const execute = useCallback(async (operation: () => Promise<T>): Promise<T | undefined> => {
    try {
      loadingState.setLoading()
      setError(null)
      setResult(null)

      const result = await operation()
      
      setResult(result)
      loadingState.setSuccess()
      options.onSuccess?.(result)
      
      return result
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      setError(error)
      loadingState.setError()
      options.onError?.(error)
      
      throw error
    } finally {
      options.onFinally?.()
    }
  }, [loadingState, options])

  const reset = useCallback(() => {
    loadingState.reset()
    setError(null)
    setResult(null)
  }, [loadingState])

  return {
    execute,
    state: loadingState.state,
    isLoading: loadingState.isLoading,
    isSuccess: loadingState.isSuccess,
    isError: loadingState.isError,
    error,
    result,
    reset
  }
}

/**
 * Multiple loading states manager for complex components
 */
interface UseMultipleLoadingStatesReturn {
  states: Record<string, LoadingState>
  isAnyLoading: boolean
  isAllSuccess: boolean
  isAnyError: boolean
  setLoading: (key: string) => void
  setSuccess: (key: string) => void
  setError: (key: string) => void
  setIdle: (key: string) => void
  reset: (key?: string) => void
  getState: (key: string) => LoadingState
  isLoading: (key: string) => boolean
  isSuccess: (key: string) => boolean
  isError: (key: string) => boolean
}

/**
 * Hook for managing multiple loading states (e.g., for different operations in the same component)
 */
export function useMultipleLoadingStates(
  keys: string[]
): UseMultipleLoadingStatesReturn {
  const [states, setStates] = useState<Record<string, LoadingState>>(() =>
    keys.reduce((acc, key) => ({ ...acc, [key]: 'idle' }), {})
  )

  const updateState = useCallback((key: string, newState: LoadingState) => {
    setStates(prev => ({ ...prev, [key]: newState }))
  }, [])

  const setLoading = useCallback((key: string) => updateState(key, 'loading'), [updateState])
  const setSuccess = useCallback((key: string) => updateState(key, 'success'), [updateState])
  const setError = useCallback((key: string) => updateState(key, 'error'), [updateState])
  const setIdle = useCallback((key: string) => updateState(key, 'idle'), [updateState])

  const reset = useCallback((key?: string) => {
    if (key) {
      updateState(key, 'idle')
    } else {
      setStates(prev => 
        Object.keys(prev).reduce((acc, k) => ({ ...acc, [k]: 'idle' }), {})
      )
    }
  }, [updateState])

  const getState = useCallback((key: string) => states[key] || 'idle', [states])
  const isLoading = useCallback((key: string) => states[key] === 'loading', [states])
  const isSuccess = useCallback((key: string) => states[key] === 'success', [states])
  const isError = useCallback((key: string) => states[key] === 'error', [states])

  const stateValues = Object.values(states)
  const isAnyLoading = stateValues.some(state => state === 'loading')
  const isAllSuccess = stateValues.every(state => state === 'success')
  const isAnyError = stateValues.some(state => state === 'error')

  return {
    states,
    isAnyLoading,
    isAllSuccess,
    isAnyError,
    setLoading,
    setSuccess,
    setError,
    setIdle,
    reset,
    getState,
    isLoading,
    isSuccess,
    isError
  }
}
