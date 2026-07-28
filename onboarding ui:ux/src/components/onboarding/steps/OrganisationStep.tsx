


import React from 'react';
import { Building2Icon, GlobeIcon } from 'lucide-react';
import { colors } from '../theme';
import { FieldLabel, Rule, SelectDropdown, StepFooter, TextInput } from '../ui';
import { StepShell } from '../StepShell';
import type { OrgData } from '../types';

const INDUSTRIES = ['SaaS', 'E-commerce', 'Fintech', 'Healthcare', 'Media', 'Gaming', 'Education', 'Other'];
const COUNTRIES = ['United States', 'United Kingdom', 'Canada', 'Germany', 'France', 'India', 'Australia', 'Other'];
const TEAM_SIZES = ['Just me', '2–10', '11–50', '51–200', '200+'];

interface Props {
  data: OrgData;
  onChange: (patch: Partial<OrgData>) => void;
  onBack: () => void;
  onNext: () => void;
}

export function OrganisationStep({ data, onChange, onBack, onNext }: Props) {
  const canContinue = data.company.trim().length > 0;

  return (
    <StepShell
      icon={<Building2Icon className="h-6 w-6" aria-hidden="true" />}
      title="Tell us about your organisation"
      subtitle="This sets up your PAAQ account. You can update it later.">
      
      <Rule />

      <div>
        <FieldLabel required>Organisation / Company name</FieldLabel>
        <TextInput
          value={data.company}
          onChange={(v) => onChange({ company: v })}
          placeholder="Acme Corp"
          ariaLabel="Company name"
          onEnter={() => canContinue && onNext()} />
        
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <FieldLabel>Industry</FieldLabel>
          <SelectDropdown
            value={data.industry}
            onChange={(v) => onChange({ industry: v })}
            options={INDUSTRIES}
            placeholder="Select industry…"
            ariaLabel="Industry" />
          
        </div>
        <div>
          <FieldLabel>Country</FieldLabel>
          <SelectDropdown
            value={data.country}
            onChange={(v) => onChange({ country: v })}
            options={COUNTRIES}
            placeholder="Select country…"
            ariaLabel="Country" />
          
        </div>
      </div>

      <div>
        <FieldLabel optional>Website</FieldLabel>
        <TextInput
          value={data.website}
          onChange={(v) => onChange({ website: v })}
          placeholder="https://acme.com"
          ariaLabel="Website"
          icon={<GlobeIcon className="h-4 w-4" aria-hidden="true" />} />
        
      </div>

      <div>
        <FieldLabel optional>Team size</FieldLabel>
        <div className="flex flex-wrap gap-2">
          {TEAM_SIZES.map((size) => {
            const active = data.teamSize === size;
            return (
              <button
                key={size}
                type="button"
                onClick={() => onChange({ teamSize: active ? '' : size })}
                style={{
                  borderColor: active ? colors.teal : colors.border,
                  background: active ? colors.tealSoft : '#fff',
                  color: active ? colors.textPrimary : colors.textMuted
                }}
                className="rounded-xl border px-4 py-2 text-sm font-semibold transition-colors">
                
                {size}
              </button>);

          })}
        </div>
      </div>

      <Rule />

      <StepFooter onBack={onBack} onNext={onNext} nextLabel="Continue" nextDisabled={!canContinue} />
    </StepShell>);

}