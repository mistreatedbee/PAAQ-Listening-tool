import { NextRequest, NextResponse } from 'next/server'

type OAuthConfig = {
  clientIdEnv: string
  buildUrl: (clientId: string, redirectUri: string, state: string) => string
}

const PROVIDER_CONFIG: Record<string, OAuthConfig> = {
  github: {
    clientIdEnv: 'GITHUB_CLIENT_ID',
    buildUrl: (clientId, redirectUri, state) =>
      `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=repo%2Cread%3Auser&state=${state}`,
  },
  gitlab: {
    clientIdEnv: 'GITLAB_CLIENT_ID',
    buildUrl: (clientId, redirectUri, state) =>
      `https://gitlab.com/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=read_repository+read_user&state=${state}`,
  },
  bitbucket: {
    clientIdEnv: 'BITBUCKET_CLIENT_ID',
    buildUrl: (clientId, redirectUri, state) =>
      `https://bitbucket.org/site/oauth2/authorize?client_id=${clientId}&response_type=code&state=${state}&redirect_uri=${encodeURIComponent(redirectUri)}`,
  },
  azure: {
    clientIdEnv: 'AZURE_CLIENT_ID',
    buildUrl: (clientId, redirectUri, state) =>
      `https://app.vssps.visualstudio.com/oauth2/authorize?client_id=${clientId}&response_type=Assertion&state=${state}&scope=vso.code&redirect_uri=${encodeURIComponent(redirectUri)}`,
  },
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider } = await params
  const { searchParams } = new URL(request.url)
  const projectId = searchParams.get('project_id')

  const config = PROVIDER_CONFIG[provider]

  if (!config || !projectId) {
    return NextResponse.redirect(new URL('/setup', request.url))
  }

  const clientId = process.env[config.clientIdEnv]
  if (!clientId) {
    return NextResponse.redirect(
      new URL(`/apps/${projectId}?repo_error=not_configured`, request.url),
    )
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin
  const redirectUri = `${appUrl}/api/auth/${provider}/callback`
  const state = Buffer.from(JSON.stringify({ projectId, provider })).toString('base64url')

  return NextResponse.redirect(config.buildUrl(clientId, redirectUri, state))
}
