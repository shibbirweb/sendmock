export type SmtpReplyClass = "2xx" | "3xx" | "4xx" | "5xx";

export type SmtpTranscriptLine = {
  speaker: "client" | "server" | "note";
  text: string;
  /** Server replies only, e.g. 250. */
  replyCode: number | null;
  replyClass: SmtpReplyClass | null;
  /** The placeholder SendMock writes instead of the DATA content. */
  isMessagePlaceholder: boolean;
};

const replyCodePattern = /^([2-5])\d\d[ -]/;

function parseTranscriptLine(transcriptLine: string): SmtpTranscriptLine {
  if (transcriptLine.startsWith("S: ")) {
    const replyText = transcriptLine.slice(3);
    const replyMatch = replyText.match(replyCodePattern);

    return {
      speaker: "server",
      text: replyText,
      replyCode: replyMatch ? Number(replyText.slice(0, 3)) : null,
      replyClass: replyMatch ? (`${replyMatch[1]}xx` as SmtpReplyClass) : null,
      isMessagePlaceholder: false,
    };
  }

  if (transcriptLine.startsWith("C: ")) {
    const commandText = transcriptLine.slice(3);

    return {
      speaker: "client",
      text: commandText,
      replyCode: null,
      replyClass: null,
      isMessagePlaceholder: commandText.startsWith("[message "),
    };
  }

  return {
    speaker: "note",
    text: transcriptLine,
    replyCode: null,
    replyClass: null,
    isMessagePlaceholder: false,
  };
}

/**
 * Splits a stored transcript (`C: ` client and `S: ` server lines) into
 * lines the viewer can colour (EM-09.4); other lines are notes such as a
 * dropped connection.
 */
export function parseSmtpTranscript(transcript: string): SmtpTranscriptLine[] {
  return transcript
    .split("\n")
    .filter((transcriptLine) => transcriptLine.trim() !== "")
    .map(parseTranscriptLine);
}
