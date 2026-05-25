# Site Blocker Mode Guidelines

## Overview
The Site Blocker is a powerful system-wide utility that prevents access to distracting websites by modifying the OS `hosts` file. It ensures that focus is maintained by removing the possibility of digital "rabbit holes" during work sessions.

## Core Functionality
1. **Rule Management:**
   - The user can add domains to a "Block List" (e.g., `facebook.com`, `youtube.com`).
   - The system should automatically normalize these domains (removing `http://`, `https://`, and `www.`) to ensure broad matching.
   - Domains can be removed from the list individually.

2. **System-Wide Blocking:**
   - When activated, the application must map the blocked domains to `127.0.0.1` (localhost) within the system's `hosts` file.
   - This requires **elevated privileges** (Administrator on Windows, Root on macOS).
   - The application must use a helper service (e.g., `@vscode/sudo-prompt`) to perform these modifications safely.

3. **Status Feedback:**
   - The main dashboard must clearly indicate whether the Site Blocker is currently "Active" or "Inactive".
   - If an error occurs during activation (e.g., the user denied the permission prompt), the application must show a clear error message explaining the failure.

4. **Safety Mechanisms:**
   - The application must **automatically clear all blocks** when it quits or crashes.
   - A backup of the original `hosts` file should be maintained to ensure the system can be restored to its previous state in case of a critical failure.

## Implementation Details
- **Helper Script:** Use a dedicated helper script (e.g., `fokus-sb-helper.js`) that runs with elevated privileges to minimize the amount of code running as root.
- **IPC Safety:** All requests to modify the `hosts` file must be validated using `isOriginSafe` to prevent malicious third-party scripts from triggering the blocker.
- **Port Matching:** The blocker should also run a local "Block Page" server on a specific port, so that when a user visits a blocked site, they see a "SuperFokus: Stay Focused!" message instead of a generic browser error.

## User Experience (UX) Standards
- The activation process should be transparent, providing a progress indicator while the `hosts` file is being modified.
- The "Block List" should be easy to manage, with a clean UI for adding and removing domains.
- Warnings should be shown if the user attempts to block essential system domains (e.g., `google.com` if needed for work).

## Edge Case Handling
- **Missing Hosts File:** If the `hosts` file cannot be found, the blocker should fail gracefully and report the error.
- **Simultaneous Access:** If another program is modifying the `hosts` file at the same time, the Site Blocker must implement a retry mechanism or alert the user to the conflict.
- **Network Restart:** On some systems, a network restart or DNS flush might be required for the changes to take effect; the application should handle this automatically if possible.

## Future Enhancements
- Support for "Timed Blocks" that automatically expire.
- Integration with Fokus Modes (e.g., "Block these sites only during Pomo Work phases").
- Categories of blocks (e.g., "Social Media", "News", "Gaming") to allow for quick setup.
- "White List" mode where *everything* is blocked except for a few specific sites.
