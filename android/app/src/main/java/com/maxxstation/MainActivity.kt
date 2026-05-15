package com.maxxstation

import android.content.Intent
import android.os.Bundle
import android.util.Log
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

class MainActivity : ReactActivity() {

  companion object {
    private const val TAG = "MainActivity"
    private const val RN_BACKGROUND_ACTIONS_SERVICE =
      "com.asterinet.react.bgactions.RNBackgroundActionsTask"
    private const val NOTIFEE_FOREGROUND_SERVICE = "app.notifee.core.ForegroundService"
  }

  override fun onCreate(savedInstanceState: Bundle?) {
    setTheme(R.style.AppTheme)
    // Avoid restoring native fragment / view state after process death or OEM task
    // switches — a frequent source of crashes when resuming with react-native-screens
    // and MapView together.
    super.onCreate(null)
  }

  override fun onNewIntent(intent: android.content.Intent?) {
    super.onNewIntent(intent)
    setIntent(intent)
  }

  /**
   * FIXED: Overriding onSaveInstanceState to do nothing prevents the system from
   * trying to restore a broken fragment/view state bundle after the activity is
   * killed in the background. Combined with super.onCreate(null), this ensures
   * a stable, clean restart on Samsung devices.
   */
  override fun onSaveInstanceState(outState: Bundle) {
    super.onSaveInstanceState(Bundle())
  }

  override fun onDestroy() {
    if (isFinishing && !isChangingConfigurations) {
      stopBillableForegroundServices()
    }
    super.onDestroy()
  }

  private fun stopBillableForegroundServices() {
    listOf(RN_BACKGROUND_ACTIONS_SERVICE, NOTIFEE_FOREGROUND_SERVICE).forEach { serviceName ->
      runCatching {
        stopService(Intent().setClassName(packageName, serviceName))
      }.onFailure { error ->
        Log.w(TAG, "Unable to stop $serviceName during task cleanup", error)
      }
    }
  }

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "MaxxStation"

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)
}
