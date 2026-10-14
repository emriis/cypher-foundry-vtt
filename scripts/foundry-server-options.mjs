/** Prepare the disposable Node server without modifying installation settings. */

/**
 * Return arguments for the isolated Foundry server used by Playwright.
 * The user-data directory belongs to the runner; activation metadata is copied
 * there separately. Arguments remain an array so paths containing spaces are safe.
 * @param {{port: number, worldId: string, userDataPath: string}} options Owned test environment.
 * @returns {string[]} Foundry command-line arguments, excluding its entry point.
 */
export function foundryServerArguments({ port, worldId, userDataPath }) {
  return [
    "--port=" + port,
    "--noupnp",
    // Local tests need no public invitation URL. Foundry 14.369 can vend world
    // data before slow external discovery populates its invitation addresses.
    // Official flag: https://foundryvtt.com/article/configuration/
    "--noipdiscovery",
    "--noupdate",
    "--world=" + worldId,
    "--dataPath=" + userDataPath
  ];
}
