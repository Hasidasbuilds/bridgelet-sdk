import { registerAs } from '@nestjs/config';

export default registerAs('stellar', () => {
  assertNetworkEndpointAlignment();
  return {
    network: getNetwork(),
    horizonUrl:
      process.env.STELLAR_HORIZON_URL || 'https://horizon-testnet.stellar.org',
    sorobanRpcUrl:
      process.env.STELLAR_SOROBAN_RPC_URL ||
      'https://soroban-testnet.stellar.org',
    // #991: issued-asset allowlist for the configured network. `SUPPORTED_ASSETS_<NETWORK>`
    // wins over the network-agnostic `SUPPORTED_ASSETS`, so testnet and mainnet can
    // trust different issuers for the same code.
    supportedAssets: getSupportedAssets(),
    fundingSecret: process.env.FUNDING_ACCOUNT_SECRET,
    recoveryPublic: process.env.RECOVERY_ACCOUNT_PUBLIC,
    contracts: {
      ephemeralAccount: process.env.EPHEMERAL_ACCOUNT_CONTRACT_ID,
      // #811: the ephemeral-account WASM hash of the uploaded contract. Every
      // POST /accounts deploys its own contract instance from this hash (see
      // StellarService.createEphemeralAccount), so a single shared contract ID
      // can never be initialized twice.
      ephemeralAccountWasmHash: process.env.EPHEMERAL_ACCOUNT_WASM_HASH,
      sweepController: process.env.SWEEP_CONTROLLER_CONTRACT_ID,
      // #648: version of the deployed ephemeral-account contract. Left
      // undefined when unknown so ContractProvider reports 'unknown' rather
      // than a stale literal that silently drifts from the deployed WASM.
      ephemeralAccountVersion: process.env.EPHEMERAL_ACCOUNT_CONTRACT_VERSION,
    },
    sweepSigningKeySeed: process.env.SWEEP_SIGNING_KEY_SEED,
    // #823: which SweepSigner backs generateAuthSignature(). 'env-seed' (the
    // default) signs with SWEEP_SIGNING_KEY_SEED and is refused in production
    // by SweepSigningGuard; 'kms' signs with an asymmetric Ed25519 KMS key and
    // is required in production.
    sweepSignerProvider: process.env.STELLAR_SWEEP_SIGNER_PROVIDER,
    // KMS key (KeySpec ECC_NIST_EDWARDS25519, KeyUsage SIGN_VERIFY) used when
    // sweepSignerProvider is 'kms'.
    sweepKmsKeyId: process.env.STELLAR_SWEEP_KMS_KEY_ID,
    // Optional: the G... public key the selected signer must hold (the
    // SweepController's on-chain authorized_signer). Startup fails on mismatch.
    sweepAuthorizedSigner: process.env.STELLAR_SWEEP_AUTHORIZED_SIGNER,
    encryptionKey: process.env.ENCRYPTION_KEY || '64_char_hex_string_here',
    sweepControllerContractId: process.env.SWEEP_CONTROLLER_CONTRACT_ID,
  };
});

/**
 * #1048: strict `STELLAR_NETWORK` validation alone is not enough — the old
 * failure mode was a typo selecting the testnet passphrase while Horizon/RPC
 * still pointed at mainnet (or the reverse). Refuse the dangerous combination
 * where a mainnet passphrase is paired with the default testnet endpoints.
 * Custom endpoints are left alone so private networks keep working.
 */
function assertNetworkEndpointAlignment(): void {
  if (getNetwork() !== 'mainnet') return;

  const horizonUrl =
    process.env.STELLAR_HORIZON_URL || 'https://horizon-testnet.stellar.org';
  const sorobanRpcUrl =
    process.env.STELLAR_SOROBAN_RPC_URL ||
    'https://soroban-testnet.stellar.org';

  if (horizonUrl.includes('testnet') || sorobanRpcUrl.includes('testnet')) {
    throw new Error(
      'STELLAR_NETWORK=mainnet requires mainnet STELLAR_HORIZON_URL and ' +
        `STELLAR_SOROBAN_RPC_URL; got "${horizonUrl}" and "${sorobanRpcUrl}".`,
    );
  }
}

function getNetwork(): 'mainnet' | 'testnet' {
  const network = process.env.STELLAR_NETWORK || 'testnet';
  if (network !== 'mainnet' && network !== 'testnet') {
    throw new Error(
      `Invalid STELLAR_NETWORK "${network}". Expected "mainnet" or "testnet".`,
    );
  }
  return network;
}

/**
 * Reads the issued-asset allowlist. A network-specific value
 * (`SUPPORTED_ASSETS_TESTNET` / `SUPPORTED_ASSETS_MAINNET`) takes precedence
 * over `SUPPORTED_ASSETS`, and entries are comma-separated `CODE:ISSUER`
 * pairs (e.g. `USDC:GBBD...`). An empty value means issued assets are refused.
 */
function getSupportedAssets(): string[] {
  const network = getNetwork().toUpperCase();
  const raw =
    process.env[`SUPPORTED_ASSETS_${network}`] ??
    process.env.SUPPORTED_ASSETS ??
    '';

  return raw
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}
