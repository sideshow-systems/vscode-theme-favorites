import * as vscode from 'vscode';

/**
	* Schlüssel für die Speicherung der Favoriten in `globalState`.
	*/
const FAVORITES_KEY = 'favoriteThemes';

function normalizeThemeName(name: string): string {
	if (!name) return '';
	return name
		.toLowerCase()
		.normalize('NFKD')
		.replace(/[\u0300-\u036f]/g, '')
		.replace(/\s+/g, ' ')
		.trim()
		.replace(/[^a-z0-9 ]/g, '');
}

function isSameTheme(a: string, b: string): boolean {
	const na = normalizeThemeName(a);
	const nb = normalizeThemeName(b);
	if (!na || !nb) return false;
	if (na === nb) return true;
	// fallback: one contains the other (avoid very short matches)
	if ((na.includes(nb) || nb.includes(na)) && Math.min(na.length, nb.length) >= 3) return true;
	return false;
}

/**
  * Ein Theme‑Eintrag in der "All Themes" View.
  */
export class ThemeItem extends vscode.TreeItem {
	constructor(public readonly label: string, public readonly favorited: boolean, public readonly active: boolean) {
		super(label, vscode.TreeItemCollapsibleState.None);
		this.tooltip = label;
		this.description = active ? 'Active' : '';
		if (active) {
			this.iconPath = new vscode.ThemeIcon('check');
		}
		this.contextValue = favorited ? 'favorited' : 'notFavorited';
		this.command = {
			command: 'themeFavorites.openTheme',
			title: 'Apply Theme',
			arguments: [label]
		};
	}
}

/**
  * Provider für die vollständige Liste der installierten Themes.
  */
export class ThemesProvider implements vscode.TreeDataProvider<ThemeItem> {
	private _onDidChangeTreeData: vscode.EventEmitter<ThemeItem | undefined | void> = new vscode.EventEmitter();
	readonly onDidChangeTreeData: vscode.Event<ThemeItem | undefined | void> = this._onDidChangeTreeData.event;

	/**
	 * @param _context ExtensionContext (privat, mit Unterstrich)
	 */
	constructor(private _context: vscode.ExtensionContext) { }

	/**
	 * Löst ein Update der View aus.
	 */
	refresh(): void {
		this._onDidChangeTreeData.fire();
	}

	getTreeItem(element: ThemeItem): vscode.TreeItem {
		return element;
	}

	async getChildren(): Promise<ThemeItem[]> {
		const favs = this._context.globalState.get<string[]>(FAVORITES_KEY, []);
		const active = vscode.workspace.getConfiguration('workbench').get<string>('colorTheme', '');
		const set = new Set<string>();
		for (const ext of vscode.extensions.all) {
			const contributes = ext.packageJSON && ext.packageJSON.contributes;
			const themes = contributes && contributes.themes;
			if (!themes) continue;
			for (const t of themes) {
				const label = typeof t === 'string' ? t : (t.label ?? t.id ?? t.path);
				if (label) set.add(label);
			}
		}
		const themes = Array.from(set).sort((a, b) => a.localeCompare(b));
		return themes.map(t => new ThemeItem(t, favs.includes(t), isSameTheme(t, active)));
	}
}
