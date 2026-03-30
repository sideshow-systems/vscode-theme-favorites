import * as vscode from 'vscode';
import { ThemesProvider } from './themesProvider';
import { getFavorites, setFavorites } from './favoritesUtils';

/**
 * WebviewViewProvider für die interaktive Theme‑Ansicht.
 */
export class ThemesWebviewProvider implements vscode.WebviewViewProvider {
	public static readonly viewType = 'theme-favorites-webview';
	private _view?: vscode.WebviewView;
	private _out?: vscode.OutputChannel;

	/**
	 * @param _extensionUri URI der Extension (für Ressourcen)
	 * @param _context ExtensionContext für globalState
	 * @param _themesProvider Backend‑Provider für Theme‑Listen
	 * @param _out optionaler OutputChannel für Diagnostics
	 */
	private _favoritesRefresh?: () => Promise<void>;
	constructor(private readonly _extensionUri: vscode.Uri, private readonly _context: vscode.ExtensionContext, private readonly _themesProvider: ThemesProvider, out?: vscode.OutputChannel, favoritesRefresh?: () => Promise<void>) {
		this._out = out;
		this._favoritesRefresh = favoritesRefresh;
	}

	/**
	 * Wird aufgerufen, wenn die Webview sichtbar wird.
	 */
	public async resolveWebviewView(webviewView: vscode.WebviewView, _context: vscode.WebviewViewResolveContext, _token: vscode.CancellationToken) {
		this._view = webviewView;
		try {
			webviewView.webview.options = { enableScripts: true, localResourceRoots: [this._extensionUri] };
			webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

			// Nachrichten vom Webview empfangen
			webviewView.webview.onDidReceiveMessage(async (message) => {
				try {
					switch (message.command) {
						case 'initRequest':
							await this._sendInit();
							break;
						case 'applyTheme':
							if (message.name) {
								await vscode.workspace.getConfiguration('workbench').update('colorTheme', message.name, vscode.ConfigurationTarget.Global);
								this._themesProvider.refresh();
								await this._sendInit();
								vscode.window.showInformationMessage(`Theme changed: ${message.name}`);
							}
							break;
						case 'toggleFavorite':
							if (!message.name) break;
						const favs = getFavorites();
						if (favs.includes(message.name)) {
							const newFavs = favs.filter(f => f !== message.name);
							await setFavorites(newFavs);
						} else {
							favs.push(message.name);
							await setFavorites(favs);
						}
						// refresh internal provider state
						this._themesProvider.refresh();
						// notify this webview
						const updatedFavs = getFavorites();
							webviewView.webview.postMessage({ command: 'favoritesUpdated', favorites: updatedFavs });
							// also notify favorites webview (if available)
							try {
								if (this._favoritesRefresh) await this._favoritesRefresh();
							} catch (e) {
								this._out?.appendLine(`favorites refresh callback failed: ${e}`);
							}
							// ensure any other view (TreeView or older registrations) also refresh via the public command
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
				} catch (inner) {
					this._out?.appendLine(`webview message handler error: ${inner}`);
				}
			});

			// initiale Daten senden
			await this._sendInit();

			// auf externe Theme‑Änderungen hören
			this._context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(e => {
				if (e.affectsConfiguration && e.affectsConfiguration('workbench.colorTheme')) {
					const active = vscode.workspace.getConfiguration('workbench').get<string>('colorTheme', '');
					webviewView.webview.postMessage({ command: 'activeThemeChanged', activeTheme: active });
				}
			}));
		} catch (err) {
			const msg = `Error initializing theme webview: ${err}`;
			this._out?.appendLine(msg);
			// Fallback-HTML, damit die View etwas zeigt statt "kein Datenanbieter"
			try {
				webviewView.webview.html = `<div style="padding:12px;font-family:system-ui;">Error loading theme view.<br>${escapeHtml(String(err))}</div>`;
			} catch (e) {
				// ignore
			}
		}
	}

	/**
	 * Sendet die initialen Daten (Themes, Favoriten, aktives Theme) an das Webview.
	 */
	private getWebviewStrings() {
		const locale = vscode.env.language && vscode.env.language.startsWith('de') ? 'de' : 'en';
		const map = {
			'en': {
				searchPlaceholder: 'Search themes...',
				filterAll: 'All',
				filterDark: 'Dark',
				filterLight: 'Light',
				groupDark: 'Dark',
				groupLight: 'Light',
				groupOther: 'Other',
				pageTitle: 'Themes',
				noThemesFound: 'No themes found',
				toggleColorsLabel: 'Colors'
			},
			'de': {
				searchPlaceholder: 'Themes suchen...',
				filterAll: 'Alle',
				filterDark: 'Dunkel',
				filterLight: 'Hell',
				groupDark: 'Dunkel',
				groupLight: 'Hell',
				groupOther: 'Andere',
				pageTitle: 'Themes durchsuchen',
				noThemesFound: 'Keine Themes gefunden',
				toggleColorsLabel: 'Farben'
			}
		};
		return map[locale];
	}

	private async _sendInit() {
		if (!this._view) return;
		const themes = await this._themesProvider.getAllThemes();
		const favorites = getFavorites();
		const active = vscode.workspace.getConfiguration('workbench').get<string>('colorTheme', '');
		this._view.webview.postMessage({
			command: 'init',
			themes,
			favorites,
			activeTheme: active,
			strings: this.getWebviewStrings()
		});
	}

	/**
	 * Exposed refresh method so external callers can request an update.
	 */
	public async refresh(): Promise<void> {
		await this._sendInit();
	}

	/**
	 * Erzeugt das HTML/CSS/JS für die Webview.
	 */
	private _getHtmlForWebview(webview: vscode.Webview): string {
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
  flex-wrap: wrap;
}

#search { 
  flex: 1;
  min-width: 150px;
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

.filters {
  display: flex;
  gap: 6px;
  flex-wrap: nowrap;
}

.filter-btn {
  padding: 4px 10px;
  border-radius: 3px;
  border: 1px solid var(--vscode-editorWidget-border);
  background: transparent;
  color: var(--vscode-editor-foreground);
  cursor: pointer;
  font-size: 0.85em;
  transition: all 0.15s;
  white-space: nowrap;
}

.filter-btn:hover {
  background: var(--vscode-list-hoverBackground);
}

.filter-btn.active {
  background: var(--vscode-button-background);
  color: var(--vscode-button-foreground);
  border-color: var(--vscode-button-background);
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
  margin-left: auto;
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
  background: transparent;
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

.theme-swatch.hidden {
  display: none;
}

.theme-swatch-color {
  background: #1e1e1e;
  border-radius: 2px;
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

.btn.star { 
  color: var(--vscode-terminal-ansiYellow); 
  font-weight: 700; 
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
  <div class="filters" id="filters"></div>
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
let currentFilter = 'all';
let showSwatches = false;
let themeMap = {}; // Map to store full theme objects for preview
let strings = {
	searchPlaceholder: 'Search themes...',
	filterAll: 'All',
	filterDark: 'Dark',
	filterLight: 'Light',
	groupDark: 'Dark',
	groupLight: 'Light',
	groupOther: 'Other',
	pageTitle: 'Themes',
	noThemesFound: 'No themes found'
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

function setActive(name) { activeTheme = name || ''; render(); }
function updateFavorites(list) { favorites = list || []; render(); }

function categorizeTheme(t) {
	if (!t || typeof t !== 'object') return 'unknown';
	const ui = (t.uiTheme || '').toLowerCase();
	const label = (t.label || '').toLowerCase();
	
	// Check uiTheme first
	if (ui.includes('dark')) return 'dark';
	if (ui.includes('vs') || ui.includes('light')) return 'light';
	
	// Fallback: check theme name for known dark variants (Catppuccin, etc.)
	if (label && (label.includes('dark') || label.includes('frappe') || label.includes('mocha'))) return 'dark';
	if (label && (label.includes('light') || label.includes('latte'))) return 'light';
	
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

function filterThemesByType(list, type) {
	if (type === 'all') return list;
	return list.filter(t => {
		const kind = categorizeTheme(t);
		return kind === type;
	});
}

function render() {
	try {
		const q = document.getElementById('search').value.trim().toLowerCase();
		let filtered = themes.filter(t => !q || (t && t.label && t.label.toLowerCase().includes(q)));
		filtered = filterThemesByType(filtered, currentFilter);
		
		if (!filtered || filtered.length === 0) {
		  document.getElementById('groups').innerHTML = '<div id="noItems">' + strings.noThemesFound + '</div>';
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
				if (!t || !t.label) continue;
				const active = isSameTheme(t.label, activeTheme);
				const item = document.createElement('div');
				item.className = 'themeItem' + (active ? ' active' : '');
				const left = document.createElement('div');
				left.className = 'left';
				
				// Create color swatch with 5 dominant theme colors
				const swatch = document.createElement('div');
				swatch.className = 'theme-swatch';
				if (!showSwatches) swatch.classList.add('hidden');
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
				const star = document.createElement('button');
				star.className = 'btn star';
				star.innerText = favorites.includes(t.label) ? '★' : '☆';
				star.onclick = (e) => { e.stopPropagation(); vscode.postMessage({ command: 'toggleFavorite', name: t.label }); };
				item.onclick = () => { vscode.postMessage({ command: 'applyTheme', name: t.label }); };
				right.appendChild(star);
				item.appendChild(left);
				item.appendChild(right);
				itemsContainer.appendChild(item);
			}
			groupEl.appendChild(itemsContainer);
			container.appendChild(groupEl);
		}
	} catch (e) {
		document.getElementById('groups').innerHTML = '<div id="noItems">Error rendering themes: ' + String(e) + '</div>';
	}
}

function updateFilterButtons() {
	const filtersContainer = document.getElementById('filters');
	filtersContainer.innerHTML = '';
	const filters = [
		{ key: 'all', label: strings.filterAll },
		{ key: 'dark', label: strings.filterDark },
		{ key: 'light', label: strings.filterLight }
	];
	for (const f of filters) {
		const btn = document.createElement('button');
		btn.className = 'filter-btn' + (currentFilter === f.key ? ' active' : '');
		btn.textContent = f.label;
		btn.setAttribute('data-filter', f.key);
		btn.onclick = () => {
			currentFilter = f.key;
			updateFilterButtons();
			render();
		};
		filtersContainer.appendChild(btn);
	}
}

function updateUI() {
	document.getElementById('search').placeholder = strings.searchPlaceholder;
	document.getElementById('toggleSwatchesLabel').textContent = strings.toggleColorsLabel;
	document.title = strings.pageTitle;
	updateFilterButtons();
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
 case 'favoritesUpdated': updateFavorites(msg.favorites || []); break;
 case 'activeThemeChanged': setActive(msg.activeTheme || ''); break;
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

document.getElementById('preview-modal').addEventListener('click', (e) => {
	if (e.target.id === 'preview-modal') closePreview();
});
document.addEventListener('keydown', (e) => {
	if (e.key === 'Escape') closePreview();
});

vscode.postMessage({ command: 'initRequest' });
</script>
</body>
</html>`;
	}
}

function escapeHtml(str: string): string {
    return str.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' } as any)[c]);
}

/** Helper: nonce erzeugen */
function getNonce() {
	let text = '';
	const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	for (let i = 0; i < 32; i++) {
		text += possible.charAt(Math.floor(Math.random() * possible.length));
	}
	return text;
}
