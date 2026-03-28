import * as vscode from 'vscode';

/**
  * Schlüssel für die Speicherung der Favoriten in `globalState`.
  */
const FAVORITES_KEY = 'favoriteThemes';

/**
  * Einzelner Favorit‑Eintrag in der TreeView.
  */
export class FavoriteItem extends vscode.TreeItem {
	/**
	 * @param label Anzeige-Name des Themes
	 * @param active Ob das Theme aktuell aktiv ist
	 */
	constructor(public readonly label: string, public readonly active: boolean) {
		super(label, vscode.TreeItemCollapsibleState.None);
		this.tooltip = label;
		this.description = active ? 'Active' : '';
		if (active) {
			this.iconPath = new vscode.ThemeIcon('check');
		}
		this.contextValue = 'favoriteItem';
		this.command = {
			command: 'themeFavorites.openTheme',
			title: 'Apply Theme',
			arguments: [label]
		};
	}
}

/**
  * Provider für die Favoriten‑TreeView.
  */
export class FavoritesProvider implements vscode.TreeDataProvider<FavoriteItem> {
	private _onDidChangeTreeData: vscode.EventEmitter<FavoriteItem | undefined | void> = new vscode.EventEmitter();
	readonly onDidChangeTreeData: vscode.Event<FavoriteItem | undefined | void> = this._onDidChangeTreeData.event;

	/**
	 * @param _context ExtensionContext (als privates Feld mit Unterstrich)
	 */
	constructor(private _context: vscode.ExtensionContext) { }

	/**
	 * Refresh löst ein Neuladen der View aus.
	 */
	refresh(): void {
		this._onDidChangeTreeData.fire();
	}

	getTreeItem(element: FavoriteItem): vscode.TreeItem {
		return element;
	}

	getChildren(): Thenable<FavoriteItem[]> {
		const favs = this._context.globalState.get<string[]>(FAVORITES_KEY, []);
		const active = vscode.workspace.getConfiguration('workbench').get<string>('colorTheme', '');
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
			if ((na.includes(nb) || nb.includes(na)) && Math.min(na.length, nb.length) >= 3) return true;
			return false;
		}
		return Promise.resolve((favs || []).map(f => new FavoriteItem(f, isSameTheme(f, active))));
	}
}
