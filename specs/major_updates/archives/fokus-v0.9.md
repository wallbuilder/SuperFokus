# SUPERFOKUS v0.9 UPDATE
Thoroghly read this update. Make sure you understand every last word before implementing it.

# Features

   ## Autoclose
   - Add an autoclose feature for Repeating Reminders. The text on the popup's close button should display a timer in parentheses. An example is: "Closes in (10)". When the mouse is hovering over the close button, it should change to "Close now", and the close button should turn a lighter color. When the autoclose timer reaches 0, the popup automatically closes.
       - If possible, make it so when the autclose timer reaches 1, the close button stops working.
       - The autoclose timer should be visible only on the button.
   - Autoclose should be adjustable in Repeating Reminders config.

   ## New Home Screen
   - There should be a new home screen that you see after you open the app (and the start screen animation finishes). Clicking the "SuperFokus" text on the header will also redirect you to the Home Screen.
       - There should be big purple buttons (one for each Fokus Mode) instead of a dropdown menu 
       - Each button will direct you to its respective Fokus Mode.
            - Repeating Reminders button icon: a "repeat" arrow (circle shaped)
            - Pomo Style Button icon: a white circle with a checkmark "cutout" (it's transparent)
            - Micro-Task Sprint Button icon: A simplistic "checklist" type of icon. Refer to the file 'fokus-v0.9_helper.JPG' for a visual example.
       - There should be a "Workflows" button with two smaller buttons underneath. (The Workflows Feature will be explained later)
    - Refer to the file 'fokus-v0.9_helper.JPG' for a visual diagram. Examinine it fully before proceeding.

    ## Flow State Stopwatch
    - The Fourth Fokus mode (shown as "Coming Soon") in the file 'fokus-v0.9_helper.JPG'
    - A count-up timer mode for when counting down creates anxiety. It just tracks how long you've been focused.
    - You start it, and it counts up. It could periodically chime (can be adjusted in config options) just to keep you grounded, but it doesn't force you to stop if you are in the "zone." It ends when you decide to stop it, logging the total time to your "Fokus Stats."
    - Icon: An upward trending arrow inside a clock.

  ## Workflows (IMPLEMENT THIS FEATURE LAST)
    - This feature works by having a Dyamic Workflow Building Station where you can select different Presets from different Fokus Modes and put them together in a modern "builder"-like type of interface with draggable AND editable "blocks" shown in a "stack". Each "block" conisists a few rounds of a specific preset from a specific Fokus Mode.
        - You can save the "structure" of your blocks as a preset.
    - "Blocks" display: Non-editable Preset information (parameters), Amount of rounds/cycles (editiable, excluding Repeating Reminders), Block Name (editiable), and total amount of time the block will take to finish (Non-editable, shown as just a stat on the bottom of the block display)

# Bugs
- Pause Button for Repeating Reminders and Pomo Style doesn't work.
- Stop Button for Micro-Task Sprint Mode doesn't work.
- A JavaScript error happens when trying to activate Site Blocker. Analyze the code to see if it is outdated and (replace it with code that works if it's ACTUALLY outdated).
The program cannot be opened multiple times in the same Termial tab.
- Pomo Timer does not permanantly stay on top of the screen.

## QOL
- Add a presets feature (like the Pomo Presets for Pomo Style) for Repeating Reminders. The preset wil save details about the number of rounds (infinite is not allowed as)
- Add a presets feature (like the Pomo Presets for Pomo Style) for Micro-Task Sprint. The preset will save details about the tasks and how long the sprint duration is.
- Add a custom sprint duation in the config for Micro-Task Sprint when you select "Custom" in the dropdown menu. A textbox will pop p which you can edit to the desired amount of minutes.
- Add a "Skip Task" button for Micro-Task Sprint.

# MAKE SURE ALL INSTANCES OF ANY VERSION NUMBER ("v0.8.2", "v0.8.4", etc.) ARE CHANGED TO "v0.9" IN ALL FILES.