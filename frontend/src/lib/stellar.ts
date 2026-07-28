import {
  Contract,
  SorobanRpc,
  TransactionBuilder,
  scValToNative,
  xdr,
} from "@stellar/stellar-sdk";
import {
  isConnected as freighterIsConnected,
  requestAccess as freighterRequestAccess,
  getNetwork as freighterGetNetwork,
} from "@stellar/freighter-api";
import { SOROBAN_RPC_URL, STELLAR_NETWORK_PASSPHRASE } from "./constants";

/**
 * Module-level singleton — created once, reused on every subsequent call.
 * Keeping a single instance avoids the overhead of re-establishing the
 * HTTP connection on every RPC call.
 */
let _server: SorobanRpc.Server | null = null;

/**
 * Returns a memoized {@link SorobanRpc.Server} pointed at the configured
 * {@link SOROBAN_RPC_URL}.  The instance is created on the first call and
 * the same object is returned on every subsequent call.
 *
 * @example
 * const server = getServer();
 * const account = await server.getAccount(publicKey);
 */
export function getServer(): SorobanRpc.Server {
  if (!_server) {
    _server = new SorobanRpc.Server(SOROBAN_RPC_URL, {
      allowHttp: SOROBAN_RPC_URL.startsWith("http://"),
    });
  }
  return _server;
}

/**
 * Heuristic for turning a Freighter API error (or thrown value) into a
 * user-facing message. Freighter v3 returns `{ error: { code, message } }`
 * objects rather than throwing, but older paths / the extension bridge can
 * still throw, so we handle both.
 */
function describeFreighterError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("lock")) {
    return "Your Freighter wallet is locked. Please unlock it and try again.";
  }
  if (
    lower.includes("reject") ||
    lower.includes("denied") ||
    lower.includes("declined") ||
    lower.includes("cancel")
  ) {
    return "Connection request was rejected in Freighter.";
  }
  return message;
}

/**
 * Trigger the Freighter authorization popup and return the connected wallet's
 * public key and network.
 *
 * Throws descriptive {@link Error}s for the common failure modes so the UI can
 * catch and display them:
 * - Freighter extension not installed / not detected
 * - wallet locked
 * - user rejected the access request
 *
 * @returns the connected account's `publicKey` and its `network` label
 */
export async function connectFreighter(): Promise<{
  publicKey: string;
  network: string;
}> {
  // 1. Detect the extension. `isConnected` reports whether Freighter is
  //    installed and reachable in the current browser.
  let connected: { isConnected: boolean; error?: { message: string } };
  try {
    connected = await freighterIsConnected();
  } catch {
    throw new Error(
      "Freighter wallet extension is not installed or could not be detected."
    );
  }
  if (connected?.error) {
    throw new Error(
      "Freighter wallet extension is not installed or could not be detected."
    );
  }
  if (!connected?.isConnected) {
    throw new Error(
      "Freighter wallet extension is not installed or could not be detected."
    );
  }

  // 2. Request access — this opens the authorization popup.
  let access: { address: string; error?: { message: string } };
  try {
    access = await freighterRequestAccess();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(describeFreighterError(msg));
  }
  if (access?.error) {
    throw new Error(describeFreighterError(access.error.message));
  }
  if (!access?.address) {
    throw new Error("Freighter did not return a public key.");
  }

  // 3. Fetch the active network.
  let network = "";
  try {
    const net = await freighterGetNetwork();
    if (!net?.error && net?.network) {
      network = net.network;
    }
  } catch {
    // Network is best-effort; a missing network shouldn't block a successful
    // connection. Leave it empty rather than failing the whole flow.
  }

  return { publicKey: access.address, network };
}

/**
 * Read-only contract simulation helper.
 *
 * Builds a transaction that invokes `method(...args)` on `contractId`, submits
 * it to the RPC's `simulateTransaction`, and decodes the return value to a
 * native JS value. No signing or submission occurs, so `sourceAddress` only
 * needs to be a real (loadable) account — it never signs anything.
 *
 * @throws Error when the simulation fails or returns no value.
 */
export async function simulateContractCall(
  contractId: string,
  method: string,
  args: xdr.ScVal[],
  sourceAddress: string
): Promise<unknown> {
  const server = getServer();
  const contract = new Contract(contractId);
  const account = await server.getAccount(sourceAddress);

  const tx = new TransactionBuilder(account, {
    fee: "100",
    networkPassphrase: STELLAR_NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(30)
    .build();

  const result = await server.simulateTransaction(tx);

  if (SorobanRpc.Api.isSimulationError(result)) {
    throw new Error(`Simulation failed for ${method}: ${result.error}`);
  }

  if (!result.result?.retval) {
    throw new Error(`No return value from simulation of ${method}`);
  }

  return scValToNative(result.result.retval);
}
