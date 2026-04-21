#!/usr/bin/env bash
set -euo pipefail

if ! command -v aws >/dev/null 2>&1; then
  echo "aws CLI is required"
  exit 1
fi

AWS_REGION="${AWS_REGION:-us-east-1}"
AWS_PROFILE="${AWS_PROFILE:-inseason-admin}"
FUNCTION_NAME="${FUNCTION_NAME:-inseason-monthly-cache-clear}"
SCHEDULE_NAME="${SCHEDULE_NAME:-inseason-monthly-cache-clear}"
SCHEDULER_GROUP_NAME="${SCHEDULER_GROUP_NAME:-default}"
SCHEDULE_EXPRESSION="${SCHEDULE_EXPRESSION:-cron(0 08 1 * ? *)}"
SCHEDULER_ROLE_ARN="${SCHEDULER_ROLE_ARN:-}"
SCHEDULE_INPUT="${SCHEDULE_INPUT:-{\"source\":\"inseason.monthly-cache-clear\"}}"

if [[ -z "$SCHEDULER_ROLE_ARN" ]]; then
  echo "Set SCHEDULER_ROLE_ARN to an IAM role ARN that can invoke the Lambda."
  exit 1
fi

echo "Resolving Lambda ARN for $FUNCTION_NAME..."
TARGET_ARN="$(aws lambda get-function \
  --function-name "$FUNCTION_NAME" \
  --region "$AWS_REGION" \
  --profile "$AWS_PROFILE" \
  --query 'Configuration.FunctionArn' \
  --output text)"
TARGET_JSON="$(jq -cn \
  --arg arn "$TARGET_ARN" \
  --arg role "$SCHEDULER_ROLE_ARN" \
  --arg input "$SCHEDULE_INPUT" \
  '{Arn:$arn,RoleArn:$role,Input:$input}')"

echo "Ensuring Lambda invoke permission for EventBridge Scheduler..."
PERMISSION_STATEMENT_ID="allow-eventbridge-scheduler-monthly-cache-clear"
set +e
aws lambda add-permission \
  --function-name "$FUNCTION_NAME" \
  --statement-id "$PERMISSION_STATEMENT_ID" \
  --action lambda:InvokeFunction \
  --principal scheduler.amazonaws.com \
  --region "$AWS_REGION" \
  --profile "$AWS_PROFILE" >/dev/null 2>&1
set -e

if aws scheduler get-schedule \
  --name "$SCHEDULE_NAME" \
  --group-name "$SCHEDULER_GROUP_NAME" \
  --region "$AWS_REGION" \
  --profile "$AWS_PROFILE" >/dev/null 2>&1; then
  echo "Updating existing monthly schedule $SCHEDULE_NAME..."
  aws scheduler update-schedule \
    --name "$SCHEDULE_NAME" \
    --group-name "$SCHEDULER_GROUP_NAME" \
    --schedule-expression "$SCHEDULE_EXPRESSION" \
    --flexible-time-window '{"Mode":"OFF"}' \
    --target "$TARGET_JSON" \
    --region "$AWS_REGION" \
    --profile "$AWS_PROFILE" >/dev/null
else
  echo "Creating monthly schedule $SCHEDULE_NAME..."
  aws scheduler create-schedule \
    --name "$SCHEDULE_NAME" \
    --group-name "$SCHEDULER_GROUP_NAME" \
    --schedule-expression "$SCHEDULE_EXPRESSION" \
    --flexible-time-window '{"Mode":"OFF"}' \
    --target "$TARGET_JSON" \
    --region "$AWS_REGION" \
    --profile "$AWS_PROFILE" >/dev/null
fi

echo "Done. Schedule: $SCHEDULE_NAME ($SCHEDULE_EXPRESSION)"
