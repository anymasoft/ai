package com.privacyhelper.ui.components

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.*
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

@Composable
fun ScoreIndicator(
    score: Int,
    modifier: Modifier = Modifier,
    size: Dp = 140.dp,
    strokeWidth: Dp = 12.dp
) {
    var animationPlayed by remember { mutableStateOf(false) }
    val animatedScore by animateFloatAsState(
        targetValue = if (animationPlayed) score / 100f else 0f,
        animationSpec = tween(durationMillis = 1000),
        label = "score"
    )

    LaunchedEffect(Unit) {
        animationPlayed = true
    }

    val color = getScoreColor(score)

    Box(
        contentAlignment = Alignment.Center,
        modifier = modifier.size(size)
    ) {
        Canvas(modifier = Modifier.size(size)) {
            // Фон дуги
            drawArc(
                color = color.copy(alpha = 0.15f),
                startAngle = 135f,
                sweepAngle = 270f,
                useCenter = false,
                style = Stroke(width = strokeWidth.toPx(), cap = StrokeCap.Round)
            )
            // Заполненная дуга
            drawArc(
                color = color,
                startAngle = 135f,
                sweepAngle = 270f * animatedScore,
                useCenter = false,
                style = Stroke(width = strokeWidth.toPx(), cap = StrokeCap.Round)
            )
        }

        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(
                text = "$score",
                fontSize = 36.sp,
                fontWeight = FontWeight.Bold,
                color = color
            )
            Text(
                text = getScoreLabel(score),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}

fun getScoreColor(score: Int): Color {
    return when {
        score <= 20 -> Color(0xFF4CAF50)
        score <= 50 -> Color(0xFFFFC107)
        score <= 75 -> Color(0xFFFF9800)
        else -> Color(0xFFF44336)
    }
}

fun getScoreLabel(score: Int): String {
    return when {
        score <= 20 -> "Безопасно"
        score <= 50 -> "Умеренно"
        score <= 75 -> "Рискованно"
        else -> "Опасно"
    }
}
