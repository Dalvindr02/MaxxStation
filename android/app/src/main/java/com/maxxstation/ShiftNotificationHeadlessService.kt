package com.maxxstation

import android.content.Intent
import com.facebook.react.HeadlessJsTaskService
import com.facebook.react.jstasks.HeadlessJsTaskConfig

class ShiftNotificationHeadlessService : HeadlessJsTaskService() {
  override fun getTaskConfig(intent: Intent?): HeadlessJsTaskConfig? {
    val extras = intent?.extras ?: return null
    return HeadlessJsTaskConfig(
      "ShiftNotificationResyncTask",
      com.facebook.react.bridge.Arguments.fromBundle(extras),
      15000,
      false
    )
  }
}
