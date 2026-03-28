import * as vscode from 'vscode';
import { FavoritesProvider } from './favoritesProvider';
import { ThemesProvider } from './themesProvider';

/**
  * Schlüssel für die Speicherung der Favoriten in `globalState`.
  */
const FAVORITES_KEY = 'favoriteThemes';

/**
  * Hilfsfunktion: extrahiert den Theme‑Namen aus verschiedenen Argument‑Formen.
  */
function getName(arg: any): string | undefined {
	if (!arg) return undefined;
	if (typeof arg === 'string') return arg;
	if (typeof arg.label === 'string') return arg.label;
	return undefined;
}

/**
  * Aktivierung der Extension: Provider und Commands registrieren.
  */
export function activate(context: vscode.ExtensionContext) {
	const favoritesProvider = new FavoritesProvider(context);
	const themesProvider = new ThemesProvider(context);

	const favView = vscode.window.createTreeView('theme-favorites-favorites', { treeDataProvider: favoritesProvider });
	const themesView = vscode.window.createTreeView('theme-favorites-themes', { treeDataProvider: themesProvider });

	context.subscriptions.push(favView, themesView);

	context.subscriptions.push(
		vscode.commands.registerCommand('themeFavorites.addFavorite', async (arg?: any) => {
			const name = getName(arg);
			if (name) {
				await addFavorite(context, name, favoritesProvider, themesProvider);
				return;
			}
			const items = await themesProvider.getChildren();
			const choices = items.filter((i: any) => i.contextValue === 'notFavorited').map((i: any) => i.label as string);
			const pick = await vscode.window.showQuickPick(choices, { placeHolder: 'Theme wählen, um als Favorit hinzuzufügen' });
			if (!pick) return;
			await addFavorite(context, pick, favoritesProvider, themesProvider);
		}),

		vscode.commands.registerCommand('themeFavorites.removeFavorite', async (arg?: any) => {
			const name = getName(arg);
			if (name) {
				await removeFavorite(context, name, favoritesProvider, themesProvider);
				return;
			}
			const items = await favoritesProvider.getChildren();
			const choices = items.map((i: any) => i.label as string);
			const pick = await vscode.window.showQuickPick(choices, { placeHolder: 'Favorit entfernen' });
			if (!pick) return;
			await removeFavorite(context, pick, favoritesProvider, themesProvider);
		}),

		vscode.commands.registerCommand('themeFavorites.toggleFavorite', async (arg?: any) => {
			const name = getName(arg);
			if (!name) return;
			const favs = context.globalState.get<string[]>(FAVORITES_KEY, []);
			if (favs.includes(name)) {
				await removeFavorite(context, name, favoritesProvider, themesProvider);
			} else {
				await addFavorite(context, name, favoritesProvider, themesProvider);
			}
		}),

		vscode.commands.registerCommand('themeFavorites.openTheme', async (arg?: any) => {
			const name = getName(arg);
			if (!name) return;
			await vscode.workspace.getConfiguration('workbench').update('colorTheme', name, vscode.ConfigurationTarget.Global);
			favoritesProvider.refresh();
			themesProvider.refresh();
			vscode.window.showInformationMessage(`Theme gewechselt: ${name}`);
		}),

		vscode.commands.registerCommand('themeFavorites.refresh', () => {
			favoritesProvider.refresh();
			themesProvider.refresh();
			vscode.window.showInformationMessage('Theme Favorites aktualisiert');
		})
	);

	// Refresh views when the user changes the color theme externally
	context.subscriptions.push(
		vscode.workspace.onDidChangeConfiguration(e => {
			if (e.affectsConfiguration && e.affectsConfiguration('workbench.colorTheme')) {
				favoritesProvider.refresh();
				themesProvider.refresh();
			}
		})
	);
}

/**
  * Favorit hinzufügen und Views aktualisieren.
  */
async function addFavorite(context: vscode.ExtensionContext, name: string, favoritesProvider: FavoritesProvider, themesProvider: ThemesProvider) {
	const favs = context.globalState.get<string[]>(FAVORITES_KEY, []);
	if (!favs.includes(name)) {
		favs.push(name);
		await context.globalState.update(FAVORITES_KEY, favs);
		favoritesProvider.refresh();
		themesProvider.refresh();
		vscode.window.showInformationMessage(`Favorit hinzugefügt: ${name}`);
	} else {
		vscode.window.showInformationMessage(`${name} ist bereits Favorit`);
	}
}

/**
  * Favorit entfernen und Views aktualisieren.
  */
async function removeFavorite(context: vscode.ExtensionContext, name: string, favoritesProvider: FavoritesProvider, themesProvider: ThemesProvider) {
	const favs = context.globalState.get<string[]>(FAVORITES_KEY, []);
	const newFavs = favs.filter(f => f !== name);
	await context.globalState.update(FAVORITES_KEY, newFavs);
	favoritesProvider.refresh();
	themesProvider.refresh();
	vscode.window.showInformationMessage(`Favorit entfernt: ${name}`);
}

export function deactivate() { }
