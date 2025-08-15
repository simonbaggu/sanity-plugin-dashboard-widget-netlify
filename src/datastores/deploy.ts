import {Observable, of} from 'rxjs'
import {map} from 'rxjs/operators'
import {statusCodeRequest} from '../http/statusCodeRequest'
import {jsonRequest} from '../http/jsonRequest'
import {Site, Deploy} from '../types'

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

export function fetchDeployHistory(
  siteId: string,
  accessToken?: string,
  proxyUrl?: string,
  maxDeploys: number = 10
): Observable<Deploy[]> {
  const url = proxyUrl
    ? `${proxyUrl}/sites/${siteId}/deploys`
    : `https://api.netlify.com/api/v1/sites/${siteId}/deploys`

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
            ? new Date(deployItem.publishedAt).getTime() - new Date(deployItem.createdAt).getTime()
            : undefined,
      }))
    )
  )
}
