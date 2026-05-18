package com.maxxstation

import android.content.Intent
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class BillableTrackingControlModule(
  private val reactContext: ReactApplicationContext,
) : ReactContextBaseJavaModule(reactContext) {

  companion object {
    private const val RN_BACKGROUND_ACTIONS_SERVICE =
      "com.asterinet.react.bgactions.RNBackgroundActionsTask"
  }

  override fun getName(): String = "BillableTrackingControl"

  @ReactMethod
  fun startTaskRemovalWatcher(promise: Promise) {
    try {
      val intent = Intent(reactContext, BillableTaskRemovalService::class.java)
      reactContext.startService(intent)
      promise.resolve(null)
    } catch (error: Exception) {
      promise.reject("BILLABLE_WATCHER_START_FAILED", error)
    }
  }

  @ReactMethod
  fun stopTaskRemovalWatcher(promise: Promise) {
    try {
      reactContext.stopService(Intent(reactContext, BillableTaskRemovalService::class.java))
      promise.resolve(null)
    } catch (error: Exception) {
      promise.reject("BILLABLE_WATCHER_STOP_FAILED", error)
    }
  }

  @ReactMethod
  fun stopBillableServices(promise: Promise) {
    try {
      reactContext.stopService(Intent(reactContext, BillableTaskRemovalService::class.java))
      reactContext.stopService(Intent().setClassName(reactContext.packageName, RN_BACKGROUND_ACTIONS_SERVICE))
      promise.resolve(null)
    } catch (error: Exception) {
      promise.reject("BILLABLE_SERVICES_STOP_FAILED", error)
    }
  }

  @ReactMethod
  fun consumeTaskRemovedFlag(promise: Promise) {
    try {
      val prefs = reactContext.getSharedPreferences(
        BillableTaskRemovalService.PREFS_NAME,
        android.content.Context.MODE_PRIVATE,
      )
      val wasTaskRemoved = prefs.getBoolean(BillableTaskRemovalService.TASK_REMOVED_KEY, false)
      if (wasTaskRemoved) {
        prefs.edit().remove(BillableTaskRemovalService.TASK_REMOVED_KEY).apply()
      }
      promise.resolve(wasTaskRemoved)
    } catch (error: Exception) {
      promise.reject("BILLABLE_TASK_REMOVED_READ_FAILED", error)
    }
  }
}
