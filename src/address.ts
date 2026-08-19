import {
  CairoCustomEnum,
  CairoOption,
  CairoOptionVariant,
  CallData,
  hash,
  num,
} from 'starknet';

/**
 * Argent account contract v0.4 class hash on Starknet mainnet.
 *
 * Pinned deliberately: the address of a counterfactual account is derived from
 * the class hash, so changing this value changes where every existing user's
 * funds live. Treat it as part of your data model, not as configuration.
 */
export const ARGENT_V04_CLASS_HASH =
  '0x036078334509b514626504edc9fb252328d1a240e4e948bef8d0c08dff45927f';

/**
 * Constructor calldata for an Argent v0.4 account owned by a single Starknet
 * signer, with no guardian.
 */
export function argentV04ConstructorCalldata(publicKey: string): string[] {
  const owner = new CairoCustomEnum({ Starknet: { pubkey: num.toHex(publicKey) } });
  const guardian = new CairoOption<unknown>(CairoOptionVariant.None);
  return CallData.compile({ owner, guardian });
}

export interface ArgentV04AddressOptions {
  /** Deployment salt. Defaults to the public key, which makes the address deterministic. */
  salt?: string;
  /** Override only if you deploy a different account class. */
  classHash?: string;
}

/**
 * Compute the address an Argent v0.4 account will have once deployed.
 *
 * The address exists before the contract does: you can receive funds at it,
 * and deploy the account later out of those same funds (counterfactual
 * deployment). Using the public key as the salt makes the mapping
 * key → address deterministic, so the address can always be re-derived from
 * the signer alone with nothing else stored.
 *
 * The result is zero-padded to 64 hex chars. Starknet treats `0x05ab…` and
 * `0x5ab…` as the same felt, but string comparisons in your database do not —
 * pick one canonical form and this returns it.
 */
export function computeArgentV04Address(
  publicKey: string,
  options: ArgentV04AddressOptions = {},
): string {
  const pubKey = num.toHex(publicKey);
  const address = hash.calculateContractAddressFromHash(
    options.salt ?? pubKey,
    options.classHash ?? ARGENT_V04_CLASS_HASH,
    argentV04ConstructorCalldata(pubKey),
    0, // deployer address 0 — the account deploys itself
  );
  return `0x${BigInt(address).toString(16).padStart(64, '0')}`;
}
