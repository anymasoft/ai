/**
 * useCheckPaymentStatus Hook
 *
 * ИСПОЛЬЗОВАНИЕ ТОЛЬКО В LOCALHOST/DEV
 * Проверяет статус платежа ОДИН РАЗ после возврата из YooKassa
 *
 * PROD: webhook справляется
 * LOCAL: UI вызывает check endpoint
 *
 * БЕЗ polling, БЕЗ таймеров, БЕЗ циклов
 * ОДНА проверка по return_url параметру success=1
 */

import { useEffect, useState } from "react";

interface CheckResult {
  success: boolean;
  status?: string;
  error?: string;
}

export function useCheckPaymentStatus() {
  const [checked, setChecked] = useState(false);
  const [result, setResult] = useState<CheckResult | null>(null);

  useEffect(() => {
    // Проверяем, вернулась ли UI с success параметром
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    const success = params.get("success");

    console.log("[useCheckPaymentStatus] URL success param:", success, "checked:", checked);

    // ЕСЛИ нет success=1 ИЛИ уже проверили → ничего не делаем
    if (!success || checked) {
      console.log("[useCheckPaymentStatus] Skipping - no success param or already checked");
      return;
    }

    console.log(`[useCheckPaymentStatus] ✓ Checking latest payment status`);

    // ОДНА проверка
    (async () => {
      try {
        // Check endpoint найдёт latest pending payment по userId
        const url = `/api/payments/yookassa/check`;
        console.log(`[useCheckPaymentStatus] Fetching: ${url}`);

        const response = await fetch(url);
        const data = await response.json();

        console.log(`[useCheckPaymentStatus] ✓ Response:`, data);
        setResult(data);

        if (data.success) {
          console.log(`[useCheckPaymentStatus] ✅ Payment succeeded!`);
        } else {
          console.warn(`[useCheckPaymentStatus] ⚠️ Payment check returned:`, data);
        }
      } catch (error) {
        console.error(`[useCheckPaymentStatus] ❌ Error:`, error);
        setResult({ success: false, error: "Check failed" });
      } finally {
        setChecked(true);
      }
    })();
  }, [checked]);

  return result;
}
