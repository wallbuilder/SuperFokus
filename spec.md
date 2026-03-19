# REMINDER: ALWAYS CHANGE THE VERSION NUMBER WITH EACH UPDATE


# v0.1

## What is Fokus?
Fokus is a tool that helps you focus through 3 different "Fokus Modes" of operation. Each mode has their own configuration page where certain settings can be changed to customize the mode for any situation.

- The 3 different modes:
    - "Repeating Reminders" mode
    - "Pomo Style" mode
    - "Site Blocker" mode

## Repeating Remiders
Repeating Reminders mode is the "original" mode of Fokus. It involves a popup that continously flashes on your screen after a set amount of minutes.

## Pomo Style
Pomo Style functions just like Repeating Reminders, but also has the option to do some more tings at the end of a round.

Pomo Style can either:
    - remind you to take a break
    - create a window that blocks your screen AND reminds you to take a break.

There can be 2 different types of breaks. A short break always has to last less than a long break. A long break can be set to an infinte amount of minutes (or whatever the textbox can handle). You can choose the pattern of breaks by changing 2 textboxes that describe how many of each break there will be.

## Site Blocker
Site Blocker is largely experimental as of version 0.1. The way users use Site Blocker is by first using a slider to decide whether to:
    - block only entered websites 
    - allow only entered websites

 Then, the users go on entering website URLs in one of the 2 lists.

The 2 lists are:
    - Domain list (blocks all webpages connected to an entered domain)
    - Specific URLs list (blocks specific URLs)

The 2 lists can be used to block certain websites entirely, and/or specific sections of other websites.

-------------------------------------------------------------------
# v0.2

## First Major Overhaul
The plan for this update is to make ONLY the "Repeating Reminders" and "Pomo Style" mode functional. This update also remasters the Fokus Interface (and rename the project to "SuperFokus".) Filenames and the name of the folder will stay the same, though.

(This update will be split into 3 sections. Section 1 will be completed first, section 2 wil be completed next, and section 3 will be completed last)

### Section 1
This section of the update focuses on making the "Repeating Reminders" section functional. The way this mode can be improved to be functional is to:

- Add a way that the program can check that all values have been filled out (edited to be a certain value) before the Start button is pressed. After the Start button has been pressed, the text boxes and toggle switches "lock" (the settings are displayed, but they cannot be edited)
- Add a way for the program to create additional popups.
- Implement a working timer system and "rounds remaining" counter (see note below). The timer starts when the Start button is pressed and is displayed right below the start button in small text. 

(Note: If infinite rounds have been selected before the mode starts, the counter will display the words "Infinite rounds remanining. Press Stop to exit this mode." when all other things in the section have been completed.)

- Make it so a new popup appears when the timer reaches zero (they can be closed by the user). The popup(s) will display a specific message. Make it so the user can choose the message displayed in the popup before they start the program. (By default it is set to "Hello! If any distractions are open, please close them and get back to work.")
- Make the Stop button functional (The config options will "unlock" again, the timer will stop, and popups will no longer display.)

### Section 2
This section of the update focuses on making the "Pomo Style" section functional. The way this mode can be improved to be functional is to:

- Apply what is said in the first and third bulletpoints of Section 1 to this section.
- Make it so when the start button is pressed, a new window appers titled "Pomo Style Timer". The window should be small (but not too small) and resizable. The window will feature a regular timer dispay with a progress bar underneath and will automatically close when the Pomo Style stop button is pressed.
- Add a way to create full screen popups.
- Use knowlege of operating full screen popups and regular popups to create the breaks system. The breaks system works by checking what type of popup the user wantd to be displayed, and then dispaying that type of popup along with the text that shows it's a long or short break and for how long the break is running (timer countdown).

### Section 3
This section of the Update will be tackled in two parts:
    - Part 1: Rename the Window, rewrite the dashboard text and start text to say "SuperFokus". Also update the version number (in the bottom left).
    - Part 2: Study the design ideology of Google's Gemini at [this link:](https://design.google/library/gemini-ai-visual-design) and "remaster" the newly named "SuperFokus" project to sort of "emulate" that style. The style shouldn't be blantantly copy-pasted directly, but the fonts and motion can be made to be MOSTLY, NOT FULLY accurate to how they are in the original Gemini. This isn't infinginging on any rights because Google, the owner of Gemini, hasn't patented the style that Gemini uses. (If you need a hint, while developing this section, the font in question should preferably be the "Roboto" font, amd the motion can be smooth sliding transitions. The colour gradients should be generated by AI if possible)

-------------------------------------------------------------------
# v0.3 - Improvements Update 1
 The theme for v0.3 should be Flexibility and Feedback. Here are all the new features you need to implement, described in all their respective sections:


### Section 1. Dynamic Pomo Configuration (Core Requirement)
* Custom Work Intervals: Add an input field for "Work Duration" so users aren't stuck with the hardcoded 25 minutes.
* Variable Break Scheduling: Instead of a single "Short Break" and "Long Break" duration, allow users to define a sequence (e.g., 25m Work -> 5m Break -> 30m Work -> 10m Break).
* Auto-Start Next Phase: A toggle to decide if the next phase (Work -> Break or Break -> Work) should start automatically or wait for a user click (in the config options).

### Section 2. Enhanced Site Blocker (Functional Implementation)
* Actual Blocking: Transition the Site Blocker from a "UI Preview" to a functional feature. Use Electron's webRequest API to intercept and block outgoing requests to domains in the blacklist/whitelist.
* Create a switch to activate Site Blocker (on or off). Site Blocker can also have a switch to continue running even if other Fokus Modes are active.
* 

### Section 3. New Side Menu
  This probably may be one of the most important features in the long run. It will look like 3 stacked vertical bars in the top left of the screen when closed. When opened, a small menu will slide into view smoothly with "Side Bar" as the text display. Below is a list of programs the user can select to view/change while the side bar is open. When any of these programs are selected, a dialog for that specific program will pop up INSIDE the program window and the rest of the screen around it will darken. The dialog will display things such as text, images, graphs, interactable sliders, etc. Any Fokus Modes active while these dialogs are open will continue to run and function normally in the background.

  Below is a list of dialogs the user can open and how they work:

    - Focus Stats: Track "Total Focus Time" and "Number of Completed Rounds" per session.
    - Visual Progress: A small chart or "Heatmap" showing which days/times the user was most active.
    - Session History: A simple log of previous sessions stored locally (for example, using electron-store).
    - Customization: A dialog with simple options for customization of the SuperFokus experience (such as described in section 4).

### Section 4. UI/UX Refinement
* Dark Mode Toggle: Since the current UI is light-themed (Gemini style), a dark mode would be a highly requested feature for late-night work. This can be integrated into the sidebar.
* Sound Notifications: There can be an option to play a subtle "chime" when a session or break ends. The chime sound can be changed in the Customization options (through the sidebar) and there can even be an option to integrate your own chime throgh uploads.
* Startup Intro Fix: The startup "SuperFokus" text will become bold instead of being normal. The text will also slide into place at the exact same time it is "materializing" into view, and a small line of text alinged with the bottom of the startup "SuperFokus" text will display the version number.

-------------------------------------------------------------------
# v0.3.5 - Improvements Update Rework {3/14/2026 - 3/15/2026}
Last update (v0.3) was great, but there are still some presing issues. All issues will be adressed below in sections 1 - 3.

### Section 1. Issues with Side Bar
- Sidebar icon behaves like a static image: The sidebar icon doesn't behave like an actual icon to me. Whenever I move my mouse over it, it doesn't appear to "react" in any way. (get smaller, have a dark circle expand out under it, etc.)
- Second icon: The sidebar uses a second icon to close the side bar instead of the same one you used to open it before. What I want is that the first icon is used to open AND close the sidebar. The icon looks like the 3 horizontal bars when closed, and an "X" when open. The icon should "shapeshift" into the other icon when clicked on.
- Sidebar not as interactive as I want it to be: I want the sidebar to feel more like a "selection" type of sidebar as outlined in the text directly below the heading of v0.3, section 3. (Make a comprehensive analysis of that section before implementing what is said in it)

### Section 2. Pomo Timer is simply not working as intended
- The small Pomo Timer popup opened when the program starts starts slowing down when I minimize the dashboard (or open another program on top of it) and eventually stops working altogether until I reopen the dashboard.
- Dynamic Pomo config should ask how many repeats of the selected configuration selected should happen, or whether it should go on infinitely.
- Pomo Timer popup should be bigger when opened so I can actually see the progress bar.
- Break reminder should also have a timer on it.
- When the breaks are finished (in fullscreen mode) they should have a "next" button instead of just remaining on the screen and forcing you to restart your computer. (if auto-start is enabled then this button should be hidden and the break screen should dissapear automatically)

### Section 3. Issues with the program's appearance
- When switching to dark mode, it doesn't feel nice because there's no transitional animation
- The text needs to be bolder in the intro, and the version number needs to appear beside it in smaller text.

-------------------------------------------------------------------
# v0.4 - Double Feature: The "About SuperFokus" + QOL Improvements Update (Core Requirement) {3/16/2026}
After a short break, we are now focusing on v0.4! This version focuses specifically on the side bar, where a new modal has been added called "About SuperFokus". This modal describes what SuperFokus is about and how all the features work. We are also adding many quality-of-life improvemnts. This will all be explained in the following sections.

### Section 1. About SuperFokus
- The "About SuperFokus" option should be created in the sidebar. It opens a SCROLLABLE modal which includes a description of SuperFokus and how it works.
- There should be at least 5 or 6 paragraphs, one for every feature + the introduction paragraph (intro > repeating reminders > pomo style > site blocker > sidebar features > conclusion).

### Section 2. Quality-of-life Improvements
- "Chime Test" option should be available in customizability options. It plays the currently selected chime when clicked.
- v0.3 added sound notifications and this update is adding a "Chime Test" option. A Volume Slider in the Customization dialog is a natural next step so the chime isn't too loud or too quiet.
- "Pomo Presets" should be able in the config options for Pomo Style. Instead of manually typing in the sequence of Work/Break intervals every time, you can allow users to save their current configuration as a preset (e.g., "Deep Work - 50/10", "Quick Study - 25/5") and load it from a dropdown.
- A pause button in Repeating Reminders or Pomo Style should be added as quick way to pause an active timer for unexpected interruptions (phone calls, bathroom breaks, emergenices, etc.) without resetting the entire session or ending the round early.

-------------------------------------------------------------------
# v0.4.1 {3/16/2026}
This update fixes many of the problems had with v0.4. The things I have probelms with are the chimes section of the Customizability options, the "Pomo Style" timer, and the Pomo Presets. All the issues will be covered in the below sections. (Also, update the version number to 0.4.1)


### Section 1
These are all the problems with the chimes section of the customizability options.

- There are no actual sounds for the chimes.
- You can't actually upload your own sound as a chime.
- The chimes section buttons are inconsistent compared to the dark mode toggle.


### Section 2
These are all the problems with the Pomo Style Timer.

- The timer still continues running after the SuperFokus dashboard is closed.
- When Dark Mode is on, the Pomo Timer still displays a Light Mode display because it has no display for Dark Mode. (Ensure that when this issue is resolved, the pomo timer popup will change along with the dashboard any time while it is running {so if you change the theme midway while the timer popup is running, the timer also updates too}.)
- When the Break Mode screen blocker (when "Block screen AND remind" is enabled in the Pomo Style config) is finished and it closes, the timer stays behind any other open appications instead of moving to the front.

### Section 3
The only problem with the Pomo Presets is that you can't create your own presets! What's the point of this feature existing then?

Please solve these problems as soon as possible!

-------------------------------------------------------------------
# v0.5 - The "Seconds" update {3/18/2026}
This update deals with implenting seconds into the Fokus Modes (For people who have a hard time focusing, this update will help a lot) and also fixes problems with timer drift. These features are acknowleged in the below sections. (Also, update the version number to 0.5)

### Section 1
- The way to allow support for seconds in Repeating Reminders is to decrease the width of the Reminder Interval box by half and make another box that says "Reminder Interval (seconds):", then making it functional. After all that has been described in this section has been fulfilled, update the "About SuperFokus" modal in the sidebar to reflect these changes.

- For Pomo Style, the "mins" text next to the X button becomes a dropdown with "secs" as an option.
    - Also, if 2 of the same type of phase are on top of each other, when Pomo Style starts the 2 phases' times "add up" (so minute and second combinations are possible).
    - If "secs" is selected and the number inside the box is 60 or higher, it should be changed to be 59.
- Also, the Repeat Configuration box in the config for Pomo Style is inconistent with the other number boxes (no "e.g. 4", does not dissapear when Infinte Rounds is selected).
    - "Repeats" should really be called "Cycles" instead.
- Finally, the Pomo Presets don't save, and there's no way to delete them.
    - The presets that were not created by the user (Custom, Deep Work, Quick Study) should not be able to be deleted.


### Section 2
This section deals with the timer drift. The timer's current State is that in main.js, the timers use `setInterval(() => { timers[id].seconds--; }, 1000)`. The issue with this is that the "setInterval" command is not guaranteed to execute exactly every 1000ms. Over a 50-minute "Deep Work" session, process scheduling and blocking operations can cause the timer to drift by several seconds.

To optimze this, we need to switch to a timestamp-based approach. When the timer starts, calculate the expected end time ('const endTime = Date.now() + durationMs'). On each interval tick, calculate the remaining seconds using Math.round((endTime - Date.now()) / 1000). This guarantees that the timer remains perfectly synced with the system clock, regardless of any execution delays.


-------------------------------------------------------------------
# v0.6 {3/18/2026}
This update focuses on updating the Site Blocker to be actually functional, since using Electron's webrequest API doesn't actually help the Site Blocker work as intended. Other things the update focuses on will be revealed later. (Also, update the version number to 0.6)

### Section 1. Hybrid Site Blocker Implementation
To achieve system-wide site blocking without completely rewriting SuperFokus as a native Windows app, we will use a "Hybrid" approach. This involves keeping the UI in Electron and using a separate, elevated script to modify the system's `hosts` file.

  **Step 1: Create a Blocker Helper Script**
  Create a separate, standalone Node.js script (e.g., `fokus-sb-helper.js`). This script's only job will be to read a list of domains and append them to the Windows `hosts` file (`C:\Windows\System32\drivers\etc\hosts`), routing them to `127.0.0.1`. It must also have a dedicated function to cleanly remove these specific entries.

  **Step 2: Implement Administrator Elevation**
  Editing the `hosts` file requires Administrator privileges, which the main Electron app shouldn't run with constantly. Use a Node.js package like `sudo-prompt` inside `main.js`. When the user toggles the Site Blocker ON, use `sudo-prompt` to execute your `blocker-helper.js` script. This will natively trigger the Windows UAC (User Account Control) prompt asking the user for permission.

  **Step 3: IPC Integration & State Management**
  Update the `ipcMain` listeners in `main.js`. When the renderer process sends the signal to start the site blocker with the list of domains, `main.js` will package these domains (e.g., as a temporary JSON file or command-line arguments) and pass them to the elevated helper script.

  **Step 4: Failsafe and Cleanup (Crucial)**
  You must ensure the user's internet isn't permanently restricted if the app crashes or is closed abruptly. 
  - Add a listener for the app quitting (`app.on('will-quit')`) to run the helper script one last time to remove all SuperFokus entries from the `hosts` file.
  - Add a "Clear All Blocks" failsafe button in the SuperFokus Customization settings to manually trigger the cleanup.

  **Step 5: UI/UX Updates**
  Update the Site Blocker UI to clearly inform the user: "System-wide blocking requires Administrator privileges. You will see a prompt asking for the administrator's permission when activating this feature."

### Section 2. ???
There's nothing in here for now.

### Section 3. ???
There's nothing in here for now.

-------------------------------------------------------------------
# v0.7 {3/19/2026}
This update focuses on (???). (Also, update the version number to 0.7.)


### Section 1. ???
There's nothing in here for now.