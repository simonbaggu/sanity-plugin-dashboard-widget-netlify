import {Observable, of} from 'rxjs'
import {map} from 'rxjs/operators'
import {statusCodeRequest} from '../http/statusCodeRequest'
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
  _siteId: string,
  _accessToken?: string,
  _proxyUrl?: string,
  _maxDeploys: number = 10
): Observable<Deploy[]> {
  // For now, we'll skip deploy history fetching due to CORS limitations
  // Users can still trigger deploys, but deploy history won't be available
  // until Netlify adds CORS support or we implement a server-side solution

  console.warn(
    'Deploy history fetching is disabled due to Netlify API CORS limitations. Only deploy triggering is available.'
  )

  return of([])
}
