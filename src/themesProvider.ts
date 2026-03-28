import * as vscode from 'vscode';
import * as path from 'path';

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

export class GroupItem extends vscode.TreeItem {
	constructor(public readonly label: string, public readonly kind: 'dark' | 'light' | 'unknown') {
		super(label, vscode.TreeItemCollapsibleState.Collapsed);
		this.contextValue = 'group';
	}
}

/**
  * Provider für die vollständige Liste der installierten Themes.
  */
export type ThemeNode = ThemeItem | GroupItem;

export class ThemesProvider implements vscode.TreeDataProvider<ThemeNode> {
	private _onDidChangeTreeData: vscode.EventEmitter<ThemeNode | undefined | void> = new vscode.EventEmitter();
	readonly onDidChangeTreeData: vscode.Event<ThemeNode | undefined | void> = this._onDidChangeTreeData.event;

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

	  getTreeItem(element: ThemeNode): vscode.TreeItem {
	    return element;
	  }

	  async getChildren(element?: ThemeNode): Promise<ThemeNode[]> {
		const favs = this._context.globalState.get<string[]>(FAVORITES_KEY, []);
		const active = vscode.workspace.getConfiguration('workbench').get<string>('colorTheme', '');

		// Root: return groups (dark, light, other)
		if (!element) {
			return [
				new GroupItem('Dark Themes', 'dark'),
				new GroupItem('Light Themes', 'light'),
				new GroupItem('Other Themes', 'unknown')
			];
		}

		// If a group was expanded: return themes belonging to that kind
		if (element instanceof GroupItem) {
			const set = new Map<string, { label: string; uiTheme: string | undefined; extDisplay?: string; extId?: string; iconPath?: string | undefined; }>();
			for (const ext of vscode.extensions.all) {
				const contributes = ext.packageJSON && ext.packageJSON.contributes;
				const themes = contributes && contributes.themes;
				if (!themes) continue;
				for (const t of themes) {
					const label = typeof t === 'string' ? t : (t.label ?? t.id ?? t.path);
					const uiTheme = typeof t === 'object' ? (t.uiTheme as string | undefined) : undefined;
					if (!label) continue;
					const kind = uiTheme && uiTheme.toLowerCase().includes('dark') ? 'dark' : (uiTheme && (uiTheme.toLowerCase().includes('vs') || uiTheme.toLowerCase().includes('light')) ? 'light' : 'unknown');
					if (kind !== element.kind) continue;
					if (!set.has(label)) {
						set.set(label, { label, uiTheme, extDisplay: ext.packageJSON && (ext.packageJSON.displayName || ext.packageJSON.name), extId: ext.id, iconPath: ext.packageJSON && ext.packageJSON.icon ? path.join(ext.extensionPath, ext.packageJSON.icon) : undefined });
					}
				}
			}
			const items = Array.from(set.values()).sort((a, b) => a.label.localeCompare(b.label));
			return items.map(i => {
				const item = new ThemeItem(i.label, favs.includes(i.label), isSameTheme(i.label, active));
				// augment tooltip with extension info
				item.tooltip = `${i.label}\nFrom: ${i.extDisplay ?? i.extId}\nuiTheme: ${i.uiTheme ?? 'unknown'}`;
				if (i.iconPath) {
					item.iconPath = { light: vscode.Uri.file(i.iconPath), dark: vscode.Uri.file(i.iconPath) };
				}
				return item;
			});
		}

		return [];
	  }
}
