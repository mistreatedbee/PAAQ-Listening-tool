import React, { useCallback, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Header } from './components/onboarding/Header';
import { ProgressBar } from './components/onboarding/ProgressBar';
import { WelcomeStep } from './components/onboarding/steps/WelcomeStep';
import { OrganisationStep } from './components/onboarding/steps/OrganisationStep';
import { ConnectProductStep } from './components/onboarding/steps/ConnectProductStep';
import { SdkSetupStep } from './components/onboarding/steps/SdkSetupStep';
import { DoneStep } from './components/onboarding/steps/DoneStep';
import type { Credentials, OrgData, ProductData } from './components/onboarding/types';

type Screen = 'welcome' | 'org' | 'product' | 'sdk' | 'done';

const STEP_NAMES: Record<Screen, string | undefined> = {
  welcome: undefined,
  org: 'Your Organisation',
  product: 'Connect Product',
  sdk: 'SDK Setup',
  done: 'All Set'
};

// Maps a screen to its 1-based progress step (only org/product/sdk/done show the bar).
const PROGRESS_STEP: Partial<Record<Screen, number>> = {
  org: 1,
  product: 2,
  sdk: 3,
  done: 4
};

function randToken(prefix: string, len = 24) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let out = '';
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return `${prefix}${out}`;
}

export function App() {
  const [screen, setScreen] = useState<Screen>('welcome');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const [org, setOrg] = useState<OrgData>({
    company: '',
    industry: '',
    country: '',
    website: '',
    teamSize: ''
  });

  const [product, setProduct] = useState<ProductData>({
    projectName: '',
    productType: '',
    technology: '',
    environment: 'production'
  });

  const [credentials, setCredentials] = useState<Credentials | null>(null);

  const goto = useCallback((next: Screen) => {
    setScreen(next);
    setError(null);
    requestAnimationFrame(() => {
      contentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }, []);

  const createProject = useCallback(async () => {
    setCreating(true);
    setError(null);
    try {
      await new Promise((r) => setTimeout(r, 1100));
      const env = product.environment === 'production' ? 'live' : 'test';
      setCredentials({
        projectId: randToken('proj_', 12),
        sdkToken: randToken(`sdk_${env}_`, 20),
        publicKey: randToken(`pk_${env}_`, 20),
        secretKey: randToken(`sk_${env}_`, 24),
        webhookSecret: randToken('whsec_', 24)
      });
      goto('sdk');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setCreating(false);
    }
  }, [product.environment, goto]);

  const progressStep = PROGRESS_STEP[screen];

  const body = useMemo(() => {
    switch (screen) {
      case 'welcome':
        return <WelcomeStep onNext={() => goto('org')} />;
      case 'org':
        return (
          <OrganisationStep
            data={org}
            onChange={(patch) => setOrg((prev) => ({ ...prev, ...patch }))}
            onBack={() => goto('welcome')}
            onNext={() => goto('product')} />);


      case 'product':
        return (
          <ConnectProductStep
            data={product}
            onChange={(patch) => setProduct((prev) => ({ ...prev, ...patch }))}
            onBack={() => goto('org')}
            onCreate={createProject}
            loading={creating}
            error={error} />);


      case 'sdk':
        return credentials ?
        <SdkSetupStep
          product={product}
          credentials={credentials}
          onBack={() => goto('product')}
          onNext={() => goto('done')} /> :

        null;
      case 'done':
        return <DoneStep projectName={product.projectName} onFinish={() => goto('welcome')} />;
      default:
        return null;
    }
  }, [screen, org, product, credentials, creating, error, goto, createProject]);

  return (
    <div className="flex min-h-full w-full flex-col" style={{ background: '#f5f8fb' }}>
      <Header stepName={STEP_NAMES[screen]} />
      <main ref={contentRef} className="mx-auto w-full max-w-2xl flex-1 px-6 py-10">
        {progressStep && <ProgressBar currentStep={progressStep} />}
        <AnimatePresence mode="wait">
          <motion.div
            key={screen}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}>
            
            {body}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>);

}