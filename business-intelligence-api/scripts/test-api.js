#!/usr/bin/env node

/**
 * @description API testing script for development
 * @author CleoClaudeDesktop
 * @created 2025-06-23
 * @lastModified 2025-06-23 by CleoClaudeDesktop - Initial test script
 */

const axios = require('axios');
const colors = require('colors/safe');

const API_BASE_URL = process.env.API_URL || 'http://localhost:8090/api/v1';
const AUTH_TOKEN = process.env.AUTH_TOKEN || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLTEyMyIsImVtYWlsIjoidGVzdEB0ZXN0LmNvbSIsIm9yZ2FuaXphdGlvbklkIjoib3JnLTEyMyIsInJvbGUiOiJhZG1pbiJ9.test';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Authorization': `Bearer ${AUTH_TOKEN}`,
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

// Test results
let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    console.log(colors.yellow(`Testing: ${name}...`));
    await fn();
    console.log(colors.green(`✓ ${name}`));
    passed++;
  } catch (error) {
    console.log(colors.red(`✗ ${name}`));
    console.error(colors.red(`  Error: ${error.message}`));
    if (error.response) {
      console.error(colors.red(`  Status: ${error.response.status}`));
      console.error(colors.red(`  Data: ${JSON.stringify(error.response.data, null, 2)}`));
    }
    failed++;
  }
}

async function runTests() {
  console.log(colors.cyan('\n=== QuDAG Business Intelligence API Tests ===\n'));

  // Health check
  await test('Health Check', async () => {
    const response = await api.get('/health');
    if (response.data.status !== 'healthy') {
      throw new Error('API is not healthy');
    }
  });

  // Organizations
  let orgId;
  await test('List Organizations', async () => {
    const response = await api.get('/organizations');
    if (!response.data.success) {
      throw new Error('Failed to list organizations');
    }
    if (response.data.data.length > 0) {
      orgId = response.data.data[0].id;
    }
  });

  // Agents
  await test('List Agents', async () => {
    if (!orgId) {
      console.log(colors.yellow('  Skipping: No organization found'));
      return;
    }
    const response = await api.get(`/agents?organizationId=${orgId}`);
    if (!response.data.success) {
      throw new Error('Failed to list agents');
    }
  });

  // Metrics
  await test('Get Dashboard Data', async () => {
    if (!orgId) {
      console.log(colors.yellow('  Skipping: No organization found'));
      return;
    }
    const response = await api.get(`/metrics/dashboard?organizationId=${orgId}`);
    if (!response.data.success) {
      throw new Error('Failed to get dashboard data');
    }
  });

  // Commands
  await test('Execute Command', async () => {
    if (!orgId) {
      console.log(colors.yellow('  Skipping: No organization found'));
      return;
    }
    const response = await api.post('/commands', {
      command: 'Show revenue metrics',
      context: { organizationId: orgId },
    });
    if (!response.data.success && response.data.intent.confidence < 0.5) {
      throw new Error('Command execution failed');
    }
  });

  await test('Get Command Suggestions', async () => {
    const response = await api.get('/commands/suggestions');
    if (!response.data.success || !Array.isArray(response.data.data)) {
      throw new Error('Failed to get command suggestions');
    }
  });

  // Dashboards
  await test('List Dashboards', async () => {
    if (!orgId) {
      console.log(colors.yellow('  Skipping: No organization found'));
      return;
    }
    const response = await api.get(`/dashboards?organizationId=${orgId}`);
    if (!response.data.success) {
      throw new Error('Failed to list dashboards');
    }
  });

  await test('Get Dashboard Templates', async () => {
    const response = await api.get('/dashboards/templates');
    if (!response.data.success || !Array.isArray(response.data.data)) {
      throw new Error('Failed to get dashboard templates');
    }
  });

  // Summary
  console.log(colors.cyan('\n=== Test Summary ==='));
  console.log(colors.green(`Passed: ${passed}`));
  console.log(colors.red(`Failed: ${failed}`));
  console.log(colors.cyan(`Total: ${passed + failed}`));

  if (failed > 0) {
    console.log(colors.red('\n❌ Some tests failed!'));
    process.exit(1);
  } else {
    console.log(colors.green('\n✅ All tests passed!'));
  }
}

// Handle errors
process.on('unhandledRejection', (error) => {
  console.error(colors.red('Unhandled rejection:'), error);
  process.exit(1);
});

// Run tests
runTests().catch(error => {
  console.error(colors.red('Test runner failed:'), error);
  process.exit(1);
});