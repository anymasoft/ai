🔒 Deployment State Machine

The implementation creates a robust deployment state machine:

## State Machine Diagram

```mermaid
stateDiagram-v2
    [*] --> idle : Initial State

    idle --> preparing : AI Request Submitted
    deployed --> preparing : AI Request Submitted
    failed --> preparing : AI Request Submitted

    preparing --> deploying : Preparation Complete
    deploying --> deployed : Deployment Success
    deploying --> failed : Deployment Failure

    deployed --> idle : Rollback Performed
    failed --> idle : Rollback Performed

    classDef readyStates fill:#e8f5e8,stroke:#4caf50,stroke-width:2px
    classDef progressStates fill:#fff3e0,stroke:#ff9800,stroke-width:2px
    classDef failedState fill:#ffebee,stroke:#f44336,stroke-width:2px

    class idle,deployed readyStates
    class preparing,deploying progressStates
    class failed failedState
```

## Deployment States

| State Category | State | Description |
|---|---|---|
| **READY FOR NEW DEPLOYMENT** | `null/idle` | Project ready for deployment |
| | `deployed` | Previous deployment successful |
| | `failed` | Previous deployment failed |
| **DEPLOYMENT IN PROGRESS (BLOCKED)** | `preparing` | Deployment being prepared |
| | `deploying` | Deployment in progress |

## State Reset Triggers

| Trigger Event | Resulting State | Description |
|---|---|---|
| AI Request Submitted | `idle` | Status reset to allow new deployment |
| Rollback Performed | `idle` | Status reset after rollback operation |
| Deployment Completed | `deployed` | Status updated on successful deployment |
| Deployment Failed | `failed` | Status updated on deployment failure |