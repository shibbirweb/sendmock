const channelPrefixPattern = /^[a-z]+:/i;

/** "whatsapp:+8801722222222" -> "+8801722222222"; plain numbers are unchanged. */
export function stripChannelPrefix(phoneAddress: string): string {
  return phoneAddress.replace(channelPrefixPattern, "");
}
