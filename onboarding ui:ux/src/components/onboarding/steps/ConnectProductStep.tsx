import React from "react";
import { motion } from "framer-motion";
import { BoxesIcon, CheckIcon, GlobeIcon, ServerIcon, SmartphoneIcon, XIcon, BoxIcon } from "lucide-react";
import { IconType } from "react-icons";
import { SiAndroid, SiAngular, SiApple, SiDotnet, SiFlutter, SiGo, SiJavascript, SiNextdotjs, SiNodedotjs, SiOpenjdk, SiPython, SiReact, SiVuedotjs } from "react-icons/si";
import { colors } from "../theme";
import { FieldLabel, Rule, StepFooter, TextInput } from "../ui";
import { StepShell } from "../StepShell";
import { ProductData } from "../types";
type ProductType = {
  id: string;
  icon: BoxIcon;
  label: string;
  desc: string;
};
type Technology = {
  icon: IconType;
  iconColor: string;
  label: string;
};
const PRODUCT_TYPES: ProductType[] = [{
  id: 'website',
  icon: GlobeIcon,
  label: 'Website',
  desc: 'React, Next.js, Vue and more'
}, {
  id: 'mobile',
  icon: SmartphoneIcon,
  label: 'Mobile app',
  desc: 'Flutter, native iOS or Android'
}, {
  id: 'backend',
  icon: ServerIcon,
  label: 'Backend API',
  desc: 'Node.js, Python, Go and more'
}, {
  id: 'platform',
  icon: BoxesIcon,
  label: 'Full platform',
  desc: 'A connected web, mobile and API stack'
}];
const TECH: Record<string, Technology[]> = {
  website: [{
    icon: SiReact,
    iconColor: '#61DAFB',
    label: 'React'
  }, {
    icon: SiNextdotjs,
    iconColor: '#111827',
    label: 'Next.js'
  }, {
    icon: SiVuedotjs,
    iconColor: '#42B883',
    label: 'Vue'
  }, {
    icon: SiAngular,
    iconColor: '#DD0031',
    label: 'Angular'
  }, {
    icon: SiJavascript,
    iconColor: '#F7DF1E',
    label: 'Vanilla JS'
  }],
  mobile: [{
    icon: SiFlutter,
    iconColor: '#02569B',
    label: 'Flutter'
  }, {
    icon: SiReact,
    iconColor: '#61DAFB',
    label: 'React Native'
  }, {
    icon: SiApple,
    iconColor: '#111827',
    label: 'iOS'
  }, {
    icon: SiAndroid,
    iconColor: '#3DDC84',
    label: 'Android'
  }],
  backend: [{
    icon: SiNodedotjs,
    iconColor: '#5FA04E',
    label: 'Node.js'
  }, {
    icon: SiPython,
    iconColor: '#3776AB',
    label: 'Python'
  }, {
    icon: SiGo,
    iconColor: '#00ADD8',
    label: 'Go'
  }, {
    icon: SiOpenjdk,
    iconColor: '#ED8B00',
    label: 'Java'
  }, {
    icon: SiDotnet,
    iconColor: '#512BD4',
    label: '.NET'
  }],
  platform: [{
    icon: SiReact,
    iconColor: '#61DAFB',
    label: 'React'
  }, {
    icon: SiNextdotjs,
    iconColor: '#111827',
    label: 'Next.js'
  }, {
    icon: SiVuedotjs,
    iconColor: '#42B883',
    label: 'Vue'
  }, {
    icon: SiAngular,
    iconColor: '#DD0031',
    label: 'Angular'
  }, {
    icon: SiJavascript,
    iconColor: '#F7DF1E',
    label: 'Vanilla JS'
  }, {
    icon: SiFlutter,
    iconColor: '#02569B',
    label: 'Flutter'
  }, {
    icon: SiReact,
    iconColor: '#61DAFB',
    label: 'React Native'
  }, {
    icon: SiNodedotjs,
    iconColor: '#5FA04E',
    label: 'Node.js'
  }, {
    icon: SiPython,
    iconColor: '#3776AB',
    label: 'Python'
  }, {
    icon: SiGo,
    iconColor: '#00ADD8',
    label: 'Go'
  }]
};
interface Props {
  data: ProductData;
  onChange: (patch: Partial<ProductData>) => void;
  onBack: () => void;
  onCreate: () => void;
  loading: boolean;
  error: string | null;
}
export function ConnectProductStep({
  data,
  onChange,
  onBack,
  onCreate,
  loading,
  error
}: Props) {
  const techOptions = data.productType ? TECH[data.productType] : [];
  const canCreate = data.projectName.trim().length > 0 && data.productType && data.technology;
  const selectType = (id: string) => {
    onChange({
      productType: id,
      technology: ''
    });
  };
  return <StepShell icon={<GlobeIcon className="h-6 w-6" aria-hidden="true" />} title="Connect your digital product" subtitle="Tell us what you're connecting — we'll give you the right SDK.">
      <Rule />

      <div>
        <FieldLabel required>Project name</FieldLabel>
        <TextInput value={data.projectName} onChange={(v) => onChange({
        projectName: v
      })} placeholder="My Digital Product" ariaLabel="Project name" />
      </div>

      <div>
        <FieldLabel required>What are you connecting?</FieldLabel>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {PRODUCT_TYPES.map((productType) => {
          const active = data.productType === productType.id;
          const Icon = productType.icon;
          return <motion.button key={productType.id} type="button" whileTap={{
            scale: 0.985
          }} onClick={() => selectType(productType.id)} aria-pressed={active} style={{
            borderColor: active ? colors.teal : colors.border,
            background: active ? 'rgba(39,166,206,0.055)' : '#fff',
            boxShadow: active ? '0 8px 20px rgba(39,166,206,0.10)' : '0 1px 2px rgba(15,27,42,0.02)'
          }} className="group relative flex min-h-[108px] items-start gap-4 overflow-hidden rounded-2xl border px-4 py-4 text-left transition-[border-color,box-shadow,background-color] hover:border-slate-300 hover:shadow-md">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors" style={{
              background: active ? '#e4f8fb' : '#f4f7fa',
              color: active ? colors.teal : colors.textSecondary
            }}>
                  <Icon className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
                </span>
                <span className="min-w-0 pr-5">
                  <span className="block text-sm font-bold" style={{
                color: colors.textPrimary
              }}>
                    {productType.label}
                  </span>
                  <span className="mt-1 block text-xs leading-relaxed" style={{
                color: colors.textMuted
              }}>
                    {productType.desc}
                  </span>
                </span>
                {active && <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full text-white" style={{
              background: colors.teal
            }}>
                    <CheckIcon className="h-3 w-3" strokeWidth={3} aria-hidden="true" />
                  </span>}
              </motion.button>;
        })}
        </div>
      </div>

      {data.productType && <motion.div initial={{
      opacity: 0,
      height: 0,
      y: 10
    }} animate={{
      opacity: 1,
      height: 'auto',
      y: 0
    }} transition={{
      duration: 0.24,
      ease: 'easeOut'
    }} className="overflow-hidden">
          <div className="mb-2 flex items-end justify-between gap-4">
            <FieldLabel required>Choose your primary technology</FieldLabel>
            <span className="mb-2 hidden text-xs sm:block" style={{
          color: colors.textMuted
        }}>
              You can add more later
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {techOptions.map((tech) => {
          const active = data.technology === tech.label;
          const Icon = tech.icon;
          return <motion.button key={tech.label} type="button" whileTap={{
            scale: 0.97
          }} onClick={() => onChange({
            technology: tech.label
          })} aria-pressed={active} style={{
            borderColor: active ? colors.teal : colors.border,
            background: active ? 'rgba(39,166,206,0.055)' : '#fff',
            boxShadow: active ? '0 8px 18px rgba(39,166,206,0.10)' : '0 1px 2px rgba(15,27,42,0.02)'
          }} className="group relative flex min-h-[112px] flex-col items-center justify-center rounded-2xl border p-4 transition-[border-color,box-shadow,background-color] hover:border-slate-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-cyan-100">
                  <span className="mb-2.5 flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50 transition-colors group-hover:bg-slate-100" aria-hidden="true">
                    <Icon className="h-6 w-6" style={{
                color: tech.iconColor
              }} />
                  </span>
                  <span className="text-xs font-semibold" style={{
              color: active ? colors.textPrimary : colors.textSecondary
            }}>
                    {tech.label}
                  </span>
                  {active && <span className="absolute right-2.5 top-2.5 flex h-5 w-5 items-center justify-center rounded-full text-white" style={{
              background: colors.teal
            }}>
                      <CheckIcon className="h-3 w-3" strokeWidth={3} aria-hidden="true" />
                    </span>}
                </motion.button>;
        })}
          </div>
        </motion.div>}

      <div>
        <FieldLabel>Environment</FieldLabel>
        <div className="flex gap-3">
          {(['production', 'staging'] as const).map((env) => {
          const active = data.environment === env;
          return <button key={env} type="button" onClick={() => onChange({
            environment: env
          })} style={{
            borderColor: active ? colors.teal : colors.border,
            background: active ? colors.tealSoft : '#fff',
            color: active ? colors.textPrimary : colors.textMuted
          }} className="flex flex-1 items-center justify-center gap-2 rounded-xl border-2 py-3 text-sm font-semibold capitalize transition-all">
                <span className="h-2 w-2 rounded-full" style={{
              background: env === 'production' ? colors.green : colors.yellow
            }} />
                {env}
              </button>;
        })}
        </div>
      </div>

      {error && <div className="flex items-start gap-2 rounded-xl border px-4 py-3 text-sm" style={{
      background: colors.redSoft,
      borderColor: 'rgba(220,38,38,0.3)',
      color: colors.red
    }} role="alert">
          <XIcon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>Failed to create organisation: {error}</span>
        </div>}

      <Rule />

      <StepFooter onBack={onBack} onNext={onCreate} nextLabel="Create project" nextDisabled={!canCreate} loading={loading} loadingLabel="Creating…" />
    </StepShell>;
}