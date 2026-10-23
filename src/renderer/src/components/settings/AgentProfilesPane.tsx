import { useCallback, useEffect, useState } from 'react'
import { ChevronRight, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { translate } from '@/i18n/i18n'
import { getAgentProfileViews, refreshAgentProfiles } from '@/lib/agent-profile-agents'
import { AGENT_PROFILE_ICON_COMPONENTS } from '@/lib/agent-profile-icons'
import { cn } from '@/lib/utils'
import type { AgentProfilePublicView } from '../../../../shared/agent-profile'
import type { LlmEndpointPublicView } from '../../../../shared/llm-endpoint'
import {
  draftAddProfilePayload,
  draftBlankProfile,
  draftFromProfileView,
  draftUpdateProfilePatch,
  validateAgentProfileDraft,
  type AgentProfileDraft
} from './agent-profiles-pane-draft'
import { AgentProfilesPaneEditor } from './agent-profiles-pane-editor'

type AgentProfileSelection = { kind: 'edit'; slug: string } | { kind: 'add' }

function selectionKey(selection: AgentProfileSelection | null): string | null {
  if (!selection) {
    return null
  }
  return selection.kind === 'edit' ? `edit:${selection.slug}` : 'add'
}

function draftForSelection(
  selection: AgentProfileSelection,
  profiles: readonly AgentProfilePublicView[]
): AgentProfileDraft | null {
  if (selection.kind === 'add') {
    return draftBlankProfile()
  }
  const view = profiles.find((profile) => profile.slug === selection.slug)
  return view ? draftFromProfileView(view) : null
}

function defaultSelection(profiles: readonly AgentProfilePublicView[]): AgentProfileSelection {
  return profiles.length > 0 ? { kind: 'edit', slug: profiles[0].slug } : { kind: 'add' }
}

type AgentProfilesPaneProps = {
  /** Saved endpoints offered as model sources. */
  endpoints: readonly LlmEndpointPublicView[]
}

/** Master-detail editor for agent profiles; each saved profile becomes an `ap-{slug}` agent. */
export function AgentProfilesPane({ endpoints }: AgentProfilesPaneProps): React.JSX.Element {
  const [profiles, setProfiles] =
    useState<readonly AgentProfilePublicView[]>(getAgentProfileViews())
  const [selection, setSelection] = useState<AgentProfileSelection | null>(null)
  const [draft, setDraft] = useState<AgentProfileDraft | null>(null)
  const [busy, setBusy] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [saveAttempted, setSaveAttempted] = useState(false)

  const reload = useCallback(async (): Promise<readonly AgentProfilePublicView[]> => {
    await refreshAgentProfiles()
    const next = getAgentProfileViews()
    setProfiles(next)
    return next
  }, [])

  useEffect(() => {
    void reload()
      .then((next) => {
        setSelection((current) => current ?? defaultSelection(next))
      })
      .catch(() => {
        setSelection((current) => current ?? { kind: 'add' })
      })
  }, [reload])

  useEffect(() => {
    setDraft(selection ? draftForSelection(selection, profiles) : null)
    setConfirmingDelete(false)
    setSaveAttempted(false)
  }, [selection, profiles])

  const existingSlugs = profiles.map((profile) => profile.slug)
  const endpointSlugs = endpoints.map((endpoint) => endpoint.slug)
  const validationError = draft
    ? validateAgentProfileDraft(draft, existingSlugs, endpointSlugs)
    : null
  const displayedError = saveAttempted ? validationError : null

  const handleSave = async (): Promise<void> => {
    if (!draft) {
      return
    }
    if (validationError) {
      setSaveAttempted(true)
      return
    }
    setBusy(true)
    try {
      let savedSlug: string
      if (draft.mode === 'add') {
        const payload = draftAddProfilePayload(draft)
        await window.api.agentProfiles.add(payload.slug, payload.config)
        savedSlug = payload.slug
      } else {
        const { slug, patch } = draftUpdateProfilePatch(draft)
        await window.api.agentProfiles.update(slug, patch)
        savedSlug = slug
      }
      await reload()
      setSelection({ kind: 'edit', slug: savedSlug })
      toast.success(
        draft.mode === 'add'
          ? translate('auto.components.settings.AgentProfilesPane.added', 'Profile added')
          : translate('auto.components.settings.AgentProfilesPane.saved', 'Profile saved')
      )
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async (): Promise<void> => {
    if (!draft || draft.mode !== 'edit') {
      return
    }
    if (!confirmingDelete) {
      setConfirmingDelete(true)
      return
    }
    setBusy(true)
    try {
      await window.api.agentProfiles.delete(draft.slug)
      const next = await reload()
      setSelection(defaultSelection(next))
      toast.success(
        translate('auto.components.settings.AgentProfilesPane.deleted', 'Profile deleted')
      )
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(false)
    }
  }

  const activeKey = selectionKey(selection)
  const rowClass = (key: string): string =>
    cn(
      'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left transition-colors',
      activeKey === key ? 'bg-accent text-accent-foreground' : 'hover:bg-muted/60'
    )

  return (
    <div className="flex h-[680px] overflow-hidden rounded-xl border border-border/60">
      <div className="flex w-48 shrink-0 flex-col gap-1 overflow-y-auto scrollbar-sleek border-r border-border/60 bg-muted/20 p-2">
        <p className="px-3 pb-1 pt-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {translate('auto.components.settings.AgentProfilesPane.profiles', 'Profiles')}
        </p>
        {profiles.length === 0 ? (
          <p className="px-3 py-1 text-[11px] text-muted-foreground">
            {translate('auto.components.settings.AgentProfilesPane.noneConfigured', 'None yet')}
          </p>
        ) : (
          profiles.map((profile) => {
            const key = `edit:${profile.slug}`
            const Icon = AGENT_PROFILE_ICON_COMPONENTS[profile.icon]
            return (
              <button
                key={key}
                type="button"
                onClick={() => setSelection({ kind: 'edit', slug: profile.slug })}
                className={rowClass(key)}
              >
                <Icon className="size-3.5 shrink-0 text-muted-foreground" />
                <p className="min-w-0 flex-1 truncate text-xs font-medium">{profile.name}</p>
                <ChevronRight className="size-3 shrink-0 text-muted-foreground/60" />
              </button>
            )
          })
        )}
        <button
          type="button"
          onClick={() => setSelection({ kind: 'add' })}
          className={cn(rowClass('add'), 'mt-2')}
        >
          <Plus className="size-3.5 shrink-0 text-muted-foreground" />
          <p className="min-w-0 flex-1 truncate text-xs font-medium">
            {translate('auto.components.settings.AgentProfilesPane.newProfile', 'New profile')}
          </p>
        </button>
      </div>
      {draft ? (
        <AgentProfilesPaneEditor
          draft={draft}
          endpoints={endpoints}
          validationError={displayedError}
          saveDisabled={saveAttempted && validationError !== null}
          busy={busy}
          confirmingDelete={confirmingDelete}
          onDraftChange={setDraft}
          onSave={() => void handleSave()}
          onDelete={() => void handleDelete()}
        />
      ) : null}
    </div>
  )
}
