// Freighter wallet connection, exposed as Svelte 5 runes state.
import {
  isConnected,
  requestAccess,
  getAddress,
  getNetworkDetails,
  signTransaction as freighterSign,
} from '@stellar/freighter-api';
import { TESTNET_PASSPHRASE } from './contracts';

class WalletState {
  address = $state<string | null>(null);
  connecting = $state(false);
  error = $state<string | null>(null);

  get connected(): boolean {
    return this.address !== null;
  }

  /** Reconnect silently if Freighter already trusts this site. */
  async restore(): Promise<void> {
    try {
      const conn = await isConnected();
      if (!conn.isConnected) return;
      const res = await getAddress();
      if (!res.error && res.address) {
        this.address = res.address;
      }
    } catch {
      // No Freighter installed; the connect button will say so.
    }
  }

  async connect(): Promise<void> {
    this.connecting = true;
    this.error = null;
    try {
      const conn = await isConnected();
      if (conn.error || !conn.isConnected) {
        this.error = 'Freighter not detected — install it from freighter.app';
        return;
      }
      const net = await getNetworkDetails();
      if (!net.error && net.networkPassphrase !== TESTNET_PASSPHRASE) {
        this.error = 'Please switch Freighter to Testnet first.';
        return;
      }
      const access = await requestAccess();
      if (access.error) {
        this.error = access.error.message ?? String(access.error);
        return;
      }
      this.address = access.address;
    } catch (e) {
      this.error = e instanceof Error ? e.message : String(e);
    } finally {
      this.connecting = false;
    }
  }

  disconnect(): void {
    this.address = null;
  }
}

export const wallet = new WalletState();

/** Freighter's signTransaction, adapted to the contract clients' signer shape. */
export async function signTransaction(
  xdr: string,
  opts?: { networkPassphrase?: string; address?: string },
): Promise<{ signedTxXdr: string; signerAddress?: string }> {
  const res = await freighterSign(xdr, {
    networkPassphrase: opts?.networkPassphrase ?? TESTNET_PASSPHRASE,
    address: opts?.address ?? wallet.address ?? undefined,
  });
  if (res.error) {
    throw new Error(res.error.message ?? 'Signing rejected');
  }
  return { signedTxXdr: res.signedTxXdr, signerAddress: res.signerAddress };
}
