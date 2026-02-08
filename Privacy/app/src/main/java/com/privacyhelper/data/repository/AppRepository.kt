package com.privacyhelper.data.repository

import com.privacyhelper.data.model.AppInfo
import com.privacyhelper.domain.scanner.AppScanner
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class AppRepository(private val appScanner: AppScanner) {

    suspend fun getScannedApps(): List<AppInfo> = withContext(Dispatchers.IO) {
        appScanner.scanInstalledApps()
    }
}
