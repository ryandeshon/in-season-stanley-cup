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
AWS_PROFILE="${AWS_PROFILE:-}"

LEGACY_PLAYERS_SEASON1_TABLE="${LEGACY_PLAYERS_SEASON1_TABLE:-Players-Season1}"
LEGACY_PLAYERS_CURRENT_TABLE="${LEGACY_PLAYERS_CURRENT_TABLE:-Players}"
LEGACY_GAME_RECORDS_SEASON1_TABLE="${LEGACY_GAME_RECORDS_SEASON1_TABLE:-GameRecords-Season1}"
LEGACY_GAME_RECORDS_CURRENT_TABLE="${LEGACY_GAME_RECORDS_CURRENT_TABLE:-GameRecords}"
LEGACY_GAME_OPTIONS_TABLE="${LEGACY_GAME_OPTIONS_TABLE:-GameOptions}"
LEGACY_DRAFT_STATE_ID="${LEGACY_DRAFT_STATE_ID:-draftState}"

PLAYER_LIFETIME_TABLE="${PLAYER_LIFETIME_TABLE:-PlayerLifetime}"
PLAYER_SEASON_TABLE="${PLAYER_SEASON_TABLE:-PlayerSeason}"
GAME_RECORDS_V2_TABLE="${GAME_RECORDS_V2_TABLE:-GameRecordsV2}"
DRAFT_STATE_TABLE="${DRAFT_STATE_TABLE:-DraftState}"
SEASON_CATALOG_ID="${SEASON_CATALOG_ID:-seasonCatalog}"

SEASON1_ID="${SEASON1_ID:-season1}"
CURRENT_SEASON_ID="${CURRENT_SEASON_ID:-season2}"

HTTP_API_FUNCTION_NAME="${HTTP_API_FUNCTION_NAME:-inseason-http-api}"
CHECK_GAME_FUNCTION_NAME="${CHECK_GAME_FUNCTION_NAME:-inseason-check-game}"

CREATE_TABLES="${CREATE_TABLES:-true}"
APPLY_LAMBDA_ENV_CUTOVER="${APPLY_LAMBDA_ENV_CUTOVER:-false}"
TAG_LEGACY_TABLES="${TAG_LEGACY_TABLES:-true}"

TIMESTAMP="${TIMESTAMP:-$(date -u +%Y%m%dT%H%M%SZ)}"
SNAPSHOT_DIR="${SNAPSHOT_DIR:-tmp/season-data-migration/${TIMESTAMP}}"
RUN_TS="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

AWS_CMD=(aws --region "$AWS_REGION")
if [[ -n "$AWS_PROFILE" ]]; then
  AWS_CMD+=(--profile "$AWS_PROFILE")
fi

bool_true() {
  case "${1,,}" in
    1|true|yes|on) return 0 ;;
    *) return 1 ;;
  esac
}

aws_cli() {
  "${AWS_CMD[@]}" "$@"
}

log() {
  echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] $*"
}

require_table() {
  local table="$1"
  if ! aws_cli dynamodb describe-table --table-name "$table" >/dev/null 2>&1; then
    echo "Missing required table: $table"
    exit 1
  fi
}

table_exists() {
  local table="$1"
  aws_cli dynamodb describe-table --table-name "$table" >/dev/null 2>&1
}

ensure_table() {
  local table="$1"
  local attribute_definitions="$2"
  local key_schema="$3"

  if table_exists "$table"; then
    log "Table exists: $table"
    return
  fi

  log "Creating table: $table"
  aws_cli dynamodb create-table \
    --table-name "$table" \
    --attribute-definitions "$attribute_definitions" \
    --key-schema "$key_schema" \
    --billing-mode PAY_PER_REQUEST >/dev/null

  aws_cli dynamodb wait table-exists --table-name "$table"
  log "Table ready: $table"
}

snapshot_table() {
  local table="$1"
  local out="$SNAPSHOT_DIR/${table}.json"

  log "Snapshotting table: $table"
  aws_cli dynamodb scan --table-name "$table" --output json > "$out"
  local count
  count="$(jq '.Items | length' "$out")"
  log "Snapshot complete: $table ($count items) -> $out"
}

put_item_if_absent() {
  local table="$1"
  local condition_expression="$2"
  local item_json="$3"

  if aws_cli dynamodb put-item \
      --table-name "$table" \
      --item "$item_json" \
      --condition-expression "$condition_expression" >/dev/null 2>&1; then
    return 0
  fi

  return 1
}

put_items_from_file() {
  local table="$1"
  local condition_expression="$2"
  local source_file="$3"

  local inserted=0
  local skipped=0

  if [[ ! -s "$source_file" ]]; then
    log "No items to write for $table from $source_file"
    echo "$inserted $skipped"
    return
  fi

  while IFS= read -r item; do
    if [[ -z "$item" ]]; then
      continue
    fi

    if put_item_if_absent "$table" "$condition_expression" "$item"; then
      inserted=$((inserted + 1))
    else
      skipped=$((skipped + 1))
    fi
  done < "$source_file"

  log "Write summary for $table: inserted=$inserted skipped=$skipped"
  echo "$inserted $skipped"
}

build_player_lifetime_items() {
  local source_file="$1"
  local out_file="$2"

  jq -c --arg ts "$RUN_TS" '
    .Items[]
    | {
        _playerId: (.playerId.S // .playerId.N // .id.S // .id.N // empty),
        _name: (.name.S // ""),
        _championships: (.championships.N // "0"),
        _totalDefenses: (.totalDefenses.N // "0"),
        _updatedAt: (.updatedAt.S // $ts)
      }
    | select(._playerId != "")
    | {
        playerId: { S: (._playerId | tostring) },
        name: {
          S: (
            if (._name | length) > 0
            then ._name
            else (._playerId | tostring)
            end
          )
        },
        championships: { N: (._championships | tostring) },
        totalDefenses: { N: (._totalDefenses | tostring) },
        updatedAt: { S: (._updatedAt | tostring) }
      }
  ' "$source_file" > "$out_file"
}

build_player_season_items() {
  local source_file="$1"
  local out_file="$2"
  local season_id="$3"

  jq -c --arg seasonId "$season_id" --arg ts "$RUN_TS" '
    .Items[]
    | {
        _playerId: (.playerId.S // .playerId.N // .id.S // .id.N // empty),
        _name: (.name.S // ""),
        _titleDefenses: (.titleDefenses.N // "0"),
        _updatedAt: (.updatedAt.S // $ts),
        _teams: (
          if .teams.L then
            [.teams.L[] | (.S // .N // empty)]
          elif .teams.SS then
            .teams.SS
          else
            []
          end
        )
      }
    | select(._playerId != "")
    | {
        seasonId: { S: $seasonId },
        playerId: { S: (._playerId | tostring) },
        name: {
          S: (
            if (._name | length) > 0
            then ._name
            else (._playerId | tostring)
            end
          )
        },
        teams: {
          L: (
            ._teams
            | map(select(. != "") | ascii_upcase)
            | unique
            | map({ S: . })
          )
        },
        titleDefenses: { N: (._titleDefenses | tostring) },
        updatedAt: { S: (._updatedAt | tostring) }
      }
  ' "$source_file" > "$out_file"
}

build_game_records_v2_items() {
  local source_file="$1"
  local out_file="$2"
  local season_id="$3"

  jq -c --arg seasonId "$season_id" --arg ts "$RUN_TS" '
    .Items[]
    | {
        _gameId: (.gameId.S // .gameId.N // .id.S // .id.N // empty),
        _wTeam: (.wTeam.S // ""),
        _wScore: (.wScore.N // "0"),
        _lTeam: (.lTeam.S // ""),
        _lScore: (.lScore.N // "0"),
        _savedAt: (.savedAt.S // .updatedAt.S // $ts)
      }
    | select(._gameId != "")
    | {
        seasonId: { S: $seasonId },
        gameId: { S: (._gameId | tostring) },
        id: { S: (._gameId | tostring) },
        wTeam: { S: ._wTeam },
        wScore: { N: (._wScore | tostring) },
        lTeam: { S: ._lTeam },
        lScore: { N: (._lScore | tostring) },
        savedAt: { S: (._savedAt | tostring) },
        updatedAt: { S: (._savedAt | tostring) }
      }
  ' "$source_file" > "$out_file"
}

build_draft_state_item() {
  local source_file="$1"
  local out_file="$2"

  jq -c \
    --arg draftStateId "$LEGACY_DRAFT_STATE_ID" \
    --arg draftId "$CURRENT_SEASON_ID" \
    --arg ts "$RUN_TS" '
      .Items[]
      | select((.id.S // .id.N // "") == $draftStateId)
      | {
          _state: (.state.M // {}),
          _updatedAt: (.updatedAt.S // $ts)
        }
      | {
          draftId: { S: $draftId },
          draftStarted: { BOOL: (._state.draftStarted.BOOL // false) },
          pickOrder: {
            L: (
              (._state.pickOrder.L // [])
              | map((.S // .N // empty) | tostring)
              | map({ S: . })
            )
          },
          currentPicker: (
            if (._state.currentPicker.S // ._state.currentPicker.N // "") == ""
            then { NULL: true }
            else { S: ((._state.currentPicker.S // ._state.currentPicker.N) | tostring) }
            end
          ),
          currentPickNumber: { N: ((._state.currentPickNumber.N // "0") | tostring) },
          availableTeams: {
            L: (
              if ._state.availableTeams.L then
                ._state.availableTeams.L
                | map(.S // .N // empty)
                | map(select(. != "") | ascii_upcase)
                | unique
                | map({ S: . })
              elif ._state.availableTeams.SS then
                ._state.availableTeams.SS
                | map(select(. != "") | ascii_upcase)
                | unique
                | map({ S: . })
              else
                []
              end
            )
          },
          version: { N: ((._state.version.N // "0") | tostring) },
          updatedAt: { S: (._updatedAt | tostring) }
        }
  ' "$source_file" > "$out_file"
}

upsert_season_catalog() {
  local game_options_table="$1"
  local payload

  payload="$(jq -c -n \
    --arg id "$SEASON_CATALOG_ID" \
    --arg defaultSeason "$CURRENT_SEASON_ID" \
    --arg ts "$RUN_TS" \
    --arg season1 "$SEASON1_ID" \
    --arg season2 "$CURRENT_SEASON_ID" '
      {
        id: { S: $id },
        defaultSeason: { S: $defaultSeason },
        seasons: {
          L: [
            {
              M: {
                id: { S: $season1 },
                label: { S: ($season1 | sub("^season"; "")) },
                status: { S: "complete" }
              }
            },
            {
              M: {
                id: { S: $season2 },
                label: { S: ($season2 | sub("^season"; "")) },
                status: { S: "active" }
              }
            }
          ]
        },
        updatedAt: { S: $ts }
      }
    '
  )"

  aws_cli dynamodb put-item \
    --table-name "$game_options_table" \
    --item "$payload" >/dev/null

  log "Upserted season catalog item in $game_options_table (id=$SEASON_CATALOG_ID)"
}

update_lambda_env() {
  local function_name="$1"

  local current_env
  current_env="$(aws_cli lambda get-function-configuration \
    --function-name "$function_name" \
    --query 'Environment.Variables' \
    --output json)"

  local merged_env
  merged_env="$(jq -c \
    --arg playerSeason "$PLAYER_SEASON_TABLE" \
    --arg playerLifetime "$PLAYER_LIFETIME_TABLE" \
    --arg recordsV2 "$GAME_RECORDS_V2_TABLE" \
    --arg draftState "$DRAFT_STATE_TABLE" \
    --arg defaultSeason "$CURRENT_SEASON_ID" \
    --arg seasonCatalogId "$SEASON_CATALOG_ID" '
      . + {
        PLAYER_SEASON_TABLE: $playerSeason,
        PLAYER_LIFETIME_TABLE: $playerLifetime,
        GAME_RECORDS_V2_TABLE: $recordsV2,
        DRAFT_STATE_TABLE: $draftState,
        DEFAULT_SEASON: $defaultSeason,
        SEASON_CATALOG_ID: $seasonCatalogId
      }
    ' <<<"$current_env")"

  aws_cli lambda update-function-configuration \
    --function-name "$function_name" \
    --environment "Variables=$merged_env" >/dev/null

  log "Updated Lambda env vars: $function_name"
}

tag_legacy_table() {
  local table="$1"
  local arn
  arn="$(aws_cli dynamodb describe-table --table-name "$table" --query 'Table.TableArn' --output text)"

  aws_cli dynamodb tag-resource \
    --resource-arn "$arn" \
    --tags "Key=migrationStatus,Value=legacy-frozen" "Key=migrationUpdatedAt,Value=${RUN_TS}" >/dev/null

  log "Tagged legacy table: $table"
}

mkdir -p "$SNAPSHOT_DIR"

log "Starting offseason multi-season migration"
log "Region=$AWS_REGION profile=${AWS_PROFILE:-default} snapshotDir=$SNAPSHOT_DIR"

require_table "$LEGACY_PLAYERS_SEASON1_TABLE"
require_table "$LEGACY_PLAYERS_CURRENT_TABLE"
require_table "$LEGACY_GAME_RECORDS_SEASON1_TABLE"
require_table "$LEGACY_GAME_RECORDS_CURRENT_TABLE"
require_table "$LEGACY_GAME_OPTIONS_TABLE"

if bool_true "$CREATE_TABLES"; then
  ensure_table \
    "$PLAYER_LIFETIME_TABLE" \
    '[{"AttributeName":"playerId","AttributeType":"S"}]' \
    '[{"AttributeName":"playerId","KeyType":"HASH"}]'

  ensure_table \
    "$PLAYER_SEASON_TABLE" \
    '[{"AttributeName":"seasonId","AttributeType":"S"},{"AttributeName":"playerId","AttributeType":"S"}]' \
    '[{"AttributeName":"seasonId","KeyType":"HASH"},{"AttributeName":"playerId","KeyType":"RANGE"}]'

  ensure_table \
    "$GAME_RECORDS_V2_TABLE" \
    '[{"AttributeName":"seasonId","AttributeType":"S"},{"AttributeName":"gameId","AttributeType":"S"}]' \
    '[{"AttributeName":"seasonId","KeyType":"HASH"},{"AttributeName":"gameId","KeyType":"RANGE"}]'

  ensure_table \
    "$DRAFT_STATE_TABLE" \
    '[{"AttributeName":"draftId","AttributeType":"S"}]' \
    '[{"AttributeName":"draftId","KeyType":"HASH"}]'
fi

snapshot_table "$LEGACY_PLAYERS_SEASON1_TABLE"
snapshot_table "$LEGACY_PLAYERS_CURRENT_TABLE"
snapshot_table "$LEGACY_GAME_RECORDS_SEASON1_TABLE"
snapshot_table "$LEGACY_GAME_RECORDS_CURRENT_TABLE"
snapshot_table "$LEGACY_GAME_OPTIONS_TABLE"

lifetime_items_file="$SNAPSHOT_DIR/player-lifetime-items.jsonl"
season1_items_file="$SNAPSHOT_DIR/player-season-season1-items.jsonl"
season_current_items_file="$SNAPSHOT_DIR/player-season-current-items.jsonl"
game_records_s1_file="$SNAPSHOT_DIR/game-records-season1-items.jsonl"
game_records_current_file="$SNAPSHOT_DIR/game-records-current-items.jsonl"
draft_state_file="$SNAPSHOT_DIR/draft-state-item.jsonl"

build_player_lifetime_items \
  "$SNAPSHOT_DIR/${LEGACY_PLAYERS_CURRENT_TABLE}.json" \
  "$lifetime_items_file"

build_player_season_items \
  "$SNAPSHOT_DIR/${LEGACY_PLAYERS_SEASON1_TABLE}.json" \
  "$season1_items_file" \
  "$SEASON1_ID"

build_player_season_items \
  "$SNAPSHOT_DIR/${LEGACY_PLAYERS_CURRENT_TABLE}.json" \
  "$season_current_items_file" \
  "$CURRENT_SEASON_ID"

build_game_records_v2_items \
  "$SNAPSHOT_DIR/${LEGACY_GAME_RECORDS_SEASON1_TABLE}.json" \
  "$game_records_s1_file" \
  "$SEASON1_ID"

build_game_records_v2_items \
  "$SNAPSHOT_DIR/${LEGACY_GAME_RECORDS_CURRENT_TABLE}.json" \
  "$game_records_current_file" \
  "$CURRENT_SEASON_ID"

build_draft_state_item \
  "$SNAPSHOT_DIR/${LEGACY_GAME_OPTIONS_TABLE}.json" \
  "$draft_state_file"

put_items_from_file \
  "$PLAYER_LIFETIME_TABLE" \
  'attribute_not_exists(playerId)' \
  "$lifetime_items_file" >/dev/null

put_items_from_file \
  "$PLAYER_SEASON_TABLE" \
  'attribute_not_exists(seasonId) AND attribute_not_exists(playerId)' \
  "$season1_items_file" >/dev/null

put_items_from_file \
  "$PLAYER_SEASON_TABLE" \
  'attribute_not_exists(seasonId) AND attribute_not_exists(playerId)' \
  "$season_current_items_file" >/dev/null

put_items_from_file \
  "$GAME_RECORDS_V2_TABLE" \
  'attribute_not_exists(seasonId) AND attribute_not_exists(gameId)' \
  "$game_records_s1_file" >/dev/null

put_items_from_file \
  "$GAME_RECORDS_V2_TABLE" \
  'attribute_not_exists(seasonId) AND attribute_not_exists(gameId)' \
  "$game_records_current_file" >/dev/null

if [[ -s "$draft_state_file" ]]; then
  put_items_from_file \
    "$DRAFT_STATE_TABLE" \
    'attribute_not_exists(draftId)' \
    "$draft_state_file" >/dev/null
else
  log "No legacy draft state found at id=$LEGACY_DRAFT_STATE_ID; skipping DraftState backfill"
fi

upsert_season_catalog "$LEGACY_GAME_OPTIONS_TABLE"

if bool_true "$APPLY_LAMBDA_ENV_CUTOVER"; then
  log "Applying Lambda env cutover"
  update_lambda_env "$HTTP_API_FUNCTION_NAME"
  update_lambda_env "$CHECK_GAME_FUNCTION_NAME"
else
  log "Skipping Lambda env cutover (set APPLY_LAMBDA_ENV_CUTOVER=true to apply)"
fi

if bool_true "$TAG_LEGACY_TABLES"; then
  tag_legacy_table "$LEGACY_PLAYERS_SEASON1_TABLE"
  tag_legacy_table "$LEGACY_PLAYERS_CURRENT_TABLE"
  tag_legacy_table "$LEGACY_GAME_RECORDS_SEASON1_TABLE"
  tag_legacy_table "$LEGACY_GAME_RECORDS_CURRENT_TABLE"
else
  log "Skipping legacy table tagging"
fi

log "Migration complete"
log "Snapshots and generated payloads are in: $SNAPSHOT_DIR"
log "Post-migration validation examples:"
cat <<VALIDATION
  aws --region $AWS_REGION ${AWS_PROFILE:+--profile $AWS_PROFILE }dynamodb scan --table-name $PLAYER_LIFETIME_TABLE --select COUNT
  aws --region $AWS_REGION ${AWS_PROFILE:+--profile $AWS_PROFILE }dynamodb query --table-name $PLAYER_SEASON_TABLE --key-condition-expression 'seasonId = :s' --expression-attribute-values '{":s":{"S":"$CURRENT_SEASON_ID"}}' --select COUNT
  aws --region $AWS_REGION ${AWS_PROFILE:+--profile $AWS_PROFILE }dynamodb query --table-name $GAME_RECORDS_V2_TABLE --key-condition-expression 'seasonId = :s' --expression-attribute-values '{":s":{"S":"$CURRENT_SEASON_ID"}}' --select COUNT
VALIDATION
