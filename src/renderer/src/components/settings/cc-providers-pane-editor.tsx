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
    options: { placeholder?: string; type?: string; disabled?: boolean; span2?: boolean } = {}
  ): React.JSX.Element => (
    <div className={cn('space-y-1', options.span2 && 'col-span-2')}>
      <Label htmlFor={id}>{label}</Label>
      <Input
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
      <div className="flex items-center gap-2 border-b border-border/60 px-4 py-3">
        <span className="text-sm font-medium">
          {isEdit
            ? draft.name
            : `${translate('auto.components.settings.CcProvidersPane.add', 'Add')} ${draft.name || translate('auto.components.settings.CcProvidersPane.custom', 'custom')}`}
        </span>
        {isEdit ? (
          <span className="font-mono text-[11px] text-muted-foreground">cc-{draft.slug}</span>
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
        <div className="min-h-0 flex-1 overflow-y-auto scrollbar-sleek p-4">
          <div className="grid max-w-[640px] grid-cols-2 gap-x-4 gap-y-3">
            {field(
              'cc-provider-name',
              translate('auto.components.settings.CcProvidersPane.name', 'Display name'),
              draft.name,
              (v) => onDraftChange(applyDraftFormField(draft, 'name', v))
            )}
            {field(
              'cc-provider-slug',
              translate(
                'auto.components.settings.CcProvidersPane.slug',
                'Slug (agent id: cc-{slug})'
              ),
              draft.slug,
              (v) => onDraftChange(applyDraftFormField(draft, 'slug', v)),
              {
                placeholder: translate(
                  'auto.components.settings.CcProvidersPane.slugPlaceholder',
                  'Derived from the name when empty'
                ),
                disabled: isEdit
              }
            )}
            {field(
              'cc-provider-api-key',
              isEdit
                ? translate(
                    'auto.components.settings.CcProvidersPane.apiKeyEdit',
                    'API key (empty = keep current)'
                  )
                : translate('auto.components.settings.CcProvidersPane.apiKey', 'API key'),
              draft.apiKey,
              (v) => onDraftChange(applyDraftFormField(draft, 'apiKey', v)),
              {
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
              { span2: true }
            )}
            {field(
              'cc-provider-model',
              translate(
                'auto.components.settings.CcProvidersPane.model',
                'Model (ANTHROPIC_MODEL)'
              ),
              draft.env.ANTHROPIC_MODEL ?? '',
              (v) => onDraftChange(applyDraftFormField(draft, 'ANTHROPIC_MODEL', v)),
              {
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
                'auto.components.settings.CcProvidersPane.smallModel',
                'Small/fast model (ANTHROPIC_SMALL_FAST_MODEL)'
              ),
              draft.env.ANTHROPIC_SMALL_FAST_MODEL ?? '',
              (v) => onDraftChange(applyDraftFormField(draft, 'ANTHROPIC_SMALL_FAST_MODEL', v))
            )}
          </div>
          <p className="mt-3 max-w-[640px] text-[11px] leading-relaxed text-muted-foreground">
            {translate(
              'auto.components.settings.CcProvidersPane.formFootnote',
              'Other env keys (e.g. API_TIMEOUT_MS) are edited in the JSON view; the form only syncs the five common fields.'
            )}
          </p>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col p-4">
          <textarea
            id="cc-provider-json"
            aria-label="JSON"
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
      <div className="flex items-center gap-3 border-t border-border/60 px-4 py-2.5">
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
