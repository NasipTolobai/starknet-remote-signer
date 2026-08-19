/**
 * Signature-shaping helpers for Starknet accounts driven by a remote signer.
 *
 * Everything here is pure and dependency-free so it can be unit-tested without
 * a chain, a provider, or a signing service.
 */

/** Hex string with the `0x` prefix. */
export type Hex = `0x${string}`;

/**
 * A STARK signature split into its two felt components.
 */
export interface StarkSignatureParts {
  r: Hex;
  s: Hex;
}

/**
 * Normalise a felt to the zero-padded 64-hex-char form a remote signer expects.
 *
 * This is not cosmetic. Helpers like `num.toHex` drop leading zeros, and a
 * remote signer that hashes the string it receives will then sign a different
 * pre-image than the one starknet.js puts into the transaction. The account
 * contract rejects the result with `Account: invalid signature`, and the bug is
 * intermittent — it only shows up for hashes that happen to start with a zero
 * byte, i.e. roughly one call in 256.
 */
export function toPaddedFelt(value: string | bigint): Hex {
  return `0x${BigInt(value).toString(16).padStart(64, '0')}`;
}

/**
 * Split a concatenated `r || s` signature into its parts.
 *
 * Remote signing services commonly return the signature as a single hex blob
 * of 128 characters (two 32-byte felts). Anything else is a protocol mismatch
 * we would rather fail loudly on than pass to the account contract.
 */
export function splitConcatenatedSignature(signature: string): StarkSignatureParts {
  const stripped = signature.startsWith('0x') ? signature.slice(2) : signature;
  if (stripped.length !== 128) {
    throw new Error(
      `Unexpected remote signature length: got ${stripped.length} hex chars, expected 128 (r||s).`,
    );
  }
  if (!/^[0-9a-fA-F]+$/.test(stripped)) {
    throw new Error('Remote signature is not valid hex.');
  }
  return {
    r: `0x${stripped.slice(0, 64)}`,
    s: `0x${stripped.slice(64, 128)}`,
  };
}

/**
 * Build the signature array an Argent v0.4 account expects from a single
 * Starknet-signer owner with no guardian.
 *
 * The account stores its owner as an `Array<SignerSignature>`, so the full
 * layout is five felts:
 *
 *   [ array_len = 1,
 *     SignerSignature::Starknet variant tag = 0,
 *     StarknetSigner.pubkey,
 *     r,
 *     s ]
 *
 * The two-felt "concise" form `[r, s]` is accepted for `__validate__` on an
 * already-deployed account, because the contract can read the owner from
 * storage. It does NOT work for `__validate_deploy__`: during deployment there
 * is no storage to read from yet, so the public key has to travel inside the
 * signature. Emitting the full form everywhere means the same signer works for
 * the counterfactual deploy and for every call afterwards.
 */
export function toArgentV04Signature(publicKey: string, parts: StarkSignatureParts): string[] {
  return [
    '0x1',
    '0x0',
    `0x${BigInt(publicKey).toString(16)}`,
    parts.r,
    parts.s,
  ];
}
