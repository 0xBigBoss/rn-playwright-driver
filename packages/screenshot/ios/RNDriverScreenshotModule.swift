import ExpoModulesCore
import UIKit

public class RNDriverScreenshotModule: Module {
    public func definition() -> ModuleDefinition {
        Name("RNDriverScreenshot")

        AsyncFunction("captureScreen") { () -> [String: Any] in
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

        // Note: captureElement is implemented via JS bridge in the harness
        // The harness calls viewTree.getBounds(handle) then screenshot.captureRegion()
        // This native function is a placeholder for direct handle capture if needed
        AsyncFunction("captureElement") { (handle: String) -> [String: Any] in
            // This would require cross-module handle registry which adds complexity
            // Instead, use the harness bridge which orchestrates viewTree + screenshot
            return self.errorResult(
                "Use harness bridge: global.__RN_DRIVER__.screenshot.captureElement(handle)",
                code: "NOT_SUPPORTED"
            )
        }

        AsyncFunction("captureRegion") { (x: Double, y: Double, width: Double, height: Double) -> [String: Any] in
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
