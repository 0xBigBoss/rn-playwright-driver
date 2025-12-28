package expo.modules.rndriverviewtree

import android.view.View
import java.lang.ref.WeakReference
import java.util.UUID
import java.util.WeakHashMap

/**
 * Shared handle registry for cross-module view resolution.
 * The view-tree module registers views here, screenshot module resolves them.
 */
object RNDriverHandleRegistry {
    // WeakHashMap: View -> handle (auto-cleans when view is GC'd)
    private val viewToHandle = WeakHashMap<View, String>()
    // Regular map for reverse lookup (cleaned manually)
    private val handleToView = mutableMapOf<String, WeakReference<View>>()
    private val lock = Any()

    fun register(view: View, handle: String) {
        synchronized(lock) {
            viewToHandle[view] = handle
            handleToView[handle] = WeakReference(view)
        }
    }

    fun resolve(handle: String): View? {
        synchronized(lock) {
            val ref = handleToView[handle] ?: return null
            val view = ref.get()
            if (view == null) {
                // View was garbage collected, clean up
                handleToView.remove(handle)
            }
            return view
        }
    }

    fun getOrCreateHandle(view: View): String {
        synchronized(lock) {
            // Reuse existing handle if view already tracked
            viewToHandle[view]?.let { return it }

            // Generate new handle
            val handle = "element_${UUID.randomUUID().toString().replace("-", "").take(16)}"
            viewToHandle[view] = handle
            handleToView[handle] = WeakReference(view)
            return handle
        }
    }
}
