# Security

## What this package does and does not touch

This package never sees, generates, stores, or transmits a private key. It does
three things:

1. Normalises a message hash before handing it to your remote signer.
2. Reshapes the `r, s` the signer returns into the array layout an Argent v0.4
   account expects.
3. Derives the deterministic address of an account from its public key.

Every value it produces is validated on-chain by the account contract before
anything moves. A bug here makes transactions fail, not funds leave.

## Known failure modes it guards against

- **Unpadded felts.** A hash whose leading byte is zero renders shorter than 64
  hex chars. A remote signer that hashes the string it receives then signs a
  different pre-image than the one in the transaction, and the account rejects
  it. Intermittent by nature — roughly one call in 256.
- **Malformed remote signatures.** A signature that is not exactly 128 hex chars
  throws instead of being passed on to the account.
- **Deploy-time validation.** The concise `[r, s]` form validates for calls on a
  deployed account but not for `__validate_deploy__`. This package always emits
  the full five-felt form, which is valid for both.

## Scope limits you should know before relying on it

- Handles the **single Starknet owner, no guardian** case only. Guardian,
  multisig, Secp256k1 and WebAuthn signer variants are not implemented — do not
  assume they silently work.
- The Argent v0.4 mainnet class hash is pinned. Deriving addresses against a
  different class hash without passing it explicitly will produce addresses your
  users' funds are not at.
- Not audited. It is integration code, not a smart contract, but read it before
  you put money behind it.

## Reporting a vulnerability

Open a GitHub issue for anything that only causes failed transactions.

For anything you believe could cause loss of funds, do not open a public issue —
use GitHub's private vulnerability reporting on this repository instead. We will
acknowledge within 72 hours.
