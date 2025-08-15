import {scan} from 'rxjs/operators'
import {Site, Deploy} from './types'

interface Deployment {
  id: string
}

interface Action {
  type: string
  sites?: Site[]
  site?: Site
  error?: Error
  deployments?: Deployment[]
  siteId?: string
  deploys?: Deploy[]
  errorMessage?: string
}

interface State {
  sites: Site[]
  deployHistory: Record<string, Deploy[]>
  isRefreshing: boolean
  action: Action
}

const initialState: State = {
  sites: [],
  deployHistory: {},
  isRefreshing: false,
  action: {type: 'init'},
}

export const stateReducer$ = scan((state: State = initialState, action: Action): State => {
  switch (action.type) {
    case 'setSites':
      return {...state, sites: action.sites || []}

    case 'deploy/started':
      return {
        ...state,
        sites: state.sites.map((site: Site) => {
          if (action.site && site.id === action.site.id) {
            return {...site}
          }
          return site
        }),
      }

    case 'deploy/failed':
      return {
        ...state,
        action,
      }

    case 'deploy/completed':
      return {
        ...state,
        sites: state.sites.map((site: Site) => {
          if (action.site && site.id === action.site.id) {
            return {...site, error: action.error}
          }
          return site
        }),
      }

    case 'deployHistory/updated':
      return {
        ...state,
        deployHistory: {
          ...state.deployHistory,
          [action.siteId!]: action.deploys || [],
        },
        isRefreshing: false,
      }

    case 'deployHistory/fastUpdated':
      return {
        ...state,
        deployHistory: {
          ...state.deployHistory,
          [action.siteId!]: action.deploys || [],
        },
        isRefreshing: true,
      }

    case 'deployHistory/failed':
      return {
        ...state,
        isRefreshing: false,
        deployHistory: {
          ...state.deployHistory,
          [action.siteId!]: [], // Set empty array for failed sites
        },
      }

    default:
      return state
  }
})
