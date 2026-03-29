import * as vscode from 'vscode';
import { ThemesProvider } from './themesProvider';

const FAVORITES_KEY = 'favoriteThemes';

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
                            const favs = this._context.globalState.get<string[]>(FAVORITES_KEY, []);
                            const newFavs = favs.filter(f => f !== msg.name);
                            await this._context.globalState.update(FAVORITES_KEY, newFavs);
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

    private async _sendInit() {
        if (!this._view) return;
        const all = await this._themesProvider.getAllThemes();
        const favorites = this._context.globalState.get<string[]>(FAVORITES_KEY, []);
        const favItems = all.filter(t => favorites.includes(t.label));
        const active = vscode.workspace.getConfiguration('workbench').get<string>('colorTheme', '');
        this._view.webview.postMessage({
            command: 'init',
            themes: favItems,
            favorites,
            activeTheme: active,
            strings: {
                groupDark: 'Dark',
                groupLight: 'Light',
                groupOther: 'Other',
                removeButton: 'Remove',
                pageTitle: 'Favorites'
            }
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
body { font-family: var(--vscode-font-family); color: var(--vscode-editor-foreground); background: var(--vscode-editor-background); padding: 8px; }
.themeItem:hover { background: var(--vscode-list-hoverBackground); }
.themeItem.active { outline: 2px solid var(--vscode-focusBorder); background: var(--vscode-list-activeSelectionBackground); box-shadow: 0 0 0 1px var(--vscode-focusBorder); }
#content { background-color: rgba(255,255,255,0.03); padding:8px; border-radius:6px; }
.group h3 { font-weight: 600; font-size: 1.05em; margin-bottom:6px; }
.themeItem { display:flex; align-items:center; justify-content:space-between; padding:6px 8px; border-radius:4px; margin:2px 0; cursor:pointer; }
.themeItem .left { display:flex; gap:8px; align-items:center; }
.label { font-size:0.95em; }
.meta { font-size:0.8em; color:var(--vscode-editorHint-foreground); }
.btn { background:transparent; border:none; color:var(--vscode-editor-foreground); cursor:pointer; }
</style>
</head>
<body>
<div id="content">
<div id="groups"></div>
</div>
<script nonce="${nonce}">
const vscode = acquireVsCodeApi();
let themes = [];
let favorites = [];
let activeTheme = '';
let strings = {
    groupDark: 'Dark',
    groupLight: 'Light',
    groupOther: 'Other',
    removeButton: 'Remove',
    pageTitle: 'Favorites'
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
 const container = document.getElementById('groups'); container.innerHTML = '';
 const groups = groupThemes(themes);
 for (const key of ['dark','light','unknown']) {
    const arr = groups[key]; if (!arr || arr.length === 0) continue;
    const groupEl = document.createElement('div'); groupEl.className = 'group';
    const title = document.createElement('h3');
    title.textContent = key === 'dark' ? strings.groupDark : (key === 'light' ? strings.groupLight : strings.groupOther);
    groupEl.appendChild(title);
    for (const t of arr) {
        const active = isSameTheme(t.label, activeTheme);
        const item = document.createElement('div'); item.className = 'themeItem' + (active ? ' active' : '');
        const left = document.createElement('div'); left.className = 'left';
        const lbl = document.createElement('div'); lbl.className = 'label'; lbl.textContent = t.label;
        const meta = document.createElement('div'); meta.className = 'meta'; meta.textContent = t.extDisplay || t.extId || '';
        left.appendChild(lbl); left.appendChild(meta);
        const right = document.createElement('div');
        const btn = document.createElement('button'); btn.className = 'btn'; btn.innerText = strings.removeButton;
        btn.onclick = (e) => { e.stopPropagation(); vscode.postMessage({ command: 'removeFavorite', name: t.label }); };
        item.onclick = () => { vscode.postMessage({ command: 'openTheme', name: t.label }); };
        right.appendChild(btn);
        item.appendChild(left); item.appendChild(right);
        groupEl.appendChild(item);
    }
    container.appendChild(groupEl);
 }
}

function updateUI() {
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
  case 'favoritesUpdated': favorites = msg.favorites || []; render(); break;
 }
});

vscode.postMessage({ command: 'initRequest' });
</script>
</body>
</html>`;
    }
}

function getNonce() { let text = ''; const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'; for (let i = 0; i < 32; i++) text += possible.charAt(Math.floor(Math.random() * possible.length)); return text; }
