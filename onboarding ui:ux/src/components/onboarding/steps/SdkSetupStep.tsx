




import React from 'react';
import { AlertTriangleIcon, DownloadIcon, KeyIcon } from 'lucide-react';
import { colors } from '../theme';
import { CopyButton, LabeledDivider, PrimaryButton, SecondaryButton } from '../ui';
import { StepShell } from '../StepShell';
import type { Credentials, ProductData } from '../types';

interface Props {
  product: ProductData;
  credentials: Credentials;
  onBack: () => void;
  onNext: () => void;
}

interface Row {
  label: string;
  value: string;
  hint: string;
  secret?: boolean;
}

export function SdkSetupStep({ product, credentials, onBack, onNext }: Props) {
  const rows: Row[] = [
  { label: 'Project ID', value: credentials.projectId, hint: 'Use in SDK initialization' },
  { label: 'SDK Token', value: credentials.sdkToken, hint: 'Safe to bundle in your app' },
  { label: 'Public Key', value: credentials.publicKey, hint: 'Safe for client-side reads' },
  { label: 'Secret Key', value: credentials.secretKey, hint: 'Server-side only — never expose', secret: true },
  { label: 'Webhook Secret', value: credentials.webhookSecret, hint: 'Verify incoming webhooks', secret: true }];


  const initCode = `import { PAAQProvider } from '@paaq/web-sdk';

export default function App() {
  return (
    <PAAQProvider
      sdkToken="${credentials.sdkToken}"
      projectId="${credentials.projectId}"
    >
      <YourApp />
    </PAAQProvider>
  );
}`;

  const installCmd = 'npm install @paaq/web-sdk';

  const downloadTxt = () => {
    const content = rows.map((r) => `${r.label}: ${r.value}`).join('\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${product.projectName || 'paaq'}-credentials.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyAll = rows.map((r) => `${r.label}: ${r.value}`).join('\n');

  return (
    <StepShell
      icon={<KeyIcon className="h-6 w-6" aria-hidden="true" />}
      iconTone="green"
      title="Your credentials are ready"
      subtitle={
      <>
          Save these now — Secret Key and Webhook Secret are shown{' '}
          <strong style={{ color: colors.textPrimary }}>once only</strong>.
        </>
      }>
      
      {/* Credential table */}
      <div className="overflow-hidden rounded-2xl border" style={{ borderColor: colors.border }}>
        <div
          className="flex items-center justify-between px-4 py-3"
          style={{ background: 'rgba(15,27,42,0.02)', borderBottom: `1px solid ${colors.border}` }}>
          
          <div>
            <div className="text-sm font-bold" style={{ color: colors.textPrimary }}>
              {product.projectName || 'Untitled project'}
            </div>
            <div className="text-xs capitalize" style={{ color: colors.textMuted }}>
              {product.technology} · {product.environment}
            </div>
          </div>
          <CopyButton text={copyAll} label="Copy all" />
        </div>
        {rows.map((r, i) =>
        <div
          key={r.label}
          className="flex items-start gap-3 px-4 py-3"
          style={{ borderBottom: i < rows.length - 1 ? `1px solid ${colors.border}` : 'none' }}>
          
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold" style={{ color: colors.textPrimary }}>
                  {r.label}
                </span>
                {r.secret &&
              <span
                className="rounded px-1.5 py-0.5 text-[9px] font-bold uppercase"
                style={{ background: colors.yellowSoft, color: colors.yellow }}>
                
                    Server only
                  </span>
              }
              </div>
              <div className="mt-1 break-all font-mono text-xs" style={{ color: colors.textSecondary }}>
                {r.value}
              </div>
              <div className="mt-0.5 text-[10px]" style={{ color: colors.textMuted }}>
                {r.hint}
              </div>
            </div>
            <CopyButton text={r.value} />
          </div>
        )}
      </div>

      <div
        className="flex items-start gap-2 rounded-xl border px-4 py-3 text-xs leading-relaxed"
        style={{ background: colors.yellowSoft, borderColor: 'rgba(202,138,4,0.25)', color: colors.yellow }}>
        
        <AlertTriangleIcon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <span>
          Store Secret Key and Webhook Secret in environment variables. They cannot be recovered if lost — only rotated.
        </span>
      </div>

      <LabeledDivider>Install the SDK</LabeledDivider>

      {/* Step 1 */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-semibold" style={{ color: colors.textPrimary }}>
            1. Install package
          </span>
          <CopyButton text={installCmd} />
        </div>
        <div
          className="overflow-x-auto rounded-xl border p-4 font-mono text-xs"
          style={{ borderColor: colors.border, background: '#f8fafc', color: colors.teal }}>
          
          {installCmd}
        </div>
      </div>

      {/* Step 2 */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-semibold" style={{ color: colors.textPrimary }}>
            2. Initialise with your credentials
          </span>
          <CopyButton text={initCode} label="Copy code" />
        </div>
        <pre
          className="overflow-x-auto rounded-xl p-4 font-mono text-xs leading-relaxed"
          style={{ background: '#0d1117', color: '#86efac' }}>
          
          {initCode}
        </pre>
      </div>

      <hr className="border-0 border-t" style={{ borderColor: colors.border }} />

      <div className="flex gap-3">
        <SecondaryButton onClick={downloadTxt}>
          <DownloadIcon className="h-4 w-4" aria-hidden="true" />
          Download .txt
        </SecondaryButton>
        <PrimaryButton onClick={onNext} className="flex-1">
          I've added the SDK
        </PrimaryButton>
      </div>
    </StepShell>);

}