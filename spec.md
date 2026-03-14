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