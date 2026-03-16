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

# v0.3.5 - Improvements Update Rework
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

