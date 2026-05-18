package com.maxxstation

import android.app.Service
import android.content.Intent
import android.os.IBinder
import android.os.Process
import android.util.Log

class BillableTaskRemovalService : Service() {

  companion object {
    const val PREFS_NAME = "billable_tracking_control"
    const val TASK_REMOVED_KEY = "task_removed"
    private const val TAG = "BillableTaskRemoval"
    private const val RN_BACKGROUND_ACTIONS_SERVICE =
      "com.asterinet.react.bgactions.RNBackgroundActionsTask"
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    return START_NOT_STICKY
  }

  override fun onTaskRemoved(rootIntent: Intent?) {
    getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
      .edit()
      .putBoolean(TASK_REMOVED_KEY, true)
      .apply()
    stopBillableForegroundServices()
    stopSelf()
    super.onTaskRemoved(rootIntent)
    Process.killProcess(Process.myPid())
  }

  override fun onBind(intent: Intent?): IBinder? = null

  private fun stopBillableForegroundServices() {
    runCatching {
      stopService(Intent().setClassName(packageName, RN_BACKGROUND_ACTIONS_SERVICE))
    }.onFailure { error ->
      Log.w(TAG, "Unable to stop background-actions service after task removal", error)
    }
  }
}
