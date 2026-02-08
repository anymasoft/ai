# Privacy Helper ProGuard Rules
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile

# Gson
-keepattributes Signature
-keepattributes *Annotation*
-keep class com.privacyhelper.data.model.** { *; }
