---
run: run-vscode-theme-favorites-001
work_item: preserve-insertion-order
intent: favoriten-reihenfolge-sortierbar
mode: autopilot
checkpoint: none
approved_at: 2026-04-27T20:18:25.642Z
---

# Implementation Plan: Alphabetische Sortierung entfernen

## Approach

Entfernt die `.sort((a, b) => a.label.localeCompare(b.label))`-Zeile aus `FavoritesProvider.getChildren()`. Danach erscheinen Favoriten innerhalb jeder Gruppe in der Reihenfolge, in der sie im `themeFavorites.favorites`-Array stehen. Dies ist die Voraussetzung dafür, dass eine per Drag & Drop gesetzte Reihenfolge sichtbar bleibt.

## Files to Create

| File | Purpose |
|------|---------|
| (none) | |

## Files to Modify

| File | Changes |
|------|---------|
| `src/favoritesProvider.ts` | Zeile 236: `.sort((a, b) => a.label.localeCompare(b.label))` entfernen |

## Tests

| Test File | Coverage |
|-----------|----------|
| (keine neuen Tests nötig — Änderung ist eine Zeilenentfernung ohne neue Logik) | |

---

## Work Item: implement-drag-and-drop (REVISED — Webview, nicht TreeView)

### Approach

Die Favoriten-Ansicht ist eine Webview (`FavoritesWebviewProvider`), kein TreeView.
DnD wird daher mit der **HTML5 Drag & Drop API** implementiert.

**Zwei Fixes in einem Work Item:**

1. `_sendInit()` gibt `favItems` aktuell in der Reihenfolge von `all` zurück — nicht in der Reihenfolge des `favorites`-Arrays. Fix: `favorites`-Array als primäre Reihenfolge, `all` als Lookup.

2. DnD in der Webview: `themeItem`-Divs werden `draggable`. Beim Drop wird die neue Reihenfolge innerhalb der Gruppe berechnet und als `reorderFavorites`-Message an den Extension Host gesendet. Dieser ruft `setFavorites()` auf und refresht die Webview.

**Kein VS Code API-Version-Bump nötig** (HTML5 DnD, kein `TreeDragAndDropController`).

### Files to Create

| File | Purpose |
|------|---------|
| (none) | |

### Files to Modify

| File | Changes |
|------|---------|
| `src/favoritesWebviewProvider.ts` | `_sendInit()` Reihenfolge-Fix + `reorderFavorites`-Handler + DnD CSS/JS in `_getHtml()` |

### Tests

| Test File | Coverage |
|-----------|----------|
| (keine automatisierten Tests — Webview-Logik, kein Runner konfiguriert) | |

---
*Plan approved at checkpoint. Execution follows.*
