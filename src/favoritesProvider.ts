import * as vscode from 'vscode';
import * as path from 'path';
import { getFavorites } from './favoritesUtils';

/**
 * Einzelner Favorit‑Eintrag in der TreeView.
 */
export class FavoriteItem extends vscode.TreeItem {
	/**
	 * @param label Anzeige-Name des Themes
	 * @param active Ob das Theme aktuell aktiv ist
	 */
	constructor(
		public readonly label: string,
		public readonly active: boolean
	) {
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
			arguments: [label],
		};
	}
}

export class GroupItem extends vscode.TreeItem {
	constructor(
		public readonly label: string,
		public readonly kind: 'dark' | 'light' | 'unknown'
	) {
		super(label, vscode.TreeItemCollapsibleState.Collapsed);
		this.contextValue = 'group';
	}
}

/**
 * Provider für die Favoriten‑TreeView.
 */
export type FavoriteNode = FavoriteItem | GroupItem;

export class FavoritesProvider implements vscode.TreeDataProvider<FavoriteNode> {
	private _onDidChangeTreeData: vscode.EventEmitter<FavoriteNode | undefined | void> =
		new vscode.EventEmitter();
	readonly onDidChangeTreeData: vscode.Event<FavoriteNode | undefined | void> =
		this._onDidChangeTreeData.event;

	/**
	 * @param _context ExtensionContext (als privates Feld mit Unterstrich)
	 */
	constructor(private _context: vscode.ExtensionContext) {}

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
		const favs = getFavorites();
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
			if ((na.includes(nb) || nb.includes(na)) && Math.min(na.length, nb.length) >= 3)
				return true;
			return false;
		}

		function parseColor(input: string): { r: number; g: number; b: number } | null {
			if (!input || typeof input !== 'string') return null;
			const s = input.trim().toLowerCase();
			if (s[0] === '#') {
				const hex = s.substring(1);
				if (hex.length === 3) {
					const r = parseInt(hex[0] + hex[0], 16);
					const g = parseInt(hex[1] + hex[1], 16);
					const b = parseInt(hex[2] + hex[2], 16);
					return { r, g, b };
				}
				if (hex.length === 4) {
					const r = parseInt(hex[0] + hex[0], 16);
					const g = parseInt(hex[1] + hex[1], 16);
					const b = parseInt(hex[2] + hex[2], 16);
					return { r, g, b };
				}
				if (hex.length === 6 || hex.length === 8) {
					const r = parseInt(hex.substring(0, 2), 16);
					const g = parseInt(hex.substring(2, 4), 16);
					const b = parseInt(hex.substring(4, 6), 16);
					return { r, g, b };
				}
			}
			const rgbMatch = s.match(/rgba?\(([^)]+)\)/);
			if (rgbMatch) {
				const parts = rgbMatch[1].split(',').map((p) => p.trim());
				if (parts.length >= 3) {
					const parsePart = (p: string) =>
						p.endsWith('%')
							? Math.round(parseFloat(p) * 2.55)
							: Math.round(parseFloat(p));
					const r = parsePart(parts[0]);
					const g = parsePart(parts[1]);
					const b = parsePart(parts[2]);
					if (!Number.isNaN(r) && !Number.isNaN(g) && !Number.isNaN(b))
						return { r, g, b };
				}
			}
			return null;
		}

		if (!element) {
			return [
				new GroupItem('Dark Favorites', 'dark'),
				new GroupItem('Light Favorites', 'light'),
				new GroupItem('Other Favorites', 'unknown'),
			];
		}

		if (element instanceof GroupItem) {
			const results: FavoriteNode[] = [];
			for (const fav of favs || []) {
				// try to determine kind for this favorite (prefer editor.background color)
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
							// attempt to read theme file and inspect editor.background
							try {
								const themePath =
									typeof t === 'object' && (t.path || t.file)
										? path.join(ext.extensionPath, t.path || t.file)
										: undefined;
								if (themePath) {
									const uri = vscode.Uri.file(themePath);
									const bytes = await vscode.workspace.fs.readFile(uri);
									const raw = Buffer.from(bytes).toString('utf8');
									let parsed: any = undefined;
									if (raw && raw.trim().startsWith('{')) {
										try {
											parsed = JSON.parse(raw);
										} catch (e) {
											parsed = undefined;
										}
									}
									if (
										parsed &&
										parsed.colors &&
										typeof parsed.colors === 'object'
									) {
										const bg =
											parsed.colors['editor.background'] ||
											parsed.colors['editorBackground'];
										if (bg && typeof bg === 'string') {
											const rgb = parseColor(bg);
											if (rgb) {
												const lum = Math.round(
													(rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000
												);
												kind = lum > 128 ? 'light' : 'dark';
											}
										}
									}
								}
							} catch (e) {
								// ignore file read/parse errors
							}
							// fallback to uiTheme if we couldn't determine by color
							if (kind === 'unknown') {
								const uiTheme =
									typeof t === 'object'
										? (t.uiTheme as string | undefined)
										: undefined;
								kind =
									uiTheme && uiTheme.toLowerCase().includes('dark')
										? 'dark'
										: uiTheme &&
											  (uiTheme.toLowerCase().includes('vs') ||
													uiTheme.toLowerCase().includes('light'))
											? 'light'
											: 'unknown';
							}
							extDisplay =
								ext.packageJSON &&
								(ext.packageJSON.displayName || ext.packageJSON.name);
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
						item.iconPath = {
							light: vscode.Uri.file(iconPath),
							dark: vscode.Uri.file(iconPath),
						} as any;
					}
					results.push(item);
				}
			}
			return results;
		}

		return [];
	}
}
