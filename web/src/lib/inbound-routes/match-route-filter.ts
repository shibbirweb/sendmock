import type { InboundRouteFilter } from "@/lib/api/types";

/** The parts of an incoming email a filter reads. */
export type RoutableEmail = {
  recipients: string[];
  headers: Record<string, string[]>;
};

export type RouteFilterMatch =
  | {
      isMatch: true;
      matchedValue: string;
      capturedGroups: Record<string, string>;
    }
  | { isMatch: false };

/**
 * Mailgun patterns are Python regexes matched from the start, case-blind;
 * `(?P<name>...)` named groups become JavaScript's `(?<name>...)`.
 */
export function compileRoutePattern(pattern: string): RegExp | null {
  try {
    return new RegExp(`^(?:${pattern.replaceAll("(?P<", "(?<")})`, "i");
  } catch {
    return null;
  }
}

/** Null when the pattern compiles, else why not. */
export function findPatternError(pattern: string): string | null {
  if (pattern.trim() === "") {
    return "Enter a pattern";
  }

  return compileRoutePattern(pattern) === null
    ? "Not a valid regular expression"
    : null;
}

function matchFirst(
  compiledPattern: RegExp,
  candidateValues: string[],
): RouteFilterMatch {
  for (const candidateValue of candidateValues) {
    const patternMatch = compiledPattern.exec(candidateValue);
    if (patternMatch !== null) {
      return {
        isMatch: true,
        matchedValue: candidateValue,
        capturedGroups: { ...(patternMatch.groups ?? {}) },
      };
    }
  }

  return { isMatch: false };
}

/** Whether a route's filter takes an incoming email, and its named groups (WH-12.1). */
export function matchRouteFilter(
  routeFilter: InboundRouteFilter,
  routableEmail: RoutableEmail,
): RouteFilterMatch {
  if (routeFilter.kind === "catch_all") {
    return {
      isMatch: true,
      matchedValue: routableEmail.recipients[0] ?? "",
      capturedGroups: {},
    };
  }
  const compiledPattern = compileRoutePattern(routeFilter.pattern);
  if (compiledPattern === null) {
    return { isMatch: false };
  }
  if (routeFilter.kind === "match_recipient") {
    return matchFirst(compiledPattern, routableEmail.recipients);
  }
  const headerName = routeFilter.header_name.toLowerCase();
  const headerValues = Object.entries(routableEmail.headers)
    .filter(([candidateName]) => candidateName.toLowerCase() === headerName)
    .flatMap(([, values]) => values);

  return matchFirst(compiledPattern, headerValues);
}

/** `\g<token>` in an action replaced with the captured group. */
export function fillCapturedGroups(
  actionText: string,
  capturedGroups: Record<string, string>,
): string {
  return actionText.replace(
    /\\g<(\w+)>/g,
    (groupToken, groupName: string) => capturedGroups[groupName] ?? groupToken,
  );
}
