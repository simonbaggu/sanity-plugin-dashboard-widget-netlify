import {DashboardWidget} from '@sanity/dashboard'
import {LayoutConfig} from '@sanity/dashboard'

export declare interface Deploy {
  id: string
  siteId: string
  status: 'building' | 'ready' | 'error' | 'cancelled'
  createdAt: string
  publishedAt?: string
  buildTime?: number
  errorMessage?: string
  branch?: string
  commitRef?: string
  commitMessage?: string
  deployUrl?: string
}

export declare type DeployAction = (site: Site) => void

export declare function netlifyWidget(config: NetlifyWidgetConfig): DashboardWidget

export declare type NetlifyWidgetConfig = WidgetOptions & {
  layout?: LayoutConfig
}

export declare interface NetlifyWidgetProps {
  title?: string
  description?: string
  sites?: Site[]
  isLoading: boolean
  onDeploy: DeployAction
  deployHistory?: Record<string, Deploy[]>
  isRefreshing?: boolean
}

export declare interface Site {
  title: string
  name?: string
  id: string
  url?: string
  adminUrl?: string
  buildHookId: string
  branch?: string
}

export declare interface SiteWidgetOption {
  apiId: string
  name?: string
  title: string
  buildHookId: string
  url?: string
  branch?: string
}

export declare interface WidgetOptions {
  title?: string
  description?: string
  sites: SiteWidgetOption[]
  accessToken?: string
  proxyUrl?: string
  maxDeploys?: number
  pollIntervalMs?: number
  fastPollIntervalMs?: number
}

export {}
