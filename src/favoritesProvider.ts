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
	 */
	constructor(public readonly label: string) {
		super(label, vscode.TreeItemCollapsibleState.None);
		this.tooltip = label;
		this.description = '';
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
		return Promise.resolve((favs || []).map(f => new FavoriteItem(f)));
	}
}
