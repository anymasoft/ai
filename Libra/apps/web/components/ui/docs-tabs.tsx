/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * docs-tabs.tsx
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

import type {
  TabsContentProps,
  TabsProps as BaseProps,
} from '@radix-ui/react-tabs'
import {
  useMemo,
  useState,
  createContext,
  useContext,
  useRef,
  useLayoutEffect,
  useId,
  useEffect,
} from 'react'
import * as Primitive from '@libra/ui/components/tabs'
import { cn } from '@libra/ui/lib/utils'
import {IconsMap} from "@/configs/docs";

export { Primitive }

type ChangeListener = (v: string) => void
const listeners = new Map<string, ChangeListener[]>()

function addChangeListener(id: string, listener: ChangeListener): void {
  const list = listeners.get(id) ?? []
  list.push(listener)
  listeners.set(id, list)
}

function removeChangeListener(id: string, listener: ChangeListener): void {
  const list = listeners.get(id) ?? []
  listeners.set(
    id,
    list.filter((item) => item !== listener)
  )
}

export interface TabsProps extends BaseProps {
  /**
   * Identifier for Sharing value of tabs
   */
  groupId?: string

  /**
   * Enable persistent
   */
  persist?: boolean
  /**
   * @defaultValue 0
   */
  defaultIndex?: number

  items?: string[]

  /**
   * If true, updates the URL hash based on the tab's id
   */
  updateAnchor?: boolean
}

const TabsContext = createContext<{
  items: string[]
  valueToIdMap: Map<string, string>
  collection: CollectionType
} | null>(null)

export function Tabs({
  groupId,
  items = [],
  persist = false,
  defaultIndex = 0,
  updateAnchor = false,
  ...props
}: TabsProps) {
  const values = useMemo(() => items.map((item) => toValue(item)), [items])
  const [value, setValue] = useState(values[defaultIndex])

  const valueToIdMap = useMemo(() => new Map<string, string>(), [])
  // eslint-disable-next-line react-hooks/exhaustive-deps -- re-reconstruct the collection if items changed
  const collection = useMemo(() => createCollection(), [items])

  const onChange: ChangeListener = (v) => {
    if (values.includes(v)) setValue(v)
  }

  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  useLayoutEffect(() => {
    if (!groupId) return
    const onUpdate: ChangeListener = (v) => onChangeRef.current(v)

    const previous = persist
      ? localStorage.getItem(groupId)
      : sessionStorage.getItem(groupId)

    if (previous) onUpdate(previous)
    addChangeListener(groupId, onUpdate)
    return () => {
      removeChangeListener(groupId, onUpdate)
    }
  }, [groupId, persist])

  useLayoutEffect(() => {
    const hash = window.location.hash.slice(1)
    if (!hash) return

    for (const [value, id] of valueToIdMap.entries()) {
      if (id === hash) {
        setValue(value)
        break
      }
    }
  }, [valueToIdMap])

  return (
    <Primitive.Tabs
      value={value}
      onValueChange={(v: string) => {
        if (updateAnchor) {
          const id = valueToIdMap.get(v)

          if (id) {
            window.history.replaceState(null, '', `#${id}`)
          }
        }

        if (groupId) {
          listeners.get(groupId)?.forEach((item) => {
            item(v)
          })

          if (persist) localStorage.setItem(groupId, v)
          else sessionStorage.setItem(groupId, v)
        } else {
          setValue(v)
        }
      }}
      className={cn('my-4', props.className)}
      {...props}
    >
      <Primitive.TabsList
        className={cn('-100 w-full justify-start border-b-0')}
      >
        {values.map((v, i) => {
          const Icon = IconsMap[v] || null
          return (
            <Primitive.TabsTrigger
              key={v}
              value={v}
              className="flex items-center gap-2"
            >
              {Icon && <Icon className="size-3" />}
              {items[i]}
            </Primitive.TabsTrigger>
          )
        })}
      </Primitive.TabsList>
      <TabsContext.Provider
        value={useMemo(
          () => ({ items, valueToIdMap, collection }),
          [valueToIdMap, collection, items]
        )}
      >
        {props.children}
      </TabsContext.Provider>
    </Primitive.Tabs>
  )
}

function toValue(v: string): string {
  return v.toLowerCase().replace(/\s/, '-')
}

export type TabProps = Omit<TabsContentProps, 'value'> & {
  /**
   * Value of tab, detect from index if unspecified.
   */
  value?: TabsContentProps['value']
}

export function Tab({ value, className, ...props }: TabProps) {
  const ctx = useContext(TabsContext)
  const resolvedValue =
    value ??
    // eslint-disable-next-line react-hooks/rules-of-hooks -- `value` is not supposed to change
    ctx?.items.at(useCollectionIndex())
  if (!resolvedValue)
    throw new Error(
      'Failed to resolve tab `value`, please pass a `value` prop to the Tab component.'
    )

  const v = toValue(resolvedValue)

  if (props.id && ctx) {
    ctx.valueToIdMap.set(v, props.id)
  }

  return (
    <Primitive.TabsContent
      value={v}
      className={cn('prose-no-margin', className)}
      {...props}
    >
      {props.children}
    </Primitive.TabsContent>
  )
}

type CollectionKey = string | symbol
type CollectionType = ReturnType<typeof createCollection>

function createCollection() {
  return [] as CollectionKey[]
}

/**
 * Inspired by Headless UI.
 *
 * Return the index of children, this is made possible by registering the order of render from children using React context.
 * This is supposed by work with pre-rendering & pure client-side rendering.
 */
function useCollectionIndex() {
  const key = useId()
  const ctx = useContext(TabsContext)
  if (!ctx) throw new Error('You must wrap your component in <Tabs>')

  const list = ctx.collection

  function register() {
    if (!list.includes(key)) list.push(key)
  }

  function unregister() {
    const idx = list.indexOf(key)
    if (idx !== -1) list.splice(idx, 1)
  }

  useMemo(() => {
    // re-order the item to the bottom if registered
    unregister()
    register()
    // eslint-disable-next-line -- register
  }, [list])

  useEffect(() => {
    return unregister
    // eslint-disable-next-line -- clean up only
  }, [])

  return list.indexOf(key)
}
