package com.maxxstation

import android.app.ActivityManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.facebook.react.HeadlessJsTaskService

private fun isAppInForeground(context: Context): Boolean {
  val activityManager =
    context.getSystemService(Context.ACTIVITY_SERVICE) as? ActivityManager ?: return false
  val packageName = context.packageName
  return activityManager.runningAppProcesses?.any { processInfo ->
    processInfo.importance == ActivityManager.RunningAppProcessInfo.IMPORTANCE_FOREGROUND &&
      processInfo.pkgList.contains(packageName)
  } == true
}

class ShiftNotificationBootReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val action = intent.action ?: return
    if (
      action != Intent.ACTION_BOOT_COMPLETED &&
      action != Intent.ACTION_MY_PACKAGE_REPLACED &&
      action != Intent.ACTION_TIME_CHANGED &&
      action != Intent.ACTION_TIMEZONE_CHANGED
    ) {
      return
    }

    if (isAppInForeground(context)) {
      return
    }

    val serviceIntent = Intent(context, ShiftNotificationHeadlessService::class.java).apply {
      putExtra("eventName", "SHIFT_NOTIFICATION_RESYNC")
      putExtra("action", action)
    }

    HeadlessJsTaskService.acquireWakeLockNow(context)
    context.startService(serviceIntent)
  }
}
