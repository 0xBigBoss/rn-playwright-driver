import ExpoModulesCore
import UIKit

public class RNDriverLifecycleModule: Module {
    public func definition() -> ModuleDefinition {
        Name("RNDriverLifecycle")

        AsyncFunction("openURL") { (urlString: String) -> [String: Any] in
            guard let url = URL(string: urlString) else {
                return self.errorResult("Invalid URL: \(urlString)", code: "INVALID_URL")
            }

            var opened = false
            let semaphore = DispatchSemaphore(value: 0)

            DispatchQueue.main.async {
                UIApplication.shared.open(url, options: [:]) { success in
                    opened = success
                    semaphore.signal()
                }
            }

            semaphore.wait()

            if opened {
                return self.successResult(NSNull())
            } else {
                return self.errorResult("Failed to open URL: \(urlString)", code: "INTERNAL")
            }
        }

        AsyncFunction("reload") { () -> [String: Any] in
            // Check if DevSettings is available (dev mode only)
            guard let devSettingsClass = RCTDevSettings,
                  let devSettings = devSettingsClass.sharedSettings else {
                return self.errorResult(
                    "Reload not available in production builds. DevSettings not found.",
                    code: "NOT_SUPPORTED"
                )
            }

            var reloadCalled = false
            let semaphore = DispatchSemaphore(value: 0)

            DispatchQueue.main.async {
                devSettings.reload()
                reloadCalled = true
                semaphore.signal()
            }

            semaphore.wait()

            if reloadCalled {
                return self.successResult(NSNull())
            } else {
                return self.errorResult("Failed to trigger reload", code: "INTERNAL")
            }
        }

        AsyncFunction("background") { () -> [String: Any] in
            // iOS doesn't allow apps to programmatically move to background
            // This would require XCUITest or private APIs
            return self.errorResult("Cannot programmatically background app on iOS", code: "NOT_SUPPORTED")
        }

        AsyncFunction("foreground") { () -> [String: Any] in
            // If the app is already in foreground, this is a no-op
            // To bring from background, we'd need to open a URL scheme
            return self.successResult(NSNull())
        }

        AsyncFunction("getState") { () -> [String: Any] in
            var state: String = "active"

            let semaphore = DispatchSemaphore(value: 0)
            DispatchQueue.main.async {
                switch UIApplication.shared.applicationState {
                case .active:
                    state = "active"
                case .background:
                    state = "background"
                case .inactive:
                    state = "inactive"
                @unknown default:
                    state = "active"
                }
                semaphore.signal()
            }
            semaphore.wait()

            return self.successResult(state)
        }
    }

    // MARK: - Result Helpers

    private func successResult(_ data: Any) -> [String: Any] {
        return ["success": true, "data": data]
    }

    private func errorResult(_ error: String, code: String) -> [String: Any] {
        return ["success": false, "error": error, "code": code]
    }
}

// Optional: Forward declare RCTDevSettings for reload functionality
@objc protocol RCTDevSettingsProtocol {
    func reload()
}

private var RCTDevSettings: RCTDevSettingsProtocol.Type? {
    return NSClassFromString("RCTDevSettings") as? RCTDevSettingsProtocol.Type
}

extension RCTDevSettingsProtocol {
    static var sharedSettings: RCTDevSettingsProtocol? {
        let selector = NSSelectorFromString("sharedSettings")
        guard (self as AnyClass).responds(to: selector) else { return nil }
        return (self as AnyClass).perform(selector)?.takeUnretainedValue() as? RCTDevSettingsProtocol
    }
}
