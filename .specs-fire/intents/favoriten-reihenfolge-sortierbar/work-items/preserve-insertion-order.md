---
id: preserve-insertion-order
title: Alphabetische Sortierung entfernen
intent: favoriten-reihenfolge-sortierbar
complexity: low
mode: autopilot
status: completed
depends_on: []
created: 2026-04-27T00:00:00Z
run_id: run-vscode-theme-favorites-001
completed_at: 2026-04-27T20:20:40.901Z
---

# Work Item: Alphabetische Sortierung entfernen

## Description

In `FavoritesProvider.getChildren()` werden Favoriten aktuell alphabetisch sortiert (`results.sort(...)`). Diese Sortierung überschreibt die im Settings-Array gespeicherte Reihenfolge. Sie muss entfernt werden, damit die in `themeFavorites.favorites` gespeicherte Reihenfolge in der TreeView sichtbar ist — als Voraussetzung für persistentes Drag & Drop.

## Acceptance Criteria

- [ ] `results.sort((a, b) => a.label.localeCompare(b.label))` in `favoritesProvider.ts:236` ist entfernt
- [ ] Favoriten erscheinen innerhalb jeder Gruppe in der Reihenfolge, in der sie im Settings-Array stehen
- [ ] Keine anderen Sortierungen oder Umsortierungen im `getChildren`-Pfad

## Technical Notes

Änderung: eine Zeile entfernen in [favoritesProvider.ts:236](src/favoritesProvider.ts#L236).

## Dependencies

(none)
