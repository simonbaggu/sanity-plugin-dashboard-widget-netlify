import {merge, of, timer} from 'rxjs'
import {createEventHandler} from 'react-props-stream'
import {catchError, map, startWith, switchMap} from 'rxjs/operators'
import {deploy, fetchDeployHistory} from './datastores/deploy'
import {Site, WidgetOptions} from './types'
import {stateReducer$} from './reducers'

const noop = () => undefined

const INITIAL_PROPS = {
  title: 'Netlify sites',
  sites: [],
  isLoading: true,
  onDeploy: noop,
  deployHistory: {},
  isRefreshing: false,
}

// Helper function to create deploy history stream for a site
const createDeployHistoryStream = (
  site: Site,
  actionType: string,
  accessToken?: string,
  proxyUrl?: string,
  maxDeploys: number = 10
) => {
  return fetchDeployHistory(site.id, accessToken, proxyUrl, maxDeploys).pipe(
    map((deploys) => ({type: actionType, siteId: site.id, deploys})),
    catchError(() => of({type: 'deployHistory/failed', siteId: site.id}))
  )
}

// Helper function to create deploy history streams for all sites
const createDeployHistoryStreams = (
  sites: Site[],
  actionType: string,
  accessToken?: string,
  proxyUrl?: string,
  maxDeploys: number = 10
) => {
  return merge(
    ...sites.map((site) =>
      createDeployHistoryStream(site, actionType, accessToken, proxyUrl, maxDeploys)
    )
  )
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export const props$ = (options: WidgetOptions) => {
  const {
    accessToken,
    proxyUrl,
    maxDeploys = 10,
    pollIntervalMs = 30000,
    fastPollIntervalMs = 5000,
  } = options

  const configuredSites = (options.sites || []).map((site) => ({
    id: site.apiId,
    name: site.name,
    title: site.title,
    buildHookId: site.buildHookId,
    url:
      site.url ||
      (site.branch && `https://${site.branch}--${site.name}.netlify.app/`) ||
      (site.name && `https://${site.name}.netlify.app/`),
    adminUrl: site.name && `https://app.netlify.com/sites/${site.name}`,
    branch: site.branch,
  }))

  const [onDeploy$, onDeploy] = createEventHandler<Site>()
  const setSitesAction$ = of(configuredSites).pipe(map((sites) => ({type: 'setSites', sites})))
  const deployAction$ = onDeploy$.pipe(map((site) => ({type: 'deploy/started', site})))
  const deployResult$ = onDeploy$.pipe(switchMap((site) => deploy(site, accessToken, proxyUrl)))
  const deployCompletedAction$ = deployResult$.pipe(
    map(
      (result) => ({type: 'deploy/completed', ...result}),
      catchError((error) => of({type: 'deploy/failed', error}))
    )
  )

  // Auto-refresh functionality
  const refreshDeployHistory$ = timer(0, pollIntervalMs).pipe(
    switchMap(() =>
      of(configuredSites).pipe(
        switchMap((sites) =>
          createDeployHistoryStreams(
            sites,
            'deployHistory/updated',
            accessToken,
            proxyUrl,
            maxDeploys
          )
        )
      )
    )
  )

  // Fast refresh when deploy is in progress
  const fastRefresh$ = timer(0, fastPollIntervalMs).pipe(
    switchMap(() =>
      of(configuredSites).pipe(
        switchMap((sites) =>
          createDeployHistoryStreams(
            sites,
            'deployHistory/fastUpdated',
            accessToken,
            proxyUrl,
            maxDeploys
          )
        )
      )
    )
  )

  const state$ = merge(
    setSitesAction$,
    deployAction$,
    deployCompletedAction$,
    refreshDeployHistory$,
    fastRefresh$
  ).pipe(stateReducer$)

  return state$.pipe(
    map((state) => ({
      sites: state.sites,
      title: options.title || INITIAL_PROPS.title,
      description: options.description,
      isLoading: false,
      onDeploy,
      deployHistory: state.deployHistory,
      isRefreshing: state.isRefreshing,
    })),
    startWith(INITIAL_PROPS)
  )
}
