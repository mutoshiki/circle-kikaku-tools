export function sameCheckoutContent(left, right) {
  const normalize = input => {
    const bytes = Buffer.from(input);
    if (bytes.includes(0)) return bytes;
    const output = [];
    for (let i = 0; i < bytes.length; i += 1) {
      if (bytes[i] === 13 && bytes[i + 1] === 10) i += 1;
      output.push(bytes[i]);
    }
    return Buffer.from(output);
  };
  return normalize(left).equals(normalize(right));
}
