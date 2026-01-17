package com.example.productphoto

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import android.widget.Button

class MainActivity : AppCompatActivity() {
    companion object {
        private const val WEB_URL = "https://example.com"
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        val button = findViewById<Button>(R.id.openWebButton)
        button.setOnClickListener {
            val intent = Intent(Intent.ACTION_VIEW, Uri.parse(WEB_URL))
            startActivity(intent)
        }
    }
}
