import { useEffect, useState } from 'react'
import { Blocks, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
import { translate } from '@/i18n/i18n'
import { cn } from '@/lib/utils'
import type { LlmEndpointPublicView } from '../../../../shared/llm-endpoint'
import {
  LLM_ENDPOINT_PRESETS,
  getLlmEndpointPreset,
  type LlmEndpointPreset
} from '../../../../shared/llm-endpoint-presets'
import {
  draftAddPayload,
  draftBlank,
  draftFromPreset,
  draftFromView,
  draftUpdatePatch,
  validateLlmEndpointDraft,
  type LlmEndpointDraft
} from './llm-endpoints-pane-draft'
import { LlmEndpointsPaneEditor, type LlmEndpointEditorView } from './llm-endpoints-pane-editor'

type LlmEndpointSelection =
  | { kind: 'edit'; slug: string }
  | { kind: 'add-preset'; presetKey: string }
  | { kind: 'add-custom' }

function selectionKey(selection: LlmEndpointSelection | null): string | null {
  if (!selection) {
    return null
  }
  switch (selection.kind) {
    case 'edit':
      return `edit:${selection.slug}`
    case 'add-preset':
      return `add:${selection.presetKey}`
    case 'add-custom':
      return 'add:custom'
  }
}

function draftForSelection(
  selection: LlmEndpointSelection,
  endpoints: readonly LlmEndpointPublicView[]
): LlmEndpointDraft | null {
  switch (selection.kind) {
    case 'edit': {
      const view = endpoints.find((endpoint) => endpoint.slug === selection.slug)
      return view ? draftFromView(view) : null
    }
    case 'add-preset': {
      const preset = getLlmEndpointPreset(selection.presetKey)
      return preset ? draftFromPreset(preset) : null
    }
    case 'add-custom':
      return draftBlank()
  }
}

type LlmEndpointsPaneProps = {
  endpoints: readonly LlmEndpointPublicView[]
  /** Re-fetches the endpoint list from main and resolves with it. */
  reload: () => Promise<readonly LlmEndpointPublicView[]>
}

/** Master-detail editor for Anthropic-compatible LLM endpoints that agent profiles can use. */
export function LlmEndpointsPane({ endpoints, reload }: LlmEndpointsPaneProps): React.JSX.Element {
  const [selection, setSelection] = useState<LlmEndpointSelection | null>(null)
  const [draft, setDraft] = useState<LlmEndpointDraft | null>(null)
  const [busy, setBusy] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [saveAttempted, setSaveAttempted] = useState(false)
  const [editorView, setEditorView] = useState<LlmEndpointEditorView>('form')

  // Why not an effect on [selection, endpoints]: endpoints is a prop, and resetting the draft
  // after it changes would flash the stale draft for a frame. Every selection goes through here.
  const select = (
    next: LlmEndpointSelection,
    list: readonly LlmEndpointPublicView[] = endpoints
  ): void => {
    setSelection(next)
    setDraft(draftForSelection(next, list))
    setConfirmingDelete(false)
    setSaveAttempted(false)
    setEditorView('form')
  }

  useEffect(() => {
    void reload()
      .then((next) => select(defaultSelection(next), next))
      .catch(() => select(defaultSelection([]), []))
    // Once on mount: pick an initial selection after the first refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const existingSlugs = endpoints.map((endpoint) => endpoint.slug)
  const validationError = draft ? validateLlmEndpointDraft(draft, existingSlugs) : null
  // Show schema/slug errors only after the first save attempt; JSON syntax errors show live.
  const displayedError = draft?.jsonError ? validationError : saveAttempted ? validationError : null

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
        const payload = draftAddPayload(draft)
        await window.api.llmEndpoints.add(payload.slug, payload.config)
        savedSlug = payload.slug
      } else {
        const { slug, patch } = draftUpdatePatch(draft)
        await window.api.llmEndpoints.update(slug, patch)
        savedSlug = slug
      }
      const next = await reload()
      select({ kind: 'edit', slug: savedSlug }, next)
      toast.success(
        draft.mode === 'add'
          ? translate('auto.components.settings.LlmEndpointsPane.added', 'Endpoint added')
          : translate('auto.components.settings.LlmEndpointsPane.saved', 'Endpoint saved')
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
      await window.api.llmEndpoints.delete(draft.slug)
      const next = await reload()
      select(defaultSelection(next), next)
      toast.success(
        translate('auto.components.settings.LlmEndpointsPane.deleted', 'Endpoint deleted')
      )
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(false)
    }
  }

  const activeKey = selectionKey(selection)
  const row = (
    key: string,
    title: string,
    onClick: () => void,
    right?: string
  ): React.JSX.Element => (
    <button
      key={key}
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left transition-colors',
        activeKey === key ? 'bg-accent text-accent-foreground' : 'hover:bg-muted/60'
      )}
    >
      <p className="min-w-0 flex-1 truncate text-xs font-medium">{title}</p>
      {right ? <span className="shrink-0 text-[10px] text-muted-foreground">{right}</span> : null}
      <ChevronRight className="size-3 shrink-0 text-muted-foreground/60" />
    </button>
  )

  return (
    <div className="flex h-[680px] overflow-hidden rounded-xl border border-border/60">
      <div className="flex w-48 shrink-0 flex-col gap-1 overflow-y-auto scrollbar-sleek border-r border-border/60 bg-muted/20 p-2">
        <p className="px-3 pb-1 pt-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {translate('auto.components.settings.LlmEndpointsPane.configured', 'Configured')}
        </p>
        {endpoints.length === 0 ? (
          <p className="px-3 py-1 text-[11px] text-muted-foreground">
            {translate('auto.components.settings.LlmEndpointsPane.noneConfigured', 'None yet')}
          </p>
        ) : (
          endpoints.map((endpoint) =>
            row(
              `edit:${endpoint.slug}`,
              endpoint.name,
              () => select({ kind: 'edit', slug: endpoint.slug }),
              endpoint.slug
            )
          )
        )}
        <p className="px-3 pb-1 pt-3 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {translate('auto.components.settings.LlmEndpointsPane.add', 'Add')}
        </p>
        {LLM_ENDPOINT_PRESETS.map((preset: LlmEndpointPreset) => {
          const count = endpoints.filter((endpoint) => endpoint.preset === preset.key).length
          return row(
            `add:${preset.key}`,
            preset.name,
            () => select({ kind: 'add-preset', presetKey: preset.key }),
            count > 0 ? `×${count}` : undefined
          )
        })}
        {row(
          'add:custom',
          translate('auto.components.settings.LlmEndpointsPane.custom', 'Custom'),
          () => select({ kind: 'add-custom' })
        )}
      </div>
      {draft ? (
        <LlmEndpointsPaneEditor
          draft={draft}
          validationError={displayedError}
          saveDisabled={validationError !== null}
          busy={busy}
          confirmingDelete={confirmingDelete}
          view={editorView}
          onViewChange={setEditorView}
          onDraftChange={setDraft}
          onSave={() => void handleSave()}
          onDelete={() => void handleDelete()}
        />
      ) : (
        <div className="flex flex-1 items-center justify-center text-xs text-muted-foreground">
          <Blocks className="mr-2 size-4" />
          {translate(
            'auto.components.settings.LlmEndpointsPane.pickOne',
            'Pick an endpoint on the left, or add one from a preset.'
          )}
        </div>
      )}
    </div>
  )
}

function defaultSelection(endpoints: readonly LlmEndpointPublicView[]): LlmEndpointSelection {
  return endpoints.length > 0
    ? { kind: 'edit', slug: endpoints[0].slug }
    : { kind: 'add-preset', presetKey: 'kimi' }
}
