package com.privacyhelper.ui.navigation

import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import com.privacyhelper.data.model.ScanState
import com.privacyhelper.ui.screens.AppDetailsScreen
import com.privacyhelper.ui.screens.AppListScreen
import com.privacyhelper.ui.screens.DashboardScreen
import com.privacyhelper.ui.screens.ScanScreen
import com.privacyhelper.viewmodel.MainViewModel

@Composable
fun AppNavigation(
    navController: NavHostController,
    viewModel: MainViewModel
) {
    val scanState by viewModel.scanState.collectAsState()
    val selectedApp by viewModel.selectedApp.collectAsState()

    NavHost(
        navController = navController,
        startDestination = NavRoutes.SCAN
    ) {
        composable(NavRoutes.SCAN) {
            ScanScreen(
                scanState = scanState,
                onScanClick = { viewModel.scanApps() },
                onScanComplete = {
                    navController.navigate(NavRoutes.DASHBOARD) {
                        popUpTo(NavRoutes.SCAN) { inclusive = true }
                    }
                }
            )
        }

        composable(NavRoutes.DASHBOARD) {
            val apps = (scanState as? ScanState.Loaded)?.apps ?: emptyList()
            DashboardScreen(
                averageScore = viewModel.getAverageScore(),
                totalApps = apps.size,
                appsWithCamera = viewModel.getAppsWithCamera(),
                appsWithMicrophone = viewModel.getAppsWithMicrophone(),
                appsWithLocation = viewModel.getAppsWithLocation(),
                appsWithTrackers = viewModel.getAppsWithTrackers(),
                onShowAppsClick = {
                    navController.navigate(NavRoutes.APP_LIST)
                }
            )
        }

        composable(NavRoutes.APP_LIST) {
            val apps = (scanState as? ScanState.Loaded)?.apps ?: emptyList()
            AppListScreen(
                apps = apps,
                onAppClick = { app ->
                    viewModel.selectApp(app)
                    navController.navigate(NavRoutes.APP_DETAILS)
                },
                onBackClick = { navController.popBackStack() }
            )
        }

        composable(NavRoutes.APP_DETAILS) {
            selectedApp?.let { app ->
                AppDetailsScreen(
                    app = app,
                    scoreCalculator = viewModel.privacyScoreCalculator,
                    onBackClick = { navController.popBackStack() }
                )
            }
        }
    }
}
