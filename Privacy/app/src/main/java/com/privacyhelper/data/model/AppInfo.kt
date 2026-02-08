package com.privacyhelper.data.model

import android.graphics.drawable.Drawable

data class AppInfo(
    val appName: String,
    val packageName: String,
    val icon: Drawable?,
    val targetSdk: Int,
    val dangerousPermissions: List<String>,
    val trackers: List<String>,
    val privacyScore: Int
)
