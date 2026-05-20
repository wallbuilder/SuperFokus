# Major Update: Rust Core Integration (v1.0.0 \[Part 2\])  

## Objective
Transition SuperFokus from a pure Node.js/JavaScript application to a high-performance hybrid architecture by integrating Rust-based native modules. This will improve system-level efficiency, security, and the reliability of core features like the Site Blocker and Smart Pause.

## Section A. Architectural Strategy: The NAPI-RS Bridge
We will utilize `napi-rs` to build compiled Node-API addons. This allows Rust code to be loaded directly by Electron's Main process as a standard `.node` module, providing near-native execution speeds for OS-level operations.

### Key Goals:
- **CPU Efficiency:** Move heavy polling logic (like idle tracking) out of the JavaScript event loop.
- **Enhanced Security:** Perform sensitive operations (like `hosts` file modification) within a compiled, memory-safe binary.
- **Native OS Integration:** Leverage Rust's superior access to Windows APIs (`winapi` / `windows-rs`) and macOS APIs.

## Section B. Core Implementation Phases

------------------------------------------------------------------------------------------

### Phase 1: The "Watcher" Service (Idle Detection)
Currently, "Smart Pause" relies on JavaScript-based idle detection which can be inconsistent.
- **Task:** Implement a Rust crate that utilizes the `GetLastInputInfo` Windows API.
- **Behavior:** The service will emit an event to the Main process only when the idle state changes, minimizing CPU wake-ups.
- **File Impact:** Replaces parts of `HealthService.js`.

### Phase 2: The "Guardian" Service (Advanced Site Blocking)
Moving the Site Blocker to Rust will allow for more robust protection and potentially network-level filtering.
- **Task:** Rewrite the `hosts` file manipulation logic in Rust.
- **Feature:** Implement "Protected Mode" where the Rust binary monitors the `hosts` file and automatically reverts unauthorized manual changes by the user.
- **File Impact:** Replaces `BlockerService.js` and the `fokus-sb-helper.js` script.

### Phase 3: The "Super-Kernel" (Centralized High-Precision Timer)
While the current `TimerService.js` is good, a Rust-backed timer can ensure microsecond precision even during heavy system load.
- **Task:** Create a dedicated thread in Rust for global timing.
- **Benefit:** Eliminates any potential drift caused by the Node.js event loop lag.

## Section C. Modular Architecture & Directory Structure
We will use a **Rust Workspace** architecture for maximum modularity. All native code will reside within the project's source tree to ensure feature encapsulation.

```
src/
├── native/ (Rust Workspace Root)
│   ├── Cargo.toml (Workspace Manifest)
│   ├── guardian/  (Blocker & Security Crate)
│   │   ├── Cargo.toml
│   │   └── src/lib.rs
│   ├── watcher/   (Idle & System Polling Crate)
│   │   ├── Cargo.toml
│   │   └── src/lib.rs
│   ├── timer/     (High-Precision Timer Crate)
│   │   ├── Cargo.toml
│   │   └── src/lib.rs
│   └── bridge/    (NAPI-RS JS Entry Point)
│       ├── Cargo.toml
│       └── src/lib.rs
├── main/     (Electron Main Process)
└── renderer/ (Electron Renderer Process)
```

- **Compiler:** Rust stable (latest).
- **Binding:** `@napi-rs/cli`.
- **Root Directory:** `src/native/`

------------------------------------------------------------------------------------------

## Section D. Integration Requirements for Future Agents
Any specialized agent handling this update MUST:
1. Ensure the `package.json` includes the necessary build scripts for cross-compilation (Windows/Mac).
2. Maintain the existing IPC interface so the Renderer doesn't require a full rewrite.
3. Implement a graceful fallback to JavaScript logic if the compiled binary fails to load on a specific architecture.

## Section E. Security & Stability Mandates
- **Panic Protection:** All entry points in `bridge/` must use `std::panic::catch_unwind` or return a `Result` type. A crash in Rust must **never** take down the entire Electron process.
- **Input Sanitization:** All data received from the JavaScript bridge must be validated and sanitized before being passed to OS-level crates (`guardian`, `watcher`).
- **Resource Lifecycle:** Any background threads or system handles (file pointers, raw inputs) created in Rust must be properly dropped or closed when the feature is stopped to prevent memory and handle leaks.
- **Elevation Transparency:** Any action requiring Administrator/Root privileges must be clearly signaled to the Main process so it can request user consent via the standard OS prompt.
- **Incompatibility Fallback:** The application must remain functional (using existing JS logic) if the `.node` binary fails to load due to missing libraries or architecture mismatch.
- **Build Hardening:** All Rust modules must be built with `panic = 'abort'` in release mode to minimize binary size and ensure predictable behavior during critical failures.
- **Minimal Surface:** The JS-to-Rust API should be as small as possible. Expose only high-level commands, never raw memory or sensitive internal state.
---
**Status:** DRAFT / PENDING IMPLEMENTATION
**Target Version:** 1.0.0
