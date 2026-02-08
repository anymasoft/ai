package com.privacyhelper.domain.scorer

import android.Manifest

class PrivacyScoreCalculator {

    companion object {
        private val PERMISSION_WEIGHTS = mapOf(
            Manifest.permission.CAMERA to 20,
            Manifest.permission.RECORD_AUDIO to 20,
            Manifest.permission.ACCESS_FINE_LOCATION to 30,
            Manifest.permission.ACCESS_COARSE_LOCATION to 15,
            Manifest.permission.ACCESS_BACKGROUND_LOCATION to 40,
            Manifest.permission.READ_CONTACTS to 15,
            Manifest.permission.READ_CALL_LOG to 20,
            Manifest.permission.READ_SMS to 25,
            Manifest.permission.READ_CALENDAR to 10,
            Manifest.permission.READ_EXTERNAL_STORAGE to 10,
            Manifest.permission.READ_PHONE_STATE to 15,
            Manifest.permission.BODY_SENSORS to 15
        )

        private const val TRACKER_WEIGHT = 10
    }

    fun calculate(permissions: List<String>, trackers: List<String>): Int {
        var score = 0

        for (permission in permissions) {
            score += PERMISSION_WEIGHTS[permission] ?: 0
        }

        score += trackers.size * TRACKER_WEIGHT

        return score.coerceIn(0, 100)
    }

    fun getRiskLevel(score: Int): RiskLevel {
        return when {
            score <= 20 -> RiskLevel.LOW
            score <= 50 -> RiskLevel.MEDIUM
            score <= 75 -> RiskLevel.HIGH
            else -> RiskLevel.CRITICAL
        }
    }

    fun getRiskDescription(score: Int): String {
        return when (getRiskLevel(score)) {
            RiskLevel.LOW -> "Низкий риск. Приложение запрашивает минимум разрешений."
            RiskLevel.MEDIUM -> "Средний риск. Приложение имеет доступ к некоторым чувствительным данным."
            RiskLevel.HIGH -> "Высокий риск. Приложение имеет доступ к значительному объёму личных данных."
            RiskLevel.CRITICAL -> "Критический риск. Приложение собирает максимум личной информации."
        }
    }
}

enum class RiskLevel {
    LOW, MEDIUM, HIGH, CRITICAL
}
