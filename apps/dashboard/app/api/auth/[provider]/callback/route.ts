import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'

type TokenExchangeResult = {
  accessToken: string
  providerUser: string
  repoUrl?: string
}

async function exchangeGitHub(code: string, redirectUri: string): Promise<TokenExchangeResult> {
  const res = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      client_id: process.env.GITHUB_CLIENT_ID,
      client_secret: process.env.GITHUB_CLIENT_SECRET,
      code,
    }),
  })
  const data = await res.json()
  if (!data.access_token) throw new Error('no_token')

  const userRes = await fetch('https://api.github.com/user', {
    headers: { Authorization: `Bearer ${data.access_token}`, Accept: 'application/vnd.github+json' },
  })
  const user = await userRes.json()
  return { accessToken: data.access_token, providerUser: user.login, repoUrl: user.html_url }
}

async function exchangeGitLab(code: string, redirectUri: string): Promise<TokenExchangeResult> {
  const res = await fetch('https://gitlab.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: process.env.GITLAB_CLIENT_ID,
      client_secret: process.env.GITLAB_CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
    }),
  })
  const data = await res.json()
  if (!data.access_token) throw new Error('no_token')

  const userRes = await fetch('https://gitlab.com/api/v4/user', {
    headers: { Authorization: `Bearer ${data.access_token}` },
  })
  const user = await userRes.json()
  return { accessToken: data.access_token, providerUser: user.username, repoUrl: user.web_url }
}

async function exchangeBitbucket(code: string, redirectUri: string): Promise<TokenExchangeResult> {
  const credentials = Buffer.from(
    `${process.env.BITBUCKET_CLIENT_ID}:${process.env.BITBUCKET_CLIENT_SECRET}`,
  ).toString('base64')
  const res = await fetch('https://bitbucket.org/site/oauth2/access_token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${credentials}`,
    },
    body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: redirectUri }),
  })
  const data = await res.json()
  if (!data.access_token) throw new Error('no_token')
  return { accessToken: data.access_token, providerUser: data.scopes ?? 'bitbucket' }
}

async function exchangeAzure(code: string, redirectUri: string): Promise<TokenExchangeResult> {
  const res = await fetch('https://app.vssps.visualstudio.com/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
      client_assertion: process.env.AZURE_CLIENT_SECRET ?? '',
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: code,
      redirect_uri: redirectUri,
    }),
  })
  const data = await res.json()
  if (!data.access_token) throw new Error('no_token')
  return { accessToken: data.access_token, providerUser: 'azure' }
}

const EXCHANGE_FNS: Record<string, (code: string, redirectUri: string) => Promise<TokenExchangeResult>> = {
  github: exchangeGitHub,
  gitlab: exchangeGitLab,
  bitbucket: exchangeBitbucket,
  azure: exchangeAzure,
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider } = await params
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const stateParam = searchParams.get('state')

  // Decode state to get projectId
  let projectId: string | null = null
  try {
    const state = JSON.parse(Buffer.from(stateParam ?? '', 'base64url').toString())
    projectId = state.projectId
  } catch {
    // ignore
  }

  const fallback = projectId ? `/apps/${projectId}?repo_error=auth_failed` : '/setup'

  if (!code || !projectId || !EXCHANGE_FNS[provider]) {
    return NextResponse.redirect(new URL(fallback, request.url))
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin
  const redirectUri = `${appUrl}/api/auth/${provider}/callback`

  try {
    const { accessToken, providerUser, repoUrl } = await EXCHANGE_FNS[provider](code, redirectUri)

    const cookieStore = await cookies()
    const sb = createClient(cookieStore)

    await sb.from('project_repositories').upsert(
      {
        project_id: projectId,
        provider,
        provider_user: providerUser,
        repo_url: repoUrl ?? null,
        status: 'active',
      },
      { onConflict: 'project_id,provider' },
    )

    return NextResponse.redirect(new URL(`/apps/${projectId}?repo_connected=${provider}`, request.url))
  } catch {
    return NextResponse.redirect(new URL(`/apps/${projectId}?repo_error=auth_failed`, request.url))
  }
}
