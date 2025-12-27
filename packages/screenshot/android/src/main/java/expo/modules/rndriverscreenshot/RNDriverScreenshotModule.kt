package expo.modules.rndriverscreenshot

import android.graphics.Bitmap
import android.graphics.Canvas
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.util.Base64
import android.view.PixelCopy
import android.view.View
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.ByteArrayOutputStream
import java.util.concurrent.TimeUnit

class RNDriverScreenshotModule : Module() {
    override fun definition() = ModuleDefinition {
        Name("RNDriverScreenshot")

        AsyncFunction("captureScreen") {
            val rootView = getRootView() ?: return@AsyncFunction errorResult("Could not find root view", "INTERNAL")

            val bitmap = captureView(rootView)
            if (bitmap == null) {
                return@AsyncFunction errorResult("Failed to capture screen", "INTERNAL")
            }

            val base64 = bitmapToBase64(bitmap)
            bitmap.recycle()

            if (base64 == null) {
                return@AsyncFunction errorResult("Failed to encode image", "INTERNAL")
            }

            successResult(base64)
        }

        // Note: captureElement is implemented via JS bridge in the harness
        // The harness calls viewTree.getBounds(handle) then screenshot.captureRegion()
        AsyncFunction("captureElement") { handle: String ->
            // This would require cross-module handle registry which adds complexity
            // Instead, use the harness bridge which orchestrates viewTree + screenshot
            errorResult(
                "Use harness bridge: global.__RN_DRIVER__.screenshot.captureElement(handle)",
                "NOT_SUPPORTED"
            )
        }

        AsyncFunction("captureRegion") { x: Double, y: Double, width: Double, height: Double ->
            val rootView = getRootView() ?: return@AsyncFunction errorResult("Could not find root view", "INTERNAL")

            val fullBitmap = captureView(rootView)
            if (fullBitmap == null) {
                return@AsyncFunction errorResult("Failed to capture screen", "INTERNAL")
            }

            // Convert logical points (dp) to pixels
            val density = rootView.resources.displayMetrics.density
            val px = (x * density).toInt()
            val py = (y * density).toInt()
            val pWidth = (width * density).toInt()
            val pHeight = (height * density).toInt()

            // Ensure bounds are within the bitmap
            val cropX = px.coerceIn(0, fullBitmap.width - 1)
            val cropY = py.coerceIn(0, fullBitmap.height - 1)
            val cropWidth = pWidth.coerceAtMost(fullBitmap.width - cropX)
            val cropHeight = pHeight.coerceAtMost(fullBitmap.height - cropY)

            if (cropWidth <= 0 || cropHeight <= 0) {
                fullBitmap.recycle()
                return@AsyncFunction errorResult("Invalid crop region", "INTERNAL")
            }

            val croppedBitmap = Bitmap.createBitmap(fullBitmap, cropX, cropY, cropWidth, cropHeight)
            fullBitmap.recycle()

            val base64 = bitmapToBase64(croppedBitmap)
            croppedBitmap.recycle()

            if (base64 == null) {
                return@AsyncFunction errorResult("Failed to encode image", "INTERNAL")
            }

            successResult(base64)
        }
    }

    // MARK: - Helpers

    private fun getRootView(): View? {
        val activity = appContext.currentActivity ?: return null
        return activity.window?.decorView?.rootView
    }

    private fun captureView(view: View): Bitmap? {
        val bitmap = Bitmap.createBitmap(view.width, view.height, Bitmap.Config.ARGB_8888)

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            // Use PixelCopy for hardware-accelerated views (API 26+)
            val activity = appContext.currentActivity ?: return null
            val window = activity.window ?: return null

            try {
                val latch = java.util.concurrent.CountDownLatch(1)
                var success = false

                PixelCopy.request(
                    window,
                    bitmap,
                    { result ->
                        success = result == PixelCopy.SUCCESS
                        latch.countDown()
                    },
                    Handler(Looper.getMainLooper())
                )

                // Wait with timeout to prevent indefinite hang
                val completed = latch.await(5, TimeUnit.SECONDS)

                if (!completed || !success) {
                    // Fallback to canvas drawing
                    val canvas = Canvas(bitmap)
                    view.draw(canvas)
                }
            } catch (e: Exception) {
                // Fallback to canvas drawing
                val canvas = Canvas(bitmap)
                view.draw(canvas)
            }
        } else {
            // Fallback for older APIs
            val canvas = Canvas(bitmap)
            view.draw(canvas)
        }

        return bitmap
    }

    private fun bitmapToBase64(bitmap: Bitmap): String? {
        return try {
            val outputStream = ByteArrayOutputStream()
            bitmap.compress(Bitmap.CompressFormat.PNG, 100, outputStream)
            val bytes = outputStream.toByteArray()
            Base64.encodeToString(bytes, Base64.NO_WRAP)
        } catch (e: Exception) {
            null
        }
    }

    private fun successResult(data: Any?): Map<String, Any?> {
        return mapOf("success" to true, "data" to data)
    }

    private fun errorResult(error: String, code: String): Map<String, Any?> {
        return mapOf("success" to false, "error" to error, "code" to code)
    }
}
