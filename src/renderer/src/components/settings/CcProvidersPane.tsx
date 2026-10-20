import { useCallback, useEffect, useState } from 'react'
import { Blocks, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
import { translate } from '@/i18n/i18n'
import { cn } from '@/lib/utils'
import { getCcProviderViews, refreshCcProviders } from '@/lib/cc-provider-agents'
import type { CcProviderPublicView } from '../../../../shared/cc-provider'
import {
  CC_PROVIDER_PRESETS,
  getCcProviderPreset,
  type CcProviderPreset
} from '../../../../shared/cc-provider-presets'
import {
  draftAddPayload,
  draftBlank,
  draftFromPreset,
  draftFromView,
  draftUpdatePatch,
  validateCcProviderDraft,
  type CcProviderDraft
} from './cc-providers-pane-draft'
import { CcProvidersPaneEditor, type CcProviderEditorView } from './cc-providers-pane-editor'

type CcProviderSelection =
  | { kind: 'edit'; slug: string }
  | { kind: 'add-preset'; presetKey: string }
  | { kind: 'add-custom' }

function selectionKey(selection: CcProviderSelection | null): string | null {
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
  selection: CcProviderSelection,
  providers: readonly CcProviderPublicView[]
): CcProviderDraft | null {
  switch (selection.kind) {
    case 'edit': {
      const view = providers.find((provider) => provider.slug === selection.slug)
      return view ? draftFromView(view) : null
    }
    case 'add-preset': {
      const preset = getCcProviderPreset(selection.presetKey)
      return preset ? draftFromPreset(preset) : null
    }
    case 'add-custom':
      return draftBlank()
  }
}

/** Master-detail pane for third-party Anthropic-compatible Claude Code providers (T13). */
export function CcProvidersPane(): React.JSX.Element {
  const [providers, setProviders] = useState<readonly CcProviderPublicView[]>(getCcProviderViews())
  const [selection, setSelection] = useState<CcProviderSelection | null>(null)
  const [draft, setDraft] = useState<CcProviderDraft | null>(null)
  const [busy, setBusy] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [saveAttempted, setSaveAttempted] = useState(false)
  const [editorView, setEditorView] = useState<CcProviderEditorView>('form')

  const reload = useCallback(async (): Promise<readonly CcProviderPublicView[]> => {
    await refreshCcProviders()
    const next = getCcProviderViews()
    setProviders(next)
    return next
  }, [])

  useEffect(() => {
    void reload()
      .then((next) => {
        setSelection((current) => current ?? defaultSelection(next))
      })
      .catch(() => {})
    // Once on mount: pick an initial selection after the first refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    setDraft(selection ? draftForSelection(selection, providers) : null)
    setConfirmingDelete(false)
    setSaveAttempted(false)
    setEditorView('form')
  }, [selection, providers])

  const existingSlugs = providers.map((provider) => provider.slug)
  const validationError = draft ? validateCcProviderDraft(draft, existingSlugs) : null
  // Show schema/slug errors only after the first save attempt; JSON syntax errors show live.
  const displayedError = draft?.jsonError ? validationError : saveAttempted ? validationError : null

  const select = (next: CcProviderSelection): void => setSelection(next)

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
        await window.api.ccProviders.add(payload.slug, payload.config)
        savedSlug = payload.slug
      } else {
        const { slug, patch } = draftUpdatePatch(draft)
        await window.api.ccProviders.update(slug, patch)
        savedSlug = slug
      }
      await reload()
      setSelection({ kind: 'edit', slug: savedSlug })
      toast.success(
        draft.mode === 'add'
          ? translate('auto.components.settings.CcProvidersPane.added', 'Provider added')
          : translate('auto.components.settings.CcProvidersPane.saved', 'Provider saved')
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
      await window.api.ccProviders.delete(draft.slug)
      const next = await reload()
      setSelection(defaultSelection(next))
      toast.success(
        translate('auto.components.settings.CcProvidersPane.deleted', 'Provider deleted')
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
    <div className="flex h-[560px] overflow-hidden rounded-xl border border-border/60">
      <div className="flex w-48 shrink-0 flex-col gap-1 overflow-y-auto scrollbar-sleek border-r border-border/60 bg-muted/20 p-2">
        <p className="px-3 pb-1 pt-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {translate('auto.components.settings.CcProvidersPane.configured', 'Configured')}
        </p>
        {providers.length === 0 ? (
          <p className="px-3 py-1 text-[11px] text-muted-foreground">
            {translate('auto.components.settings.CcProvidersPane.noneConfigured', 'None yet')}
          </p>
        ) : (
          providers.map((provider) =>
            row(
              `edit:${provider.slug}`,
              provider.name,
              () => select({ kind: 'edit', slug: provider.slug }),
              `cc-${provider.slug}`
            )
          )
        )}
        <p className="px-3 pb-1 pt-3 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {translate('auto.components.settings.CcProvidersPane.add', 'Add')}
        </p>
        {CC_PROVIDER_PRESETS.map((preset: CcProviderPreset) => {
          const count = providers.filter((provider) => provider.preset === preset.key).length
          return row(
            `add:${preset.key}`,
            preset.name,
            () => select({ kind: 'add-preset', presetKey: preset.key }),
            count > 0 ? `×${count}` : undefined
          )
        })}
        {row(
          'add:custom',
          translate('auto.components.settings.CcProvidersPane.custom', 'Custom'),
          () => select({ kind: 'add-custom' })
        )}
      </div>
      {draft ? (
        <CcProvidersPaneEditor
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
            'auto.components.settings.CcProvidersPane.pickOne',
            'Pick a provider on the left, or add one from a preset.'
          )}
        </div>
      )}
    </div>
  )
}

function defaultSelection(providers: readonly CcProviderPublicView[]): CcProviderSelection {
  return providers.length > 0
    ? { kind: 'edit', slug: providers[0].slug }
    : { kind: 'add-preset', presetKey: 'kimi' }
}
