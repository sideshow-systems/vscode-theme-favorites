import * as vscode from 'vscode';

/**
  * Schlüssel für die Speicherung der Favoriten in `globalState`.
  */
const FAVORITES_KEY = 'favoriteThemes';

/**
  * Ein Theme‑Eintrag in der "All Themes" View.
  */
export class ThemeItem extends vscode.TreeItem {
	constructor(public readonly label: string, public readonly favorited: boolean) {
		super(label, vscode.TreeItemCollapsibleState.None);
		this.tooltip = label;
		this.description = '';
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
		return themes.map(t => new ThemeItem(t, favs.includes(t)));
	}
}
