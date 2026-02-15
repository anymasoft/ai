/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * error.ts
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

type Success<T> = readonly [T, null]
type Failure<E> = readonly [null, E]
type ResultSync<T, E> = Success<T> | Failure<E>
type ResultAsync<T, E> = Promise<ResultSync<T, E>>
type Operation<T> = Promise<T> | (() => T) | (() => Promise<T>)

export function tryCatch<T, E = Error>(operation: Promise<T>): ResultAsync<T, E>
export function tryCatch<T, E = Error>(operation: () => Promise<T>): ResultAsync<T, E>
export function tryCatch<T, E = Error>(operation: () => T): ResultSync<T, E>
export function tryCatch<T, E = Error>(operation: Operation<T>): ResultSync<T, E> | ResultAsync<T, E> {
    if (operation instanceof Promise) {
        return operation.then((data: T) => [data, null] as const).catch((error: E) => [null, error as E] as const)
    }

    try {
        const result = operation()

        if (result instanceof Promise) {
            return result.then((data: T) => [data, null] as const).catch((error: E) => [null, error as E] as const)
        }

        return [result, null] as const
    } catch (error) {
        return [null, error as E] as const
    }
}

/**
 * use case
 */
// const [data, error] = await tryCatch(async () => {
//     const [file] = await db
//         .insert(filesTable)
//         .values({ size: 1234, mimeType: "text/plain", path: "/uploads/test.txt" })
//         .returning()
//
//     if (!file) {
//         throw new Error("File creation failed")
//     }
//
//     return file
// })
//
// if (error) {
//     console.error("Error creating the file:", error)
//     // Handle the error
//     throw error
// }