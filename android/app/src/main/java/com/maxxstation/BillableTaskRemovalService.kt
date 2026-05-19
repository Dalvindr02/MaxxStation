package com.maxxstation

import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.IBinder
import android.os.Process
import android.util.Log

class BillableTaskRemovalService : Service() {

  companion object {
    const val PREFS_NAME = "billable_tracking_control"
    const val TASK_REMOVED_KEY = "task_removed"
    // Written by onTaskRemoved so the JS background loop can read it next iteration
    const val SESSION_KILLED_KEY = "session_killed"
    private const val TAG = "BillableTaskRemoval"
    private const val RN_BACKGROUND_ACTIONS_SERVICE =
      "com.asterinet.react.bgactions.RNBackgroundActionsTask"
    // Notifee uses this channel for the billable-tracking notification
    private const val NOTIFEE_CHANNEL_ID = "maxxstation-alerts"
    private const val NOTIFEE_NOTIFICATION_ID = "billable-tracking"
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    // START_NOT_STICKY: OS must NOT restart this service after it is killed.
    return START_NOT_STICKY
  }

  override fun onTaskRemoved(rootIntent: Intent?) {
    Log.i(TAG, "onTaskRemoved fired — stopping all billable services")

    // 1. Persist kill flags so JS can detect the kill on next resume
    getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
      .edit()
      .putBoolean(TASK_REMOVED_KEY, true)
      .putBoolean(SESSION_KILLED_KEY, true)
      .apply()

    // 2. Stop the react-native-background-actions foreground service
    stopBillableForegroundServices()

    // 3. Cancel every notification (removes tracking notification + any ghost notifications)
    runCatching {
      val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      nm.cancelAll()
    }.onFailure { Log.w(TAG, "cancelAll failed", it) }

    stopSelf()
    super.onTaskRemoved(rootIntent)

    // 4. Kill the process on a daemon thread so it survives main Looper teardown.
    //    A short delay gives stopService() time to be processed by the OS before
    //    we hard-kill the process, preventing the OS from treating it as a crash
    //    and scheduling a restart.
    val pid = Process.myPid()
    Thread {
      try { Thread.sleep(600) } catch (_: InterruptedException) {}
      Log.i(TAG, "Killing process $pid after task removal cleanup")
      Process.killProcess(pid)
    }.apply {
      isDaemon = true
      start()
    }
  }

  override fun onBind(intent: Intent?): IBinder? = null

  private fun stopBillableForegroundServices() {
    runCatching {
      stopService(Intent().setClassName(packageName, RN_BACKGROUND_ACTIONS_SERVICE))
    }.onFailure { Log.w(TAG, "Could not stop RNBackgroundActionsTask", it) }
  }
}
