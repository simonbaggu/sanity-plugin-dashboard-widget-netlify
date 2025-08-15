import {Observable} from 'rxjs'
import {Site, Deploy} from '../types'
export declare function deploy(
  site: Site,
  accessToken?: string,
  proxyUrl?: string
): Observable<
  | {
      result: number
      site: Site
    }
  | Error
>
export declare function fetchDeployHistory(
  siteId: string,
  accessToken?: string,
  proxyUrl?: string,
  maxDeploys?: number
): Observable<Deploy[]>
