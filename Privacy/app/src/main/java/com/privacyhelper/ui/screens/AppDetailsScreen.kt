package com.privacyhelper.ui.screens

import android.content.Intent
import android.net.Uri
import android.provider.Settings
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.privacyhelper.data.model.AppInfo
import com.privacyhelper.data.model.DangerousPermissions
import com.privacyhelper.domain.scorer.PrivacyScoreCalculator
import com.privacyhelper.ui.components.AppIcon
import com.privacyhelper.ui.components.ScoreIndicator
import com.privacyhelper.ui.components.getScoreColor

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AppDetailsScreen(
    app: AppInfo,
    scoreCalculator: PrivacyScoreCalculator,
    onBackClick: () -> Unit
) {
    val context = LocalContext.current

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Детали") },
                navigationIcon = {
                    IconButton(onClick = onBackClick) {
                        Icon(
                            Icons.Filled.ArrowBack,
                            contentDescription = "Назад"
                        )
                    }
                },
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
            // Заголовок с иконкой
            AppIcon(
                drawable = app.icon,
                modifier = Modifier.size(72.dp)
            )

            Spacer(modifier = Modifier.height(12.dp))

            Text(
                text = app.appName,
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.Bold
            )

            Text(
                text = app.packageName,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )

            Spacer(modifier = Modifier.height(8.dp))

            Text(
                text = "Target SDK: ${app.targetSdk}",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )

            Spacer(modifier = Modifier.height(16.dp))

            // Скор
            ScoreIndicator(score = app.privacyScore, size = 120.dp)

            Spacer(modifier = Modifier.height(8.dp))

            // Описание риска
            Text(
                text = scoreCalculator.getRiskDescription(app.privacyScore),
                style = MaterialTheme.typography.bodyMedium,
                color = getScoreColor(app.privacyScore)
            )

            Spacer(modifier = Modifier.height(24.dp))

            // Опасные разрешения
            if (app.dangerousPermissions.isNotEmpty()) {
                SectionHeader(title = "Опасные разрешения", icon = Icons.Default.Warning)
                Spacer(modifier = Modifier.height(8.dp))
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(
                        containerColor = MaterialTheme.colorScheme.errorContainer.copy(alpha = 0.3f)
                    )
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        app.dangerousPermissions.forEach { permission ->
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                modifier = Modifier.padding(vertical = 4.dp)
                            ) {
                                Icon(
                                    imageVector = getPermissionIcon(permission),
                                    contentDescription = null,
                                    modifier = Modifier.size(20.dp),
                                    tint = MaterialTheme.colorScheme.error
                                )
                                Spacer(modifier = Modifier.width(12.dp))
                                Column {
                                    Text(
                                        text = DangerousPermissions.getDisplayName(permission),
                                        style = MaterialTheme.typography.bodyMedium,
                                        fontWeight = FontWeight.Medium
                                    )
                                    Text(
                                        text = getPermissionRiskExplanation(permission),
                                        style = MaterialTheme.typography.bodySmall,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant
                                    )
                                }
                            }
                            if (permission != app.dangerousPermissions.last()) {
                                Divider(
                                    modifier = Modifier.padding(vertical = 4.dp),
                                    color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.5f)
                                )
                            }
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Трекеры
            if (app.trackers.isNotEmpty()) {
                SectionHeader(title = "Встроенные трекеры", icon = Icons.Default.Visibility)
                Spacer(modifier = Modifier.height(8.dp))
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(
                        containerColor = MaterialTheme.colorScheme.tertiaryContainer.copy(alpha = 0.3f)
                    )
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        app.trackers.forEach { tracker ->
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                modifier = Modifier.padding(vertical = 4.dp)
                            ) {
                                Icon(
                                    Icons.Default.TrackChanges,
                                    contentDescription = null,
                                    modifier = Modifier.size(20.dp),
                                    tint = MaterialTheme.colorScheme.tertiary
                                )
                                Spacer(modifier = Modifier.width(12.dp))
                                Text(
                                    text = tracker,
                                    style = MaterialTheme.typography.bodyMedium
                                )
                            }
                        }
                    }
                }
            }

            if (app.dangerousPermissions.isEmpty() && app.trackers.isEmpty()) {
                Spacer(modifier = Modifier.height(16.dp))
                Icon(
                    Icons.Default.CheckCircle,
                    contentDescription = null,
                    modifier = Modifier.size(48.dp),
                    tint = MaterialTheme.colorScheme.primary
                )
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = "Опасных разрешений и трекеров не обнаружено",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            Spacer(modifier = Modifier.height(32.dp))

            // Кнопка настроек
            OutlinedButton(
                onClick = {
                    val intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                        data = Uri.fromParts("package", app.packageName, null)
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    }
                    context.startActivity(intent)
                },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(48.dp),
                shape = MaterialTheme.shapes.large
            ) {
                Icon(
                    Icons.Default.Settings,
                    contentDescription = null,
                    modifier = Modifier.size(18.dp)
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text("Открыть настройки приложения")
            }

            Spacer(modifier = Modifier.height(16.dp))
        }
    }
}

@Composable
private fun SectionHeader(title: String, icon: androidx.compose.ui.graphics.vector.ImageVector) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier.fillMaxWidth()
    ) {
        Icon(
            imageVector = icon,
            contentDescription = null,
            modifier = Modifier.size(20.dp),
            tint = MaterialTheme.colorScheme.onSurface
        )
        Spacer(modifier = Modifier.width(8.dp))
        Text(
            text = title,
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.SemiBold
        )
    }
}

private fun getPermissionIcon(permission: String): androidx.compose.ui.graphics.vector.ImageVector {
    return when {
        DangerousPermissions.isCameraPermission(permission) -> Icons.Default.CameraAlt
        DangerousPermissions.isMicrophonePermission(permission) -> Icons.Default.Mic
        DangerousPermissions.isLocationPermission(permission) -> Icons.Default.LocationOn
        permission.contains("CONTACTS") -> Icons.Default.Contacts
        permission.contains("CALL_LOG") -> Icons.Default.Phone
        permission.contains("SMS") -> Icons.Default.Sms
        permission.contains("CALENDAR") -> Icons.Default.CalendarMonth
        permission.contains("STORAGE") -> Icons.Default.Folder
        permission.contains("PHONE_STATE") -> Icons.Default.Smartphone
        permission.contains("SENSORS") -> Icons.Default.Sensors
        else -> Icons.Default.Shield
    }
}

private fun getPermissionRiskExplanation(permission: String): String {
    return when {
        DangerousPermissions.isCameraPermission(permission) ->
            "Приложение может делать фото и видео без вашего ведома"
        DangerousPermissions.isMicrophonePermission(permission) ->
            "Приложение может записывать звук с микрофона"
        permission.contains("BACKGROUND_LOCATION") ->
            "Приложение отслеживает ваше местоположение даже в фоне"
        permission.contains("FINE_LOCATION") ->
            "Приложение знает ваше точное местоположение"
        permission.contains("COARSE_LOCATION") ->
            "Приложение определяет ваше примерное местоположение"
        permission.contains("CONTACTS") ->
            "Приложение имеет доступ к вашим контактам"
        permission.contains("CALL_LOG") ->
            "Приложение может читать историю звонков"
        permission.contains("SMS") ->
            "Приложение может читать ваши SMS-сообщения"
        permission.contains("CALENDAR") ->
            "Приложение имеет доступ к событиям календаря"
        permission.contains("STORAGE") ->
            "Приложение может читать файлы на устройстве"
        permission.contains("PHONE_STATE") ->
            "Приложение может определить номер телефона и IMEI"
        permission.contains("SENSORS") ->
            "Приложение получает данные с датчиков тела"
        else -> "Доступ к чувствительным данным"
    }
}
