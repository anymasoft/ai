package com.privacyhelper.ui.components

import android.graphics.drawable.Drawable
import androidx.compose.foundation.Image
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.unit.dp
import androidx.core.graphics.drawable.toBitmap
import com.privacyhelper.data.model.AppInfo
import com.privacyhelper.data.model.DangerousPermissions

@Composable
fun AppListItem(
    app: AppInfo,
    onClick: () -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surface
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Иконка приложения
            AppIcon(
                drawable = app.icon,
                modifier = Modifier
                    .size(48.dp)
                    .clip(RoundedCornerShape(12.dp))
            )

            Spacer(modifier = Modifier.width(12.dp))

            // Информация
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = app.appName,
                    style = MaterialTheme.typography.bodyLarge
                )
                Spacer(modifier = Modifier.height(4.dp))
                // Иконки рисков
                Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    if (app.dangerousPermissions.any { DangerousPermissions.isCameraPermission(it) }) {
                        Icon(
                            Icons.Default.CameraAlt,
                            contentDescription = "Камера",
                            modifier = Modifier.size(16.dp),
                            tint = MaterialTheme.colorScheme.error
                        )
                    }
                    if (app.dangerousPermissions.any { DangerousPermissions.isMicrophonePermission(it) }) {
                        Icon(
                            Icons.Default.Mic,
                            contentDescription = "Микрофон",
                            modifier = Modifier.size(16.dp),
                            tint = MaterialTheme.colorScheme.error
                        )
                    }
                    if (app.dangerousPermissions.any { DangerousPermissions.isLocationPermission(it) }) {
                        Icon(
                            Icons.Default.LocationOn,
                            contentDescription = "Геолокация",
                            modifier = Modifier.size(16.dp),
                            tint = MaterialTheme.colorScheme.error
                        )
                    }
                    if (app.trackers.isNotEmpty()) {
                        Icon(
                            Icons.Default.Visibility,
                            contentDescription = "Трекеры",
                            modifier = Modifier.size(16.dp),
                            tint = MaterialTheme.colorScheme.tertiary
                        )
                    }
                }
            }

            // Score
            ScoreBadge(score = app.privacyScore)
        }
    }
}

@Composable
fun AppIcon(drawable: Drawable?, modifier: Modifier = Modifier) {
    if (drawable != null) {
        Image(
            bitmap = drawable.toBitmap(96, 96).asImageBitmap(),
            contentDescription = null,
            modifier = modifier
        )
    } else {
        Icon(
            Icons.Default.Android,
            contentDescription = null,
            modifier = modifier,
            tint = MaterialTheme.colorScheme.primary
        )
    }
}

@Composable
fun ScoreBadge(score: Int) {
    val color = getScoreColor(score)
    Surface(
        shape = RoundedCornerShape(8.dp),
        color = color.copy(alpha = 0.15f)
    ) {
        Text(
            text = "$score",
            color = color,
            style = MaterialTheme.typography.labelLarge,
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 4.dp)
        )
    }
}
