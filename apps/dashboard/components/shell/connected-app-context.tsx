'use client'

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import { PAAQ_APP, DEMO_APP, type ConnectedApp } from '@/lib/connected-app'

type ConnectedAppCtx = {
  app: ConnectedApp
  setApp: (id: string) => void
  allApps: ConnectedApp[]
}

const ConnectedAppContext = createContext<ConnectedAppCtx>({
  app: PAAQ_APP,
  setApp: () => {},
  allApps: [PAAQ_APP, DEMO_APP],
})

export function ConnectedAppProvider({ children }: { children: ReactNode }) {
  const [app, setAppState] = useState<ConnectedApp>(PAAQ_APP)

  const setApp = useCallback((id: string) => {
    const found = [PAAQ_APP, DEMO_APP].find((a) => a.id === id)
    if (found) setAppState(found)
  }, [])

  return (
    <ConnectedAppContext.Provider value={{ app, setApp, allApps: [PAAQ_APP, DEMO_APP] }}>
      {children}
    </ConnectedAppContext.Provider>
  )
}

export function useConnectedApp() {
  return useContext(ConnectedAppContext)
}
