import * as vscode from 'vscode';
import { ThemesProvider } from './themesProvider';
import { getFavorites, setFavorites } from './favoritesUtils';

export class FavoritesWebviewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'theme-favorites-favorites';
    private _view?: vscode.WebviewView;
    private _out?: vscode.OutputChannel;

    constructor(private readonly _extensionUri: vscode.Uri, private readonly _context: vscode.ExtensionContext, private readonly _themesProvider: ThemesProvider, out?: vscode.OutputChannel) {
        this._out = out;
    }

    public async resolveWebviewView(webviewView: vscode.WebviewView) {
        this._view = webviewView;
        try {
            webviewView.webview.options = { enableScripts: true, localResourceRoots: [this._extensionUri] };
            webviewView.webview.html = this._getHtml(webviewView.webview);

            webviewView.webview.onDidReceiveMessage(async (msg) => {
                try {
                    switch (msg.command) {
                        case 'initRequest':
                            await this._sendInit();
                            break;
                        case 'openTheme':
                            if (msg.name) {
                                await vscode.workspace.getConfiguration('workbench').update('colorTheme', msg.name, vscode.ConfigurationTarget.Global);
                                await this._sendInit();
                                this._themesProvider.refresh();
                                vscode.window.showInformationMessage(`Theme changed: ${msg.name}`);
                            }
                            break;
                        case 'removeFavorite':
                            if (!msg.name) break;
                            const favs = getFavorites();
                            const newFavs = favs.filter(f => f !== msg.name);
                            await setFavorites(newFavs);
                            await this._sendInit();
                            this._themesProvider.refresh();
                            webviewView.webview.postMessage({ command: 'favoritesUpdated', favorites: newFavs });
                            // Trigger global refresh so Themes webview updates its star state as well
                            try {
                                await vscode.commands.executeCommand('themeFavorites.refresh');
                            } catch (e) {
                                this._out?.appendLine(`executeCommand refresh failed: ${e}`);
                            }
                            break;
                        case 'refresh':
                            await this._sendInit();
                            break;
                    }
                } catch (e) {
                    this._out?.appendLine(`favorites webview message error: ${e}`);
                }
            });

            await this._sendInit();
        } catch (err) {
            this._out?.appendLine(`Favorites webview init error: ${err}`);
            try {
                const errorMsg = `Error loading favorites: ${String(err)}`;
                webviewView.webview.html = `<div style="padding:12px;">${errorMsg}</div>`;
            } catch (e) { }
        }
    }

    public async refresh() {
        await this._sendInit();
    }

    private getWebviewStrings() {
        const locale = vscode.env.language && vscode.env.language.startsWith('de') ? 'de' : 'en';
        const map = {
            'en': {
                searchPlaceholder: 'Filter favorites...',
                groupDark: 'Dark',
                groupLight: 'Light',
                groupOther: 'Other',
                removeButton: 'Remove',
                pageTitle: 'Favorites',
                noFavorites: 'No favorites yet. Add themes from the Browse view.',
                toggleColorsLabel: 'Colors'
            },
            'de': {
                searchPlaceholder: 'Favoriten filtern...',
                groupDark: 'Dunkel',
                groupLight: 'Hell',
                groupOther: 'Andere',
                removeButton: 'Entfernen',
                pageTitle: 'Theme Favoriten',
                noFavorites: 'Noch keine Favoriten. Fügen Sie Themes aus der Durchsuchen-Ansicht hinzu.',
                toggleColorsLabel: 'Farben'
            }
        };
        return map[locale];
    }

    private async _sendInit() {
        if (!this._view) return;
        const all = await this._themesProvider.getAllThemes();
        const favorites = getFavorites();
        const favItems = all.filter(t => favorites.includes(t.label));
        const active = vscode.workspace.getConfiguration('workbench').get<string>('colorTheme', '');
        this._view.webview.postMessage({
            command: 'init',
            themes: favItems,
            favorites,
            activeTheme: active,
            strings: this.getWebviewStrings()
        });
    }

    private _getHtml(webview: vscode.Webview): string {
        const nonce = getNonce();
        const cspSource = webview.cspSource;
        return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${cspSource} 'unsafe-inline'; img-src ${cspSource} data:; script-src 'nonce-${nonce}';">
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title></title>
<style>
* { box-sizing: border-box; }
body {
  font-family: var(--vscode-font-family);
  color: var(--vscode-editor-foreground);
  background: var(--vscode-editor-background);
  padding: 0;
  margin: 0;
}

#header {
  position: sticky;
  top: 0;
  background: var(--vscode-editor-background);
  padding: 8px;
  border-bottom: 1px solid var(--vscode-editorWidget-border);
  z-index: 100;
  display: flex;
  gap: 8px;
  align-items: center;
}

#search {
  flex: 1;
  padding: 6px 8px;
  border-radius: 4px;
  border: 1px solid var(--vscode-editorWidget-border);
  background: var(--vscode-input-background);
  color: var(--vscode-input-foreground);
  font-family: var(--vscode-font-family);
}

#search::placeholder {
  color: var(--vscode-input-placeholderForeground);
}

#toggleSwatches {
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  border: 1px solid transparent;
  color: var(--vscode-editor-foreground);
  font-size: 0.85em;
  white-space: nowrap;
  flex-shrink: 0;
}

#toggleSwatches:hover {
  background: var(--vscode-list-hoverBackground);
  border-color: var(--vscode-editorWidget-border);
}

.swatch-checkbox {
  width: 16px;
  height: 16px;
  cursor: pointer;
}

#content {
  padding: 8px;
}

.group {
  margin-bottom: 16px;
  border: 1px solid var(--vscode-editorWidget-border);
  border-radius: 6px;
  overflow: hidden;
}

.group h3 {
  margin: 0;
  padding: 8px 12px;
  font-weight: 600;
  font-size: 1.05em;
  background: var(--vscode-editor-lineNumberActiveForeground);
  color: var(--vscode-editor-foreground);
  opacity: 0.7;
  border-bottom: 1px solid var(--vscode-editorWidget-border);
}

.groupItems {
  display: flex;
  flex-direction: column;
  background: rgba(255,255,255,0.02);
}

.themeItem {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border-radius: 0;
  margin: 0;
  cursor: pointer;
  border-bottom: 1px solid rgba(255,255,255,0.05);
  transition: background-color 0.15s;
}

.themeItem:last-child {
  border-bottom: none;
}

.themeItem:hover {
  background: var(--vscode-list-hoverBackground);
}

.themeItem.active {
  outline: 2px solid var(--vscode-focusBorder);
  background: var(--vscode-list-activeSelectionBackground);
}

.themeItem .left {
  display: flex;
  gap: 8px;
  align-items: center;
  flex: 1;
  min-width: 0;
}

.themeItem .label {
  font-size: 0.95em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.themeItem .meta {
  font-size: 0.8em;
  color: var(--vscode-editorHint-foreground);
  flex-shrink: 0;
}

.theme-swatch {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 2px;
  border-radius: 4px;
  border: 1px solid var(--vscode-editorWidget-border);
  overflow: hidden;
  flex-shrink: 0;
  height: 24px;
  aspect-ratio: 5 / 1;
  min-width: 90px;
}

.theme-swatch-color {
  background: #1e1e1e;
  border-radius: 2px;
}

.theme-swatch.hidden {
  display: none;
}

.btn {
  background: transparent;
  border: none;
  color: var(--vscode-editor-foreground);
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 3px;
  transition: background-color 0.15s;
}

.btn:hover {
  background: var(--vscode-list-hoverBackground);
}

#noItems {
  text-align: center;
  padding: 16px 8px;
  color: var(--vscode-editorHint-foreground);
  font-size: 0.9em;
}
</style>
</head>
<body>
<div id="header">
  <input id="search" type="text" />
  <label id="toggleSwatches">
    <input type="checkbox" class="swatch-checkbox" id="swatchToggle" />
    <span id="toggleSwatchesLabel">Colors</span>
  </label>
</div>
<div id="content">
  <div id="groups"></div>
</div>
<script nonce="${nonce}">
const vscode = acquireVsCodeApi();
let themes = [];
let favorites = [];
let activeTheme = '';
let showSwatches = false;
let strings = {
    searchPlaceholder: 'Filter favorites...',
    groupDark: 'Dark',
    groupLight: 'Light',
    groupOther: 'Other',
    removeButton: 'Remove',
    pageTitle: 'Favorites',
    noFavorites: 'No favorites yet.'
};

function normalizeName(s) {
    if (!s) return '';
    try {
        return s.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim().replace(/[^a-z0-9 ]/g, '');
    } catch (e) {
        return s.toLowerCase();
    }
}

function isSameTheme(a, b) {
    const na = normalizeName(a);
    const nb = normalizeName(b);
    return na && nb && na === nb;
}

function categorizeTheme(t) {
  // prefer explicit editor.background color if available
  if (!t) return 'unknown';
  function parseColor(input) {
    if (!input || typeof input !== 'string') return null;
    const s = input.trim().toLowerCase();
    if (s[0] === '#') {
      const hex = s.substring(1);
      if (hex.length === 3) return { r: parseInt(hex[0] + hex[0], 16), g: parseInt(hex[1] + hex[1], 16), b: parseInt(hex[2] + hex[2], 16) };
      if (hex.length === 4) return { r: parseInt(hex[0] + hex[0], 16), g: parseInt(hex[1] + hex[1], 16), b: parseInt(hex[2] + hex[2], 16) };
      if (hex.length === 6 || hex.length === 8) return { r: parseInt(hex.substring(0, 2), 16), g: parseInt(hex.substring(2, 4), 16), b: parseInt(hex.substring(4, 6), 16) };
    }
    const rgbMatch = s.match(/rgba?\(([^)]+)\)/);
    if (rgbMatch) {
      const parts = rgbMatch[1].split(',').map(p => p.trim());
      if (parts.length >= 3) {
        const parsePart = (p) => p.endsWith('%') ? Math.round(parseFloat(p) * 2.55) : Math.round(parseFloat(p));
        const r = parsePart(parts[0]);
        const g = parsePart(parts[1]);
        const b = parsePart(parts[2]);
        if (!Number.isNaN(r) && !Number.isNaN(g) && !Number.isNaN(b)) return { r, g, b };
      }
    }
    return null;
  }
  function brightnessOf(color) {
    const rgb = parseColor(color);
    if (!rgb) return null;
    return Math.round((rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000);
  }
  if (t.colors && (t.colors['editor.background'] || t.colors['editorBackground'])) {
    const bg = t.colors['editor.background'] || t.colors['editorBackground'];
    const b = brightnessOf(bg);
    if (b !== null) return b > 128 ? 'light' : 'dark';
  }
  const ui = (t.uiTheme || '').toLowerCase();
  const label = (t.label || '').toLowerCase();
  // Check uiTheme next
  if (ui.includes('dark')) return 'dark';
  if (ui.includes('vs') || ui.includes('light')) return 'light';
  // Fallback: check theme name for known variants
  if (label.includes('dark') || label.includes('frappe') || label.includes('mocha')) return 'dark';
  if (label.includes('light') || label.includes('latte')) return 'light';
  return 'unknown';
}

function groupThemes(list) {
 const groups = { dark: [], light: [], unknown: [] };
 for (const t of list) {
    const kind = categorizeTheme(t);
    groups[kind].push(t);
 }
 return groups;
}

function render() {
 const q = document.getElementById('search').value.trim().toLowerCase();
 const filtered = themes.filter(t => !q || t.label.toLowerCase().includes(q));

 if (filtered.length === 0) {
   document.getElementById('groups').innerHTML = '<div id="noItems">' + strings.noFavorites + '</div>';
   return;
 }

 const container = document.getElementById('groups');
 container.innerHTML = '';
 const groups = groupThemes(filtered);
 for (const key of ['dark','light','unknown']) {
    const arr = groups[key];
    if (!arr || arr.length === 0) continue;
    const groupEl = document.createElement('div');
    groupEl.className = 'group';
    const title = document.createElement('h3');
    title.textContent = key === 'dark' ? strings.groupDark : (key === 'light' ? strings.groupLight : strings.groupOther);
    groupEl.appendChild(title);

    const itemsContainer = document.createElement('div');
    itemsContainer.className = 'groupItems';

    for (const t of arr) {
        const active = isSameTheme(t.label, activeTheme);
        const item = document.createElement('div');
        item.className = 'themeItem' + (active ? ' active' : '');
        const left = document.createElement('div');
        left.className = 'left';

        // Create color swatch with 5 dominant theme colors
        const swatch = document.createElement('div');
        swatch.className = 'theme-swatch' + (showSwatches ? '' : ' hidden');
        const colors = t.colors || {};

        // Set fallback based on theme type
        let bgFallback = '#1e1e1e';
        let fgFallback = '#d4d4d4';
        const ui = (t.uiTheme || '').toLowerCase();
        if (ui.includes('vs') || ui.includes('light')) {
            bgFallback = '#ffffff';
            fgFallback = '#333333';
        }

        // Select 5 important colors in priority order
        const paletteKeys = [
            'editor.background',
            'editor.foreground',
            'button.background',
            'terminal.ansiRed',
            'activityBar.background'
        ];

        const paletteFallbacks = [bgFallback, fgFallback, '#0e639c', '#f48771', '#333333'];

        for (let i = 0; i < 5; i++) {
            const colorValue = colors[paletteKeys[i]] || paletteFallbacks[i];
            const colorDiv = document.createElement('div');
            colorDiv.className = 'theme-swatch-color';
            colorDiv.style.backgroundColor = colorValue;
            colorDiv.title = paletteKeys[i];
            swatch.appendChild(colorDiv);
        }

        left.appendChild(swatch);

        const lbl = document.createElement('div');
        lbl.className = 'label';
        lbl.textContent = t.label;
        const meta = document.createElement('div');
        meta.className = 'meta';
        meta.textContent = t.extDisplay || t.extId || '';
        left.appendChild(lbl);
        left.appendChild(meta);
        const right = document.createElement('div');
        const btn = document.createElement('button');
        btn.className = 'btn';
        btn.innerText = strings.removeButton;
        btn.onclick = (e) => { e.stopPropagation(); vscode.postMessage({ command: 'removeFavorite', name: t.label }); };
        item.onclick = () => { vscode.postMessage({ command: 'openTheme', name: t.label }); };
        right.appendChild(btn);
        item.appendChild(left);
        item.appendChild(right);
        itemsContainer.appendChild(item);
    }
    groupEl.appendChild(itemsContainer);
    container.appendChild(groupEl);
 }
}

function updateUI() {
	document.getElementById('search').placeholder = strings.searchPlaceholder;
	document.getElementById('toggleSwatchesLabel').textContent = strings.toggleColorsLabel;
	document.title = strings.pageTitle;
}

window.addEventListener('message', event => {
 const msg = event.data;
 switch (msg.command) {
  case 'init':
      themes = msg.themes || [];
      favorites = msg.favorites || [];
      activeTheme = msg.activeTheme || '';
      strings = msg.strings || strings;
      updateUI();
      render();
      break;
  case 'favoritesUpdated':
      favorites = msg.favorites || [];
      render();
      break;
 }
});

document.getElementById('search').addEventListener('input', () => render());

document.getElementById('swatchToggle').addEventListener('change', (e) => {
	showSwatches = e.target.checked;
	const swatches = document.querySelectorAll('.theme-swatch');
	swatches.forEach(swatch => {
		if (showSwatches) {
			swatch.classList.remove('hidden');
		} else {
			swatch.classList.add('hidden');
		}
	});
});

vscode.postMessage({ command: 'initRequest' });
</script>
</body>
</html>`;
    }
}

function getNonce() { let text = ''; const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'; for (let i = 0; i < 32; i++) text += possible.charAt(Math.floor(Math.random() * possible.length)); return text; }
