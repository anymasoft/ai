package com.privacyhelper.domain.scanner

import android.content.Context
import android.content.pm.ApplicationInfo
import android.content.pm.PackageInfo
import android.content.pm.PackageManager
import com.privacyhelper.data.model.AppInfo
import com.privacyhelper.data.model.DangerousPermissions
import com.privacyhelper.domain.scorer.PrivacyScoreCalculator

class AppScanner(
    private val context: Context,
    private val trackerDetector: TrackerDetector,
    private val scoreCalculator: PrivacyScoreCalculator
) {

    fun scanInstalledApps(): List<AppInfo> {
        val pm = context.packageManager
        val packages = pm.getInstalledPackages(PackageManager.GET_PERMISSIONS)

        return packages
            .filter { isUserApp(it) }
            .map { packageInfo -> analyzeApp(pm, packageInfo) }
            .sortedByDescending { it.privacyScore }
    }

    private fun isUserApp(packageInfo: PackageInfo): Boolean {
        return packageInfo.applicationInfo?.let {
            (it.flags and ApplicationInfo.FLAG_SYSTEM) == 0
        } ?: false
    }

    private fun analyzeApp(pm: PackageManager, packageInfo: PackageInfo): AppInfo {
        val appInfo = packageInfo.applicationInfo
        val appName = appInfo?.let { pm.getApplicationLabel(it).toString() } ?: packageInfo.packageName
        val icon = appInfo?.let {
            try {
                pm.getApplicationIcon(it)
            } catch (e: Exception) {
                null
            }
        }
        val targetSdk = appInfo?.targetSdkVersion ?: 0

        val dangerousPermissions = extractDangerousPermissions(packageInfo)
        val trackers = trackerDetector.detectTrackers(packageInfo.packageName)
        val score = scoreCalculator.calculate(dangerousPermissions, trackers)

        return AppInfo(
            appName = appName,
            packageName = packageInfo.packageName,
            icon = icon,
            targetSdk = targetSdk,
            dangerousPermissions = dangerousPermissions,
            trackers = trackers,
            privacyScore = score
        )
    }

    private fun extractDangerousPermissions(packageInfo: PackageInfo): List<String> {
        val requestedPermissions = packageInfo.requestedPermissions ?: return emptyList()
        return requestedPermissions.filter { it in DangerousPermissions.ALL.keys }
    }
}
