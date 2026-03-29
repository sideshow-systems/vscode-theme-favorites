# Theme-Favoriten für VS Code

Verwalten und wechseln Sie schnell zwischen Ihren liebsten VS Code-Themes. Diese Erweiterung ermöglicht es Ihnen, installierte Themes als Favoriten zu markieren und zwischen ihnen mit einem einzigen Klick oder Befehl zu wechseln.

![Vorschau](images/banner.png)

## Funktionen

- **Favoriten hinzufügen/entfernen**: Markieren Sie Ihre bevorzugten Themes als Favoriten über die Befehlspalette
- **Schneller Wechsel**: Wechseln Sie sofort zwischen Favoriten-Themes
- **Explorer-Ansicht**: Visuelle Seitenleiste mit allen Ihren Favoriten-Themes
- **Ein-Klick-Auswahl**: Klicken Sie auf ein beliebiges Favoriten-Theme im Explorer, um es zu aktivieren
- **Einfache Verwaltung**: Entfernen Sie Themes aus den Favoriten, wenn Sie diese nicht mehr benötigen

## Erste Schritte

### Installation

1. Öffnen Sie VS Code
2. Gehen Sie zu Erweiterungen (Strg+Umschalt+X / Cmd+Umschalt+X)
3. Suchen Sie nach "Theme Favorites" oder "Theme-Favoriten"
4. Klicken Sie auf Installieren

### Verwendung

1. **Ein Favoriten-Theme hinzufügen**:
   - Öffnen Sie die Befehlspalette (Strg+Umschalt+P / Cmd+Umschalt+P)
   - Suchen Sie nach "Theme-Favoriten: Favorit hinzufügen"
   - Wählen Sie ein Theme aus der Liste aus, um es zu den Favoriten hinzuzufügen

2. **Zwischen Favoriten wechseln**:
   - Öffnen Sie die Befehlspalette und wählen Sie "Theme-Favoriten: Favorit auswählen"
   - Oder klicken Sie auf ein beliebiges Theme in der Ansicht "Theme-Favoriten" in der Explorer-Seitenleiste

3. **Aus Favoriten entfernen**:
   - Klicken Sie mit der rechten Maustaste auf ein Theme in der Ansicht "Theme-Favoriten"
   - Wählen Sie "Theme-Favoriten: Favorit entfernen"

4. **Theme umschalten**:
   - Verwenden Sie "Theme-Favoriten: Favorit umschalten", um das aktuelle Theme schnell hinzuzufügen/zu entfernen

## Befehle

- `Theme-Favoriten: Favorit hinzufügen` - Fügen Sie ein Theme zu Ihren Favoriten hinzu
- `Theme-Favoriten: Favorit entfernen` - Entfernen Sie ein Theme aus den Favoriten
- `Theme-Favoriten: Favorit auswählen` - Wählen Sie ein Favoriten-Theme aus und wechseln Sie dazu
- `Theme-Favoriten: Favorit umschalten` - Schalten Sie das aktuelle Theme als Favorit um
- `Theme-Favoriten: Theme anwenden` - Öffnen Sie die Theme-Einstellungen
- `Theme-Favoriten: Ansicht aktualisieren` - Aktualisieren Sie die Favoritenliste

## Entwicklung

### Schnellstart

- Abhängigkeiten installieren:
  ```bash
  npm install
  ```

- TypeScript kompilieren:
  ```bash
  npm run compile
  ```

- Starten Sie die Erweiterung in VS Code: Drücken Sie `F5` (Run Extension Debug-Konfiguration)

### Projektstruktur

- `package.json` — Erweiterungs-Metadaten und Befehlsdefinitionen
- `src/extension.ts` — Erweiterungsaktivierung und Befehlshandler
- `src/favoritesProvider.ts` — TreeView-Provider für Explorer-Favoriten
- `src/themesProvider.ts` — Theme-Management-Provider
- `src/favoritesWebviewProvider.ts` — Webview für Favoriten-UI
- `src/themesWebviewProvider.ts` — Webview für Themes-UI

### Einrichtungsanweisungen

1. **Lokales Testen**:
   ```bash
   # Paket erstellen
   npx vsce package
   # Lokal installieren
   code --install-extension *.vsix
   # Oder direkt veröffentlichen
   npx vsce publish --pat "$VSCE_PAT"
   ```

## Hinweise

- Überprüfen Sie, dass `package.json` die korrekten Felder enthält: `publisher`, `name`, `version` und `engines.vscode`
