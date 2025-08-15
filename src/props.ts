import {merge, of, timer} from 'rxjs'
import {createEventHandler} from 'react-props-stream'
import {
  catchError,
  map,
  startWith,
  switchMap,
  debounceTime,
  distinctUntilChanged,
} from 'rxjs/operators'
import {deploy, fetchDeployHistory} from './datastores/deploy'
import {stateReducer$} from './reducers'
import {WidgetOptions, Site, NetlifyWidgetProps} from './types'

const INITIAL_PROPS: NetlifyWidgetProps = {
  title: 'Netlify Deployments',
  description: 'Deploy your sites to Netlify',
  sites: [],
  isLoading: true,
  onDeploy: () => {
    // Empty function for initial state
  },
  deployHistory: {},
  isRefreshing: false,
}

const createDeployHistoryStream = (
  site: Site,
  actionType: string,
  accessToken?: string,
  proxyUrl?: string,
  maxDeploys: number = 10
) => {
  return fetchDeployHistory(site.id, accessToken, proxyUrl, maxDeploys).pipe(
    map((deploys) => ({type: actionType, siteId: site.id, deploys})),
    catchError((error) => {
      console.error(`Failed to fetch deploys for site ${site.id}:`, error)
      return of({type: 'deployHistory/failed', siteId: site.id, error: error.message})
    })
  )
}

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

  // Initial load - only run once
  const initialLoad$ = timer(1000).pipe(
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

  // Auto-refresh functionality - start after pollIntervalMs
  const refreshDeployHistory$ = timer(pollIntervalMs, pollIntervalMs).pipe(
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

  // Fast refresh when deploy is in progress - start after fastPollIntervalMs
  const fastRefresh$ = timer(fastPollIntervalMs, fastPollIntervalMs).pipe(
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
    initialLoad$,
    refreshDeployHistory$,
    fastRefresh$
  ).pipe(stateReducer$)

  return state$.pipe(
    debounceTime(100), // Prevent rapid state changes
    distinctUntilChanged(
      (prev, curr) => JSON.stringify(prev.deployHistory) === JSON.stringify(curr.deployHistory)
    ),
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
