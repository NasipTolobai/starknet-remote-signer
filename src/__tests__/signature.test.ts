import { describe, expect, it } from 'vitest';
import {
  splitConcatenatedSignature,
  toArgentV04Signature,
  toPaddedFelt,
} from '../signature.js';

const R = 'a'.repeat(64);
const S = 'b'.repeat(64);

describe('toPaddedFelt', () => {
  it('pads a short hash to 64 hex chars', () => {
    expect(toPaddedFelt('0x1')).toBe(`0x${'0'.repeat(63)}1`);
  });

  it('preserves a hash that is already full width', () => {
    const full = `0x${'f'.repeat(64)}`;
    expect(toPaddedFelt(full)).toBe(full);
  });

  it('accepts a bigint', () => {
    expect(toPaddedFelt(255n)).toBe(`0x${'0'.repeat(62)}ff`);
  });

  it('is what stops a leading-zero hash from being signed short', () => {
    // The failure this guards against: a hash whose top byte is zero renders
    // as 62 hex chars, the remote signer hashes that shorter string, and the
    // account rejects the signature.
    const leadingZero = `0x00${'1'.repeat(62)}`;
    expect(toPaddedFelt(leadingZero)).toHaveLength(66);
  });
});

describe('splitConcatenatedSignature', () => {
  it('splits r||s with the 0x prefix', () => {
    expect(splitConcatenatedSignature(`0x${R}${S}`)).toEqual({
      r: `0x${R}`,
      s: `0x${S}`,
    });
  });

  it('splits r||s without the prefix', () => {
    expect(splitConcatenatedSignature(`${R}${S}`)).toEqual({
      r: `0x${R}`,
      s: `0x${S}`,
    });
  });

  it('rejects a signature of the wrong length', () => {
    expect(() => splitConcatenatedSignature('0xdeadbeef')).toThrow(/expected 128/);
  });

  it('rejects non-hex input', () => {
    expect(() => splitConcatenatedSignature(`0x${'z'.repeat(128)}`)).toThrow(/not valid hex/);
  });
});

describe('toArgentV04Signature', () => {
  it('emits the five-felt Array<SignerSignature> layout', () => {
    const sig = toArgentV04Signature('0x1234', { r: `0x${R}`, s: `0x${S}` });
    expect(sig).toEqual(['0x1', '0x0', '0x1234', `0x${R}`, `0x${S}`]);
  });

  it('normalises a zero-padded public key back to its short form', () => {
    // The account stores the owner as a felt; the padded and unpadded spellings
    // are the same value, and the contract compares values, not strings.
    const sig = toArgentV04Signature(`0x${'0'.repeat(60)}1234`, { r: `0x${R}`, s: `0x${S}` });
    expect(sig[2]).toBe('0x1234');
  });
});
