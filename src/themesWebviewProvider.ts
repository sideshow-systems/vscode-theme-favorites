import * as vscode from 'vscode';
import { ThemesProvider } from './themesProvider';

/**
 * Schlüssel für Favoriten in globalState.
 */
const FAVORITES_KEY = 'favoriteThemes';

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
								vscode.window.showInformationMessage(`Theme gewechselt: ${message.name}`);
							}
							break;
						case 'toggleFavorite':
							if (!message.name) break;
							const favs = this._context.globalState.get<string[]>(FAVORITES_KEY, []);
							if (favs.includes(message.name)) {
								const newFavs = favs.filter(f => f !== message.name);
								await this._context.globalState.update(FAVORITES_KEY, newFavs);
							} else {
								favs.push(message.name);
								await this._context.globalState.update(FAVORITES_KEY, favs);
							}
							// refresh internal provider state
							this._themesProvider.refresh();
							// notify this webview
							const updatedFavs = this._context.globalState.get<string[]>(FAVORITES_KEY, []);
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
			const msg = `Fehler beim Initialisieren der Theme-Webview: ${err}`;
			this._out?.appendLine(msg);
			// Fallback-HTML, damit die View etwas zeigt statt "kein Datenanbieter"
			try {
				webviewView.webview.html = `<div style="padding:12px;font-family:system-ui;">Fehler beim Laden der Theme‑Ansicht.<br>${escapeHtml(String(err))}</div>`;
			} catch (e) {
				// ignore
			}
		}
	}

	/**
	 * Sendet die initialen Daten (Themes, Favoriten, aktives Theme) an das Webview.
	 */
	private async _sendInit() {
		if (!this._view) return;
		const themes = await this._themesProvider.getAllThemes();
		const favorites = this._context.globalState.get<string[]>(FAVORITES_KEY, []);
		const active = vscode.workspace.getConfiguration('workbench').get<string>('colorTheme', '');
		this._view.webview.postMessage({ command: 'init', themes, favorites, activeTheme: active });
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
<title>Themes</title>
<style>
body { font-family: var(--vscode-font-family); color: var(--vscode-editor-foreground); background: var(--vscode-editor-background); padding: 8px; }
.header { display:flex; gap:8px; align-items:center; margin-bottom:8px; }
#search { flex:1; padding:6px 8px; border-radius:4px; border:1px solid var(--vscode-editorWidget-border); background:var(--vscode-input-background); color:var(--vscode-input-foreground); }
.group { margin-top:10px; }
.group h3 { margin:6px 0; font-size:0.95em; color:var(--vscode-editor-foreground); }
.themeItem { display:flex; align-items:center; justify-content:space-between; padding:6px 8px; border-radius:4px; margin:2px 0; background:transparent; cursor:pointer; }
.themeItem.active { outline: 2px solid var(--vscode-focusBorder); }
.group h3 { font-weight: 600; font-size: 1.05em; margin-bottom:6px; }
#content { background-color: rgba(255,255,255,0.03); padding:8px; border-radius:6px; }
.themeItem .left { display:flex; gap:8px; align-items:center; }
.themeItem .label { font-size:0.95em; }
.themeItem .meta { font-size:0.8em; color:var(--vscode-editorHint-foreground); }
.btn { background:transparent; border:none; color:var(--vscode-editor-foreground); cursor:pointer; }
.btn.star { color: var(--vscode-button-foreground); }
</style>
</head>
<body>
<div class="header">
<input id="search" placeholder="Search themes..." />
<button id="refresh" class="btn">Refresh</button>
</div>
<div id="content">
<div id="groups"></div>
</div>
<script nonce="${nonce}">
const vscode = acquireVsCodeApi();
let themes = [];
let favorites = [];
let activeTheme = '';

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
	if (!na || !nb) return false;
	if (na === nb) return true;
	if ((na.includes(nb) || nb.includes(na)) && Math.min(na.length, nb.length) >= 3) return true;
	return false;
}

function setActive(name) { activeTheme = name || ''; render(); }
function updateFavorites(list) { favorites = list || []; render(); }

function groupThemes(list) {
	const groups = { dark: [], light: [], unknown: [] };
	for (const t of list) {
		const ui = (t.uiTheme || '').toLowerCase();
		const kind = ui.includes('dark') ? 'dark' : (ui.includes('vs') || ui.includes('light') ? 'light' : 'unknown');
		groups[kind].push(t);
	}
	return groups;
}

function render() {
	const q = document.getElementById('search').value.trim().toLowerCase();
	const groups = groupThemes(themes);
	const container = document.getElementById('groups');
	container.innerHTML = '';
	for (const key of ['dark','light','unknown']) {
		const arr = groups[key]; if (!arr || arr.length === 0) continue;
		const groupEl = document.createElement('div'); groupEl.className = 'group';
		const title = document.createElement('h3'); title.textContent = key === 'dark' ? 'Dark' : (key === 'light' ? 'Light' : 'Other'); groupEl.appendChild(title);
		for (const t of arr) {
			if (q && !t.label.toLowerCase().includes(q)) continue;
			const active = isSameTheme(t.label, activeTheme);
			const item = document.createElement('div'); item.className = 'themeItem' + (active ? ' active' : '');
			const left = document.createElement('div'); left.className = 'left';
			const lbl = document.createElement('div'); lbl.className = 'label'; lbl.textContent = t.label;
			const meta = document.createElement('div'); meta.className = 'meta'; meta.textContent = t.extDisplay || t.extId || '';
			left.appendChild(lbl); left.appendChild(meta);
			const right = document.createElement('div');
			const star = document.createElement('button'); star.className = 'btn star'; star.innerText = favorites.includes(t.label) ? '★' : '☆';
			star.onclick = (e) => { e.stopPropagation(); vscode.postMessage({ command: 'toggleFavorite', name: t.label }); };
			item.onclick = () => { vscode.postMessage({ command: 'applyTheme', name: t.label }); };
			right.appendChild(star);
			item.appendChild(left); item.appendChild(right);
			groupEl.appendChild(item);
		}
		container.appendChild(groupEl);
	}
}

window.addEventListener('message', event => {
 const msg = event.data;
 switch (msg.command) {
 case 'init': themes = msg.themes || []; favorites = msg.favorites || []; activeTheme = msg.activeTheme || ''; render(); break;
 case 'favoritesUpdated': updateFavorites(msg.favorites || []); break;
 case 'activeThemeChanged': setActive(msg.activeTheme || ''); break;
 }
});

document.getElementById('search').addEventListener('input', () => render());
document.getElementById('refresh').addEventListener('click', () => vscode.postMessage({ command: 'refresh' }));

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
