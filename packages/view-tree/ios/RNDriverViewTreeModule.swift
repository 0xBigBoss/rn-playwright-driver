import ExpoModulesCore
import UIKit

/// Shared handle registry for cross-module view resolution.
/// This registry is the canonical source - the screenshot module imports it
/// to resolve handles when capturing element screenshots.
public class RNDriverHandleRegistry {
    public static let shared = RNDriverHandleRegistry()

    private var handleToView = NSMapTable<NSString, UIView>.strongToWeakObjects()
    private var viewToHandle = NSMapTable<UIView, NSString>.weakToStrongObjects()
    private let lock = NSLock()

    private init() {}

    public func register(view: UIView, handle: String) {
        lock.lock()
        defer { lock.unlock() }
        handleToView.setObject(view, forKey: handle as NSString)
        viewToHandle.setObject(handle as NSString, forKey: view)
    }

    public func resolve(handle: String) -> UIView? {
        lock.lock()
        defer { lock.unlock() }
        return handleToView.object(forKey: handle as NSString)
    }

    public func getOrCreateHandle(for view: UIView) -> String {
        lock.lock()
        defer { lock.unlock() }

        if let existing = viewToHandle.object(forKey: view) {
            return existing as String
        }

        let uuid = UUID().uuidString.replacingOccurrences(of: "-", with: "")
        let handle = "element_\(String(uuid.prefix(16)))"
        handleToView.setObject(view, forKey: handle as NSString)
        viewToHandle.setObject(handle as NSString, forKey: view)
        return handle
    }
}

/// Element bounds in logical points
struct ElementBounds: Record {
    @Field var x: Double = 0
    @Field var y: Double = 0
    @Field var width: Double = 0
    @Field var height: Double = 0
}

/// Element info returned from queries
struct ElementInfo: Record {
    @Field var handle: String = ""
    @Field var testId: String? = nil
    @Field var text: String? = nil
    @Field var role: String? = nil
    @Field var label: String? = nil
    @Field var bounds: ElementBounds = ElementBounds()
    @Field var visible: Bool = false
    @Field var enabled: Bool = true
}

public class RNDriverViewTreeModule: Module {
    public func definition() -> ModuleDefinition {
        Name("RNDriverViewTree")

        // Single element queries - all run on main thread for UIKit safety
        AsyncFunction("findByTestId") { (testId: String) -> [String: Any] in
            return self.runOnMainThread {
                self.findSingleElement { view in
                    self.matchesTestId(view, testId: testId)
                }
            }
        }

        AsyncFunction("findByText") { (text: String, exact: Bool) -> [String: Any] in
            return self.runOnMainThread {
                self.findSingleElement { view in
                    self.matchesText(view, text: text, exact: exact)
                }
            }
        }

        AsyncFunction("findByRole") { (role: String, name: String?) -> [String: Any] in
            return self.runOnMainThread {
                self.findSingleElement { view in
                    self.matchesRole(view, role: role, name: name)
                }
            }
        }

        // Multiple element queries
        AsyncFunction("findAllByTestId") { (testId: String) -> [String: Any] in
            return self.runOnMainThread {
                self.findAllElements { view in
                    self.matchesTestId(view, testId: testId)
                }
            }
        }

        AsyncFunction("findAllByText") { (text: String, exact: Bool) -> [String: Any] in
            return self.runOnMainThread {
                self.findAllElements { view in
                    self.matchesText(view, text: text, exact: exact)
                }
            }
        }

        AsyncFunction("findAllByRole") { (role: String, name: String?) -> [String: Any] in
            return self.runOnMainThread {
                self.findAllElements { view in
                    self.matchesRole(view, role: role, name: name)
                }
            }
        }

        // Element state queries
        AsyncFunction("getBounds") { (handle: String) -> [String: Any] in
            return self.runOnMainThread {
                guard let view = self.resolveHandle(handle) else {
                    return self.successResult(NSNull())
                }
                let bounds = self.getViewBounds(view)
                return self.successResult([
                    "x": bounds.x,
                    "y": bounds.y,
                    "width": bounds.width,
                    "height": bounds.height
                ])
            }
        }

        AsyncFunction("isVisible") { (handle: String) -> [String: Any] in
            return self.runOnMainThread {
                guard let view = self.resolveHandle(handle) else {
                    return self.errorResult("Element not found", code: "NOT_FOUND")
                }
                return self.successResult(self.isViewVisible(view))
            }
        }

        AsyncFunction("isEnabled") { (handle: String) -> [String: Any] in
            return self.runOnMainThread {
                guard let view = self.resolveHandle(handle) else {
                    return self.errorResult("Element not found", code: "NOT_FOUND")
                }
                return self.successResult(self.isViewEnabled(view))
            }
        }

        AsyncFunction("refresh") { (handle: String) -> [String: Any] in
            return self.runOnMainThread {
                guard let view = self.resolveHandle(handle) else {
                    return self.successResult(NSNull())
                }
                return self.successResult(self.createElementInfo(for: view))
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

    // MARK: - Handle Management (uses shared registry for cross-module access)

    private func getOrCreateHandle(for view: UIView) -> String {
        return RNDriverHandleRegistry.shared.getOrCreateHandle(for: view)
    }

    private func resolveHandle(_ handle: String) -> UIView? {
        return RNDriverHandleRegistry.shared.resolve(handle: handle)
    }

    // MARK: - View Traversal

    private func getRootView() -> UIView? {
        guard let scene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
              let window = scene.windows.first(where: { $0.isKeyWindow }) else {
            return nil
        }
        return window
    }

    private func traverseViews(from view: UIView, matching predicate: (UIView) -> Bool) -> [UIView] {
        var results: [UIView] = []

        if predicate(view) {
            results.append(view)
        }

        for subview in view.subviews {
            results.append(contentsOf: traverseViews(from: subview, matching: predicate))
        }

        return results
    }

    // MARK: - Matchers

    private func matchesTestId(_ view: UIView, testId: String) -> Bool {
        return view.accessibilityIdentifier == testId
    }

    private func matchesText(_ view: UIView, text: String, exact: Bool) -> Bool {
        let viewText = getViewText(view)
        guard let viewText = viewText else { return false }

        if exact {
            return viewText == text
        } else {
            return viewText.localizedCaseInsensitiveContains(text)
        }
    }

    private func matchesRole(_ view: UIView, role: String, name: String?) -> Bool {
        let viewRole = getViewRole(view)
        guard viewRole == role else { return false }

        if let name = name {
            let label = view.accessibilityLabel ?? getViewText(view)
            return label == name
        }

        return true
    }

    // MARK: - View Properties

    private func getViewText(_ view: UIView) -> String? {
        // Check accessibility label first
        if let label = view.accessibilityLabel, !label.isEmpty {
            return label
        }

        // Check accessibility value (e.g., for sliders, progress bars)
        if let value = view.accessibilityValue, !value.isEmpty {
            return value
        }

        // Check if it's a UILabel
        if let label = view as? UILabel {
            return label.text
        }

        // Check if it's a UITextField
        if let textField = view as? UITextField {
            return textField.text ?? textField.placeholder
        }

        // Check if it's a UITextView
        if let textView = view as? UITextView {
            return textView.text
        }

        // Check if it's a UIButton
        if let button = view as? UIButton {
            return button.currentTitle
        }

        // For container views, aggregate text from child UILabels
        let childText = getAggregatedChildText(view)
        if !childText.isEmpty {
            return childText
        }

        return nil
    }

    /// Aggregate text from immediate child UILabel/Text views.
    /// Useful for container views like RCTView that wrap multiple text elements.
    private func getAggregatedChildText(_ view: UIView) -> String {
        var texts: [String] = []
        for subview in view.subviews {
            if let label = subview as? UILabel, let text = label.text, !text.isEmpty {
                texts.append(text)
            }
        }
        return texts.joined(separator: " ")
    }

    private func getViewRole(_ view: UIView) -> String? {
        let traits = view.accessibilityTraits

        if traits.contains(.button) { return "button" }
        if traits.contains(.link) { return "link" }
        if traits.contains(.image) { return "image" }
        if traits.contains(.header) { return "header" }
        if traits.contains(.searchField) { return "searchbox" }
        if traits.contains(.adjustable) { return "slider" }
        if traits.contains(.staticText) { return "text" }

        // Check view type
        if view is UIButton { return "button" }
        if view is UILabel { return "text" }
        if view is UIImageView { return "image" }
        if view is UITextField { return "textbox" }
        if view is UITextView { return "textbox" }
        if view is UISwitch { return "switch" }
        if view is UISlider { return "slider" }

        return nil
    }

    private func getViewBounds(_ view: UIView) -> ElementBounds {
        let screenBounds = view.convert(view.bounds, to: nil)
        var bounds = ElementBounds()
        bounds.x = Double(screenBounds.origin.x)
        bounds.y = Double(screenBounds.origin.y)
        bounds.width = Double(screenBounds.size.width)
        bounds.height = Double(screenBounds.size.height)
        return bounds
    }

    private func isViewVisible(_ view: UIView) -> Bool {
        guard !view.isHidden, view.alpha > 0 else { return false }

        // Check if view is within screen bounds
        let screenBounds = view.convert(view.bounds, to: nil)
        let screen = UIScreen.main.bounds

        return screenBounds.intersects(screen)
    }

    private func isViewEnabled(_ view: UIView) -> Bool {
        if let control = view as? UIControl {
            return control.isEnabled
        }
        return view.isUserInteractionEnabled
    }

    // MARK: - Element Info Creation

    private func createElementInfo(for view: UIView) -> [String: Any] {
        let bounds = getViewBounds(view)
        return [
            "handle": getOrCreateHandle(for: view),
            "testId": view.accessibilityIdentifier as Any,
            "text": getViewText(view) as Any,
            "role": getViewRole(view) as Any,
            "label": view.accessibilityLabel as Any,
            "bounds": [
                "x": bounds.x,
                "y": bounds.y,
                "width": bounds.width,
                "height": bounds.height
            ],
            "visible": isViewVisible(view),
            "enabled": isViewEnabled(view)
        ]
    }

    // MARK: - Query Helpers

    private func findSingleElement(matching predicate: (UIView) -> Bool) -> [String: Any] {
        guard let root = getRootView() else {
            return errorResult("Could not find root view", code: "INTERNAL")
        }

        let matches = traverseViews(from: root, matching: predicate)

        if matches.isEmpty {
            return errorResult("Element not found", code: "NOT_FOUND")
        }

        if matches.count > 1 {
            return errorResult("Multiple elements found (\(matches.count)). Use findAll* or make selector more specific.", code: "MULTIPLE_FOUND")
        }

        return successResult(createElementInfo(for: matches[0]))
    }

    private func findAllElements(matching predicate: (UIView) -> Bool) -> [String: Any] {
        guard let root = getRootView() else {
            return errorResult("Could not find root view", code: "INTERNAL")
        }

        let matches = traverseViews(from: root, matching: predicate)
        let elements = matches.map { createElementInfo(for: $0) }

        return successResult(elements)
    }

    // MARK: - Result Helpers

    private func successResult(_ data: Any) -> [String: Any] {
        return ["success": true, "data": data]
    }

    private func errorResult(_ error: String, code: String) -> [String: Any] {
        return ["success": false, "error": error, "code": code]
    }
}
