import { RemoteStarknetSigner } from './remoteSigner.js';
import type { Hex } from './signature.js';

/**
 * The shape of Privy's raw-hash signing call, as exposed by both
 * `@privy-io/react-auth` on the client and `@privy-io/server-auth` on the
 * server. Typed structurally so this package does not depend on either SDK.
 */
export type PrivySignRawHash = (input: {
  address: string;
  chainType: 'starknet';
  hash: Hex;
}) => Promise<{ signature: Hex }>;

export interface PrivyStarknetSignerOptions {
  /**
   * The Privy wallet address for the Starknet chain type. For Starknet wallets
   * Privy reports the STARK public key here, which is also what the Argent
   * account contract stores as its owner — so this value doubles as the public
   * key unless you pass one explicitly.
   */
  privyAddress: string;
  /** Override if your setup separates the Privy address from the public key. */
  publicKey?: string;
  /** `signRawHash` from the Privy SDK. */
  signRawHash: PrivySignRawHash;
}

/**
 * A `starknet.js` Signer backed by Privy's TEE.
 *
 * The private key is generated and used inside Privy's enclave and never
 * reaches the browser, the server, or the user — there is no seed phrase to
 * show, back up, or lose. What this class adds is the translation layer:
 * starknet.js hashes, Privy signs, and the result is reshaped into the
 * signature array an Argent v0.4 account accepts.
 */
export class PrivyStarknetSigner extends RemoteStarknetSigner {
  constructor(options: PrivyStarknetSignerOptions) {
    const { privyAddress, signRawHash } = options;
    super({
      publicKey: options.publicKey ?? privyAddress,
      sign: async (hash) => {
        const { signature } = await signRawHash({
          address: privyAddress,
          chainType: 'starknet',
          hash,
        });
        return signature;
      },
    });
  }
}
