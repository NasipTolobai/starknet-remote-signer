import { describe, expect, it, vi } from 'vitest';
import { RemoteStarknetSigner } from '../remoteSigner.js';
import { computeArgentV04Address } from '../address.js';

// Obviously synthetic, and deliberately starts with a zero byte: that is the
// case where dropping leading zeros would change what gets signed.
const PUBKEY = `0x00${'abc123'.repeat(10)}ab`;
const R = 'a'.repeat(64);
const S = 'b'.repeat(64);

/** Exposes the protected `signRaw` so the layout can be asserted directly. */
class TestSigner extends RemoteStarknetSigner {
  signRawPublic(msgHash: string) {
    return this.signRaw(msgHash);
  }
}

describe('RemoteStarknetSigner', () => {
  it('reports the public key it was constructed with', async () => {
    const signer = new RemoteStarknetSigner({
      publicKey: PUBKEY,
      sign: async () => `0x${R}${S}`,
    });
    await expect(signer.getPubKey()).resolves.toBe(PUBKEY);
  });

  it('hands the remote signer a zero-padded hash', async () => {
    const sign = vi.fn(async () => `0x${R}${S}`);
    const signer = new TestSigner({ publicKey: PUBKEY, sign });

    await signer.signRawPublic('0x1');

    expect(sign).toHaveBeenCalledWith(`0x${'0'.repeat(63)}1`);
  });

  it('produces the Argent v0.4 layout from a concatenated signature', async () => {
    const signer = new TestSigner({ publicKey: PUBKEY, sign: async () => `0x${R}${S}` });

    // The pubkey felt comes back in its short form: the contract compares
    // values, and `0x02f0…` and `0x2f0…` are the same felt.
    await expect(signer.signRawPublic(`0x${'1'.repeat(64)}`)).resolves.toEqual([
      '0x1',
      '0x0',
      `0x${BigInt(PUBKEY).toString(16)}`,
      `0x${R}`,
      `0x${S}`,
    ]);
  });

  it('accepts a remote signer that returns r and s separately', async () => {
    const signer = new TestSigner({
      publicKey: PUBKEY,
      sign: async () => ({ r: '0x1', s: '0x2' }),
    });

    const sig = (await signer.signRawPublic('0x5')) as string[];
    expect(sig[3]).toBe(`0x${'0'.repeat(63)}1`);
    expect(sig[4]).toBe(`0x${'0'.repeat(63)}2`);
  });

  it('surfaces a malformed remote signature instead of passing it on-chain', async () => {
    const signer = new TestSigner({ publicKey: PUBKEY, sign: async () => '0xdead' });
    await expect(signer.signRawPublic('0x5')).rejects.toThrow(/expected 128/);
  });
});

describe('computeArgentV04Address', () => {
  it('is deterministic for a given public key', () => {
    expect(computeArgentV04Address(PUBKEY)).toBe(computeArgentV04Address(PUBKEY));
  });

  it('returns a canonical 64-hex-char address', () => {
    expect(computeArgentV04Address(PUBKEY)).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it('gives different keys different addresses', () => {
    expect(computeArgentV04Address(PUBKEY)).not.toBe(computeArgentV04Address('0x123'));
  });
});
