#!/usr/bin/env ts-node

/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * init-env.ts
 * Copyright (C) 2025 Nextify Limited
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 *
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import { Octokit } from '@octokit/rest'
import * as dotenv from 'dotenv'
import sodium from 'libsodium-wrappers'

/*  ============================== Common Configuration =============================== */

// Parse .env
const ENV_FILE_PATH = process.env.ENV_FILE_PATH || '.env.prod'
dotenv.config({ path: path.resolve(__dirname, '..', ENV_FILE_PATH) })

// Required configuration
const {
  LIBRA_GITHUB_TOKEN,
  LIBRA_GITHUB_REPO = 'libra',
  LIBRA_GITHUB_OWNER = 'nextify-limited',
} = process.env

if (!LIBRA_GITHUB_TOKEN) {
  console.error('Error: LIBRA_GITHUB_TOKEN not set')
  process.exit(1)
}

// GitHub client (singleton)
const octokit = new Octokit({
  auth: LIBRA_GITHUB_TOKEN,
  request: {
    timeout: 10000,
    retries: 3,
  },
})

/*  ============================== Utility Functions =============================== */

/** Get repository public key (called only once globally) */
let cachedPublicKey: { key: string; key_id: string } | undefined
async function getRepoPublicKey() {
  if (cachedPublicKey) return cachedPublicKey

  try {
    const { data } = await octokit.actions.getRepoPublicKey({
      owner: LIBRA_GITHUB_OWNER,
      repo: LIBRA_GITHUB_REPO,
    })

    cachedPublicKey = { key: data.key, key_id: data.key_id }
    return cachedPublicKey
  } catch (error) {
    console.error('❌ Failed to fetch public key:', error)
    throw error
  }
}

/** Encrypt text using repository public key */
async function encryptSecret(secretValue: string): Promise<string> {
  await sodium.ready // libsodium initialization, only effective on first call

  const { key } = await getRepoPublicKey()

  const encryptedBinary = sodium.crypto_box_seal(
    sodium.from_string(secretValue),
    sodium.from_base64(key, sodium.base64_variants.ORIGINAL)
  )

  return sodium.to_base64(encryptedBinary, sodium.base64_variants.ORIGINAL)
}

/** Create or update repository Secret (depends on common public key) */
async function createOrUpdateSecret(secretName: string, secretValue: string) {
  const { key_id } = await getRepoPublicKey()
  const encrypted_value = await encryptSecret(secretValue)

  await octokit.actions.createOrUpdateRepoSecret({
    owner: LIBRA_GITHUB_OWNER,
    repo: LIBRA_GITHUB_REPO,
    secret_name: secretName,
    encrypted_value,
    key_id,
  })
}

/*  ============================== Main Process =============================== */

async function main() {
  const envPath = path.resolve(__dirname, '..', ENV_FILE_PATH)

  if (!fs.existsSync(envPath)) {
    console.error(`Error: Environment variable file does not exist: ${envPath}`)
    process.exit(1)
  }

  // Read key-value pairs from .env (only needs to be parsed once)
  const parsed = dotenv.parse(fs.readFileSync(envPath))
  const entries = Object.entries(parsed)
    .filter(([, v]) => v.trim())
    .filter(([key]) => !key.startsWith('GITHUB_')) // Filter out GITHUB_ prefixed variables


  // Push sequentially to avoid rate limiting
  for (const [key, value] of entries) {
    try {
      await createOrUpdateSecret(key, value)
    } catch (error) {
      console.error(`❌ Failed to update ${key}:`, error)
    }
  }

}

main().catch((e) => {
  console.error('Script execution failed:', e)
  process.exit(1)
})
