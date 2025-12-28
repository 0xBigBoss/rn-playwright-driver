# Roadmap

Future improvements for rn-playwright-driver, organized by effort and impact.

## Quick Wins

### GitHub Actions CI Workflow
- [ ] Create `.github/workflows/ci.yml` for unit tests and linting
- [ ] Add self-hosted macOS runner for E2E tests with iOS Simulator
- [ ] Add Android emulator job for cross-platform coverage
- Reference: `docs/CI.md` has setup instructions

### Locator Assertions
Playwright-style expect matchers with auto-retry:
```typescript
await expect(locator).toBeVisible();
await expect(locator).toHaveText("Count: 5");
await expect(locator).toBeEnabled();
await expect(locator).toBeDisabled();
```
- [ ] Create `packages/driver/src/expect.ts` with matcher implementations
- [ ] Add polling/retry logic with configurable timeout
- [ ] Export from `@0xbigboss/rn-playwright-driver/test`

### Keyboard Input
- [ ] Implement `Locator.type(text)` for text input
- [ ] Add `Locator.clear()` to clear input fields
- [ ] Add `Locator.press(key)` for special keys (Enter, Tab, Backspace)
- [ ] Requires native keyboard simulation or focus + text injection

### Scroll Gestures
```typescript
await locator.scrollIntoView();
await device.pointer.swipe({ from: {x, y}, to: {x, y2}, duration: 300 });
```
- [ ] Add `scrollIntoView()` to Locator
- [ ] Add `swipe()` to pointer interface
- [ ] Add `fling()` for fast scrolls

## Medium Effort

### Locator Chaining
Find elements within other elements:
```typescript
await device.getByTestId("login-form").getByRole("button", { name: "Submit" }).tap();
await device.getByTestId("user-list").nth(2).getByText("Edit").tap();
```
- [ ] Add `Locator.getByTestId()`, `getByText()`, `getByRole()` for scoped queries
- [ ] Add `Locator.nth(index)` for selecting from multiple matches
- [ ] Add `Locator.first()` and `Locator.last()` helpers
- [ ] Update native modules to support scoped queries

### Network Interception
Mock API responses for deterministic tests:
```typescript
await device.route("**/api/users", (route) => route.fulfill({ json: mockUsers }));
await device.route("**/api/auth", (route) => route.abort());
```
- [ ] Research Metro/Hermes network hooks
- [ ] Implement route matching with glob patterns
- [ ] Support fulfill, abort, and continue actions

### Element Inspector CLI
Interactive mode for exploring the view tree:
```bash
bun run inspect  # Launch inspector
```
- [ ] Create `packages/driver/bin/inspect.ts` CLI
- [ ] Real-time view tree display with refresh
- [ ] Tap-to-select for generating locator code
- [ ] Filter by testID, text, role

### Visual Regression Testing
Screenshot comparison with diff detection:
```typescript
await expect(device.screenshot()).toMatchSnapshot("home-screen.png");
await expect(locator.screenshot()).toMatchSnapshot("button.png");
```
- [ ] Integrate with `jest-image-snapshot` or similar
- [ ] Add threshold configuration for acceptable differences
- [ ] Generate visual diff reports on failure

## Larger Initiatives

### Test Recorder
Record interactions and generate test code:
```bash
bun run record  # Start recording session
```
- [ ] Capture tap, type, and gesture events
- [ ] Generate Playwright-style test code
- [ ] Support editing and replaying recorded tests
- [ ] Similar to Playwright codegen

### Parallel Test Execution
Run tests across multiple devices simultaneously:
```typescript
// playwright.config.ts
export default {
  workers: 4,
  devices: ["iPhone 15", "iPhone SE", "Pixel 7", "Pixel 4a"]
};
```
- [ ] Implement device pool management
- [ ] Add worker-based test distribution
- [ ] Support sharding across CI jobs

### React Navigation Integration
First-class navigation support:
```typescript
await device.navigation.navigate("Settings");
await device.navigation.goBack();
await device.navigation.waitForRoute("Profile");
const currentRoute = await device.navigation.getCurrentRoute();
```
- [ ] Detect React Navigation in app
- [ ] Bridge navigation state to driver
- [ ] Add navigation-specific waiters

### State Inspection
Access app state for debugging and assertions:
```typescript
const reduxState = await device.getReduxState();
const asyncStorageValue = await device.getAsyncStorage("user-token");
const recoilAtom = await device.getRecoilState("userAtom");
```
- [ ] Add harness hooks for Redux, Recoil, Zustand
- [ ] Implement AsyncStorage bridge
- [ ] Support MMKV and other storage solutions

### Multi-Touch Gestures
Complex gesture support:
```typescript
await device.pointer.pinch({ center: {x, y}, scale: 0.5 });
await device.pointer.rotate({ center: {x, y}, angle: 90 });
await device.pointer.multiTap(3); // Triple tap
```
- [ ] Implement multi-touch event synthesis
- [ ] Add gesture recognizer compatibility
- [ ] Test with maps, image viewers, etc.

## Platform Expansion

### Expo Web Support
- [ ] Add web driver using Puppeteer/Playwright
- [ ] Share locator API across platforms
- [ ] Cross-platform test runner

### tvOS Support
- [ ] Add focus-based navigation
- [ ] Remote control simulation
- [ ] tvOS-specific gestures

## Contributing

Want to work on something? Open an issue to discuss the approach before starting.
Priority is generally: Quick Wins > Medium Effort > Larger Initiatives.
