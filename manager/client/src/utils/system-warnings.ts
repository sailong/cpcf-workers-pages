import type { SystemWarningCode } from '../types';

const WARNING_TRANSLATION_KEYS: Record<SystemWarningCode, string> = {
  domain_environment_incomplete: 'settingsPage.warnings.domainEnvironmentIncomplete',
  console_host_mismatch: 'settingsPage.warnings.consoleHostMismatch',
  cloudflare_token_missing: 'settingsPage.warnings.cloudflareTokenMissing',
  console_dns_unresolved: 'settingsPage.warnings.consoleDnsUnresolved',
  wildcard_dns_unresolved: 'settingsPage.warnings.wildcardDnsUnresolved',
  console_tls_unhealthy: 'settingsPage.warnings.consoleTlsUnhealthy',
  wildcard_tls_unhealthy: 'settingsPage.warnings.wildcardTlsUnhealthy',
  domain_confirmation_missing: 'settingsPage.warnings.domainConfirmationMissing',
};

const LEGACY_WARNING_CODES: Record<string, SystemWarningCode> = {
  'Domain environment variables are incomplete': 'domain_environment_incomplete',
  'The current request host does not match the configured console host': 'console_host_mismatch',
  'Cloudflare DNS API token is not configured': 'cloudflare_token_missing',
  'Console DNS does not resolve': 'console_dns_unresolved',
  'Wildcard project DNS does not resolve': 'wildcard_dns_unresolved',
  'Console TLS certificate is not healthy': 'console_tls_unhealthy',
  'Wildcard project TLS certificate is not healthy': 'wildcard_tls_unhealthy',
  'Domain configuration has not been confirmed by the administrator': 'domain_confirmation_missing',
};

export function getSystemWarningTranslationKey(warning: string): string | undefined {
  const code = warning in WARNING_TRANSLATION_KEYS
    ? warning as SystemWarningCode
    : LEGACY_WARNING_CODES[warning];
  return code ? WARNING_TRANSLATION_KEYS[code] : undefined;
}
