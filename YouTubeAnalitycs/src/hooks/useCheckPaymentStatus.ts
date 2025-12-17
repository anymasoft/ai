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
    const paymentId = params.get("paymentId");

    // ЕСЛИ нет success=1 ИЛИ уже проверили → ничего не делаем
    if (!success || checked) return;

    // ЕСЛИ нет paymentId → нечего проверять
    if (!paymentId) {
      console.log("[useCheckPaymentStatus] No paymentId in URL");
      setChecked(true);
      return;
    }

    console.log(
      `[useCheckPaymentStatus] Checking payment: ${paymentId}`
    );

    // ОДНА проверка
    (async () => {
      try {
        const response = await fetch(
          `/api/payments/yookassa/check?paymentId=${paymentId}`
        );
        const data = await response.json();

        console.log(`[useCheckPaymentStatus] Result:`, data);
        setResult(data);
      } catch (error) {
        console.error(`[useCheckPaymentStatus] Error:`, error);
        setResult({ success: false, error: "Check failed" });
      } finally {
        setChecked(true);
      }
    })();
  }, [checked]);

  return result;
}
