//! # RFC 6238 Time-Based One-Time Password (TOTP) Generator
//! Pure Web Crypto API implementation (Zero heavy external dependencies)

export class TotpGenerator {
  /**
   * Decodes a standard RFC 4648 Base32 string into a Uint8Array.
   */
  static base32ToBytes(base32: string): Uint8Array {
    const cleanBase32 = base32.toUpperCase().replace(/[\s-]/g, "").replace(/=+$/, "");
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
    let bits = 0;
    let value = 0;
    const output: number[] = [];

    for (let i = 0; i < cleanBase32.length; i++) {
      const idx = alphabet.indexOf(cleanBase32[i]);
      if (idx === -1) continue;

      value = (value << 5) | idx;
      bits += 5;

      if (bits >= 8) {
        output.push((value >>> (bits - 8)) & 255);
        bits -= 8;
      }
    }

    return new Uint8Array(output);
  }

  /**
   * Generates a 6-digit TOTP code from a Base32 Secret Key for the current or specified timestamp.
   */
  static async generateCode(
    secret: string,
    timestampMs = Date.now(),
    digits = 6,
    periodSeconds = 30
  ): Promise<string> {
    if (!secret || secret.trim().length === 0) return "";

    try {
      const keyBytes = this.base32ToBytes(secret);
      if (keyBytes.length === 0) return "";

      const epochSeconds = Math.floor(timestampMs / 1000);
      const counter = Math.floor(epochSeconds / periodSeconds);

      // 8-byte big-endian counter buffer
      const counterBuffer = new ArrayBuffer(8);
      const counterView = new DataView(counterBuffer);
      counterView.setUint32(4, counter, false); // Lower 32 bits

      // Import HMAC key using Web Crypto API
      const cryptoKey = await window.crypto.subtle.importKey(
        "raw",
        keyBytes.buffer as ArrayBuffer,
        { name: "HMAC", hash: "SHA-1" },
        false,
        ["sign"]
      );

      // Sign counter buffer
      const signature = await window.crypto.subtle.sign("HMAC", cryptoKey, counterBuffer);
      const hmacResult = new Uint8Array(signature);

      // Dynamic Truncation (RFC 4226)
      const offset = hmacResult[hmacResult.length - 1] & 0x0f;
      const binaryCode =
        ((hmacResult[offset] & 0x7f) << 24) |
        ((hmacResult[offset + 1] & 0xff) << 16) |
        ((hmacResult[offset + 2] & 0xff) << 8) |
        (hmacResult[offset + 3] & 0xff);

      const otp = binaryCode % Math.pow(10, digits);
      return otp.toString().padStart(digits, "0");
    } catch (err) {
      console.warn("TOTP generation failed:", err);
      return "";
    }
  }

  /**
   * Returns remaining seconds until the current 30s TOTP window expires.
   */
  static getRemainingSeconds(timestampMs = Date.now(), periodSeconds = 30): number {
    const epochSeconds = Math.floor(timestampMs / 1000);
    return periodSeconds - (epochSeconds % periodSeconds);
  }
}
