import ExpoModulesCore
import UIKit

public class RNDriverLifecycleModule: Module {
    public func definition() -> ModuleDefinition {
        Name("RNDriverLifecycle")

        AsyncFunction("openURL") { (urlString: String) -> [String: Any] in
            guard let url = URL(string: urlString) else {
                return self.errorResult("Invalid URL: \(urlString)", code: "INVALID_URL")
            }

            let opened = self.runOnMainThreadAsync { (completion: @escaping (Bool) -> Void) in
                UIApplication.shared.open(url, options: [:], completionHandler: completion)
            }

            if opened {
                return self.successResult(NSNull())
            } else {
                return self.errorResult("Failed to open URL: \(urlString)", code: "INTERNAL")
            }
        }

        AsyncFunction("reload") { () -> [String: Any] in
            // Reload requires DevSettings which is only available in dev mode
            // and requires complex ObjC bridging. Return NOT_SUPPORTED for now.
            return self.errorResult(
                "Reload not supported. Use Metro's reload functionality instead.",
                code: "NOT_SUPPORTED"
            )
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
            let state: String = self.runOnMainThread {
                switch UIApplication.shared.applicationState {
                case .active:
                    return "active"
                case .background:
                    return "background"
                case .inactive:
                    return "inactive"
                @unknown default:
                    return "active"
                }
            }

            return self.successResult(state)
        }
    }

    // MARK: - Thread Safety

    /// Run a closure on the main thread and wait for result.
    /// If already on main thread, executes synchronously to avoid deadlock.
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

    /// Run an async callback-based operation on the main thread.
    /// If already on main thread, executes synchronously to avoid deadlock.
    private func runOnMainThreadAsync<T>(_ block: @escaping (@escaping (T) -> Void) -> Void) -> T {
        var result: T!
        let semaphore = DispatchSemaphore(value: 0)

        let dispatch = {
            block { value in
                result = value
                semaphore.signal()
            }
        }

        if Thread.isMainThread {
            dispatch()
        } else {
            DispatchQueue.main.async(execute: dispatch)
        }

        semaphore.wait()
        return result
    }

    // MARK: - Result Helpers

    private func successResult(_ data: Any) -> [String: Any] {
        return ["success": true, "data": data]
    }

    private func errorResult(_ error: String, code: String) -> [String: Any] {
        return ["success": false, "error": error, "code": code]
    }
}

