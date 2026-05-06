# SUPERFOKUS v1.0.0-beta UPDATE - for WINDOWS {4/28/2025}

# Features
    
   ## Sub-Presets for Workflows
   - When a new preset is created for either Pomo Style or Repeating Reminders, it gets 2 different variations:
       - The Standard variant: Saves all preset info, INCLUDING the repeat/cycle configuration
       - The Workflows variant: Saves all preset info, EXCLUDING the repeat/cycle configuration (so you can edit it in the Workflows page)

   ## New Customizability Options
   - Overhaul the Customizability options to have a tab-like format. There will be 4 tabs, and you can switch between them by clicking tab buttons on the top of the modal (details about this will be shown in the image file `customizationexample.PNG`). Here are each of the tabs and a description of what they will be for.
       - Themes: Choose which theme you want to use (Standard or Premium themes, premium themes will be implemented later {`customizationexample.PNG`} possibly in version 1.1.0), or create your own custom theme (limited functionality)
       - Sounds: Change how audio works (Chime options get "copy-pasted" into here)
       - Integration: Accessibility options, cloud settings, etc. (LEAVE THIS TAB'S MENU BLANK FOR NOW)
       - Advanced: Advanced settings for changing the entire SuperFokus experience (Just add the GitHub browser toggle to this tab's menu for now. It's explained in the QOL section, more tings to add will be specified later)

# QOL
- Repeating Reminders and Micro-Task Sprint preset configuations need to be more similar to how Pomo Style's preset conifgration works to offer a more "unified" experience. (analyze the files related to Pomo Style)
- Icon for Micro-Task sprint should be changed to this: "🗎"
- Make it so that the GitHub page ALWAYS opens in the browser (unless toggled off by the user in Advanced settings)


# Technical & Other Requirements
- **Version Bump:** MUST change all instances of the old version number to "v1.0.0-beta-w" across all files (e.g., UI headers, package.json, etc.).
- Put an account of all your changes into the file "UPADATE_DOCUMENTATION.txt"