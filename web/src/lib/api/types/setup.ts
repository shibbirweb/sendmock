import type { SeedItemCount } from "@/lib/api/types/system";

/** The text formats a setup file can be written in; all three hold the same structure. */
export type SetupFileFormat = "toml" | "json" | "yaml";

/** How an import treats the configuration the file does not hold. */
export type SetupImportMode = "merge" | "replace";

/** Body of POST /api/v1/setup/export. */
export type SetupExportRequest = {
  /**
   * `toml` (the default), `json` or `yaml`.
   * @example "toml"
   */
  format?: SetupFileFormat | null;
  /**
   * Only these sections, such as `webhook.endpoints`, or groups, such as `webhook`; every section when empty.
   * @example ["webhook", "numbers"]
   */
  only?: string[];
  /**
   * Every section but these.
   * @example []
   */
  except?: string[];
  /**
   * Write secrets encrypted with `passphrase` instead of as `${ENV_VAR}` references, to move the setup to your own machine.
   * @example false
   */
  include_secrets?: boolean;
  /**
   * The passphrase for `include_secrets`, 8 characters or more. The CLI reads `SENDMOCK_SETUP_PASSPHRASE` when the flag is not given.
   * @example null
   */
  passphrase?: string | null;
};

/** Body of POST /api/v1/setup/validate and /setup/import: the file's text, or a URL to download it from. */
export type SetupImportRequest = {
  /**
   * The setup file's text, in TOML, JSON or YAML; or give `url`.
   * @example "[[numbers]]\nnumber = \"+15550001111\"\nlabel = \"Support line\""
   */
  setup_text?: string | null;
  /**
   * Download the setup from this `https://` URL (plain `http://` only for loopback and private addresses): at most 1 MB, 10 seconds and 3 redirects, all to `https://`.
   * @example null
   */
  url?: string | null;
  /**
   * The SHA-256 the download must have, as 64 hexadecimal digits.
   * @example null
   */
  sha256?: string | null;
  /**
   * Headers for a private URL, each as `Name: value`; never shown or logged.
   * @example []
   */
  headers?: string[];
  /**
   * `toml`, `json` or `yaml`, when the URL or the text does not say.
   * @example "toml"
   */
  format?: SetupFileFormat | null;
  /**
   * `merge` (the default) or `replace`.
   * @example "merge"
   */
  mode?: SetupImportMode;
  /**
   * Opens the file's encrypted secrets. The CLI reads `SENDMOCK_SETUP_PASSPHRASE` when the flag is not given.
   * @example null
   */
  passphrase?: string | null;
  /**
   * For `replace` imports: how many items the validation said would be removed; the import is refused when it differs.
   * @example null
   */
  confirm_removed_count?: number | null;
};

/** Body of POST /api/v1/setup/migrate. */
export type SetupMigrateRequest = {
  /**
   * The setup file's text.
   * @example "[[numbers]]\nnumber = \"+15550001111\"\nlabel = \"Support line\""
   */
  setup_text: string;
  /**
   * The format of `setup_text`, when the text does not say.
   * @example "toml"
   */
  format?: SetupFileFormat | null;
  /**
   * The format to write the upgraded copy in; the same as the file's by default.
   * @example "json"
   */
  to_format?: SetupFileFormat | null;
};

/** A problem in a setup, by line when the format keeps one and by key path otherwise. */
export type SetupValidationError = {
  line: number | null;
  /** The key path, such as `webhook.endpoints[0].secret`. */
  location: string | null;
  message: string;
};

/** One section's changes, items named as the UI lists them. */
export type SetupSectionChange = {
  /** The section, such as `webhook.endpoints`. */
  section: string;
  item_kind: string;
  added: string[];
  changed: string[];
  removed: string[];
};

/** What validating or importing a setup found, and per section what it adds, changes and removes. */
export type SetupValidation = {
  is_valid: boolean;
  /** The format the file was read as. */
  format: SetupFileFormat;
  /** The file's format version (1 for a file without the `[sendmock]` header). */
  format_version: number;
  /** The format version an older file is upgraded from, in memory; null when it is current. */
  upgraded_from_format_version: number | null;
  /** Whether the file holds encrypted secrets, so the import needs the passphrase. */
  has_encrypted_secrets: boolean;
  errors: SetupValidationError[];
  /** How many items of each kind the file holds. */
  summary: SeedItemCount[];
  /** Per section, the items the import adds, changes and removes; only sections with any. */
  changes: SetupSectionChange[];
  /** How many items a `replace` import removes, for `confirm_removed_count`. */
  removed_count: number;
};
