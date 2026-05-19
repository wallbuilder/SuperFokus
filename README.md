# SuperFokus

SuperFokus is a versatile, Electron-based productivity application designed to help you regulate computer time, maintain healthy habits, and minimize digital distractions.

## Core Features (Fokus Modes)

SuperFokus offers three primary Fokus Modes to suit your workflow:

### 1. Repeating Reminders
The classic mode. Sets up a continuous loop of reminders to keep you on track.
- **Custom Intervals:** Set precise reminder intervals using minutes and seconds.
- **Rounds Control:** Choose a specific number of reminder rounds or let it run infinitely.
- **Custom Messages:** Personalize the popup message that appears when the timer goes off.
- **Quick Pause:** Easily pause the active timer for unexpected interruptions without resetting your session.

### 2. Pomo Style
A structured time-management mode that balances work sessions with scheduled breaks, inspired by the Pomodoro Technique.
- **Dynamic Pomo Config:** Create completely custom sequences of Work and Break phases.
- **Break Actions:** Choose between a gentle reminder or a strict screen-blocking popup to enforce downtime.
- **Pomo Presets:** Save your favorite phase configurations (e.g., "Deep Work - 50/10") or use built-in presets and load them instantly.
- **Auto-Start:** Optionally toggle auto-start for the next phase to keep your hands off the timer.
- **Quick Pause:** Pause your work session or break at any time.

### 3. Micro-Task Sprint Mode
Designed to break down larger tasks into rapid, high-speed intervals.
- **Rapid Tasks:** Allocate a set amount of time to each task. (5 min., 10 min., 15 min., or a custom amount)
- **Visual Velocity:** Dedicated countdown timer for specific tasks to maintain momentum.

### 4. Flow State (Stopwatch)
A simple, open-ended focus mode that tracks your time as you work.
- **Stopwatch:** Tracks elapsed time from the moment you start.
- **Interval Chimes:** Set a recurring chime to ring every few minutes or seconds to help you stay present and mindful of time passing.
- **Visual Display:** Includes a dedicated timer window to keep your progress visible.

### 5. Multi-Mode Workflows
The ultimate productivity builder. Combine different Fokus modes into a custom sequence.
- **Drag-and-Drop Builder:** Easily stack Pomo Style, Micro-Task Sprints, Repeating Reminders, and custom Break blocks.
- **Automated Transitions:** SuperFokus automatically moves to the next block in your workflow, allowing for complex, pre-planned sessions.
- **Flexible Cycles:** Run your entire workflow once or loop it multiple times.

## Sidebar Features & Tools

The SuperFokus sidebar provides quick access to powerful tools and analytics without interrupting your active timers:

- 📊 **Fokus Stats:** View your "Total Focus Time" and "Completed Rounds", alongside a visual chart of your activity over the last 7 days.
- 📜 **Session History:** Check a local log of your past productivity sessions.
- 🔒 **Site Blocker:**
    - Block digital distractions system-wide.
    - Choose to either *block* a blacklist of domains/URLs or *allow* only a whitelist.
    - Can run independently in the background even if other Fokus modes are active.
    - *Note: Requires Administrator privileges as it safely modifies the system hosts file.*
- ❤️ **Health Mode (The "Body Guard"):**
    - **Eye Saver:** Enforces the 20-20-20 rule (every 20 minutes, look 20 feet away for 20 seconds).
    - **Posture Check:** Reminds you to stretch and adjust your posture every 45 minutes.
- ⚙️ **Customization:**
    - **Dark Mode:** Toggle a sleek dark theme for late-night work (with smooth transitions).
    - **Audio Notifications:** Select from built-in chimes or upload your own custom sound. Test the chime and adjust the volume.

## Usage Examples

### Example 1: The "Deep Work" Session
1. Open **SuperFokus** and select **Pomo Style** from the Dashboard dropdown.
2. Under **Pomo Presets**, select "Deep Work - 50/10" (or create your own sequence using the Dynamic Pomo Builder interface).
3. Set **Action at end of phase** to "Block screen AND remind" so you are forced to step away from your monitor during breaks.
4. Select your desired number of **Cycles** (it will default to 4 cycles if you don't enter a number) and click **Start**.

### Example 2: Blocking Distractions While Studying
1. Open the sidebar (☰) and select **Site Blocker**.
2. Toggle the Site Blocker switch to **Active** (granting administrator permissions when prompted).
3. Set Blocker Mode to **Block only entered websites**.
4. In the **Domain List**, enter `youtube.com`, `reddit.com`, and `x.com`.
5. Click **Save & Apply Blocker**. You can now study distraction-free, optionally running a **Repeating Reminder** timer in the background.

### Example 3: Health-Conscious Coding
1. Open the sidebar (☰) and select **Health Mode**.
2. Enable both **Eye Saver (20-20-20 Rule)** and **Posture Check**.
3. Click **Start Health Mode**.
4. SuperFokus will run quietly in the background, pinging you every 20 minutes to rest your eyes and every 45 minutes to fix your posture.

## TECHNICAL DETAILS
- Built with Electron.js.
- Site Blocker utilizes a separate elevated helper script to modify the Windows `hosts` file (or any other system's `hosts` file) for true system-wide blocking.
- Timer precision is maintained using a timestamp-based calculation approach rather than simple `setInterval` ticks to prevent timer drift over long sessions.
