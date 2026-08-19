# starknet-remote-signer

[![CI](https://github.com/NasipTolobai/starknet-remote-signer/actions/workflows/ci.yml/badge.svg)](https://github.com/NasipTolobai/starknet-remote-signer/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)

A [`starknet.js`](https://github.com/starknet-io/starknet.js) `Signer` whose private key never exists in your process.

The key stays in a TEE, an HSM, or an MPC network. This package handles the part
that is easy to get subtly wrong: turning a remote `r || s` blob into a signature
an **Argent v0.4** account actually accepts — including during counterfactual
deployment, where the naive form fails.

Extracted from [Twin Wallet](https://t.me/twinwallet_bot), a non-custodial wallet
running on Starknet mainnet where every user account is an Argent v0.4 contract
and nobody has a seed phrase.

```bash
npm install starknet-remote-signer starknet
```

## Why this exists

Building a non-custodial Starknet wallet without a seed phrase means the signing
key lives somewhere your code can't reach. `starknet.js` supports this already —
`Signer.signRaw` is the one method that touches key material, and everything else
in the class is hash construction you want to keep. So the integration is small.

Getting it *correct* is where the time goes. Two failures cost us days each:

**1. An unpadded hash produces a valid-looking, invalid signature.**
`num.toHex` drops leading zeros. Hand that shortened string to a remote signer
that hashes what it receives, and it signs a different pre-image than the one
starknet.js puts in the transaction. The account rejects with
`Account: invalid signature`. The bug is intermittent — it only fires when the
hash happens to start with a zero byte, so roughly one call in 256 fails while
everything else works.

**2. The concise `[r, s]` signature form does not survive deployment.**
It works for `__validate__` on a deployed account, because the contract reads the
owner from storage. During `__validate_deploy__` there is no storage yet, so the
public key has to travel inside the signature. Argent v0.4 stores its owner as an
`Array<SignerSignature>`, and the layout that works everywhere is five felts:

```
[ 1,          // array length
  0,          // SignerSignature::Starknet variant tag
  pubkey,
  r,
  s ]
```

Emit that and the same signer covers the counterfactual deploy and every call
afterwards.

## Usage

### With Privy

```ts
import { Account, RpcProvider } from 'starknet';
import { PrivyStarknetSigner, computeArgentV04Address } from 'starknet-remote-signer';
import { useSignRawHash } from '@privy-io/react-auth/extended-chains';

const { signRawHash } = useSignRawHash();

const signer = new PrivyStarknetSigner({
  privyAddress: wallet.address, // Privy reports the STARK public key here
  signRawHash,
});

const provider = new RpcProvider({ nodeUrl: RPC_URL });
const address = computeArgentV04Address(wallet.address);
const account = new Account(provider, address, signer);

// From here it is ordinary starknet.js.
await account.execute([{ contractAddress: USDC, entrypoint: 'transfer', calldata }]);
```

### With any other remote signer

```ts
import { RemoteStarknetSigner } from 'starknet-remote-signer';

const signer = new RemoteStarknetSigner({
  publicKey,
  // Return either "0x{r}{s}" or { r, s }.
  sign: async (msgHash) => myEnclave.sign(msgHash),
});
```

### Counterfactual deployment

The address exists before the contract does. Fund it, then deploy the account out
of those same funds — with a paymaster, the user never needs the gas token at all.

```ts
import {
  ARGENT_V04_CLASS_HASH,
  argentV04ConstructorCalldata,
  computeArgentV04Address,
} from 'starknet-remote-signer';

const address = computeArgentV04Address(publicKey);

await account.deployAccount({
  classHash: ARGENT_V04_CLASS_HASH,
  constructorCalldata: argentV04ConstructorCalldata(publicKey),
  addressSalt: publicKey,
  contractAddress: address,
});
```

## API

| Export | What it does |
|---|---|
| `RemoteStarknetSigner` | `starknet.js` Signer delegating `signRaw` to your service |
| `PrivyStarknetSigner` | Adapter for Privy's `signRawHash`; no Privy SDK dependency |
| `computeArgentV04Address` | Deterministic account address from a public key |
| `argentV04ConstructorCalldata` | Constructor calldata: single Starknet owner, no guardian |
| `ARGENT_V04_CLASS_HASH` | Pinned mainnet class hash |
| `toArgentV04Signature` | Build the five-felt `Array<SignerSignature>` layout |
| `splitConcatenatedSignature` | Split `r \|\| s`, failing loudly on a malformed blob |
| `toPaddedFelt` | Zero-pad a felt to 64 hex chars before remote signing |

## Scope and limits

- Covers the **single Starknet owner, no guardian** case. Guardians, multisig
  owners, and non-Starknet signer types (Secp256k1, WebAuthn) are not handled.
- Tested against `starknet@^9`. Earlier majors may work; we don't test them.
- Pins the Argent v0.4 mainnet class hash. Pass `classHash` explicitly for
  another account class — the address derivation is generic, the signature
  layout is not.
- No audit. This is integration code, not a contract: it shapes signatures and
  derives addresses, and every value it produces is verified on-chain by the
  account contract before anything moves. Read it before you trust it.

## Contributing

Issues and PRs welcome, particularly around guardian support and other signer
variants. If you hit a signature-validation failure this package doesn't explain,
open an issue with the hash and the layout you emitted — that class of bug is
miserable to debug alone and worth documenting for the next person.

MIT.
