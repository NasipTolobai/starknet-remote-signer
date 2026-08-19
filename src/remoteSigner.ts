import { Signer, type Signature } from 'starknet';
import {
  splitConcatenatedSignature,
  toArgentV04Signature,
  toPaddedFelt,
  type Hex,
} from './signature.js';

/**
 * Signs a pre-computed message hash somewhere this process cannot reach —
 * a TEE, an HSM, an MPC network, a hardware wallet.
 *
 * Return either the concatenated `0x{r}{s}` blob most services produce, or the
 * two felts separately if your service already splits them.
 */
export type RemoteSignFn = (msgHash: Hex) => Promise<string | { r: string; s: string }>;

export interface RemoteStarknetSignerOptions {
  /** The account owner's STARK public key, as a hex felt. */
  publicKey: string;
  /** Delegate that performs the actual signing. */
  sign: RemoteSignFn;
}

/**
 * A `starknet.js` Signer whose private key does not exist in this process.
 *
 * The base `Signer` already knows how to build every transaction, deploy and
 * typed-data hash Starknet defines; the only thing it needs a key for is the
 * final `signRaw` step. Overriding `signRaw` and `getPubKey` — and nothing
 * else — keeps all of starknet.js's hashing logic and swaps out only the part
 * that touches key material. Everything downstream (`Account.execute`,
 * `deployAccount`, paymaster flows, `signMessage`) works unchanged.
 *
 * The emitted signature uses the Argent v0.4 `Array<SignerSignature>` layout,
 * which is valid both during counterfactual deployment and for ordinary calls.
 */
export class RemoteStarknetSigner extends Signer {
  protected readonly publicKey: string;
  private readonly remoteSign: RemoteSignFn;

  constructor(options: RemoteStarknetSignerOptions) {
    // The base class requires a key. This one is never used: both methods that
    // would read it are overridden below.
    super('0x1');
    this.publicKey = options.publicKey;
    this.remoteSign = options.sign;
  }

  override async getPubKey(): Promise<string> {
    return this.publicKey;
  }

  protected override async signRaw(msgHash: string): Promise<Signature> {
    // Pad before handing the hash over: see `toPaddedFelt` for why an unpadded
    // felt silently produces an invalid signature.
    const padded = toPaddedFelt(msgHash);
    const result = await this.remoteSign(padded);
    const parts =
      typeof result === 'string'
        ? splitConcatenatedSignature(result)
        : {
            r: toPaddedFelt(result.r),
            s: toPaddedFelt(result.s),
          };
    return toArgentV04Signature(this.publicKey, parts);
  }
}
