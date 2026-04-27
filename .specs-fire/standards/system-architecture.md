# System Architecture

## Overview

VS Code extension that provides a sidebar panel and quick-pick UI for saving, organizing, and switching between favorite color themes. The extension runs inside the VS Code extension host process.

## System Context

The extension integrates directly into the VS Code shell via the Extension API. It has no external network dependencies — all state is persisted in VS Code's built-in settings storage.

### Context Diagram

```
┌─────────────────────────────────────┐
│              VS Code                 │
│                                     │
│  ┌──────────────────────────────┐   │
│  │   vscode-theme-favorites     │   │
│  │  (Extension Host Process)    │   │
│  │                              │   │
│  │  Commands ──► Favorites UI   │   │
│  │  TreeViews ──► Sidebar       │   │
│  │  Webviews ──► Panel          │   │
│  └──────────┬───────────────────┘   │
│             │                       │
│  ┌──────────▼───────────────────┐   │
│  │   VS Code Settings Storage   │   │
│  │  (themeFavorites.favorites)  │   │
│  └──────────────────────────────┘   │
└─────────────────────────────────────┘
```

### Users

- **VS Code Users**: Developers who frequently switch between multiple color themes and want quick access to a curated shortlist.

### External Systems

- **VS Code Marketplace**: Distribution channel for publishing the extension via `vsce`.

## Architecture Pattern

**Pattern**: Event-driven provider model (VS Code extension architecture)
**Rationale**: Dictated by the VS Code Extension API — extensions expose providers and command handlers; VS Code drives all lifecycle events.

## Component Architecture

### Components

#### extension.ts
- **Purpose**: Activation entry point
- **Responsibilities**: Register commands, instantiate and register providers
- **Dependencies**: All providers

#### FavoritesProvider
- **Purpose**: TreeView data provider for the favorites sidebar
- **Responsibilities**: Read favorites from settings, render as tree items, handle add/remove/reorder
- **Dependencies**: VS Code TreeView API, `favoritesUtils.ts`

#### FavoritesWebviewProvider
- **Purpose**: Webview-based panel for advanced favorites management
- **Responsibilities**: Render interactive HTML UI, communicate with extension host via message passing
- **Dependencies**: VS Code Webview API, `favoritesUtils.ts`

#### ThemesProvider
- **Purpose**: TreeView data provider listing all installed themes
- **Responsibilities**: Enumerate installed color themes, group by type/source
- **Dependencies**: VS Code extension API (reading installed extensions)

#### ThemesWebviewProvider
- **Purpose**: Webview panel for browsing all themes
- **Responsibilities**: Render theme list with previews, support filtering
- **Dependencies**: VS Code Webview API, `ThemesProvider`

#### favoritesUtils.ts
- **Purpose**: Pure utility functions for favorites management
- **Responsibilities**: CRUD operations on the favorites array in VS Code settings
- **Dependencies**: VS Code Configuration API

### Component Diagram

```
extension.ts
├── registers → FavoritesProvider (TreeView)
├── registers → FavoritesWebviewProvider (Webview Panel)
├── registers → ThemesProvider (TreeView)
├── registers → ThemesWebviewProvider (Webview Panel)
└── registers → Commands (addFavorite, removeFavorite, chooseFavorite, etc.)
                    │
                    ▼
              favoritesUtils.ts
                    │
                    ▼
          VS Code Settings API
```

## Data Flow

User interactions (clicking a theme, using commands) flow from VS Code UI → command handlers → utility functions → VS Code settings storage → providers refresh → UI update.

```
User Action
    │
    ▼
Command Handler (extension.ts)
    │
    ▼
favoritesUtils.ts (read/write settings)
    │
    ▼
vscode.workspace.getConfiguration('themeFavorites')
    │
    ▼
FavoritesProvider.refresh() → TreeView updates
```

## Technology Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| Language | TypeScript 4.9 | Type-safe extension logic |
| Extension API | VS Code API ^1.60 | Commands, views, settings |
| UI (sidebar) | VS Code TreeView | Favorites and themes list |
| UI (panel) | VS Code Webview | Advanced management UI |
| Persistence | VS Code Settings | Store favorites array |
| Build | tsc | Compile to CommonJS |
| Distribution | vsce | Package and publish |

## Non-Functional Requirements

### Performance

- **Activation time**: Extension should activate in < 100ms
- **Theme switch**: Applying a favorite theme should feel instant (< 50ms)

### Security

- No external network requests
- No secrets or tokens handled
- Webview content uses VS Code's CSP recommendations

### Scalability

Single-user, single-machine extension — no scalability concerns. Performance degrades gracefully with large numbers of installed themes (> 100).

## Constraints

- Must run inside VS Code's extension host (CommonJS module, no ESM)
- VS Code API is the only runtime dependency
- Extension must support VS Code >= 1.60.0
- No external npm runtime dependencies (keeps extension lightweight)

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Storage | VS Code settings | Native, syncs across devices via Settings Sync |
| UI approach | TreeView + Webview | TreeView for quick access; Webview for richer management |
| Build target | ES2020 / CommonJS | Required by VS Code extension host |
| No runtime deps | Zero production deps | Keeps extension size minimal, no supply-chain risk |

---
*Generated by specs.md - fabriqa.ai FIRE Flow*
