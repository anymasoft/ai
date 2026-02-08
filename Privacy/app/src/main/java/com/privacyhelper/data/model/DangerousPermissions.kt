package com.privacyhelper.data.model

import android.Manifest

object DangerousPermissions {

    val ALL = mapOf(
        Manifest.permission.CAMERA to "Камера",
        Manifest.permission.RECORD_AUDIO to "Микрофон",
        Manifest.permission.ACCESS_FINE_LOCATION to "Точная геолокация",
        Manifest.permission.ACCESS_COARSE_LOCATION to "Примерная геолокация",
        Manifest.permission.ACCESS_BACKGROUND_LOCATION to "Фоновая геолокация",
        Manifest.permission.READ_CONTACTS to "Контакты",
        Manifest.permission.READ_CALL_LOG to "Журнал звонков",
        Manifest.permission.READ_SMS to "SMS-сообщения",
        Manifest.permission.READ_CALENDAR to "Календарь",
        Manifest.permission.READ_EXTERNAL_STORAGE to "Хранилище",
        Manifest.permission.READ_PHONE_STATE to "Состояние телефона",
        Manifest.permission.BODY_SENSORS to "Датчики тела"
    )

    fun getDisplayName(permission: String): String {
        return ALL[permission] ?: permission.substringAfterLast(".")
    }

    fun isLocationPermission(permission: String): Boolean {
        return permission in listOf(
            Manifest.permission.ACCESS_FINE_LOCATION,
            Manifest.permission.ACCESS_COARSE_LOCATION,
            Manifest.permission.ACCESS_BACKGROUND_LOCATION
        )
    }

    fun isCameraPermission(permission: String): Boolean {
        return permission == Manifest.permission.CAMERA
    }

    fun isMicrophonePermission(permission: String): Boolean {
        return permission == Manifest.permission.RECORD_AUDIO
    }
}
