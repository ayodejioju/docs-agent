# Deployments

## Release process
Releases go out through the CI pipeline on merge to main. Every release needs one approving review and a green test run before the deploy stage starts.

## Rollbacks
To roll back, re-run the previous successful pipeline run from the pipeline history. Database migrations must ship with a down script so a rollback never leaves the schema ahead of the code.

## Release windows
Production deployments are allowed Monday to Thursday. There are no Friday deployments unless the on-call lead approves an emergency fix.
