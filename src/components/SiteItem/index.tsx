import React, {FunctionComponent, useCallback, useEffect, useRef, useState} from 'react'
import {Button, Flex, Box, Card, Text, Stack, Label} from '@sanity/ui'
import {DeployAction, Site, Deploy} from '../../types'
import Links from './Links'
import DeployList from './DeployList'

interface Props {
  site: Site
  onDeploy: DeployAction
  deployHistory?: Deploy[]
  isRefreshing?: boolean
}

export const IMAGE_PULL_INTERVAL = 10000

const getImageUrl = (siteId: string, branchName?: string) => {
  const baseUrl = `https://api.netlify.com/api/v1/badges/${siteId}/deploy-status`
  const time = new Date().getTime()
  const branch = `branch=${branchName}`

  return branchName ? `${baseUrl}?${time}&${branch}` : `${baseUrl}?${time}`
}

const useBadgeImage = (siteId: string, branchName?: string ) => {
  const [src, setSrc] = useState(() => getImageUrl(siteId, branchName))
  const update = useCallback(() => setSrc(getImageUrl(siteId, branchName)), [siteId])

  useEffect(() => {
    const interval = window.setInterval(update, IMAGE_PULL_INTERVAL)
    return () => window.clearInterval(interval)
  }, [update])

  return [src, update] as const
}

const useDeploy = (site: Site, onDeploy: DeployAction, updateBadge: () => void) => {
  const timeoutRef = useRef(-1)
  useEffect(() => () => window.clearTimeout(timeoutRef.current), [])

  return useCallback(() => {
    onDeploy(site)
    timeoutRef.current = window.setTimeout(updateBadge, 1000)
  }, [site, onDeploy, updateBadge])
}

const SiteItem: FunctionComponent<Props> = (props) => {
  const [hasBadgeError, setHasBadgeError] = useState(false)
  const [showDeployHistory, setShowDeployHistory] = useState(false)
  const {site, onDeploy, deployHistory = [], isRefreshing = false} = props
  const {id, name, title, url, adminUrl, buildHookId, branch} = site

  const [badge, updateBadge] = useBadgeImage(id, branch)
  const handleDeploy = useDeploy(site, onDeploy, updateBadge)
  const handleBadgeError = () => {
    setHasBadgeError(true)
  }

  const toggleDeployHistory = () => {
    setShowDeployHistory(!showDeployHistory)
  }

  const hasDeployHistory = deployHistory && deployHistory.length > 0
  const latestDeploy = deployHistory[0]

  return (
    <Card as="li" padding={3} radius={2} tone="default">
      <Stack space={3}>
        <Flex justify="space-between" align="flex-start">
          <Box flex={1}>
            <Stack space={2}>
              <Text as="h4">
                {title || name}
                <Links url={url} adminUrl={adminUrl} />
              </Text>

              <Flex justify="flex-start" align="center" gap={2}>
                {!hasBadgeError && <img src={badge} onError={handleBadgeError} alt="Badge" />}
                {hasBadgeError && (
                  <Card tone="critical" radius={2} padding={2}>
                    <Label size={0} muted>Failed to load badge</Label>
                  </Card>
                )}
                {isRefreshing && (
                  <Text size={0} muted>Refreshing...</Text>
                )}
              </Flex>
            </Stack>
          </Box>

          {buildHookId && (
            <Box>
              <Button mode="ghost" onClick={handleDeploy} text="Deploy" />
            </Box>
          )}
        </Flex>

        {hasDeployHistory && (
          <Box>
            <Flex justify="space-between" align="center">
              <Text size={1} weight="semibold">Deploy History</Text>
              <Button 
                mode="bleed" 
                onClick={toggleDeployHistory} 
                text={showDeployHistory ? "Hide" : "Show"}
                size={0}
              />
            </Flex>
            
            {latestDeploy && (
              <Box marginTop={2}>
                <Text size={0} muted>
                  Latest: {latestDeploy.status} • {new Date(latestDeploy.createdAt).toLocaleDateString()}
                </Text>
              </Box>
            )}
            
            {showDeployHistory && (
              <Box marginTop={3}>
                <DeployList deploys={deployHistory} isLoading={isRefreshing} />
              </Box>
            )}
          </Box>
        )}
      </Stack>
    </Card>
  )
}

export default SiteItem
