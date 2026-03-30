import * as vscode from 'vscode';

/**
 * Schlüssel für die Speicherung der Favoriten in der Configuration (mit Settings Sync).
 */
const FAVORITES_CONFIG_KEY = 'themeFavorites.favorites';

/**
 * Lädt die Favoriten aus der Konfiguration (mit Settings Sync Unterstützung).
 */
export function getFavorites(): string[] {
	const config = vscode.workspace.getConfiguration();
	return config.get<string[]>(FAVORITES_CONFIG_KEY, []);
}

/**
 * Speichert die Favoriten in der Konfiguration (mit Settings Sync Unterstützung).
 */
export async function setFavorites(favorites: string[]): Promise<void> {
	const config = vscode.workspace.getConfiguration();
	await config.update(FAVORITES_CONFIG_KEY, favorites, vscode.ConfigurationTarget.Global);
}
