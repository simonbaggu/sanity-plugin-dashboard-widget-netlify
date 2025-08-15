import React from 'react'
import {DeployAction, Site, Deploy} from '../types'
interface Props {
  isLoading: boolean
  sites?: Site[]
  onDeploy: DeployAction
  deployHistory?: Record<string, Deploy[]>
  isRefreshing?: boolean
}
export default function SiteList(props: Props): React.JSX.Element
export {}
