#!/usr/bin/env bash

set -e

# Accept network and identity as arguments
NETWORK="${1:-testnet}"
IDENTITY="${2:-mykey}"

echo "Deploying to network: $NETWORK using identity: $IDENTITY"

# 1. Build all contracts
echo "Building all contracts..."
stellar contract build

# 2. Get administrative address for the identity
echo "Resolving admin address..."
ADMIN_ADDRESS=$(stellar keys address "$IDENTITY")
echo "Admin Address: $ADMIN_ADDRESS"

# 3. Deploy each contract wasm
echo "Deploying Registry contract..."
REGISTRY_ID=$(stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/automint_registry.wasm \
  --source "$IDENTITY" \
  --network "$NETWORK")
echo "Registry Contract ID: $REGISTRY_ID"

echo "Deploying BotNFT contract..."
BOT_NFT_ID=$(stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/automint_bot_nft.wasm \
  --source "$IDENTITY" \
  --network "$NETWORK")
echo "BotNFT Contract ID: $BOT_NFT_ID"

echo "Deploying Accrual contract..."
ACCRUAL_ID=$(stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/automint_accrual.wasm \
  --source "$IDENTITY" \
  --network "$NETWORK")
echo "Accrual Contract ID: $ACCRUAL_ID"

echo "Deploying Marketplace contract..."
MARKETPLACE_ID=$(stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/automint_marketplace.wasm \
  --source "$IDENTITY" \
  --network "$NETWORK")
echo "Marketplace Contract ID: $MARKETPLACE_ID"

echo "Deploying Token contract..."
TOKEN_ID=$(stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/automint_token.wasm \
  --source "$IDENTITY" \
  --network "$NETWORK")
echo "Token Contract ID: $TOKEN_ID"

# 4. Call initialize on each deployed contract
echo "Initializing Registry..."
stellar contract invoke \
  --id "$REGISTRY_ID" \
  --source "$IDENTITY" \
  --network "$NETWORK" \
  -- initialize --admin "$ADMIN_ADDRESS"

echo "Initializing BotNFT..."
stellar contract invoke \
  --id "$BOT_NFT_ID" \
  --source "$IDENTITY" \
  --network "$NETWORK" \
  -- initialize --admin "$ADMIN_ADDRESS" --registry "$REGISTRY_ID"

echo "Initializing Accrual..."
stellar contract invoke \
  --id "$ACCRUAL_ID" \
  --source "$IDENTITY" \
  --network "$NETWORK" \
  -- initialize --admin "$ADMIN_ADDRESS" --points_per_amt 100

echo "Initializing Marketplace..."
stellar contract invoke \
  --id "$MARKETPLACE_ID" \
  --source "$IDENTITY" \
  --network "$NETWORK" \
  -- initialize --admin "$ADMIN_ADDRESS" --bot-nft "$BOT_NFT_ID" --fee-bps 250

echo "Initializing Token..."
stellar contract invoke \
  --id "$TOKEN_ID" \
  --source "$IDENTITY" \
  --network "$NETWORK" \
  -- initialize --admin "$ADMIN_ADDRESS" --decimal 7 --name "AutoMint Token" --symbol "AMT"

# 5. Write the resulting contract IDs into frontend/.env.local
echo "Writing contract IDs to frontend/.env.local..."
if [ ! -f frontend/.env.local ]; then
  if [ -f frontend/.env.example ]; then
    cp frontend/.env.example frontend/.env.local
  else
    touch frontend/.env.local
  fi
fi

# Replace placeholders or update keys in frontend/.env.local
update_env_var() {
  local key=$1
  local value=$2
  if grep -q "^$key=" frontend/.env.local; then
    # Key exists, update it
    sed -i "s|^$key=.*|$key=$value|g" frontend/.env.local
  else
    # Key doesn't exist, append it
    echo "$key=$value" >> frontend/.env.local
  fi
}

update_env_var "NEXT_PUBLIC_NETWORK" "TESTNET"
update_env_var "NEXT_PUBLIC_SOROBAN_RPC_URL" "https://soroban-testnet.stellar.org"
update_env_var "NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE" "\"Test SDF Network ; September 2015\""
update_env_var "NEXT_PUBLIC_REGISTRY_CONTRACT_ID" "$REGISTRY_ID"
update_env_var "NEXT_PUBLIC_BOT_NFT_CONTRACT_ID" "$BOT_NFT_ID"
update_env_var "NEXT_PUBLIC_ACCRUAL_CONTRACT_ID" "$ACCRUAL_ID"
update_env_var "NEXT_PUBLIC_MARKETPLACE_CONTRACT_ID" "$MARKETPLACE_ID"
update_env_var "NEXT_PUBLIC_TOKEN_CONTRACT_ID" "$TOKEN_ID"

echo "Deployment complete! Contract IDs saved to frontend/.env.local"
