package com.privacyhelper.ui.screens

import androidx.compose.foundation.layout.* 
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.privacyhelper.data.model.AppInfo
import com.privacyhelper.ui.components.AppListItem

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AppListScreen(
    apps: List<AppInfo>,
    onAppClick: (AppInfo) -> Unit,
    onBackClick: () -> Unit
) {
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Приложения (${apps.size})") },
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
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            items(
                items = apps,
                key = { it.packageName }
            ) { app ->
                AppListItem(
                    app = app,
                    onClick = { onAppClick(app) }
                )
            }
        }
    }
}
