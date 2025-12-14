#!/bin/bash
# Helper script to run test-notifications on EC2
# Usage: ./run-script-ec2.sh list
# Usage: ./run-script-ec2.sh test <parentId> <scheduleId>
# Usage: ./run-script-ec2.sh cron
# Usage: ./run-script-ec2.sh create <parentId> <scheduleId> <daysAhead>

COMMAND=$1
shift  # Remove first argument, keep the rest

docker exec -it kdl-backend node dist/scripts/test-notifications.js "$COMMAND" "$@"
