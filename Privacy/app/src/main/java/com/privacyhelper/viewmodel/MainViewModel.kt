package com.privacyhelper.viewmodel

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.privacyhelper.data.model.AppInfo
import com.privacyhelper.data.model.DangerousPermissions
import com.privacyhelper.data.model.ScanState
import com.privacyhelper.data.repository.AppRepository
import com.privacyhelper.domain.scanner.AppScanner
import com.privacyhelper.domain.scanner.TrackerDetector
import com.privacyhelper.domain.scorer.PrivacyScoreCalculator
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

class MainViewModel(application: Application) : AndroidViewModel(application) {

    private val scoreCalculator = PrivacyScoreCalculator()
    private val trackerDetector = TrackerDetector(application)
    private val appScanner = AppScanner(application, trackerDetector, scoreCalculator)
    private val repository = AppRepository(appScanner)

    private val _scanState = MutableStateFlow<ScanState>(ScanState.Idle)
    val scanState: StateFlow<ScanState> = _scanState.asStateFlow()

    private val _selectedApp = MutableStateFlow<AppInfo?>(null)
    val selectedApp: StateFlow<AppInfo?> = _selectedApp.asStateFlow()

    val privacyScoreCalculator: PrivacyScoreCalculator get() = scoreCalculator

    fun scanApps() {
        viewModelScope.launch {
            _scanState.value = ScanState.Loading
            try {
                val apps = repository.getScannedApps()
                _scanState.value = ScanState.Loaded(apps)
            } catch (e: Exception) {
                _scanState.value = ScanState.Error(
                    e.message ?: "Неизвестная ошибка при сканировании"
                )
            }
        }
    }

    fun selectApp(app: AppInfo) {
        _selectedApp.value = app
    }

    fun getAverageScore(): Int {
        val state = _scanState.value
        if (state !is ScanState.Loaded) return 0
        if (state.apps.isEmpty()) return 0
        return state.apps.map { it.privacyScore }.average().toInt()
    }

    fun getAppsWithCamera(): Int = countAppsWithPermission { DangerousPermissions.isCameraPermission(it) }
    fun getAppsWithMicrophone(): Int = countAppsWithPermission { DangerousPermissions.isMicrophonePermission(it) }
    fun getAppsWithLocation(): Int = countAppsWithPermission { DangerousPermissions.isLocationPermission(it) }

    fun getAppsWithTrackers(): Int {
        val state = _scanState.value
        if (state !is ScanState.Loaded) return 0
        return state.apps.count { it.trackers.isNotEmpty() }
    }

    private fun countAppsWithPermission(predicate: (String) -> Boolean): Int {
        val state = _scanState.value
        if (state !is ScanState.Loaded) return 0
        return state.apps.count { app ->
            app.dangerousPermissions.any(predicate)
        }
    }
}
