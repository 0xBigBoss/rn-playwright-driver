package expo.modules.rndriverviewtree

import android.os.Handler
import android.os.Looper
import android.view.View
import android.view.ViewGroup
import android.widget.Button
import android.widget.EditText
import android.widget.ImageView
import android.widget.Switch
import android.widget.TextView
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.lang.ref.WeakReference
import java.util.UUID
import java.util.WeakHashMap
import java.util.concurrent.CountDownLatch

class RNDriverViewTreeModule : Module() {
    // WeakHashMap: View -> handle (auto-cleans when view is GC'd)
    private val viewToHandle = WeakHashMap<View, String>()
    // Regular map for reverse lookup (cleaned manually)
    private val handleToView = mutableMapOf<String, WeakReference<View>>()

    override fun definition() = ModuleDefinition {
        Name("RNDriverViewTree")

        // Single element queries - all run on UI thread for View hierarchy safety
        AsyncFunction("findByTestId") { testId: String ->
            runOnUiThreadBlocking { findSingleElement { view -> matchesTestId(view, testId) } }
        }

        AsyncFunction("findByText") { text: String, exact: Boolean ->
            runOnUiThreadBlocking { findSingleElement { view -> matchesText(view, text, exact) } }
        }

        AsyncFunction("findByRole") { role: String, name: String? ->
            runOnUiThreadBlocking { findSingleElement { view -> matchesRole(view, role, name) } }
        }

        // Multiple element queries
        AsyncFunction("findAllByTestId") { testId: String ->
            runOnUiThreadBlocking { findAllElements { view -> matchesTestId(view, testId) } }
        }

        AsyncFunction("findAllByText") { text: String, exact: Boolean ->
            runOnUiThreadBlocking { findAllElements { view -> matchesText(view, text, exact) } }
        }

        AsyncFunction("findAllByRole") { role: String, name: String? ->
            runOnUiThreadBlocking { findAllElements { view -> matchesRole(view, role, name) } }
        }

        // Element state queries
        AsyncFunction("getBounds") { handle: String ->
            runOnUiThreadBlocking {
                val view = resolveHandle(handle)
                if (view == null) {
                    successResult(null)
                } else {
                    val bounds = getViewBounds(view)
                    successResult(bounds)
                }
            }
        }

        AsyncFunction("isVisible") { handle: String ->
            runOnUiThreadBlocking {
                val view = resolveHandle(handle)
                if (view == null) {
                    errorResult("Element not found", "NOT_FOUND")
                } else {
                    successResult(isViewVisible(view))
                }
            }
        }

        AsyncFunction("isEnabled") { handle: String ->
            runOnUiThreadBlocking {
                val view = resolveHandle(handle)
                if (view == null) {
                    errorResult("Element not found", "NOT_FOUND")
                } else {
                    successResult(view.isEnabled)
                }
            }
        }

        AsyncFunction("refresh") { handle: String ->
            runOnUiThreadBlocking {
                val view = resolveHandle(handle)
                if (view == null) {
                    successResult(null)
                } else {
                    successResult(createElementInfo(view))
                }
            }
        }
    }

    // MARK: - Thread Safety

    /**
     * Run a block on the UI thread and wait for result.
     * Required for View hierarchy access which must happen on UI thread.
     */
    private fun <T> runOnUiThreadBlocking(block: () -> T): T {
        if (Looper.myLooper() == Looper.getMainLooper()) {
            return block()
        }

        val latch = CountDownLatch(1)
        var result: T? = null
        var exception: Exception? = null

        Handler(Looper.getMainLooper()).post {
            try {
                result = block()
            } catch (e: Exception) {
                exception = e
            }
            latch.countDown()
        }

        latch.await()

        exception?.let { throw it }
        @Suppress("UNCHECKED_CAST")
        return result as T
    }

    // MARK: - Handle Management

    private fun getOrCreateHandle(view: View): String {
        // Reuse existing handle if view already tracked
        viewToHandle[view]?.let { return it }

        // Generate new handle
        val handle = "element_${UUID.randomUUID().toString().replace("-", "").take(16)}"
        viewToHandle[view] = handle
        handleToView[handle] = WeakReference(view)
        return handle
    }

    private fun resolveHandle(handle: String): View? {
        val ref = handleToView[handle] ?: return null
        val view = ref.get()
        if (view == null) {
            // View was garbage collected, clean up
            handleToView.remove(handle)
        }
        return view
    }

    // MARK: - View Traversal

    private fun getRootView(): View? {
        val activity = appContext.currentActivity ?: return null
        return activity.window?.decorView?.rootView
    }

    private fun traverseViews(view: View, predicate: (View) -> Boolean): List<View> {
        val results = mutableListOf<View>()

        if (predicate(view)) {
            results.add(view)
        }

        if (view is ViewGroup) {
            for (i in 0 until view.childCount) {
                results.addAll(traverseViews(view.getChildAt(i), predicate))
            }
        }

        return results
    }

    // MARK: - Matchers

    private fun matchesTestId(view: View, testId: String): Boolean {
        // React Native sets testID as the tag
        val viewTestId = view.getTag(com.facebook.react.R.id.react_test_id)
        return viewTestId == testId || view.contentDescription == testId
    }

    private fun matchesText(view: View, text: String, exact: Boolean): Boolean {
        val viewText = getViewText(view) ?: return false

        return if (exact) {
            viewText == text
        } else {
            viewText.contains(text, ignoreCase = true)
        }
    }

    private fun matchesRole(view: View, role: String, name: String?): Boolean {
        val viewRole = getViewRole(view)
        if (viewRole != role) return false

        if (name != null) {
            val label = view.contentDescription?.toString() ?: getViewText(view)
            return label == name
        }

        return true
    }

    // MARK: - View Properties

    private fun getViewText(view: View): String? {
        // Check content description first
        view.contentDescription?.toString()?.takeIf { it.isNotEmpty() }?.let { return it }

        // Check view type
        return when (view) {
            is TextView -> view.text?.toString()
            is EditText -> view.text?.toString()?.takeIf { it.isNotEmpty() } ?: view.hint?.toString()
            is Button -> view.text?.toString()
            else -> null
        }
    }

    private fun getViewRole(view: View): String? {
        // Check accessibilityClassName if set
        view.accessibilityClassName?.toString()?.let { className ->
            when {
                className.contains("Button") -> return "button"
                className.contains("EditText") -> return "textbox"
                className.contains("ImageView") -> return "image"
                className.contains("Switch") -> return "switch"
            }
        }

        // Fallback to view type
        return when (view) {
            is Button -> "button"
            is TextView -> "text"
            is EditText -> "textbox"
            is ImageView -> "image"
            is Switch -> "switch"
            else -> null
        }
    }

    private fun getViewBounds(view: View): Map<String, Double> {
        val location = IntArray(2)
        view.getLocationOnScreen(location)

        // Convert to dp (logical points)
        val density = view.resources.displayMetrics.density
        return mapOf(
            "x" to (location[0] / density).toDouble(),
            "y" to (location[1] / density).toDouble(),
            "width" to (view.width / density).toDouble(),
            "height" to (view.height / density).toDouble()
        )
    }

    private fun isViewVisible(view: View): Boolean {
        if (view.visibility != View.VISIBLE) return false
        if (view.alpha <= 0) return false

        // Check if view is within screen bounds
        val location = IntArray(2)
        view.getLocationOnScreen(location)

        val metrics = view.resources.displayMetrics
        val screenWidth = metrics.widthPixels
        val screenHeight = metrics.heightPixels

        return location[0] < screenWidth &&
               location[0] + view.width > 0 &&
               location[1] < screenHeight &&
               location[1] + view.height > 0
    }

    // MARK: - Element Info Creation

    private fun createElementInfo(view: View): Map<String, Any?> {
        val testId = view.getTag(com.facebook.react.R.id.react_test_id)?.toString()
            ?: view.contentDescription?.toString()?.takeIf { it.isNotEmpty() }

        return mapOf(
            "handle" to getOrCreateHandle(view),
            "testId" to testId,
            "text" to getViewText(view),
            "role" to getViewRole(view),
            "label" to view.contentDescription?.toString(),
            "bounds" to getViewBounds(view),
            "visible" to isViewVisible(view),
            "enabled" to view.isEnabled
        )
    }

    // MARK: - Query Helpers

    private fun findSingleElement(predicate: (View) -> Boolean): Map<String, Any?> {
        val root = getRootView() ?: return errorResult("Could not find root view", "INTERNAL")

        val matches = traverseViews(root, predicate)

        return when {
            matches.isEmpty() -> errorResult("Element not found", "NOT_FOUND")
            matches.size > 1 -> errorResult(
                "Multiple elements found (${matches.size}). Use findAll* or make selector more specific.",
                "MULTIPLE_FOUND"
            )
            else -> successResult(createElementInfo(matches[0]))
        }
    }

    private fun findAllElements(predicate: (View) -> Boolean): Map<String, Any?> {
        val root = getRootView() ?: return errorResult("Could not find root view", "INTERNAL")

        val matches = traverseViews(root, predicate)
        val elements = matches.map { createElementInfo(it) }

        return successResult(elements)
    }

    // MARK: - Result Helpers

    private fun successResult(data: Any?): Map<String, Any?> {
        return mapOf("success" to true, "data" to data)
    }

    private fun errorResult(error: String, code: String): Map<String, Any?> {
        return mapOf("success" to false, "error" to error, "code" to code)
    }
}
