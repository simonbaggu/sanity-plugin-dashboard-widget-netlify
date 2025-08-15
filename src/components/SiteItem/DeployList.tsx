import React, {FunctionComponent} from 'react'
import {Box, Card, Text, Stack, Badge, Flex} from '@sanity/ui'
import {Deploy} from '../../types'

interface Props {
  deploys: Deploy[]
  isLoading?: boolean
}

const formatBuildTime = (buildTime?: number): string => {
  if (!buildTime) return 'Unknown'
  
  const seconds = Math.floor(buildTime / 1000)
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  
  if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`
  }
  return `${seconds}s`
}

const getStatusColor = (status: Deploy['status']): 'primary' | 'positive' | 'critical' | 'caution' => {
  switch (status) {
    case 'ready':
      return 'positive'
    case 'error':
      return 'critical'
    case 'building':
      return 'primary'
    case 'cancelled':
      return 'caution'
    default:
      return 'primary'
  }
}

const formatDate = (dateString: string): string => {
  const date = new Date(dateString)
  const now = new Date()
  const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60))
  
  if (diffInMinutes < 1) return 'Just now'
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`
  
  const diffInHours = Math.floor(diffInMinutes / 60)
  if (diffInHours < 24) return `${diffInHours}h ago`
  
  const diffInDays = Math.floor(diffInHours / 24)
  if (diffInDays < 7) return `${diffInDays}d ago`
  
  return date.toLocaleDateString()
}

const DeployList: FunctionComponent<Props> = ({deploys, isLoading}) => {
  if (isLoading) {
    return (
      <Box padding={3}>
        <Text size={1} muted>Loading deploy history...</Text>
      </Box>
    )
  }

  if (!deploys || deploys.length === 0) {
    return (
      <Box padding={3}>
        <Text size={1} muted>No deploy history available</Text>
      </Box>
    )
  }

  return (
    <Stack space={2}>
      {deploys.map((deploy) => (
        <Card key={deploy.id} padding={3} radius={2} tone="default">
          <Stack space={2}>
            <Flex justify="space-between" align="center">
              <Stack space={1}>
                <Text size={1} weight="semibold">
                  {deploy.commitMessage || `Deploy ${deploy.id.slice(0, 8)}`}
                </Text>
                {deploy.branch && (
                  <Text size={0} muted>
                    Branch: {deploy.branch}
                  </Text>
                )}
              </Stack>
              <Badge tone={getStatusColor(deploy.status)} mode="outline">
                {deploy.status}
              </Badge>
            </Flex>
            
            <Flex justify="space-between" align="center">
              <Text size={0} muted>
                {formatDate(deploy.createdAt)}
              </Text>
              {deploy.buildTime && (
                <Text size={0} muted>
                  Build: {formatBuildTime(deploy.buildTime)}
                </Text>
              )}
            </Flex>
            
            {deploy.errorMessage && (
              <Card tone="critical" padding={2} radius={1}>
                <Text size={0}>{deploy.errorMessage}</Text>
              </Card>
            )}
            
            {deploy.deployUrl && (
              <Text size={0}>
                <a href={deploy.deployUrl} target="_blank" rel="noopener noreferrer">
                  View deploy →
                </a>
              </Text>
            )}
          </Stack>
        </Card>
      ))}
    </Stack>
  )
}

export default DeployList
