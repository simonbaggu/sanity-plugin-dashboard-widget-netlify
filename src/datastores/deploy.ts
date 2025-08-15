import {Observable, of} from 'rxjs'
import {map, catchError} from 'rxjs/operators'
import {statusCodeRequest} from '../http/statusCodeRequest'
import {jsonRequest} from '../http/jsonRequest'
import {Site, Deploy} from '../types'

// List of reliable CORS proxy services
const CORS_PROXIES = [
  'https://corsproxy.io/?',
  'https://api.allorigins.win/raw?url=',
  'https://cors-anywhere.herokuapp.com/',
]

export function deploy(
  site: Site,
  accessToken?: string,
  proxyUrl?: string
): Observable<{result: number; site: Site} | Error> {
  if (!site.buildHookId) {
    return of(new Error('Site missing buildHookId'))
  }

  const url = proxyUrl
    ? `${proxyUrl}/build_hooks/${site.buildHookId}`
    : `https://api.netlify.com/build_hooks/${site.buildHookId}`

  const headers: Record<string, string> = {}
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`
  }

  return statusCodeRequest(url, {
    method: 'POST',
    headers,
  }).pipe(map((result) => ({result, site})))
}

function tryCorsProxy(
  netlifyUrl: string,
  accessToken?: string,
  proxyIndex: number = 0
): Observable<Deploy[]> {
  if (proxyIndex >= CORS_PROXIES.length) {
    console.warn('All CORS proxies failed. Deploy history unavailable.')
    return of([])
  }

  const corsProxy = CORS_PROXIES[proxyIndex]
  const url = `${corsProxy}${encodeURIComponent(netlifyUrl)}`

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`
  }

  return jsonRequest<Deploy[]>(url, {
    method: 'GET',
    headers,
  }).pipe(
    map((deploys) =>
      deploys.slice(0, 10).map((deployItem) => ({
        ...deployItem,
        buildTime:
          deployItem.publishedAt && deployItem.createdAt
            ? new Date(deployItem.publishedAt).getTime() - new Date(deployItem.createdAt).getTime()
            : undefined,
      }))
    ),
    catchError((error) => {
      console.warn(`CORS proxy ${proxyIndex + 1} failed:`, error.message)
      return tryCorsProxy(netlifyUrl, accessToken, proxyIndex + 1)
    })
  )
}

export function fetchDeployHistory(
  siteId: string,
  accessToken?: string,
  proxyUrl?: string,
  maxDeploys: number = 10
): Observable<Deploy[]> {
  const netlifyUrl = `https://api.netlify.com/api/v1/sites/${siteId}/deploys`

  // If custom proxy is provided, use it
  if (proxyUrl) {
    const url = `${proxyUrl}/sites/${siteId}/deploys`
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }

    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`
    }

    return jsonRequest<Deploy[]>(url, {
      method: 'GET',
      headers,
    }).pipe(
      map((deploys) =>
        deploys.slice(0, maxDeploys).map((deployItem) => ({
          ...deployItem,
          buildTime:
            deployItem.publishedAt && deployItem.createdAt
              ? new Date(deployItem.publishedAt).getTime() -
                new Date(deployItem.createdAt).getTime()
              : undefined,
        }))
      )
    )
  }

  // Otherwise, try the built-in CORS proxies
  return tryCorsProxy(netlifyUrl, accessToken)
}
