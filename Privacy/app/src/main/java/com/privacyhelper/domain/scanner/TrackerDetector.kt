package com.privacyhelper.domain.scanner

import android.content.Context
import android.content.pm.PackageManager
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import com.privacyhelper.data.model.TrackerDefinition

class TrackerDetector(private val context: Context) {

    private val trackerDefinitions: List<TrackerDefinition> by lazy {
        loadTrackerDefinitions()
    }

    private fun loadTrackerDefinitions(): List<TrackerDefinition> {
        return try {
            val json = context.assets.open("trackers.json")
                .bufferedReader()
                .use { it.readText() }

            val type = object : TypeToken<Map<String, List<String>>>() {}.type
            val map: Map<String, List<String>> = Gson().fromJson(json, type)

            map.map { (name, signatures) ->
                TrackerDefinition(name = name, signatures = signatures)
            }
        } catch (e: Exception) {
            emptyList()
        }
    }

    fun detectTrackers(packageName: String): List<String> {
        val detectedTrackers = mutableListOf<String>()

        try {
            val pm = context.packageManager
            val appInfo = pm.getApplicationInfo(packageName, PackageManager.GET_META_DATA)
            val sourceDir = appInfo.sourceDir

            val dexClasses = getDexClassNames(sourceDir)

            for (tracker in trackerDefinitions) {
                for (signature in tracker.signatures) {
                    if (dexClasses.any { it.startsWith(signature) }) {
                        detectedTrackers.add(tracker.name)
                        break
                    }
                }
            }
        } catch (e: Exception) {
            // Приложение может быть недоступно для анализа
        }

        return detectedTrackers
    }

    private fun getDexClassNames(apkPath: String): List<String> {
        val classNames = mutableListOf<String>()
        try {
            val dexFile = dalvik.system.DexFile(apkPath)
            val entries = dexFile.entries()
            while (entries.hasMoreElements()) {
                classNames.add(entries.nextElement())
            }
            dexFile.close()
        } catch (e: Exception) {
            // Некоторые APK могут не поддерживать прямое чтение DEX
        }
        return classNames
    }
}
