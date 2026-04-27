---
id: favoriten-reihenfolge-sortierbar
title: Favoriten per Drag & Drop sortierbar
status: completed
created: 2026-04-27T00:00:00Z
completed_at: 2026-04-27T20:29:14.235Z
---

# Intent: Favoriten per Drag & Drop sortierbar

## Goal

Nutzer können ihre Favoriten-Themes in der TreeView per Drag & Drop in eine beliebige Reihenfolge bringen. Die Reihenfolge wird persistiert (VS Code Settings) und bleibt nach Neustart erhalten.

## Users

VS Code-Nutzer, die mehrere Favoriten-Themes gespeichert haben und diese nach Priorität oder persönlicher Präferenz anordnen möchten — z.B. damit die am häufigsten genutzten Themes ganz oben stehen.

## Problem

Aktuell werden Favoriten innerhalb jeder Gruppe (Dark / Light / Other) **alphabetisch** sortiert. Es gibt keine Möglichkeit, eine eigene Reihenfolge festzulegen. Nutzer mit vielen Favoriten können ihre bevorzugten Themes nicht nach oben schieben.

## Success Criteria

- Favoriten lassen sich per Drag & Drop innerhalb ihrer Gruppe (Dark / Light / Other) umsortieren
- Die Reihenfolge entspricht nach dem Drop der Reihenfolge im `themeFavorites.favorites`-Array in den Settings
- Nach VS Code-Neustart bleibt die Reihenfolge erhalten (Settings Sync kompatibel)
- Nur `FavoriteItem`-Knoten sind draggable — `GroupItem`-Knoten bleiben fest

## Constraints

- VS Code Minimum-Version muss auf `^1.62.0` angehoben werden (TreeDragAndDropController API)
- Kein Breaking Change an der bestehenden Settings-Struktur (`themeFavorites.favorites` bleibt ein `string[]`)
- Gruppenstruktur (Dark / Light / Other) bleibt erhalten — Drag & Drop nur innerhalb einer Gruppe

## Notes

Aktueller Code: `favoritesProvider.ts:236` sortiert Items alphabetisch mit `.sort((a, b) => a.label.localeCompare(b.label))`. Diese Zeile muss entfernt werden, damit die Settings-Reihenfolge sichtbar wird.
