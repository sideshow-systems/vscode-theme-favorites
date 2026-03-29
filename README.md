# Theme Favorites for VS Code

Quickly manage and switch between your favorite VS Code themes. This extension allows you to mark installed themes as favorites and switch between them with a single click or command.

![Preview](images/banner.png)

## Features

- **Add/Remove Favorites**: Mark your preferred themes as favorites using the Command Palette
- **Quick Switch**: Switch between favorite themes instantly
- **Explorer View**: Visual sidebar showing all your favorite themes
- **One-Click Selection**: Click on any favorite theme in the explorer to activate it
- **Easy Management**: Remove themes from favorites when you no longer need them

## Getting Started

### Installation

1. Open VS Code
2. Go to Extensions (Ctrl+Shift+X / Cmd+Shift+X)
3. Search for "Theme Favorites"
4. Click Install

### Usage

1. **Add a Favorite Theme**:
   - Open Command Palette (Ctrl+Shift+P / Cmd+Shift+P)
   - Search for "Theme Favorites: Add Favorite"
   - Select a theme from the list to add it to favorites

2. **Switch Between Favorites**:
   - Open Command Palette and select "Theme Favorites: Choose Favorite"
   - Or click any theme in the "Theme Favorites" view in the Explorer sidebar

3. **Remove from Favorites**:
   - Right-click on a theme in the "Theme Favorites" view
   - Select "Theme Favorites: Remove Favorite"

4. **Toggle Theme**:
   - Use "Theme Favorites: Toggle Favorite" to quickly add/remove the current theme

## Commands

- `Theme Favorites: Add Favorite` - Add a theme to your favorites
- `Theme Favorites: Remove Favorite` - Remove a theme from favorites
- `Theme Favorites: Choose Favorite` - Select and switch to a favorite theme
- `Theme Favorites: Toggle Favorite` - Toggle the current theme as favorite
- `Theme Favorites: Open Theme` - Open theme settings
- `Theme Favorites: Refresh` - Refresh the favorites list

## Development

### Quick Start

- Install dependencies:
  ```bash
  npm install
  ```

- Compile TypeScript:
  ```bash
  npm run compile
  ```

- Start the extension in VS Code: Press `F5` (Run Extension debug configuration)

### Project Structure

- `package.json` — Extension metadata and command definitions
- `src/extension.ts` — Extension activation and command handlers
- `src/favoritesProvider.ts` — TreeView provider for favorites explorer
- `src/themesProvider.ts` — Theme management provider
- `src/favoritesWebviewProvider.ts` — Webview for favorites UI
- `src/themesWebviewProvider.ts` — Webview for themes UI

### Setup Instructions

1. **Local Testing**:
   ```bash
   # Create package
   npx vsce package
   # Install locally
   code --install-extension *.vsix
   # Or publish directly
   npx vsce publish --pat "$VSCE_PAT"
   ```

## Notes

- Verify `package.json` contains correct fields: `publisher`, `name`, `version`, and `engines.vscode`
