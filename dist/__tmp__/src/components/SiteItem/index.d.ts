import {FunctionComponent} from 'react'
import {DeployAction, Site, Deploy} from '../../types'
interface Props {
  site: Site
  onDeploy: DeployAction
  deployHistory?: Deploy[]
  isRefreshing?: boolean
}
export declare const IMAGE_PULL_INTERVAL = 10000
declare const SiteItem: FunctionComponent<Props>
export default SiteItem
