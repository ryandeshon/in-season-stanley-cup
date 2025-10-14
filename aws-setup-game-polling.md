# AWS Setup for Live Game Polling

## Overview

This document provides step-by-step instructions to set up scheduled polling for live NHL games using AWS EventBridge and Lambda.

## Prerequisites

- AWS CLI installed and configured
- Your Lambda function deployed and working
- Lambda function ARN from your existing setup

## Step 1: Get Your Lambda Function ARN

First, find your Lambda function ARN:

```bash
aws lambda list-functions --region us-east-1 --query 'Functions[?contains(FunctionName, `broadcast`) || contains(FunctionName, `game`)].[FunctionName,FunctionArn]' --output table
```

## Step 2: Create EventBridge Rule for 30-second polling

```bash
# Replace YOUR_LAMBDA_ARN with the actual ARN from step 1
LAMBDA_ARN="YOUR_LAMBDA_ARN_HERE"

# Create the EventBridge rule (runs every 30 seconds)
aws events put-rule \
  --region us-east-1 \
  --name "GamePollingRule" \
  --schedule-expression "rate(30 seconds)" \
  --description "Polls NHL API every 30 seconds during live games" \
  --state ENABLED

# Add the Lambda function as a target
aws events put-targets \
  --region us-east-1 \
  --rule "GamePollingRule" \
  --targets "Id"="1","Arn"="$LAMBDA_ARN"

# Give EventBridge permission to invoke your Lambda
aws lambda add-permission \
  --region us-east-1 \
  --function-name "$LAMBDA_ARN" \
  --statement-id "AllowExecutionFromEventBridge" \
  --action "lambda:InvokeFunction" \
  --principal events.amazonaws.com \
  --source-arn "arn:aws:events:us-east-1:896453848695:rule/GamePollingRule"
```

## Step 3: Enable/Disable the Rule Based on Game Status

To avoid unnecessary polling when no games are live, you can disable/enable the rule:

```bash
# Disable polling (run this when no games are live)
aws events disable-rule --region us-east-1 --name "GamePollingRule"

# Enable polling (run this when games start)
aws events enable-rule --region us-east-1 --name "GamePollingRule"
```

## Step 4: Monitor the Setup

Check if the rule is working:

```bash
# List the rule
aws events list-rules --region us-east-1 --name-prefix "GamePolling"

# Check recent Lambda invocations
aws logs filter-log-events \
  --region us-east-1 \
  --log-group-name "/aws/lambda/YOUR_LAMBDA_FUNCTION_NAME" \
  --start-time $(date -d "5 minutes ago" +%s)000
```

## Step 5: Clean Up (if needed)

To remove the scheduled polling:

```bash
# Remove targets
aws events remove-targets --region us-east-1 --rule "GamePollingRule" --ids "1"

# Delete the rule
aws events delete-rule --region us-east-1 --name "GamePollingRule"

# Remove Lambda permission
aws lambda remove-permission \
  --region us-east-1 \
  --function-name "$LAMBDA_ARN" \
  --statement-id "AllowExecutionFromEventBridge"
```

## Important Notes

1. **Rate Limiting**: The NHL API may have rate limits. 30 seconds should be safe, but monitor for any 429 errors.

2. **Cost Consideration**: EventBridge charges per event. At 30-second intervals, this will be ~2,880 invocations per day when enabled.

3. **Game State Logic**: The Lambda function now checks if the game is live before broadcasting updates.

4. **Manual Control**: You can manually enable/disable the rule based on when games are happening.

## Alternative: CloudFormation Template

If you prefer Infrastructure as Code, here's a CloudFormation template:

```yaml
AWSTemplateFormatVersion: '2010-09-09'
Description: 'EventBridge rule for NHL game polling'

Parameters:
  LambdaFunctionArn:
    Type: String
    Description: ARN of the Lambda function to invoke

Resources:
  GamePollingRule:
    Type: AWS::Events::Rule
    Properties:
      Name: GamePollingRule
      Description: 'Polls NHL API every 30 seconds during live games'
      ScheduleExpression: 'rate(30 seconds)'
      State: ENABLED
      Targets:
        - Arn: !Ref LambdaFunctionArn
          Id: 'GamePollingTarget'

  LambdaInvokePermission:
    Type: AWS::Lambda::Permission
    Properties:
      FunctionName: !Ref LambdaFunctionArn
      Action: 'lambda:InvokeFunction'
      Principal: 'events.amazonaws.com'
      SourceArn: !GetAtt GamePollingRule.Arn
```

Save this as `game-polling-infrastructure.yaml` and deploy with:

```bash
aws cloudformation deploy \
  --region us-east-1 \
  --template-file game-polling-infrastructure.yaml \
  --stack-name game-polling-stack \
  --parameter-overrides LambdaFunctionArn=YOUR_LAMBDA_ARN
```
