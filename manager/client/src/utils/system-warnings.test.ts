import { describe, expect, it } from 'vitest';
import { getSystemWarningTranslationKey } from './system-warnings';

describe('system warning translations', () => {
  it('maps diagnostics warning codes to locale keys', () => {
    expect(getSystemWarningTranslationKey('domain_environment_incomplete'))
      .toBe('settingsPage.warnings.domainEnvironmentIncomplete');
    expect(getSystemWarningTranslationKey('domain_confirmation_missing'))
      .toBe('settingsPage.warnings.domainConfirmationMissing');
  });

  it('translates warnings returned by a backend that has not restarted yet', () => {
    expect(getSystemWarningTranslationKey('Cloudflare DNS API token is not configured'))
      .toBe('settingsPage.warnings.cloudflareTokenMissing');
  });

  it('allows unknown warning codes to fall back to their raw value', () => {
    expect(getSystemWarningTranslationKey('future_warning_code')).toBeUndefined();
  });
});
