export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";

  for (let index = 0; index < bytes.length; index += 1) {
    const byte = bytes[index];

    if (byte === undefined) {
      throw new Error("Cannot encode sparse byte array.");
    }

    binary += String.fromCharCode(byte);
  }

  return btoa(binary);
}
