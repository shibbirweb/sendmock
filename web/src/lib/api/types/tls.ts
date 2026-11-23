/** SendMock's local CA and what trusts it, for the HTTPS provider port (PL-20, PL-25). */

/** One place that can trust the local CA, and its state (PL-25). */
export type TlsTrustPlace = {
  /**
   * The system store or a runtime.
   * @example "PHP 8.4.1 (/opt/homebrew/bin/php)"
   */
  place: string;
  /**
   * `trusted`, `missing` (`sendmock trust` adds it) or `manual` (set the line in `detail`).
   * @example "missing"
   */
  state: "trusted" | "missing" | "manual";
  /**
   * What the place is, or the line or command to run.
   * @example "Its CA file is /opt/homebrew/etc/openssl@3/cert.pem"
   */
  detail: string;
};

/** Answer of `GET /tls/trust`: what trusts SendMock's local CA on this machine (PL-25). */
export type TlsTrustReport = {
  /**
   * Where the local CA certificate is.
   * @example "/home/sam/.local/share/sendmock/provider-ca-certificate.pem"
   */
  ca_path: string;
  places: TlsTrustPlace[];
};

/** SendMock's local CA, to trust for the HTTPS provider port (PL-20). */
export type TlsCertificateAuthority = {
  /**
   * Where the CA certificate is on the machine SendMock runs on.
   * @example "/home/sam/.local/share/sendmock/provider-ca-certificate.pem"
   */
  path: string;
  /**
   * The CA certificate (PEM), to add to a trust store or `NODE_EXTRA_CA_CERTS`.
   * @example "-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----\n"
   */
  pem: string;
  /**
   * The provider APIs over HTTPS.
   * @example "127.0.0.1:8027"
   */
  provider_tls_address: string;
};
