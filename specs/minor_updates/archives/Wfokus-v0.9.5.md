# SUPERFOKUS v0.9.5 UPDATE - {4/21/2026}

## Bugs
- No popup appears after finishing a round of Repeating Reminders.
- The timer doesn't continue after finishing a round.
    - It will possily be likely that the timer located on the Repeating Rminders popup close button will not display on the button.
    - (Close now (10) will not become Close now (9) and so on until it reaches 0)

## Loading Screen
This objective is simple. Turn the startup screen for SuperFokus into a "loading screen" which masks everyhing while the rest of the HTML and JavaScript loads in. There will be an alert sent afterwards everything is comfirned to be loaded in. The loading screen will then fade to the home screen, and it will not be called for again until the application is reopened.

# Technical & Other Requirements
- **Version Bump:** MUST change all instances of the old version number to "v0.9.6" across all files (e.g., UI headers, package.json, etc.).
- Test every part of the application to ensure that it's working as intended.