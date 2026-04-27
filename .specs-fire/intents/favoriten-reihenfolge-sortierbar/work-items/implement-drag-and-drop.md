---
id: implement-drag-and-drop
title: Drag & Drop für Favoriten-TreeView implementieren
intent: favoriten-reihenfolge-sortierbar
complexity: medium
mode: confirm
status: completed
depends_on:
  - preserve-insertion-order
created: 2026-04-27T00:00:00Z
run_id: run-vscode-theme-favorites-001
completed_at: 2026-04-27T20:29:14.221Z
---

# Work Item: Drag & Drop für Favoriten-TreeView implementieren

## Description

`FavoritesProvider` wird um einen `TreeDragAndDropController<FavoriteItem>` erweitert. Nutzer können `FavoriteItem`-Knoten innerhalb ihrer Gruppe (Dark / Light / Other) per Drag & Drop umsortieren. Beim Drop wird die neue Reihenfolge ins flache `themeFavorites.favorites`-Array zurückgeschrieben und persistiert.

**Scope:** Nur Drag innerhalb einer Gruppe. Kein Cross-Group-Drag (ein Dark-Theme kann nicht in die Light-Gruppe gezogen werden).

## Acceptance Criteria

- [ ] `FavoritesProvider` implementiert `vscode.TreeDragAndDropController<FavoriteItem>`
- [ ] `dragMimeTypes`: `['application/vnd.code.tree.theme-favorites']`
- [ ] `dropMimeTypes`: `['application/vnd.code.tree.theme-favorites']`
- [ ] `handleDrag`: serialisiert den gezogenen `FavoriteItem.label` in den DataTransfer
- [ ] `handleDrop`: ermittelt die neue Position im flachen `themeFavorites.favorites`-Array, ruft `setFavorites()` auf und ruft `refresh()` auf
- [ ] Drop auf `GroupItem` eines anderen Kind-Typs wird ignoriert (kein Cross-Group-Drop)
- [ ] `createTreeView` in `extension.ts` wird mit `dragAndDropController: favoritesProvider` registriert
- [ ] `package.json` `engines.vscode` ist auf `^1.62.0` angehoben
- [ ] Nach dem Drop bleibt die Reihenfolge nach VS Code-Neustart erhalten

## Technical Notes

**API:** `vscode.TreeDragAndDropController<T>` (verfügbar ab VS Code 1.62).

**Reorder-Logik im `handleDrop`:**
1. Lese aktuelles `getFavorites()` → flaches `string[]`
2. Ermittle die Gruppe des Ziel-Knotens (aus `GroupItem.kind`)
3. Filtere alle Favoriten der gleichen Gruppe heraus (behalte ihre Indizes im Flat-Array)
4. Ermittle die Zielposition innerhalb dieser Gruppe
5. Entferne das gezogene Item aus dem Array, füge es an der neuen Position ein
6. Rufe `setFavorites(newArray)` auf

**Registrierung in `extension.ts`:**
```typescript
const favoritesTreeView = vscode.window.createTreeView('theme-favorites-favorites', {
  treeDataProvider: favoritesProvider,
  dragAndDropController: favoritesProvider,
});
```

**Wichtig:** `FavoritesProvider` muss das Interface `vscode.TreeDragAndDropController<FavoriteItem>` explizit implementieren (nicht nur `FavoriteNode`, da `GroupItem` nicht draggable sein soll).

## Dependencies

- preserve-insertion-order
