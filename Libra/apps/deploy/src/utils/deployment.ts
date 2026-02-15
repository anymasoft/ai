/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * deployment.ts
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

import { tryCatch } from '@libra/common'
import { createLogger } from './logger'

// Import unified sandbox configuration
import {
    DEPLOYMENT_CONFIG,
    getSandboxFactory,
    initializeSandboxFactory,
    createConfigFromEnvironment,
    getBuilderDefaultProvider,
    type ISandbox,
    type SandboxProviderType
} from '@libra/sandbox'

// Re-export for backward compatibility
export { DEPLOYMENT_CONFIG }

/**
 * Unified error handling wrapper
 */
export async function executeStep<T>(stepName: string, operation: () => Promise<T>): Promise<T> {
    const [result, error] = await tryCatch(operation);
    if (error) {
        // Use a basic logger since we don't have env context here
        const logger = createLogger({ LOG_LEVEL: 'error' } as any)
        logger.error(`${stepName} failed`, {
            stepName,
            error: error.message || 'Unknown error'
        });
        throw new Error(`${stepName} failed: ${error.message || 'Unknown error'}`);
    }

    return result;
}

/**
 * Log step execution using structured logging
 */
export function logStep(stepName: string, message: string, data?: any): void {
    // Use a basic logger since we don't have env context here
    const logger = createLogger({ LOG_LEVEL: 'info' } as any)
    logger.info(`[${stepName}] ${message}`, {
        stepName,
        ...data
    });
}

/**
 * Get default sandbox provider
 */
function getDefaultSandboxProvider(): SandboxProviderType {
    return getBuilderDefaultProvider();
}

/**
 * Get template for provider for builder
 */
function getTemplateForProviderForBuilder(_provider: SandboxProviderType): string {
    // This function should be imported from @libra/sandbox
    // For now, return a default template
    return 'ubuntu-node';
}

/**
 * Sandbox connection helper using abstraction layer
 * @param sandboxId - The sandbox ID to connect to
 * @returns {Promise<ISandbox>} Sandbox instance
 */
export async function connectToSandbox(sandboxId: string): Promise<ISandbox> {
    logStep('Sandbox Connect', `Connecting to sandbox: ${sandboxId}`);

    // Initialize factory if needed
    const config = createConfigFromEnvironment();
    await initializeSandboxFactory(config);

    const factory = getSandboxFactory();
    const provider = getDefaultSandboxProvider();
    const sandbox = await factory.connectToSandbox(sandboxId, provider);

    logStep('Sandbox Connect', 'Connected successfully', {
        sandboxId: sandbox.id,
        provider
    });
    return sandbox;
}

/**
 * Create sandbox using abstraction layer
 * @param baseTemplate - The sandbox template to use
 * @param options - Creation options including timeout and environment variables
 * @returns {Promise<ISandbox>} Created sandbox instance
 */
export async function createDeploymentSandbox(
    baseTemplate: string,
    options: { timeoutMs?: number; envs?: Record<string, string> } = {}
): Promise<ISandbox> {
    const provider = getDefaultSandboxProvider();
    const template = getTemplateForProviderForBuilder(provider);

    logStep('Sandbox Create', `Creating sandbox with template: ${template}`, {
        provider,
        baseTemplate,
        resolvedTemplate: template,
        ...options
    });

    // Initialize factory if needed
    const config = createConfigFromEnvironment();
    await initializeSandboxFactory(config);

    const factory = getSandboxFactory();
    const sandbox = await factory.createSandbox({
        provider,
        template,
        timeoutMs: options.timeoutMs || DEPLOYMENT_CONFIG.TIMEOUT
    });

    logStep('Sandbox Create', 'Sandbox created successfully', {
        sandboxId: sandbox.id,
        provider,
        template
    });

    return sandbox;
}

/**
 * Terminate sandbox using abstraction layer
 * @param sandboxId - The sandbox ID to terminate
 * @param options - Termination options including timeout
 * @returns {Promise<boolean>} True if termination was successful
 */
export async function terminateDeploymentSandbox(
    sandboxId: string,
    options: { timeoutMs?: number } = {}
): Promise<boolean> {
    if (!sandboxId || sandboxId.startsWith('sandbox-')) {
        logStep('Sandbox Terminate', `Skipping termination for mock sandbox: ${sandboxId}`);
        return true;
    }

    logStep('Sandbox Terminate', `Terminating sandbox: ${sandboxId}`, options);

    try {
        // Initialize factory if needed
        const config = createConfigFromEnvironment();
        await initializeSandboxFactory(config);

        const factory = getSandboxFactory();
        const provider = getDefaultSandboxProvider();

        const result = await factory.getProvider(provider).terminate(sandboxId, {
            timeoutMs: options.timeoutMs || 30_000
        });

        logStep('Sandbox Terminate', 'Terminated successfully', {
            sandboxId,
            success: result.success
        });

        return result.success;

    } catch (error) {
        logStep('Sandbox Terminate', 'Failed to terminate sandbox', {
            sandboxId,
            error: error instanceof Error ? error.message : String(error)
        });
        return false;
    }
}

/**
 * Execute command in sandbox
 * @param sandbox - The sandbox instance
 * @param command - Command to execute
 * @param timeoutMs - Command timeout in milliseconds
 * @param stepName - Step name for logging
 * @returns Command execution result with stdout/stderr
 */
export async function executeCommand(
    sandbox: ISandbox,
    command: string,
    timeoutMs: number,
    stepName: string
) {
    logStep(stepName, `Executing: ${command}`, { timeoutMs });

    const result = await sandbox.executeCommand(command, {
        timeoutMs,
        onStderr: (data: string) => {
            const logger = createLogger({ LOG_LEVEL: 'error' } as any)
            logger.error(`[Workflow ${stepName} Error]`, {
                stepName,
                stderr: data
            })
        }
    });

    // Check exit code
    if (result.exitCode !== 0) {
        const errorDetails = [];
        if (result.stdout) errorDetails.push(`STDOUT: ${result.stdout}`);
        if (result.stderr) errorDetails.push(`STDERR: ${result.stderr}`);

        const errorMessage = `${stepName} failed with exit code ${result.exitCode}${
            errorDetails.length > 0 ? `\n${errorDetails.join('\n')}` : ''
        }`;

        logStep(stepName, errorMessage);
        throw new Error(errorMessage);
    }

    logStep(stepName, 'Command completed successfully', {
        exitCode: result.exitCode,
        hasStdout: !!result.stdout,
        hasStderr: !!result.stderr
    });
    return result;
}
