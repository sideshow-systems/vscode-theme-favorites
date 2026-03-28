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

## CI/CD — Veröffentlichung via GitLab

Diese Repo enthält eine GitLab CI Konfiguration [.gitlab-ci.yml](.gitlab-ci.yml), die bei gesetztem Git‑Tag ein Paket baut und in den VS Code Marketplace veröffentlicht.

1) Persönliches Access Token (PAT) erstellen:
	- Erstelle ein Azure DevOps Personal Access Token (PAT) mit Scope "Marketplace (publish)".
	- Siehe: https://aka.ms/azure-devops-create-pat

2) GitLab CI Variable anlegen:
	- Projekt → Settings → CI / CD → Variables
	- Name: `VSCE_PAT`
	- Wert: dein PAT
	- Optionen: Masked = true, Protected = true

3) Veröffentlichung auslösen:
	- Erstelle ein Tag und pushe es:
	  ```
	  git tag v1.0.0
	  git push origin --tags
	  ```
	- Die Pipeline baut ein `.vsix` und veröffentlicht es automatisch (nur bei Tags).

4) Lokal testen:
	- Paket erstellen:
	  ```
	  npx vsce package
	  code --install-extension *.vsix
	  ```
	- Veröffentlichen lokal:
	  ```
	  npx vsce publish --pat "$VSCE_PAT"
	  ```

Hinweis:
- Der Self‑Hosted Runner benötigt ausgehenden Netzwerkzugriff.
- Prüfe `package.json` auf Felder `publisher`, `name`, `version`, `engines.vscode`.
