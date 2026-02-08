package com.privacyhelper.ui.theme

import android.os.Build
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext

private val LightColorScheme = lightColorScheme(
    primary = Color(0xFF1B6B4D),
    onPrimary = Color.White,
    primaryContainer = Color(0xFFA7F5CE),
    onPrimaryContainer = Color(0xFF002115),
    secondary = Color(0xFF4E6355),
    onSecondary = Color.White,
    secondaryContainer = Color(0xFFD0E8D6),
    onSecondaryContainer = Color(0xFF0B1F14),
    tertiary = Color(0xFF3C6472),
    onTertiary = Color.White,
    error = Color(0xFFBA1A1A),
    onError = Color.White,
    background = Color(0xFFFBFDF8),
    onBackground = Color(0xFF191C1A),
    surface = Color(0xFFFBFDF8),
    onSurface = Color(0xFF191C1A),
)

private val DarkColorScheme = darkColorScheme(
    primary = Color(0xFF8BD8B3),
    onPrimary = Color(0xFF003828),
    primaryContainer = Color(0xFF005139),
    onPrimaryContainer = Color(0xFFA7F5CE),
    secondary = Color(0xFFB5CCBB),
    onSecondary = Color(0xFF203529),
    secondaryContainer = Color(0xFF364B3E),
    onSecondaryContainer = Color(0xFFD0E8D6),
    tertiary = Color(0xFFA3CDD9),
    onTertiary = Color(0xFF033542),
    error = Color(0xFFFFB4AB),
    onError = Color(0xFF690005),
    background = Color(0xFF191C1A),
    onBackground = Color(0xFFE1E3DE),
    surface = Color(0xFF191C1A),
    onSurface = Color(0xFFE1E3DE),
)

@Composable
fun PrivacyHelperTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit
) {
    val colorScheme = when {
        Build.VERSION.SDK_INT >= Build.VERSION_CODES.S -> {
            val context = LocalContext.current
            if (darkTheme) dynamicDarkColorScheme(context) else dynamicLightColorScheme(context)
        }
        darkTheme -> DarkColorScheme
        else -> LightColorScheme
    }

    MaterialTheme(
        colorScheme = colorScheme,
        typography = Typography(),
        content = content
    )
}
