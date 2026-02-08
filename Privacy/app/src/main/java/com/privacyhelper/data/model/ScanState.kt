package com.privacyhelper.data.model

sealed class ScanState {
    data object Idle : ScanState()
    data object Loading : ScanState()
    data class Loaded(val apps: List<AppInfo>) : ScanState()
    data class Error(val message: String) : ScanState()
}
