import * as vscode from 'vscode';
import * as path from 'path';

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

export class GroupItem extends vscode.TreeItem {
	constructor(public readonly label: string, public readonly kind: 'dark' | 'light' | 'unknown') {
		super(label, vscode.TreeItemCollapsibleState.Collapsed);
		this.contextValue = 'group';
	}
}

/**
  * Provider für die Favoriten‑TreeView.
  */
export type FavoriteNode = FavoriteItem | GroupItem;

export class FavoritesProvider implements vscode.TreeDataProvider<FavoriteNode> {
	private _onDidChangeTreeData: vscode.EventEmitter<FavoriteNode | undefined | void> = new vscode.EventEmitter();
	readonly onDidChangeTreeData: vscode.Event<FavoriteNode | undefined | void> = this._onDidChangeTreeData.event;

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

	getTreeItem(element: FavoriteNode): vscode.TreeItem {
		return element;
	}

	async getChildren(element?: FavoriteNode): Promise<FavoriteNode[]> {
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

		if (!element) {
			return [
				new GroupItem('Dark Favorites', 'dark'),
				new GroupItem('Light Favorites', 'light'),
				new GroupItem('Other Favorites', 'unknown')
			];
		}

		if (element instanceof GroupItem) {
			const results: FavoriteNode[] = [];
			for (const fav of (favs || [])) {
				// try to find uiTheme for this favorite
				let kind: 'dark' | 'light' | 'unknown' = 'unknown';
				let extDisplay: string | undefined;
				let iconPath: string | undefined;
				for (const ext of vscode.extensions.all) {
					const contributes = ext.packageJSON && ext.packageJSON.contributes;
					const themes = contributes && contributes.themes;
					if (!themes) continue;
					for (const t of themes) {
						const label = typeof t === 'string' ? t : (t.label ?? t.id ?? t.path);
						if (!label) continue;
						if (isSameTheme(label, fav)) {
							const uiTheme = typeof t === 'object' ? (t.uiTheme as string | undefined) : undefined;
							kind = uiTheme && uiTheme.toLowerCase().includes('dark') ? 'dark' : (uiTheme && (uiTheme.toLowerCase().includes('vs') || uiTheme.toLowerCase().includes('light')) ? 'light' : 'unknown');
							extDisplay = ext.packageJSON && (ext.packageJSON.displayName || ext.packageJSON.name);
							if (ext.packageJSON && ext.packageJSON.icon) {
								iconPath = path.join(ext.extensionPath, ext.packageJSON.icon);
							}
							break;
						}
					}
					if (extDisplay) break;
				}
				if (kind === element.kind) {
					const item = new FavoriteItem(fav, isSameTheme(fav, active));
					item.tooltip = `${fav}\nFrom: ${extDisplay ?? 'unknown'}\nKind: ${kind}`;
					if (iconPath) {
						item.iconPath = { light: vscode.Uri.file(iconPath), dark: vscode.Uri.file(iconPath) } as any;
					}
					results.push(item);
				}
			}
			return results.sort((a, b) => a.label.localeCompare(b.label));
		}

		return [];
	}
}
