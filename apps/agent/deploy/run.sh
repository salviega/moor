#!/usr/bin/env bash
# Starts the agent loop with its secrets read from Ledger Key Ring (wallet-cli ring),
# never from a file (AGENTS.md, Security). The ring was enrolled on this host once,
# with the device; from then on it only needs the network.
#
# Keys expected in the ring: moor/agent-private-key, moor/sepolia-rpc-url, moor/anthropic-api-key
set -euo pipefail
cd "$(dirname "$0")/../../.."

ring() { wallet-cli ring decrypt --key "$1" 2>/dev/null; }

AGENT_PRIVATE_KEY="$(ring moor/agent-private-key)"
SEPOLIA_RPC_URL="$(ring moor/sepolia-rpc-url)"
ANTHROPIC_API_KEY="$(ring moor/anthropic-api-key || true)"
export AGENT_PRIVATE_KEY SEPOLIA_RPC_URL ANTHROPIC_API_KEY
export AGENT_INTERVAL_SECONDS="${AGENT_INTERVAL_SECONDS:-300}"
export AGENT_PARENT_NAME="${AGENT_PARENT_NAME:-salviega.eth}"

exec pnpm --filter @moor/agent loop
