import { FileJson, Loader2, SlidersHorizontal, Trash2 } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import { cn } from '@/lib/utils'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import {
  applyDraftFormField,
  applyDraftJsonText,
  CC_PROVIDER_API_KEY_MASK,
  type CcProviderDraft
} from './cc-providers-pane-draft'

export type CcProviderEditorView = 'form' | 'json'

type CcProvidersPaneEditorProps = {
  draft: CcProviderDraft
  /** Shown in the footer status line; null when nothing to display yet. */
  validationError: string | null
  /** Blocks saving (validation failed) even when the message is not shown yet. */
  saveDisabled: boolean
  busy: boolean
  confirmingDelete: boolean
  view: CcProviderEditorView
  onViewChange: (view: CcProviderEditorView) => void
  onDraftChange: (draft: CcProviderDraft) => void
  onSave: () => void
  onDelete: () => void
}

/** Right side of the master-detail pane: header (view switch + delete) / scrollable body /
 *  pinned footer (status + save). Form and JSON are alternate views of the same draft —
 *  the JSON text stays the save-time source of truth, so a broken JSON blocks the form view. */
export function CcProvidersPaneEditor({
  draft,
  validationError,
  saveDisabled,
  busy,
  confirmingDelete,
  view,
  onViewChange,
  onDraftChange,
  onSave,
  onDelete
}: CcProvidersPaneEditorProps): React.JSX.Element {
  const isEdit = draft.mode === 'edit'
  const jsonBroken = draft.jsonError !== null
  const field = (
    id: string,
    label: string,
    value: string,
    onChange: (value: string) => void,
    options: {
      description?: React.ReactNode
      placeholder?: string
      type?: string
      disabled?: boolean
      span2?: boolean
    } = {}
  ): React.JSX.Element => (
    // Why mt-auto: a wrapped description in one column must not push its input below its row neighbor's.
    <div className={cn('flex flex-col gap-2', options.span2 && 'col-span-2')}>
      <div className="space-y-1">
        <Label htmlFor={id}>{label}</Label>
        {options.description ? (
          <p className="text-xs text-muted-foreground">{options.description}</p>
        ) : null}
      </div>
      <Input
        className="mt-auto"
        id={id}
        type={options.type ?? 'text'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={options.placeholder}
        spellCheck={false}
        disabled={busy || options.disabled}
      />
    </div>
  )
  const envName = (name: string): React.JSX.Element => <span className="font-mono">{name}</span>
  const section = (title: string, children: React.ReactNode): React.JSX.Element => (
    <section className="space-y-3">
      <h3 className="text-2xs font-semibold tracking-[0.05em] text-muted-foreground uppercase">
        {title}
      </h3>
      <div className="grid grid-cols-2 gap-x-6 gap-y-5">{children}</div>
    </section>
  )
  const viewButton = (
    target: CcProviderEditorView,
    icon: React.ReactNode,
    label: string,
    disabled: boolean,
    title?: string
  ): React.JSX.Element => (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={() => onViewChange(target)}
      className={cn(
        'flex items-center gap-1 px-2 py-1 text-[11px] disabled:cursor-not-allowed disabled:opacity-40',
        view === target ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'
      )}
    >
      {icon}
      {label}
    </button>
  )

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="flex items-center gap-2 border-b border-border/60 px-6 py-3.5">
        <span className="text-sm font-medium">
          {isEdit
            ? draft.name
            : `${translate('auto.components.settings.CcProvidersPane.add', 'Add')} ${draft.name || translate('auto.components.settings.CcProvidersPane.custom', 'custom')}`}
        </span>
        {isEdit ? (
          <span className="font-mono text-[11px] text-muted-foreground">
            {translate('auto.components.settings.CcProvidersPane.ccPrefix', 'cc-')}
            {draft.slug}
          </span>
        ) : null}
        <span className="flex-1" />
        <div className="flex overflow-hidden rounded-md border border-border/60">
          {viewButton(
            'form',
            <SlidersHorizontal className="size-3" />,
            translate('auto.components.settings.CcProvidersPane.formView', 'Form'),
            busy || jsonBroken,
            jsonBroken
              ? translate(
                  'auto.components.settings.CcProvidersPane.fixJsonFirst',
                  'Fix the JSON syntax error first'
                )
              : undefined
          )}
          {viewButton('json', <FileJson className="size-3" />, 'JSON', busy)}
        </div>
        {isEdit ? (
          <Button
            variant={confirmingDelete ? 'destructive' : 'ghost'}
            size="xs"
            disabled={busy}
            onClick={onDelete}
          >
            <Trash2 className="size-3" />
            {confirmingDelete
              ? translate(
                  'auto.components.settings.CcProvidersPane.confirmDelete',
                  'Confirm delete'
                )
              : translate('auto.components.settings.CcProvidersPane.delete', 'Delete')}
          </Button>
        ) : null}
      </div>
      {view === 'form' ? (
        <div className="min-h-0 flex-1 overflow-y-auto scrollbar-sleek px-6 py-5">
          <div className="max-w-[640px] space-y-7">
            {section(
              translate('auto.components.settings.CcProvidersPane.basicsSection', 'Basics'),
              <>
                {field(
                  'cc-provider-name',
                  translate('auto.components.settings.CcProvidersPane.name', 'Display name'),
                  draft.name,
                  (v) => onDraftChange(applyDraftFormField(draft, 'name', v)),
                  {
                    description: translate(
                      'auto.components.settings.CcProvidersPane.nameHint',
                      'Shown as CC {{name}}',
                      { name: draft.name || '…' }
                    )
                  }
                )}
                {field(
                  'cc-provider-slug',
                  translate('auto.components.settings.CcProvidersPane.slugTitle', 'Slug'),
                  draft.slug,
                  (v) => onDraftChange(applyDraftFormField(draft, 'slug', v)),
                  {
                    description: envName(`agent id: cc-${draft.slug || '…'}`),
                    placeholder: translate(
                      'auto.components.settings.CcProvidersPane.slugPlaceholder',
                      'Derived from the name when empty'
                    ),
                    disabled: isEdit
                  }
                )}
              </>
            )}
            {section(
              translate('auto.components.settings.CcProvidersPane.connectionSection', 'Connection'),
              <>
                {field(
                  'cc-provider-api-key',
                  translate('auto.components.settings.CcProvidersPane.apiKey', 'API key'),
                  draft.apiKey,
                  (v) => onDraftChange(applyDraftFormField(draft, 'apiKey', v)),
                  {
                    description: (
                      <>
                        {envName('ANTHROPIC_AUTH_TOKEN')}
                        {isEdit
                          ? ` · ${translate(
                              'auto.components.settings.CcProvidersPane.apiKeyKeepHint',
                              'Leave empty to keep the current key'
                            )}`
                          : null}
                      </>
                    ),
                    placeholder: isEdit ? CC_PROVIDER_API_KEY_MASK : 'sk-…',
                    type: 'password',
                    span2: true
                  }
                )}
                {field(
                  'cc-provider-base-url',
                  'Base URL',
                  draft.env.ANTHROPIC_BASE_URL ?? '',
                  (v) => onDraftChange(applyDraftFormField(draft, 'ANTHROPIC_BASE_URL', v)),
                  { description: envName('ANTHROPIC_BASE_URL'), span2: true }
                )}
              </>
            )}
            {section(
              translate('auto.components.settings.CcProvidersPane.modelsSection', 'Models'),
              <>
                {field(
                  'cc-provider-model',
                  translate('auto.components.settings.CcProvidersPane.modelTitle', 'Model'),
                  draft.env.ANTHROPIC_MODEL ?? '',
                  (v) => onDraftChange(applyDraftFormField(draft, 'ANTHROPIC_MODEL', v)),
                  {
                    description: envName('ANTHROPIC_MODEL'),
                    placeholder:
                      draft.preset === 'deepseek'
                        ? translate(
                            'auto.components.settings.CcProvidersPane.deepseekModelHint',
                            '(mapped server-side — leave empty)'
                          )
                        : undefined
                  }
                )}
                {field(
                  'cc-provider-small-model',
                  translate(
                    'auto.components.settings.CcProvidersPane.smallModelTitle',
                    'Small/fast model'
                  ),
                  draft.env.ANTHROPIC_SMALL_FAST_MODEL ?? '',
                  (v) => onDraftChange(applyDraftFormField(draft, 'ANTHROPIC_SMALL_FAST_MODEL', v)),
                  { description: envName('ANTHROPIC_SMALL_FAST_MODEL') }
                )}
              </>
            )}
            <p className="text-xs leading-relaxed text-muted-foreground">
              {translate(
                'auto.components.settings.CcProvidersPane.formFootnote',
                'Other env keys (e.g. API_TIMEOUT_MS) are edited in the JSON view; the form only syncs the five common fields.'
              )}
            </p>
          </div>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col px-6 py-5">
          <textarea
            id="cc-provider-json"
            aria-label={translate(
              'auto.components.settings.CcProvidersPane.jsonEditorLabel',
              'JSON'
            )}
            className={`min-h-0 w-full flex-1 resize-none rounded-md border bg-background px-3 py-2 font-mono text-xs leading-relaxed ${
              jsonBroken ? 'border-destructive' : 'border-input'
            }`}
            value={draft.json}
            onChange={(e) => onDraftChange(applyDraftJsonText(draft, e.target.value))}
            spellCheck={false}
            disabled={busy}
          />
          <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
            {isEdit
              ? translate(
                  'auto.components.settings.CcProvidersPane.jsonEditFootnote',
                  `apiKey showing ${CC_PROVIDER_API_KEY_MASK} keeps the stored key; paste a real key to rotate it.`
                )
              : translate(
                  'auto.components.settings.CcProvidersPane.jsonAddFootnote',
                  'You can paste a complete provider JSON here; it validates on save.'
                )}
          </p>
        </div>
      )}
      <div className="flex items-center gap-3 border-t border-border/60 px-6 py-3">
        <p
          className={`min-h-4 flex-1 text-[11px] ${validationError ? 'text-destructive' : 'text-muted-foreground'}`}
        >
          {validationError ??
            translate(
              'auto.components.settings.CcProvidersPane.jsonOk',
              'Valid · env keys allowed: ANTHROPIC_* / CLAUDE_CODE_* / API_TIMEOUT_MS'
            )}
        </p>
        <Button size="sm" disabled={busy || saveDisabled} onClick={onSave}>
          {busy ? <Loader2 className="size-3 animate-spin" /> : null}
          {isEdit
            ? translate('auto.components.settings.CcProvidersPane.saveChanges', 'Save changes')
            : translate('auto.components.settings.CcProvidersPane.save', 'Save')}
        </Button>
      </div>
    </div>
  )
}
