import * as vscode from 'vscode';
import * as path from 'path';
import { getFavorites } from './favoritesUtils';

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
	return na === nb;
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
		const favs = getFavorites();
		const active = vscode.workspace.getConfiguration('workbench').get<string>('colorTheme', '');

		// Root: return groups (dark, light, other)
		if (!element) {
			return [
				new GroupItem('Dark Themes', 'dark'),
				new GroupItem('Light Themes', 'light'),
				new GroupItem('Other Themes', 'unknown')
			];
		}

		// Helper: try to determine kind from parsed theme entry (colors > uiTheme > name)
		function determineKind(entry: { label: string; uiTheme?: string; colors?: { [k: string]: string } }): 'dark' | 'light' | 'unknown' {
			// Prefer explicit editor.background color when available
			try {
				const bg = entry.colors && (entry.colors['editor.background'] || entry.colors['editorBackground']);
				if (bg && typeof bg === 'string') {
					const rgb = parseColor(bg);
					if (rgb) {
						const lum = Math.round((rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000);
						return lum > 128 ? 'light' : 'dark';
					}
				}
			} catch (e) { /* ignore parse errors */ }
			// Fallback to uiTheme
			const ui = (entry.uiTheme || '').toLowerCase();
			if (ui.includes('dark')) return 'dark';
			if (ui.includes('vs') || ui.includes('light')) return 'light';
			// Fallback: inspect label heuristics
			const lab = entry.label.toLowerCase();
			if (lab.includes('dark') || lab.includes('frappe') || lab.includes('mocha')) return 'dark';
			if (lab.includes('light') || lab.includes('latte')) return 'light';
			return 'unknown';
		}

		function parseColor(input: string): { r: number; g: number; b: number } | null {
			if (!input || typeof input !== 'string') return null;
			const s = input.trim().toLowerCase();
			// hex formats
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
			// rgb/rgba
			const rgbMatch = s.match(/rgba?\(([^)]+)\)/);
			if (rgbMatch) {
				const parts = rgbMatch[1].split(',').map(p => p.trim());
				if (parts.length >= 3) {
					const parsePart = (p: string) => p.endsWith('%') ? Math.round(parseFloat(p) * 2.55) : Math.round(parseFloat(p));
					const r = parsePart(parts[0]);
					const g = parsePart(parts[1]);
					const b = parsePart(parts[2]);
					if (!Number.isNaN(r) && !Number.isNaN(g) && !Number.isNaN(b)) return { r, g, b };
				}
			}
			return null;
		}

		if (element instanceof GroupItem) {
			const all = await this.getAllThemes();
			const items = all.filter(t => determineKind(t) === element.kind).sort((a, b) => a.label.localeCompare(b.label));
			return items.map(i => {
				const item = new ThemeItem(i.label, favs.includes(i.label), isSameTheme(i.label, active));
				item.tooltip = `${i.label}\nFrom: ${i.extDisplay ?? i.extId}\nuiTheme: ${i.uiTheme ?? 'unknown'}`;
				if (i.extId) {
					// icon handled in getAllThemes as file path not returned here, keep existing behavior minimal
				}
				return item;
			});
		}

		return [];
	  }

	/**
	 * Liefert eine flache Liste aller Themes (ohne Gruppierung).
	 * Wird z.B. von QuickPick‑Befehlen genutzt.
	 */
	async getAllThemes(): Promise<Array<{ label: string; uiTheme?: string; extDisplay?: string; extId?: string; colors?: { [k: string]: string } }>> {
		const set = new Map<string, { label: string; uiTheme?: string; extDisplay?: string; extId?: string; colors?: { [k: string]: string } }>();
		for (const ext of vscode.extensions.all) {
			const contributes = ext.packageJSON && ext.packageJSON.contributes;
			const themes = contributes && contributes.themes;
			if (!themes) continue;
			for (const t of themes) {
				const label = typeof t === 'string' ? t : (t.label ?? t.id ?? t.path);
				const uiTheme = typeof t === 'object' ? (t.uiTheme as string | undefined) : undefined;
				if (!label) continue;
				if (!set.has(label)) {
					const entry: { label: string; uiTheme?: string; extDisplay?: string; extId?: string; colors?: { [k: string]: string } } = { label, uiTheme, extDisplay: ext.packageJSON && (ext.packageJSON.displayName || ext.packageJSON.name), extId: ext.id };
					// Extrahiere alle Farben aus der Theme-Datei
					try {
						const themePath = typeof t === 'object' && (t.path || t.file) ? path.join(ext.extensionPath, (t.path || t.file)) : undefined;
						if (themePath) {
							const uri = vscode.Uri.file(themePath);
							const bytes = await vscode.workspace.fs.readFile(uri);
							const raw = Buffer.from(bytes).toString('utf8');
							let parsed: any = undefined;
							if (raw && raw.trim().startsWith('{')) {
								try { parsed = JSON.parse(raw); } catch (e) { parsed = undefined; }
							}
							if (parsed && parsed.colors && typeof parsed.colors === 'object') {
								entry.colors = parsed.colors as { [k: string]: string };
							}
						}
					} catch (e) {
						// ignore read/parse errors — colors bleibt undefined
					}
					set.set(label, entry);
				}
			}
		}
		return Array.from(set.values()).sort((a, b) => a.label.localeCompare(b.label));
	}
}
