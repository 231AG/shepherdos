/**
 * SMS segment maths. GSM-7 messages fit 160 characters in one segment (153
 * per segment when split); anything outside GSM-7 switches the whole message
 * to Unicode: 70 characters (67 per segment when split).
 */
const GSM_BASIC =
  "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà";
const GSM_EXTENDED = "^{}\\[~]|€\f";

export interface SmsCount {
  encoding: "GSM-7" | "Unicode";
  /** Characters as the network counts them (extended GSM chars count twice). */
  units: number;
  segments: number;
  perSegment: number;
  remaining: number;
  /** Characters that forced Unicode, for a helpful hint. */
  unicodeChars: string[];
}

export function countSms(text: string): SmsCount {
  let units = 0;
  const unicodeChars: string[] = [];
  for (const ch of text) {
    if (GSM_BASIC.includes(ch)) units += 1;
    else if (GSM_EXTENDED.includes(ch)) units += 2;
    else if (!unicodeChars.includes(ch)) unicodeChars.push(ch);
  }
  if (unicodeChars.length) {
    const n = [...text].length;
    const per = n <= 70 ? 70 : 67;
    const segments = n === 0 ? 0 : Math.ceil(n / per);
    return { encoding: "Unicode", units: n, segments, perSegment: per, remaining: segments * per - n, unicodeChars };
  }
  const per = units <= 160 ? 160 : 153;
  const segments = units === 0 ? 0 : Math.ceil(units / per);
  return { encoding: "GSM-7", units, segments, perSegment: per, remaining: segments * per - units, unicodeChars };
}
