/**
 * Minimal, dependency-free User-Agent parser for the web platform, where
 * the client only has a raw `navigator.userAgent` string to send — mobile
 * SDKs report browser/OS/device fields directly from first-party OS APIs
 * and skip this entirely.
 */
export type ParsedUserAgent = {
  browserName: string | null
  browserVersion: string | null
  osName: string | null
  osVersion: string | null
  deviceType: 'desktop' | 'mobile' | 'tablet' | null
}

export function parseUserAgent(ua: string | null | undefined): ParsedUserAgent {
  if (!ua) {
    return { browserName: null, browserVersion: null, osName: null, osVersion: null, deviceType: null }
  }

  let browserName: string | null = null
  let browserVersion: string | null = null
  if (/Edg\//.test(ua)) {
    browserName = 'Edge'
    browserVersion = ua.match(/Edg\/([\d.]+)/)?.[1] ?? null
  } else if (/SamsungBrowser\//.test(ua)) {
    browserName = 'Samsung Internet'
    browserVersion = ua.match(/SamsungBrowser\/([\d.]+)/)?.[1] ?? null
  } else if (/OPR\/|Opera\//.test(ua)) {
    browserName = 'Opera'
    browserVersion = ua.match(/(?:OPR|Opera)\/([\d.]+)/)?.[1] ?? null
  } else if (/Firefox\//.test(ua)) {
    browserName = 'Firefox'
    browserVersion = ua.match(/Firefox\/([\d.]+)/)?.[1] ?? null
  } else if (/CriOS\//.test(ua)) {
    browserName = 'Chrome'
    browserVersion = ua.match(/CriOS\/([\d.]+)/)?.[1] ?? null
  } else if (/Chrome\//.test(ua)) {
    browserName = 'Chrome'
    browserVersion = ua.match(/Chrome\/([\d.]+)/)?.[1] ?? null
  } else if (/Safari\//.test(ua) && /Version\//.test(ua)) {
    browserName = 'Safari'
    browserVersion = ua.match(/Version\/([\d.]+)/)?.[1] ?? null
  }

  let osName: string | null = null
  let osVersion: string | null = null
  if (/Windows NT ([\d.]+)/.test(ua)) {
    osName = 'Windows'
    osVersion = ua.match(/Windows NT ([\d.]+)/)?.[1] ?? null
  } else if (/Mac OS X ([\d_]+)/.test(ua) && !/iPhone|iPad|iPod/.test(ua)) {
    osName = 'macOS'
    osVersion = ua.match(/Mac OS X ([\d_]+)/)?.[1]?.replace(/_/g, '.') ?? null
  } else if (/Android ([\d.]+)/.test(ua)) {
    osName = 'Android'
    osVersion = ua.match(/Android ([\d.]+)/)?.[1] ?? null
  } else if (/iPhone|iPad|iPod/.test(ua)) {
    osName = 'iOS'
    osVersion = ua.match(/OS ([\d_]+) like Mac OS X/)?.[1]?.replace(/_/g, '.') ?? null
  } else if (/Linux/.test(ua)) {
    osName = 'Linux'
  }

  let deviceType: ParsedUserAgent['deviceType'] = 'desktop'
  if (/iPad|Tablet/.test(ua) || (/Android/.test(ua) && !/Mobile/.test(ua))) {
    deviceType = 'tablet'
  } else if (/Mobi|iPhone|Android/.test(ua)) {
    deviceType = 'mobile'
  }

  return { browserName, browserVersion, osName, osVersion, deviceType }
}
