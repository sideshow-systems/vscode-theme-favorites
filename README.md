# Theme Favorites (VS Code)

Kleine VS Code Erweiterung, um installierte Themes als Favoriten zu markieren und schnell zwischen ihnen zu wechseln.

Schnellstart
- Abhängigkeiten installieren:

```bash
npm install
```

- TypeScript kompilieren:

```bash
npm run compile
```

- Extension in VS Code starten: `F5` drücken (Debug-Konfiguration: Run Extension).

Benutzung
- Öffne die Command Palette und suche nach "Theme Favorites: Add Favorite" um ein Theme zur Favoritenliste hinzuzufügen.
- Über "Theme Favorites: Choose Favorite" kannst du ein Favorit‑Theme auswählen und aktivieren.
- Im Explorer gibt es eine View "Theme Favorites" mit deinen Favoriten (klicken wechselt das Theme).

Dateien
- package.json — Extension-Metadaten und Commands
- src/extension.ts — Aktivierung & Befehle
- src/favoritesProvider.ts — TreeView Provider für Favoriten
