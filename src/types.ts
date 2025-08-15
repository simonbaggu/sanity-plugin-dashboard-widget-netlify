export interface SiteWidgetOption {
  apiId: string
  name?: string
  title: string
  buildHookId: string
  url?: string
  branch?: string
}

export interface WidgetOptions {
  title?: string
  description?: string
  sites: SiteWidgetOption[]
  accessToken?: string
  proxyUrl?: string
  maxDeploys?: number
  pollIntervalMs?: number
  fastPollIntervalMs?: number
}

export interface Site {
  title: string
  name?: string
  id: string
  url?: string
  adminUrl?: string
  buildHookId: string
  branch?: string
}

export interface Deploy {
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

export type DeployAction = (site: Site) => void

export interface NetlifyWidgetProps {
  title?: string
  description?: string
  sites?: Site[]
  isLoading: boolean
  onDeploy: DeployAction
  deployHistory?: Record<string, Deploy[]>
  isRefreshing?: boolean
}
