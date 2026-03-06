#!/usr/bin/env bash
set -euo pipefail

if ! command -v aws >/dev/null 2>&1; then
  echo "aws CLI is required"
  exit 1
fi

AWS_REGION="${AWS_REGION:-us-east-1}"
AWS_PROFILE="${AWS_PROFILE:-inseason-admin}"
LOG_GROUP_NAME="${LOG_GROUP_NAME:-/aws/lambda/inseason-check-game}"
SNS_TOPIC_ARN="${SNS_TOPIC_ARN:-}"

if [[ -z "$SNS_TOPIC_ARN" ]]; then
  echo "Set SNS_TOPIC_ARN to an alert topic ARN."
  exit 1
fi

echo "Creating CloudWatch metric filters..."
aws logs put-metric-filter \
  --region "$AWS_REGION" \
  --profile "$AWS_PROFILE" \
  --log-group-name "$LOG_GROUP_NAME" \
  --filter-name "inseason-check-game-handler-error" \
  --filter-pattern '"\"msg\":\"Handler error\""' \
  --metric-transformations \
    metricName=CheckGameHandlerErrors,metricNamespace=InSeason/Checker,metricValue=1

aws logs put-metric-filter \
  --region "$AWS_REGION" \
  --profile "$AWS_PROFILE" \
  --log-group-name "$LOG_GROUP_NAME" \
  --filter-name "inseason-check-game-watching-too-long" \
  --filter-pattern '"\"decision\":\"watching_too_long\""' \
  --metric-transformations \
    metricName=CheckGameWatchingTooLong,metricNamespace=InSeason/Checker,metricValue=1

echo "Creating CloudWatch alarms..."
aws cloudwatch put-metric-alarm \
  --region "$AWS_REGION" \
  --profile "$AWS_PROFILE" \
  --alarm-name "inseason-check-game-handler-error" \
  --alarm-description "check-game Lambda handler errors detected" \
  --namespace "InSeason/Checker" \
  --metric-name "CheckGameHandlerErrors" \
  --statistic Sum \
  --period 300 \
  --evaluation-periods 1 \
  --threshold 1 \
  --comparison-operator GreaterThanOrEqualToThreshold \
  --treat-missing-data notBreaching \
  --alarm-actions "$SNS_TOPIC_ARN"

aws cloudwatch put-metric-alarm \
  --region "$AWS_REGION" \
  --profile "$AWS_PROFILE" \
  --alarm-name "inseason-check-game-watching-too-long" \
  --alarm-description "watch loop exceeded expected duration for a game" \
  --namespace "InSeason/Checker" \
  --metric-name "CheckGameWatchingTooLong" \
  --statistic Sum \
  --period 300 \
  --evaluation-periods 1 \
  --threshold 1 \
  --comparison-operator GreaterThanOrEqualToThreshold \
  --treat-missing-data notBreaching \
  --alarm-actions "$SNS_TOPIC_ARN"

echo "Done."
