const SUPPORTED_PREFIXES = [
  { countryCode: "SG", prefix: "+65" },
  { countryCode: "TR", prefix: "+90" },
  { countryCode: "UA", prefix: "+380" },
  { countryCode: "AE", prefix: "+971" },
];

export function normalizePhoneE164(value: string) {
  const trimmed = value.trim();
  const compact = trimmed.replace(/[\s().-]/g, "");
  const normalized = compact.startsWith("00")
    ? `+${compact.slice(2)}`
    : compact;

  if (!/^\+[1-9]\d{7,14}$/.test(normalized)) {
    throw new Error("Phone number must be in E.164 format");
  }

  return normalized;
}

export function supportedPhoneCountry(phoneE164: string) {
  return SUPPORTED_PREFIXES.find((item) => phoneE164.startsWith(item.prefix)) ??
    null;
}

export function assertSupportedPhoneCountry(phoneE164: string) {
  const country = supportedPhoneCountry(phoneE164);
  if (!country) {
    throw new Error(
      "Phone verification currently supports UAE, Turkey, Singapore, and Ukraine numbers",
    );
  }

  return country.countryCode;
}

export function maskPhone(phoneE164: string) {
  if (phoneE164.length <= 6) return phoneE164;
  return `${phoneE164.slice(0, 4)}***${phoneE164.slice(-3)}`;
}
