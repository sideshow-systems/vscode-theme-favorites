---
run: run-vscode-theme-favorites-001
intent: favoriten-reihenfolge-sortierbar
scope: wide
work_items_completed: 2
generated: "2026-04-27T20:29:14.221Z"
---

# Walkthrough: Favoriten per Drag & Drop sortierbar

## Übersicht

Zwei Work Items wurden in einem Wide-Run ausgeführt:

1. **preserve-insertion-order** (autopilot) — Alphabetische Sortierung entfernt
2. **implement-drag-and-drop** (confirm) — HTML5 DnD in der Webview implementiert

## Geänderte Dateien

| Datei | Änderungen |
|-------|-----------|
| `src/favoritesProvider.ts` | `.sort((a, b) => a.label.localeCompare(b.label))` entfernt |
| `src/favoritesWebviewProvider.ts` | `_sendInit()` Reihenfolge-Fix, `reorderFavorites`-Handler, DnD CSS/JS |

## Architektur-Übersicht

```
User drags .themeItem
    │
    ▼
drop-Event (Webview JS)
    │  berechnet neue Gruppen-Reihenfolge
    │  rebuilt newFavorites[] (alle Gruppen, korrekte Position)
    ▼
vscode.postMessage({ command: 'reorderFavorites', favorites: [...] })
    │
    ▼
FavoritesWebviewProvider.onDidReceiveMessage
    │
    ▼
setFavorites(msg.favorites)   ← persistiert in VS Code Settings
    │
    ▼
_sendInit()                   ← Webview neu rendern mit neuer Reihenfolge
```

## Entscheidungen

| Entscheidung | Wahl | Begründung |
|---|---|---|
| DnD-Ansatz | HTML5 Drag & Drop (kein TreeDragAndDropController) | Die Favoriten-Ansicht ist eine Webview, kein TreeView — kein VS Code API-Bump nötig |
| Reihenfolge in `_sendInit()` | `favorites.map(name => favItemMap.get(name))` statt `all.filter(...)` | `all.filter()` gibt Items in `all`-Reihenfolge zurück, nicht in `favorites`-Reihenfolge — DnD-Persistenz wäre sonst ohne Wirkung |
| Cross-Group-Drop | Ignoriert | Gruppen sind durch Theme-Farbe bestimmt, kein sinnvoller Semantik für Cross-Group |
| Drop-Indikator | Blauer Balken oben/unten je nach Maus-Position | Standard-UX-Pattern für sortierbare Listen |
| Lookup-Optimierung | `groupLabelSet = new Set(...)` | Verhindert O(n²) durch wiederholtes `arr.map().includes()` im Loop |

## Plan-Abweichungen

| Original | Tatsächlich | Grund |
|---|---|---|
| `TreeDragAndDropController` + `createTreeView` + `engines.vscode ^1.62.0` | HTML5 DnD in Webview, kein API-Bump | Favoriten-View ist Webview, nicht TreeView — `FavoritesProvider` ist ungenutzter Code |
| `src/extension.ts` ändern | Nicht geändert | Webview-Ansatz braucht keine TreeView-Registrierung |
| `package.json` engines anpassen | Nicht geändert | HTML5 DnD braucht keine spezielle VS Code-Version |

## Gotchas / Hinweise

- **`FavoritesProvider`** (`src/favoritesProvider.ts`) ist als TreeView-Provider implementiert, wird aber nirgends in `extension.ts` registriert — es ist toter Code. Die echte Favoriten-Ansicht ist `FavoritesWebviewProvider`.
- Die DnD-Reihenfolge wird **pro Gruppe** gespeichert. Ein Dark-Theme kann nicht vor ein Light-Theme gezogen werden — die Gruppe ist durch die Theme-Farbe festgelegt, nicht durch die Position.
- `dragState` ist eine globale JS-Variable im Webview-Kontext. Ein `dragend`-Event setzt sie zurück. Bei schnellem Scrollen kann der Indicator-Cleanup über `querySelectorAll` relevant sein.

## Verifikation

1. VS Code neu laden (`Ctrl+Shift+P → Reload Window`)
2. Mehrere Themes als Favoriten hinzufügen (mindestens 2 Dark-Themes)
3. Im Favoriten-Panel: Drag-Handle (⠿) an einem Theme-Item greifbar
4. Item per Drag & Drop in eine andere Position innerhalb der Gruppe ziehen
5. Blaue Drop-Linie erscheint beim Hover
6. Nach Drop: Reihenfolge in der Ansicht geändert
7. VS Code neu starten → Reihenfolge bleibt erhalten (Settings Sync kompatibel)
