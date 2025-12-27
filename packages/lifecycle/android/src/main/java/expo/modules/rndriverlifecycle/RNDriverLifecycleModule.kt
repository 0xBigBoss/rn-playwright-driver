package expo.modules.rndriverlifecycle

import android.content.Intent
import android.net.Uri
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.ProcessLifecycleOwner
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class RNDriverLifecycleModule : Module() {
    override fun definition() = ModuleDefinition {
        Name("RNDriverLifecycle")

        AsyncFunction("openURL") { urlString: String ->
            try {
                val uri = Uri.parse(urlString)
                val intent = Intent(Intent.ACTION_VIEW, uri)
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)

                val activity = appContext.currentActivity
                if (activity != null) {
                    activity.startActivity(intent)
                    successResult(null)
                } else {
                    val context = appContext.reactContext
                    context?.startActivity(intent)
                    successResult(null)
                }
            } catch (e: Exception) {
                errorResult("Failed to open URL: ${e.message}", "INTERNAL")
            }
        }

        AsyncFunction("reload") {
            try {
                val activity = appContext.currentActivity
                val reactContext = appContext.reactContext

                // Try to get ReactInstanceManager and reload
                val reactInstanceManagerMethod = reactContext?.javaClass?.getMethod("getReactInstanceManager")
                val reactInstanceManager = reactInstanceManagerMethod?.invoke(reactContext)

                if (reactInstanceManager != null) {
                    val recreateMethod = reactInstanceManager.javaClass.getMethod("recreateReactContextInBackground")
                    recreateMethod.invoke(reactInstanceManager)
                    successResult(null)
                } else {
                    errorResult("Could not find ReactInstanceManager", "INTERNAL")
                }
            } catch (e: Exception) {
                errorResult("Failed to reload: ${e.message}", "INTERNAL")
            }
        }

        AsyncFunction("background") {
            try {
                val activity = appContext.currentActivity
                if (activity != null) {
                    activity.moveTaskToBack(true)
                    successResult(null)
                } else {
                    errorResult("No active activity", "INTERNAL")
                }
            } catch (e: Exception) {
                errorResult("Failed to background: ${e.message}", "INTERNAL")
            }
        }

        AsyncFunction("foreground") {
            try {
                val activity = appContext.currentActivity
                if (activity != null) {
                    val intent = Intent(activity, activity.javaClass)
                    intent.addFlags(Intent.FLAG_ACTIVITY_REORDER_TO_FRONT)
                    activity.startActivity(intent)
                    successResult(null)
                } else {
                    errorResult("No active activity", "INTERNAL")
                }
            } catch (e: Exception) {
                errorResult("Failed to foreground: ${e.message}", "INTERNAL")
            }
        }

        AsyncFunction("getState") {
            try {
                val lifecycleState = ProcessLifecycleOwner.get().lifecycle.currentState

                val state = when {
                    lifecycleState.isAtLeast(Lifecycle.State.RESUMED) -> "active"
                    lifecycleState.isAtLeast(Lifecycle.State.STARTED) -> "inactive"
                    else -> "background"
                }

                successResult(state)
            } catch (e: Exception) {
                // Fallback: check if activity is in foreground
                val activity = appContext.currentActivity
                val state = if (activity != null && !activity.isFinishing) {
                    "active"
                } else {
                    "background"
                }
                successResult(state)
            }
        }
    }

    // MARK: - Result Helpers

    private fun successResult(data: Any?): Map<String, Any?> {
        return mapOf("success" to true, "data" to data)
    }

    private fun errorResult(error: String, code: String): Map<String, Any?> {
        return mapOf("success" to false, "error" to error, "code" to code)
    }
}
