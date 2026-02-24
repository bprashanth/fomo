#!/usr/bin/env bash
# test_sessions.sh
#
# Verifies that GET /api/sessions/ncf?bucket=fomomon (authenticated) returns
# data matching the reference fixture at src/tests/integration/db.json.
#
# Usage: ./test_sessions.sh
#
# Requires: curl, jq

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FIXTURE="$SCRIPT_DIR/db.json"
AUTH_CONFIG_URL="https://fomomon.s3.ap-south-1.amazonaws.com/auth_config.json"

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
fail() { echo "FAIL: $*" >&2; exit 1; }
pass() { echo "PASS: $*"; }

# ---------------------------------------------------------------------------
# Pre-flight checks
# ---------------------------------------------------------------------------
for cmd in curl jq; do
  command -v "$cmd" >/dev/null 2>&1 || fail "'$cmd' is required but not installed."
done

[[ -f "$FIXTURE" ]] || fail "Reference fixture not found: $FIXTURE"

# ---------------------------------------------------------------------------
# Load env files
# ---------------------------------------------------------------------------
[[ -f "$SCRIPT_DIR/test-credentials.env" ]] || fail "Missing test-credentials.env"
[[ -f "$SCRIPT_DIR/outputs.env"          ]] || fail "Missing outputs.env"

# shellcheck source=/dev/null
source "$SCRIPT_DIR/test-credentials.env"
# shellcheck source=/dev/null
source "$SCRIPT_DIR/outputs.env"

[[ -n "${TEST_USERNAME:-}" ]] || fail "TEST_USERNAME not set in test-credentials.env"
[[ -n "${TEST_PASSWORD:-}" ]] || fail "TEST_PASSWORD not set in test-credentials.env"
[[ -n "${APIGW_URL:-}"     ]] || fail "APIGW_URL not set in outputs.env"

# ---------------------------------------------------------------------------
# Step 1: Fetch Cognito auth config
# ---------------------------------------------------------------------------
echo ""
echo "==> Fetching Cognito auth config from $AUTH_CONFIG_URL"
AUTH_CONFIG=$(curl --silent --fail "$AUTH_CONFIG_URL") \
  || fail "Failed to fetch auth config from $AUTH_CONFIG_URL"

USER_POOL_ID=$(echo "$AUTH_CONFIG" | jq -r '.userPoolId')
CLIENT_ID=$(echo "$AUTH_CONFIG"    | jq -r '.clientId')
REGION=$(echo "$USER_POOL_ID"      | cut -d_ -f1)

[[ "$USER_POOL_ID" != "null" && -n "$USER_POOL_ID" ]] || fail "userPoolId missing from auth config"
[[ "$CLIENT_ID"    != "null" && -n "$CLIENT_ID"    ]] || fail "clientId missing from auth config"

echo "    UserPoolId : $USER_POOL_ID"
echo "    ClientId   : $CLIENT_ID"
echo "    Region     : $REGION"

# ---------------------------------------------------------------------------
# Step 2: Authenticate with Cognito (USER_PASSWORD_AUTH)
# ---------------------------------------------------------------------------
COGNITO_ENDPOINT="https://cognito-idp.${REGION}.amazonaws.com/"

AUTH_BODY=$(jq -n \
  --arg flow   "USER_PASSWORD_AUTH" \
  --arg cid    "$CLIENT_ID" \
  --arg user   "$TEST_USERNAME" \
  --arg pass   "$TEST_PASSWORD" \
  '{AuthFlow: $flow, ClientId: $cid, AuthParameters: {USERNAME: $user, PASSWORD: $pass}}')

echo ""
echo "==> Authenticating as '$TEST_USERNAME'"
echo "    curl -s -o <response> -w \"%{http_code}\" \\"
echo "      -X POST '$COGNITO_ENDPOINT' \\"
echo "      -H 'Content-Type: application/x-amz-json-1.1' \\"
echo "      -H 'X-Amz-Target: AWSCognitoIdentityProviderService.InitiateAuth' \\"
echo "      -d '{AuthFlow: ..., ClientId: ..., AuthParameters: {USERNAME: \"$TEST_USERNAME\", PASSWORD: \"***\"}}'"

AUTH_RESPONSE_FILE=$(mktemp)
trap 'rm -f "$AUTH_RESPONSE_FILE"' EXIT

AUTH_HTTP_CODE=$(curl --silent \
  -o "$AUTH_RESPONSE_FILE" \
  -w "%{http_code}" \
  -X POST "$COGNITO_ENDPOINT" \
  -H "Content-Type: application/x-amz-json-1.1" \
  -H "X-Amz-Target: AWSCognitoIdentityProviderService.InitiateAuth" \
  -d "$AUTH_BODY")

if [[ "$AUTH_HTTP_CODE" != "200" ]]; then
  echo "    Response body:" >&2
  cat "$AUTH_RESPONSE_FILE" >&2
  echo "" >&2
  fail "Cognito InitiateAuth returned HTTP $AUTH_HTTP_CODE (expected 200)"
fi

ID_TOKEN=$(jq -r '.AuthenticationResult.IdToken // empty' "$AUTH_RESPONSE_FILE")
[[ -n "$ID_TOKEN" ]] || fail "IdToken not found in Cognito response. Body: $(cat "$AUTH_RESPONSE_FILE")"

echo "    Auth succeeded. IdToken obtained (${#ID_TOKEN} chars)."

# ---------------------------------------------------------------------------
# Step 3: Call sessions endpoint
# ---------------------------------------------------------------------------
SESSIONS_URL="${APIGW_URL}/api/sessions/ncf?bucket=fomomon"
SESSIONS_RESPONSE_FILE=$(mktemp)
trap 'rm -f "$AUTH_RESPONSE_FILE" "$SESSIONS_RESPONSE_FILE"' EXIT

echo ""
echo "==> Fetching sessions"
echo "    curl -s -o <response> -w \"%{http_code}\" \\"
echo "      -H 'Authorization: Bearer <token>' \\"
echo "      '$SESSIONS_URL'"

SESSIONS_HTTP_CODE=$(curl --silent \
  -o "$SESSIONS_RESPONSE_FILE" \
  -w "%{http_code}" \
  -H "Authorization: Bearer $ID_TOKEN" \
  "$SESSIONS_URL")

if [[ "$SESSIONS_HTTP_CODE" != "200" ]]; then
  echo "    Response body:" >&2
  cat "$SESSIONS_RESPONSE_FILE" >&2
  echo "" >&2
  fail "Sessions endpoint returned HTTP $SESSIONS_HTTP_CODE (expected 200)"
fi

# Validate it's parseable JSON
jq empty "$SESSIONS_RESPONSE_FILE" 2>/dev/null \
  || fail "Sessions response is not valid JSON"

# ---------------------------------------------------------------------------
# Step 4: Compare response to fixture
# ---------------------------------------------------------------------------
# Presigned image URLs differ between runs — exclude them from both sides.
STRIP_URLS='. | map(del(.portraitImageUrl, .landscapeImageUrl, .portraitImagePath, .landscapeImagePath, .isUploaded))'

ACTUAL_NORMALIZED=$(jq "$STRIP_URLS | sort_by(.sessionId)" "$SESSIONS_RESPONSE_FILE")
EXPECTED_NORMALIZED=$(jq "$STRIP_URLS | sort_by(.sessionId)" "$FIXTURE")

ACTUAL_COUNT=$(echo "$ACTUAL_NORMALIZED"   | jq 'length')
EXPECTED_COUNT=$(echo "$EXPECTED_NORMALIZED" | jq 'length')

echo ""
echo "==> Comparing response to fixture"
echo "    Fixture   : $FIXTURE"
echo "    Expected  : $EXPECTED_COUNT sessions"
echo "    Actual    : $ACTUAL_COUNT sessions"

if [[ "$ACTUAL_COUNT" != "$EXPECTED_COUNT" ]]; then
  fail "Session count mismatch: got $ACTUAL_COUNT, expected $EXPECTED_COUNT"
fi

DIFF_OUTPUT=$(diff \
  <(echo "$EXPECTED_NORMALIZED" | jq '.') \
  <(echo "$ACTUAL_NORMALIZED"   | jq '.') \
  || true)

if [[ -n "$DIFF_OUTPUT" ]]; then
  echo ""
  echo "    Diff (expected vs actual):"
  echo "$DIFF_OUTPUT"
  echo ""
  fail "Session data does not match fixture"
fi

echo ""
pass "Sessions endpoint returned $ACTUAL_COUNT sessions matching fixture."
