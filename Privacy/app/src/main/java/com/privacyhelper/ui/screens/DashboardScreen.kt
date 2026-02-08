package com.privacyhelper.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.privacyhelper.ui.components.ScoreIndicator
import com.privacyhelper.ui.components.StatCard

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DashboardScreen(
    averageScore: Int,
    totalApps: Int,
    appsWithCamera: Int,
    appsWithMicrophone: Int,
    appsWithLocation: Int,
    appsWithTrackers: Int,
    onShowAppsClick: () -> Unit
) {
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Privacy Helper") },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.surface
                )
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            // Средний скор
            Text(
                text = "Общий уровень риска",
                style = MaterialTheme.typography.titleMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )

            Spacer(modifier = Modifier.height(16.dp))

            ScoreIndicator(score = averageScore, size = 160.dp)

            Spacer(modifier = Modifier.height(8.dp))

            Text(
                text = "Проанализировано приложений: $totalApps",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )

            Spacer(modifier = Modifier.height(24.dp))

            // Статистика в сетке
            Text(
                text = "Доступ к данным",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold,
                modifier = Modifier.fillMaxWidth()
            )

            Spacer(modifier = Modifier.height(12.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                StatCard(
                    icon = Icons.Default.CameraAlt,
                    label = "Камера",
                    count = appsWithCamera,
                    modifier = Modifier.weight(1f)
                )
                StatCard(
                    icon = Icons.Default.Mic,
                    label = "Микрофон",
                    count = appsWithMicrophone,
                    modifier = Modifier.weight(1f)
                )
            }

            Spacer(modifier = Modifier.height(12.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                StatCard(
                    icon = Icons.Default.LocationOn,
                    label = "Геолокация",
                    count = appsWithLocation,
                    modifier = Modifier.weight(1f)
                )
                StatCard(
                    icon = Icons.Default.Visibility,
                    label = "Трекеры",
                    count = appsWithTrackers,
                    modifier = Modifier.weight(1f)
                )
            }

            Spacer(modifier = Modifier.height(32.dp))

            // Кнопка показать приложения
            Button(
                onClick = onShowAppsClick,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(56.dp),
                shape = MaterialTheme.shapes.large
            ) {
                Icon(
                    Icons.Default.Apps,
                    contentDescription = null,
                    modifier = Modifier.size(20.dp)
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = "Показать приложения",
                    style = MaterialTheme.typography.titleMedium
                )
            }

            Spacer(modifier = Modifier.height(16.dp))
        }
    }
}
