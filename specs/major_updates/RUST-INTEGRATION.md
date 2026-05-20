# Major Update: Rust Core Integration (v1.1.0)

## Objective
Transition SuperFokus from a pure Node.js/JavaScript application to a high-performance hybrid architecture by integrating Rust-based native modules. This will improve system-level efficiency, security, and the reliability of core features like the Site Blocker and Smart Pause.

## 1. Architectural Strategy: The NAPI-RS Bridge
We will utilize `napi-rs` to build compiled Node-API addons. This allows Rust code to be loaded directly by Electron's Main process as a standard `.node` module, providing near-native execution speeds for OS-level operations.

### Key Goals:
- **CPU Efficiency:** Move heavy polling logic (like idle tracking) out of the JavaScript event loop.
- **Enhanced Security:** Perform sensitive operations (like `hosts` file modification) within a compiled, memory-safe binary.
- **Native OS Integration:** Leverage Rust's superior access to Windows APIs (`winapi` / `windows-rs`) and macOS APIs.

## 2. Core Implementation Phases

### Phase A: The "Watcher" Service (Idle Detection)
Currently, "Smart Pause" relies on JavaScript-based idle detection which can be inconsistent.
- **Task:** Implement a Rust crate that utilizes the `GetLastInputInfo` Windows API.
- **Behavior:** The service will emit an event to the Main process only when the idle state changes, minimizing CPU wake-ups.
- **File Impact:** Replaces parts of `HealthService.js`.

### Phase B: The "Guardian" Service (Advanced Site Blocking)
Moving the Site Blocker to Rust will allow for more robust protection and potentially network-level filtering.
- **Task:** Rewrite the `hosts` file manipulation logic in Rust.
- **Feature:** Implement "Protected Mode" where the Rust binary monitors the `hosts` file and automatically reverts unauthorized manual changes by the user.
- **File Impact:** Replaces `BlockerService.js` and the `fokus-sb-helper.js` script.

### Phase C: The "Super-Kernel" (Centralized High-Precision Timer)
While the current `TimerService.js` is good, a Rust-backed timer can ensure microsecond precision even during heavy system load.
- **Task:** Create a dedicated thread in Rust for global timing.
- **Benefit:** Eliminates any potential drift caused by the Node.js event loop lag.

## 3. Toolchain & Setup
- **Compiler:** Rust stable (latest).
- **Binding:** `@napi-rs/cli`.
- **Directory Structure:**
  - `/src-rust/`: The root for all Rust crates.
  - `/src-rust/guardian/`: Blocker logic.
  - `/src-rust/watcher/`: System polling.

## 4. Integration Requirements for Future Agents
Any specialized agent handling this update MUST:
1. Ensure the `package.json` includes the necessary build scripts for cross-compilation (Windows/Mac).
2. Maintain the existing IPC interface so the Renderer doesn't require a full rewrite.
3. Implement a graceful fallback to JavaScript logic if the compiled binary fails to load on a specific architecture.

## 5. Security Mandates
- All Rust modules must be built with `panic = 'abort'` in release mode to prevent memory leaks in the Electron process.
- Direct pointer manipulation must be minimized in favor of the safe `napi` wrappers.
- The `Guardian` service must require a one-time elevation to install its monitoring hook.

---
**Status:** DRAFT / PENDING IMPLEMENTATION
**Target Version:** 1.1.0 Alpha
