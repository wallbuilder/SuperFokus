# SuperFokus

SuperFokus is a high-performance, Electron-based productivity suite designed to help you master your attention, regulate computer usage,
and maintain healthy digital habits. By combining structured focus intervals, system-wide distraction blocking, and health-centric
reminders, SuperFokus provides a comprehensive environment for deep work and mindful computing.

 ## Overview
 
 ### Core Fokus Modes

  SuperFokus offers five distinct modes to accommodate various workflows and cognitive needs:

  1. Multi-Mode Workflows (The Engine)
  The ultimate productivity architect. Build complex, automated sessions by stacking different Fokus modes.
   - Drag-and-Drop Builder: Intuitively sequence Pomo phases, Sprints, and Repeating Reminders.
   - Automated Transitions: SuperFokus handles the hand-off between different modes seamlessly.
   - Cycle Management: Run your entire custom workflow once or loop it indefinitely.

  2. Pomo Style (Structured Rhythm)
  A refined implementation of the Pomodoro Technique for balanced work and recovery.
   - Dynamic Sequences: Configure custom strings of Work and Break phases.
   - Enforcement Levels: Choose between gentle notifications or strict, full-screen "Focus Overlays" to ensure you take your breaks.
   - Preset Library: Load optimized configurations like "Deep Work (50/10)" or "Quick Study (25/5)" instantly.

  3. Flow State Stopwatch (Open-Ended)
  Designed for when you're "in the zone" and don't want a countdown to interrupt your momentum.
   - Mindful Chimes: Set recurring ambient pings (e.g., every 15 minutes) to maintain time awareness without breaking focus.
   - Visual Persistence: Includes a dedicated, always-on-top timer window to keep your progress visible.

  4. Micro-Task Sprints (Velocity)
  Ideal for tackling procrastination or clearing a high volume of small tasks.
   - Rapid Intervals: Assign set times (5, 10, or 15 minutes) to specific tasks.
   - Task Stacking: Enter a list of tasks and sprint through them with optional auto-start.

  5. Repeating Reminders (Classic)
  The foundational mode for building consistency.
   - Precise Intervals: Set loops down to the second.
   - Custom Persistence: Configure autoclose timers for popup reminders to ensure they don't linger.

  ---

 ### Sidebar Tools & Features

   - 📊 Fokus Stats: Integrated analytics dashboard with a 7-day activity heatmap and total focus time tracking.
   - 🔒 System-Wide Site Blocker:
       - Dual Logic: Supports both Blacklist (block specific sites) and Whitelist (allow only specific sites) modes.
       - Kernel-Level Feel: Modifies the system hosts file for robust, browser-agnostic blocking.
       - Note: Requires Administrator privileges for system modification.
   - ❤️ Health Mode ("The Body Guard"):
       - 20-20-20 Eye Saver: Automated reminders to rest your eyes every 20 minutes.
       - Posture Alignment: Periodic prompts to stretch and correct your seating position.
   - ⚙️ Deep Customization:
       - Theme Engine: Switch between Light, Dark, and Custom themes with smooth CSS variable transitions.
       - Acoustic Environments: Select between "Classic", "Nature (Zen)", and "Mechanical" sound packs, or upload your own notification
         and ambient sounds.

  ---

 ### Technical Architecture

  SuperFokus is built with a focus on precision and system integrity:
   - Engine: Built with Electron.js and Vanilla JavaScript/CSS for maximum performance and a lightweight footprint.
   - Timer Precision: Utilizes a timestamp-based calculation system rather than standard setInterval to prevent drift during long sessions
     or system sleep.
   - Secure Escalation: Uses an elevated helper script via @vscode/sudo-prompt to safely modify system files only when necessary.
   - Persistence: Local configuration and session history are managed via electron-store for reliable data retention.

 ### Installation

   1. Download the latest SuperFokus release for your operating system (**.exe** for Windows, **.dmg** for macOS) from the Releases (https://github.com/wallbuilder/SuperFokus/releases) page.
   2. Run the installer 
    - If the installer doesn't work, (_it shows that the app isn't verified on the Microsoft/Apple app store or anything similar_) open the app through your terminal, (search "how to open files using terminal on (OS name)" if you don't know how) and follow the prompts. **(WE DO NOT HAVE A CERTIFICATE FROM MICROSOFT OR APPLE)**
   3. (Optional) Run as Administrator if you intend to use the Site Blocker feature.

 ## Development Setup (FOR NEW CONTRIBUTORS ONLY)

  To contribute or build from source:

    1. Clone the repository through your terminal (use the `cd` command to switch to a designated folder first) 
    `git clone https://github.com/wallbuilder/SuperFokus.git`
    
    2. Install dependencies
    `npm install`
    
    3. Run the application in development mode
    `npm start`
    
    (Note: To build the Windows installer, use the command: `npm run dist`)



  ---

 ## Credits
  
  ### Contributors
   - **wallbuilder**: Founder / Lead Coder / Project Creator
   - **A1A2J2**: Co-founder / Secondary Coder / Lead Asset Creator
   - **cat2d430**: Tester

  ### AI Systems
   SuperFokus was developed with significant implementation, architectural, and technical assistance from:
   - **Gemini Models** (by Google): Gemini 3.1 Pro Preview, Gemini 3 Flash, Gemini 2.5 Pro/Flash/Lite.
   - **Claude Models** (by Anthropic): Claude Haiku 4.5, Claude Sonnet 4.6.
   - **GitHub Copilot / Other Models**: ChatGPT-4.1, GPT 5 Mini, Qwen 3 Coder 8B, Qwen 3 32B, Raptor Mini, Mai Code 1 Flash.