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

  // console.log(`Trying CORS proxy ${proxyIndex + 1}: ${corsProxy}`)

  return jsonRequest<Deploy[]>(url, {
    method: 'GET',
    headers,
  }).pipe(
    map((deploys) => {
      // console.log('Raw response from CORS proxy:', deploys)

      // Handle different response formats from CORS proxies
      if (!Array.isArray(deploys)) {
        // console.warn('Invalid response format from CORS proxy - not an array:', typeof deploys)
        return []
      }

      // Filter out invalid deploy objects
      const validDeploys = deploys.filter(
        (deployItem) =>
          deployItem && typeof deployItem === 'object' && deployItem.id && deployItem.createdAt
      )

      // console.log(`Found ${validDeploys.length} valid deploys out of ${deploys.length} total`)

      return validDeploys.slice(0, 10).map((deployItem) => {
        // Safely parse dates to avoid "Invalid Date" errors
        const createdAt = deployItem.createdAt ? new Date(deployItem.createdAt) : null
        const publishedAt = deployItem.publishedAt ? new Date(deployItem.publishedAt) : null

        let buildTime: number | undefined
        if (
          createdAt &&
          publishedAt &&
          !isNaN(createdAt.getTime()) &&
          !isNaN(publishedAt.getTime())
        ) {
          buildTime = publishedAt.getTime() - createdAt.getTime()
        }

        return {
          ...deployItem,
          buildTime,
        }
      })
    }),
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
        deploys.slice(0, maxDeploys).map((deployItem) => {
          // Safely parse dates to avoid "Invalid Date" errors
          const createdAt = deployItem.createdAt ? new Date(deployItem.createdAt) : null
          const publishedAt = deployItem.publishedAt ? new Date(deployItem.publishedAt) : null

          let buildTime: number | undefined
          if (
            createdAt &&
            publishedAt &&
            !isNaN(createdAt.getTime()) &&
            !isNaN(publishedAt.getTime())
          ) {
            buildTime = publishedAt.getTime() - createdAt.getTime()
          }

          return {
            ...deployItem,
            buildTime,
          }
        })
      )
    )
  }

  // Otherwise, try the built-in CORS proxies
  return tryCorsProxy(netlifyUrl, accessToken)
}
