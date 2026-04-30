#!/usr/bin/env bash
set -euo pipefail

if ! command -v aws >/dev/null 2>&1; then
  echo "aws CLI is required"
  exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "jq is required"
  exit 1
fi

AWS_REGION="${AWS_REGION:-us-east-1}"
AWS_PROFILE="${AWS_PROFILE:-inseason-admin}"
HTTP_API_FUNCTION_NAME="${HTTP_API_FUNCTION_NAME:-inseason-http-api}"
SEASON_ID="${SEASON_ID:-season2}"
GAME_OPTIONS_ID="${GAME_OPTIONS_ID:-currentChampion}"
DRY_RUN="${DRY_RUN:-true}"

echo "Loading Lambda environment from $HTTP_API_FUNCTION_NAME..."
LAMBDA_ENV_JSON="$(aws lambda get-function-configuration \
  --function-name "$HTTP_API_FUNCTION_NAME" \
  --region "$AWS_REGION" \
  --profile "$AWS_PROFILE" \
  --query 'Environment.Variables' \
  --output json)"

SEASON_NUMBER="$(echo "$SEASON_ID" | sed -E 's/[^0-9]//g')"
if [[ -z "$SEASON_NUMBER" ]]; then
  echo "Invalid SEASON_ID: $SEASON_ID"
  exit 1
fi

PLAYERS_TABLE="$(jq -r --arg n "$SEASON_NUMBER" '
  .["PLAYERS_TABLE_SEASON" + $n] //
  (if $n == "2" then (.PLAYERS_TABLE // "Players") else ((.PLAYERS_TABLE // "Players") + "-Season" + $n) end)
' <<<"$LAMBDA_ENV_JSON")"

GAME_OPTIONS_TABLE="$(jq -r '.GAME_OPTIONS_TABLE // "GameOptions"' <<<"$LAMBDA_ENV_JSON")"

if [[ -z "$PLAYERS_TABLE" || "$PLAYERS_TABLE" == "null" ]]; then
  echo "Could not resolve players table for $SEASON_ID"
  exit 1
fi

echo "Season: $SEASON_ID"
echo "Players table: $PLAYERS_TABLE"
echo "GameOptions table: $GAME_OPTIONS_TABLE"

echo "Reading current champion team for tie-break..."
CURRENT_CHAMPION_TEAM="$(aws dynamodb get-item \
  --table-name "$GAME_OPTIONS_TABLE" \
  --key "{\"id\":{\"S\":\"$GAME_OPTIONS_ID\"}}" \
  --projection-expression "champion" \
  --region "$AWS_REGION" \
  --profile "$AWS_PROFILE" \
  --output json | jq -r '.Item.champion.S // ""')"

echo "Current champion team: ${CURRENT_CHAMPION_TEAM:-<none>}"

echo "Scanning players table..."
PLAYERS_SCAN_JSON="$(aws dynamodb scan \
  --table-name "$PLAYERS_TABLE" \
  --region "$AWS_REGION" \
  --profile "$AWS_PROFILE" \
  --output json)"

# Champion selection logic - MUST STAY IN SYNC with src/utilities/seasonChampion.js
# Tie-breaking order:
# 1. Find player(s) with maximum title defenses
# 2. If tie, prefer player who owns the current champion team
# 3. If still tied, sort alphabetically by name
# Any changes to this logic should be reflected in both files
WINNER_JSON="$(jq -c --arg champion "$CURRENT_CHAMPION_TEAM" '
  def attr_str($a): ($a.S // "");
  def attr_num($a): ((($a.N // $a.S // "0") | tonumber?) // 0);
  def attr_teams($item): [($item.teams.L // [])[] | attr_str(.)];
  .Items as $items
  | ($items | map({
      item: .,
      name: attr_str(.name),
      titleDefenses: attr_num(.titleDefenses),
      teams: attr_teams(.),
      championships: attr_num(.championships),
      lastAward: attr_str(.lastChampionshipAwardSeason)
    })) as $players
  | ($players | map(.titleDefenses) | max // 0) as $maxDefenses
  | ($players | map(select(.titleDefenses == $maxDefenses))) as $contenders
  | if ($contenders | length) == 0 then null
    elif ($contenders | length) == 1 then $contenders[0]
    else (($contenders | map(select(.teams | index($champion))) | .[0]) // ($contenders | sort_by(.name) | .[0]))
    end
' <<<"$PLAYERS_SCAN_JSON")"

if [[ -z "$WINNER_JSON" || "$WINNER_JSON" == "null" ]]; then
  echo "No champion candidate found in $PLAYERS_TABLE"
  exit 1
fi

WINNER_NAME="$(jq -r '.name' <<<"$WINNER_JSON")"
WINNER_ID="$(jq -r '.item.id.N // .item.id.S // "unknown"' <<<"$WINNER_JSON")"
WINNER_KEY_JSON="$(jq -c '{id: .item.id}' <<<"$WINNER_JSON")"
WINNER_DEFENSES="$(jq -r '.titleDefenses' <<<"$WINNER_JSON")"
LAST_AWARD_SEASON="$(jq -r '.lastAward' <<<"$WINNER_JSON")"

echo "Winner: $WINNER_NAME (id=$WINNER_ID, titleDefenses=$WINNER_DEFENSES)"

if [[ "$LAST_AWARD_SEASON" == "$SEASON_ID" ]]; then
  echo "Award already applied for $SEASON_ID; skipping championships increment."
else
  if [[ "$DRY_RUN" == "true" ]]; then
    echo "[DRY_RUN] Would increment championships for $WINNER_NAME and set lastChampionshipAwardSeason=$SEASON_ID"
  else
    echo "Applying championships increment..."
    UPDATE_ERR_FILE="$(mktemp)"
    set +e
    aws dynamodb update-item \
      --table-name "$PLAYERS_TABLE" \
      --key "$WINNER_KEY_JSON" \
      --update-expression "SET championships = if_not_exists(championships, :zero) + :inc, lastChampionshipAwardSeason = :season, updatedAt = :ts" \
      --condition-expression "attribute_not_exists(lastChampionshipAwardSeason) OR lastChampionshipAwardSeason <> :season" \
      --expression-attribute-values "{\":inc\":{\"N\":\"1\"},\":zero\":{\"N\":\"0\"},\":season\":{\"S\":\"$SEASON_ID\"},\":ts\":{\"S\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}}" \
      --region "$AWS_REGION" \
      --profile "$AWS_PROFILE" \
      --return-values UPDATED_NEW >/dev/null 2>"$UPDATE_ERR_FILE"
    UPDATE_EXIT_CODE=$?
    set -e

    if [[ $UPDATE_EXIT_CODE -ne 0 ]]; then
      if grep -q "ConditionalCheckFailedException" "$UPDATE_ERR_FILE"; then
        echo "Award already applied by another process; skipping."
      else
        cat "$UPDATE_ERR_FILE"
        rm -f "$UPDATE_ERR_FILE"
        exit $UPDATE_EXIT_CODE
      fi
    fi
    rm -f "$UPDATE_ERR_FILE"
  fi
fi

SEASON_ENV_KEY="$(echo "$SEASON_ID" | tr '[:lower:]' '[:upper:]')_SEASON_OVER"
UPDATED_ENV_JSON="$(jq -c --arg k "$SEASON_ENV_KEY" '. + {($k):"true"}' <<<"$LAMBDA_ENV_JSON")"

if [[ "$DRY_RUN" == "true" ]]; then
  echo "[DRY_RUN] Would set $SEASON_ENV_KEY=true on $HTTP_API_FUNCTION_NAME"
else
  echo "Setting $SEASON_ENV_KEY=true on $HTTP_API_FUNCTION_NAME..."
  ENV_FILE="$(mktemp)"
  jq -n --argjson vars "$UPDATED_ENV_JSON" '{Variables: $vars}' > "$ENV_FILE"
  aws lambda update-function-configuration \
    --function-name "$HTTP_API_FUNCTION_NAME" \
    --environment "file://$ENV_FILE" \
    --region "$AWS_REGION" \
    --profile "$AWS_PROFILE" >/dev/null
  rm -f "$ENV_FILE"
fi

echo "Season closeout script complete."
