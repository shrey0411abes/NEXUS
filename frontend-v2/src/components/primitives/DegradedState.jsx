import React from 'react'
import EmptyState from '../EmptyState.jsx'

export function DegradedState({ title, description, onRetry }) {
  return (
    <EmptyState
      variant="degraded"
      title={title || 'Operating in Degraded Mode'}
      description={description || 'Analytical feeds are currently reporting partial telemetry. Verified local records are displayed.'}
      actionText={onRetry ? 'Retry Sync' : undefined}
      onAction={onRetry}
    />
  )
}

export function ErrorState({ title, description, onRetry }) {
  return (
    <EmptyState
      variant="error"
      title={title || 'Operational Retrieval Error'}
      description={description || 'Failed to communicate with the local deterministic engine. Check server connection.'}
      actionText={onRetry ? 'Retry Retrieval' : undefined}
      onAction={onRetry}
    />
  )
}

export default { DegradedState, ErrorState }
