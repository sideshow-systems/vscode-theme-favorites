import * as vscode from 'vscode';
import { ThemesProvider } from './themesProvider';
import { ThemesWebviewProvider } from './themesWebviewProvider';
import { FavoritesWebviewProvider } from './favoritesWebviewProvider';
import { getFavorites, setFavorites } from './favoritesUtils';

/**
 * Legacy-Schlüssel für die Speicherung in globalState (für Migration).
 */
const FAVORITES_KEY_LEGACY = 'favoriteThemes';

/**
 * Schlüssel für die Speicherung der Favoriten in der Configuration (mit Settings Sync).
 */
const FAVORITES_CONFIG_KEY = 'themeFavorites.favorites';

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
 * Migriert alte Favoriten aus globalState zu den neuen Settings.
 */
async function migrateFavoritesIfNeeded(context: vscode.ExtensionContext): Promise<void> {
	const migratedKey = 'themeFavorites.migrated';
	
	// Überprüfe, ob die Migration bereits durchgeführt wurde
	if (context.globalState.get<boolean>(migratedKey)) {
		return;
	}

	// Versuche, alte Favoriten aus globalState zu laden
	const legacyFavorites = context.globalState.get<string[]>(FAVORITES_KEY_LEGACY, []);
	if (legacyFavorites.length > 0) {
		// Migriere alte Favoriten zu den neuen Settings
		await setFavorites(legacyFavorites);
	}

	// Markiere die Migration als durchgeführt
	await context.globalState.update(migratedKey, true);
}

/**
  * Aktivierung der Extension: Provider und Commands registrieren.
  */
export function activate(context: vscode.ExtensionContext) {
	const themesProvider = new ThemesProvider(context);

	// Output channel for diagnostics
	const out = vscode.window.createOutputChannel('Theme Favorites');
	out.appendLine('Activating Theme Favorites extension...');
	context.subscriptions.push(out);

	// Migration durchführen
	migrateFavoritesIfNeeded(context).catch(e => {
		out.appendLine(`Migration failed: ${e}`);
	});

	const favoritesWebview = new FavoritesWebviewProvider(context.extensionUri, context, themesProvider, out);
	const themesWebview = new ThemesWebviewProvider(context.extensionUri, context, themesProvider, out, async () => {
		try { await favoritesWebview.refresh(); } catch (e) { out.appendLine(`favoritesWebview.refresh() failed: ${e}`); }
	});

	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(FavoritesWebviewProvider.viewType, favoritesWebview, { webviewOptions: { retainContextWhenHidden: true } }),
		vscode.window.registerWebviewViewProvider(ThemesWebviewProvider.viewType, themesWebview, { webviewOptions: { retainContextWhenHidden: true } })
	);
	out.appendLine('Registered FavoritesWebviewProvider and ThemesWebviewProvider');

	context.subscriptions.push(
        vscode.commands.registerCommand('themeFavorites.addFavorite', async (arg?: any) => {
			const name = getName(arg);
			if (name) {
				await addFavorite(context, name, favoritesWebview, themesProvider);
				return;
			}
			const all = await themesProvider.getAllThemes();
			const favs = getFavorites();
			const choices = all.filter(t => !favs.includes(t.label)).map(t => t.label);
			const pick = await vscode.window.showQuickPick(choices, { placeHolder: 'Theme wählen, um als Favorit hinzuzufügen' });
			if (!pick) return;
			await addFavorite(context, pick, favoritesWebview, themesProvider);
		}),

		vscode.commands.registerCommand('themeFavorites.removeFavorite', async (arg?: any) => {
			const name = getName(arg);
			if (name) {
				await removeFavorite(context, name, favoritesWebview, themesProvider);
				return;
			}
			const favs = getFavorites();
			if (!favs || favs.length === 0) { vscode.window.showInformationMessage('No favorites available'); return; }
			const pick = await vscode.window.showQuickPick(favs, { placeHolder: 'Favorit entfernen' });
			if (!pick) return;
			await removeFavorite(context, pick, favoritesWebview, themesProvider);
		}),

		vscode.commands.registerCommand('themeFavorites.toggleFavorite', async (arg?: any) => {
			const name = getName(arg);
			if (!name) return;
			const favs = getFavorites();
			if (favs.includes(name)) {
				await removeFavorite(context, name, favoritesWebview, themesProvider);
			} else {
				await addFavorite(context, name, favoritesWebview, themesProvider);
			}
		}),

		vscode.commands.registerCommand('themeFavorites.openTheme', async (arg?: any) => {
			const name = getName(arg);
			if (!name) return;
			await vscode.workspace.getConfiguration('workbench').update('colorTheme', name, vscode.ConfigurationTarget.Global);
			await favoritesWebview.refresh();
			themesWebview.refresh();
			vscode.window.showInformationMessage(`Theme changed: ${name}`);
		}),

		vscode.commands.registerCommand('themeFavorites.refresh', async () => {
			await favoritesWebview.refresh();
			themesWebview.refresh();
			vscode.window.showInformationMessage('Theme Favorites refreshed');
		})
	);

	// Refresh views when the user changes the color theme externally
	context.subscriptions.push(
		vscode.workspace.onDidChangeConfiguration(e => {
			if (e.affectsConfiguration && e.affectsConfiguration('workbench.colorTheme')) {
				favoritesWebview.refresh();
				themesWebview.refresh();
			}
		})
	);
	
	// Refresh views when theme favorites configuration changes
	context.subscriptions.push(
		vscode.workspace.onDidChangeConfiguration(e => {
			if (e.affectsConfiguration(FAVORITES_CONFIG_KEY)) {
				favoritesWebview.refresh();
				themesWebview.refresh();
			}
		})
	);
}

/**
  * Favorit hinzufügen und Views aktualisieren.
  */
async function addFavorite(context: vscode.ExtensionContext, name: string, favoritesWebview: any, themesProvider: ThemesProvider) {
	const favs = getFavorites();
	if (!favs.includes(name)) {
		favs.push(name);
		await setFavorites(favs);
		try { await favoritesWebview.refresh(); } catch (e) { /* ignore */ }
		themesProvider.refresh();
		vscode.window.showInformationMessage(`Favorite added: ${name}`);
	} else {
		vscode.window.showInformationMessage(`${name} is already a favorite`);
	}
}

/**
  * Favorit entfernen und Views aktualisieren.
  */
async function removeFavorite(context: vscode.ExtensionContext, name: string, favoritesWebview: any, themesProvider: ThemesProvider) {
	const favs = getFavorites();
	const newFavs = favs.filter(f => f !== name);
	await setFavorites(newFavs);
	try { await favoritesWebview.refresh(); } catch (e) { /* ignore */ }
	try {
		await vscode.commands.executeCommand('themeFavorites.refresh');
	} catch (e) {
		try { themesProvider.refresh(); } catch (_) { /* ignore */ }
	}
	vscode.window.showInformationMessage(`Favorite removed: ${name}`);
}

export function deactivate() { }

