import {Site, WidgetOptions} from './types'
export declare const props$: (options: WidgetOptions) => import('rxjs').Observable<
  | {
      title: string
      sites: never[]
      isLoading: boolean
      onDeploy: () => undefined
      deployHistory: {}
      isRefreshing: boolean
    }
  | {
      sites: Site[]
      title: string
      description: string | undefined
      isLoading: boolean
      onDeploy: (event: Site) => void
      deployHistory: Record<string, import('./types').Deploy[]>
      isRefreshing: boolean
    }
>
