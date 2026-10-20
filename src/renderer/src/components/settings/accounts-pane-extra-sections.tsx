import { ZcodePlanAccountsSection } from './ZcodePlanAccountsSection'
import { getAccountsZcodePlanSearchEntries } from './accounts-extra-search'
import { matchesSettingsSearch } from './settings-search'
import type { UsageCredentialHost } from './usage-credential-host'
import type { UsageHostSettingsModel } from './use-usage-host-settings'

export type AccountsExtraSectionsArgs = {
  searchQuery: string
  accountOwnerKey: string
  usageCredentialHost: UsageCredentialHost
  usageHostSettings: UsageHostSettingsModel
}

/** Tail sections of the Accounts pane; kept out of AccountsPane.tsx for its max-lines budget. */
export function renderAccountsExtraSections(
  args: AccountsExtraSectionsArgs
): (React.JSX.Element | null)[] {
  return [
    matchesSettingsSearch(args.searchQuery, getAccountsZcodePlanSearchEntries()) ? (
      <ZcodePlanAccountsSection
        key={`zcode:${args.accountOwnerKey}`}
        host={args.usageCredentialHost}
        usageSettings={args.usageHostSettings}
      />
    ) : null
  ]
}
