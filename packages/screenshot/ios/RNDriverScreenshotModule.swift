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

        AsyncFunction("captureElement") { (handle: String) -> [String: Any] in
            // For element capture, we need to access the view tree module's handle map
            // Since we can't directly access it, we'll capture the screen and crop
            // In a real implementation, you'd want to share the handle map or use a different approach
            return self.errorResult("captureElement requires view-tree module integration", code: "NOT_SUPPORTED")
        }

        AsyncFunction("captureRegion") { (x: Double, y: Double, width: Double, height: Double) -> [String: Any] in
            guard let window = self.getKeyWindow() else {
                return self.errorResult("Could not find key window", code: "INTERNAL")
            }

            guard let fullImage = self.captureView(window) else {
                return self.errorResult("Failed to capture screen", code: "INTERNAL")
            }

            // Convert logical points to pixels
            let scale = UIScreen.main.scale
            let rect = CGRect(
                x: x * scale,
                y: y * scale,
                width: width * scale,
                height: height * scale
            )

            guard let cgImage = fullImage.cgImage?.cropping(to: rect) else {
                return self.errorResult("Failed to crop image", code: "INTERNAL")
            }

            let croppedImage = UIImage(cgImage: cgImage, scale: scale, orientation: fullImage.imageOrientation)

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
