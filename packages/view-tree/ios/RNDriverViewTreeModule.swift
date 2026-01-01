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

        // Tap action - triggers a native tap on the element
        // Tries multiple strategies:
        // 1. UIControl.sendActions (for native iOS controls)
        // 2. RCTSurfaceTouchHandler gesture recognizer (for RN Fabric views)
        // 3. accessibilityActivate (for accessible elements with button trait)
        AsyncFunction("tap") { (handle: String) -> [String: Any] in
            return self.runOnMainThread {
                guard let view = self.resolveHandle(handle) else {
                    return self.errorResult("Element not found", code: "NOT_FOUND")
                }

                // Try to perform native tap using multiple strategies
                let tapSucceeded = self.performTap(on: view)
                if tapSucceeded {
                    return self.successResult(true)
                }

                let viewType = String(describing: type(of: view))
                let testId = view.accessibilityIdentifier ?? "unknown"
                return self.errorResult("Could not trigger tap on view - viewType: \(viewType), testId: \(testId)", code: "TAP_FAILED")
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

    // MARK: - Touch Injection

    /// Perform a tap on the given view using multiple strategies.
    /// Returns true if the tap was successfully triggered.
    private func performTap(on view: UIView) -> Bool {
        // Strategy 1: UIControl.sendActions (native iOS buttons, switches, etc.)
        if let control = view as? UIControl {
            control.sendActions(for: .touchUpInside)
            return true
        }

        // Check ancestors for UIControl
        var current: UIView? = view.superview
        while let ancestor = current {
            if let control = ancestor as? UIControl {
                control.sendActions(for: .touchUpInside)
                return true
            }
            current = ancestor.superview
        }

        // Strategy 2: Send synthetic touch events via RCTSurfaceTouchHandler
        // React Native Fabric uses this gesture recognizer for all touch handling
        if self.sendSyntheticTouchEvent(on: view) {
            return true
        }

        // Strategy 3: accessibilityActivate as last resort
        // Walk up the view hierarchy to find the accessibility element
        var accessibleView: UIView? = view
        while let v = accessibleView {
            if v.isAccessibilityElement && v.accessibilityTraits.contains(.button) {
                if v.accessibilityActivate() {
                    return true
                }
            }
            accessibleView = v.superview
        }

        return false
    }

    /// Send a synthetic touch event through the RCTSurfaceTouchHandler gesture recognizer.
    /// React Native Fabric uses RCTSurfaceTouchHandler (a UIGestureRecognizer) to handle all touches.
    /// We need to trigger touches through the gesture recognizer, not the responder chain.
    private func sendSyntheticTouchEvent(on view: UIView) -> Bool {
        guard let window = view.window else {
            return false
        }

        // Calculate center point in window coordinates (like VoiceOver does)
        let centerInWindow = view.convert(
            CGPoint(x: view.bounds.midX, y: view.bounds.midY),
            to: window
        )

        // Find the RCTSurfaceTouchHandler gesture recognizer in the view hierarchy
        // It's typically attached to the RCTSurfaceView or RCTRootView
        var touchHandler: UIGestureRecognizer?
        var currentView: UIView? = view
        while let v = currentView {
            if let recognizers = v.gestureRecognizers {
                for recognizer in recognizers {
                    let className = String(describing: type(of: recognizer))
                    if className.contains("RCTSurfaceTouchHandler") || className.contains("RCTTouchHandler") {
                        touchHandler = recognizer
                        break
                    }
                }
            }
            if touchHandler != nil { break }
            currentView = v.superview
        }

        // If we found a touch handler, simulate touches on it directly
        if let handler = touchHandler {
            // Get the hit-tested view at the touch point
            guard let hitView = window.hitTest(centerInWindow, with: nil) else {
                return false
            }

            // Create synthetic touch and event
            let touch = SyntheticTouch(location: centerInWindow, window: window, view: hitView)

            // Directly call touchesBegan/touchesEnded on the gesture recognizer
            touch.updatePhase(.began)
            if let beganEvent = SyntheticTouchEvent(touch: touch) {
                handler.touchesBegan(Set([touch]), with: beganEvent)
            }

            // Small delay to simulate realistic tap
            usleep(50000) // 50ms

            touch.updatePhase(.ended)
            if let endedEvent = SyntheticTouchEvent(touch: touch) {
                handler.touchesEnded(Set([touch]), with: endedEvent)
            }

            return true
        }

        // Fallback: Try UIApplication.sendEvent (for non-Fabric views)
        guard let hitView = window.hitTest(centerInWindow, with: nil) else {
            return false
        }

        let touch = SyntheticTouch(location: centerInWindow, window: window, view: hitView)

        touch.updatePhase(.began)
        if let beganEvent = SyntheticTouchEvent(touch: touch) {
            UIApplication.shared.sendEvent(beganEvent)
        }

        usleep(50000)

        touch.updatePhase(.ended)
        if let endedEvent = SyntheticTouchEvent(touch: touch) {
            UIApplication.shared.sendEvent(endedEvent)
        }

        return true
    }
}

// MARK: - Synthetic Touch and Event Classes

/// Synthetic UITouch subclass for touch event injection.
/// Overrides key properties to provide valid touch data.
private class SyntheticTouch: UITouch {
    private var _location: CGPoint
    private var _previousLocation: CGPoint
    private var _window: UIWindow
    private var _view: UIView
    private var _phase: UITouch.Phase = .began
    private var _timestamp: TimeInterval
    private var _tapCount: Int = 1

    init(location: CGPoint, window: UIWindow, view: UIView) {
        self._location = location
        self._previousLocation = location
        self._window = window
        self._view = view
        self._timestamp = ProcessInfo.processInfo.systemUptime
        super.init()
    }

    func updatePhase(_ phase: UITouch.Phase) {
        _previousLocation = _location
        _phase = phase
        _timestamp = ProcessInfo.processInfo.systemUptime
    }

    override var phase: UITouch.Phase { _phase }
    override var timestamp: TimeInterval { _timestamp }
    override var window: UIWindow? { _window }
    override var view: UIView? { _view }
    override var tapCount: Int { _tapCount }
    override var type: UITouch.TouchType { .direct }
    override var force: CGFloat { 1.0 }
    override var maximumPossibleForce: CGFloat { 1.0 }
    override var majorRadius: CGFloat { 25.0 }
    override var majorRadiusTolerance: CGFloat { 5.0 }

    override func location(in view: UIView?) -> CGPoint {
        guard let targetView = view else {
            return _location
        }
        if targetView === _window {
            return _location
        }
        return _window.convert(_location, to: targetView)
    }

    override func previousLocation(in view: UIView?) -> CGPoint {
        guard let targetView = view else {
            return _previousLocation
        }
        if targetView === _window {
            return _previousLocation
        }
        return _window.convert(_previousLocation, to: targetView)
    }
}

/// Synthetic UIEvent subclass for touch event injection.
/// Uses private API _initWithEvent:touches: to create a valid UITouchesEvent.
private class SyntheticTouchEvent: UIEvent {
    private var _touches: Set<UITouch>
    private var _timestamp: TimeInterval

    init?(touch: SyntheticTouch) {
        self._touches = Set([touch])
        self._timestamp = touch.timestamp

        super.init()

        // Try to initialize as a UITouchesEvent using private API
        // This is required because UIEvent cannot be directly instantiated
        // with touch data through public APIs
        let selector = NSSelectorFromString("_setTimestamp:")
        if self.responds(to: selector) {
            self.perform(selector, with: _timestamp)
        }
    }

    override var type: UIEvent.EventType { .touches }
    override var subtype: UIEvent.EventSubtype { .none }
    override var timestamp: TimeInterval { _timestamp }

    override func touches(for window: UIWindow) -> Set<UITouch>? {
        return _touches
    }

    override func touches(for view: UIView) -> Set<UITouch>? {
        return _touches.filter { $0.view === view }
    }

    override func touches(for gestureRecognizer: UIGestureRecognizer) -> Set<UITouch>? {
        return _touches
    }

    override var allTouches: Set<UITouch>? {
        return _touches
    }
}

// Extension to add remaining module methods
extension RNDriverViewTreeModule {
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
