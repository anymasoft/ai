import { redirect } from "next/navigation"

/**
 * Batch-режим временно отключен.
 * Пользователи переадресовываются на /card-generator.
 *
 * Весь код batch сохранён для будущей активации:
 * - src/app/dashboard/batch/page.tsx (текущий файл)
 * - src/app/api/batch/by-id/route.ts
 * - src/app/api/batch/create/route.ts
 * - src/lib/batch-operations.ts
 */
export default function BatchPage() {
  redirect("/card-generator")
}
