import ExpoModulesCore
import UIKit

// Import RNDriverHandleRegistry from view-tree module for cross-module handle resolution
// The registry is defined in RNDriverViewTreeModule.swift

public class RNDriverScreenshotModule: Module {
    public func definition() -> ModuleDefinition {
        Name("RNDriverScreenshot")

        AsyncFunction("captureScreen") { () -> [String: Any] in
            return self.runOnMainThread {
                guard let window = self.getKeyWindow() else {
                    return self.errorResult("Could not find key window", code: "INTERNAL")
                }

                guard let image = self.captureView(window) else {
                    return self.errorResult("Failed to capture screen", code: "INTERNAL")
                }

                guard let base64 = self.imageToBase64(image) else {
                    return self.errorResult("Failed to encode image", code: "INTERNAL")
                }

                return self.successResult(base64)
            }
        }

        AsyncFunction("captureElement") { (handle: String) -> [String: Any] in
            return self.runOnMainThread {
                // Resolve handle to UIView via shared registry
                guard let view = RNDriverHandleRegistry.shared.resolve(handle: handle) else {
                    return self.errorResult("Element not found for handle: \(handle)", code: "NOT_FOUND")
                }

                // Render the view to an image
                guard let image = self.captureView(view) else {
                    return self.errorResult("Failed to capture element", code: "INTERNAL")
                }

                guard let base64 = self.imageToBase64(image) else {
                    return self.errorResult("Failed to encode image", code: "INTERNAL")
                }

                return self.successResult(base64)
            }
        }

        AsyncFunction("captureRegion") { (x: Double, y: Double, width: Double, height: Double) -> [String: Any] in
            return self.runOnMainThread {
                guard let window = self.getKeyWindow() else {
                    return self.errorResult("Could not find key window", code: "INTERNAL")
                }

                guard let fullImage = self.captureView(window),
                      let cgImage = fullImage.cgImage else {
                    return self.errorResult("Failed to capture screen", code: "INTERNAL")
                }

                // Convert logical points to pixels
                let scale = UIScreen.main.scale
                let px = x * scale
                let py = y * scale
                let pWidth = width * scale
                let pHeight = height * scale

                // Clamp to image bounds (like Android does)
                let imageWidth = CGFloat(cgImage.width)
                let imageHeight = CGFloat(cgImage.height)

                let clampedX = max(0, min(px, imageWidth - 1))
                let clampedY = max(0, min(py, imageHeight - 1))
                let clampedWidth = min(pWidth, imageWidth - clampedX)
                let clampedHeight = min(pHeight, imageHeight - clampedY)

                // Validate crop region
                guard clampedWidth > 0 && clampedHeight > 0 else {
                    return self.errorResult("Invalid crop region", code: "INTERNAL")
                }

                let rect = CGRect(x: clampedX, y: clampedY, width: clampedWidth, height: clampedHeight)

                guard let croppedCgImage = cgImage.cropping(to: rect) else {
                    return self.errorResult("Failed to crop image", code: "INTERNAL")
                }

                let croppedImage = UIImage(cgImage: croppedCgImage, scale: scale, orientation: fullImage.imageOrientation)

                guard let base64 = self.imageToBase64(croppedImage) else {
                    return self.errorResult("Failed to encode image", code: "INTERNAL")
                }

                return self.successResult(base64)
            }
        }
    }

    // MARK: - Thread Safety

    /// Run a closure on the main thread and wait for result.
    /// Required for UIKit access which must happen on main thread.
    private func runOnMainThread<T>(_ block: @escaping () -> T) -> T {
        if Thread.isMainThread {
            return block()
        }

        var result: T!
        let semaphore = DispatchSemaphore(value: 0)
        DispatchQueue.main.async {
            result = block()
            semaphore.signal()
        }
        semaphore.wait()
        return result
    }

    // MARK: - Helpers

    private func getKeyWindow() -> UIWindow? {
        guard let scene = UIApplication.shared.connectedScenes.first as? UIWindowScene else {
            return nil
        }
        return scene.windows.first(where: { $0.isKeyWindow })
    }

    private func captureView(_ view: UIView) -> UIImage? {
        let renderer = UIGraphicsImageRenderer(bounds: view.bounds)
        return renderer.image { context in
            view.drawHierarchy(in: view.bounds, afterScreenUpdates: true)
        }
    }

    private func imageToBase64(_ image: UIImage) -> String? {
        guard let pngData = image.pngData() else { return nil }
        return pngData.base64EncodedString()
    }

    private func successResult(_ data: Any) -> [String: Any] {
        return ["success": true, "data": data]
    }

    private func errorResult(_ error: String, code: String) -> [String: Any] {
        return ["success": false, "error": error, "code": code]
    }
}
