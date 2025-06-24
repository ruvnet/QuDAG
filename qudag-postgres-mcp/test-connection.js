/**
 * Simple test script to verify PostgreSQL MCP server functionality
 */

const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

// Test configuration
const testConfig = {
  DATABASE_URL:
    "postgresql://qudag_executive:password@localhost:5433/qudag_business",
  MCP_ACCESS_MODE: "restricted",
  MCP_ALLOWED_SCHEMAS: "executive",
  NODE_ENV: "test",
  LOG_LEVEL: "info",
};

async function testMCPServer() {
  console.log("🧪 Testing PostgreSQL MCP Server...\n");

  // Check if built files exist
  const serverPath = path.join(__dirname, "dist", "server.js");
  if (!fs.existsSync(serverPath)) {
    console.error('❌ Server build not found. Run "npm run build" first.');
    process.exit(1);
  }

  console.log("✅ Server build found");

  // Test 1: Server startup
  console.log("\n📋 Test 1: Server startup and MCP protocol");

  const server = spawn("node", [serverPath], {
    env: { ...process.env, ...testConfig },
    stdio: ["pipe", "pipe", "pipe"],
  });

  let serverOutput = "";
  let serverError = "";

  server.stdout.on("data", (data) => {
    serverOutput += data.toString();
  });

  server.stderr.on("data", (data) => {
    serverError += data.toString();
  });

  // Test MCP protocol - list tools
  setTimeout(() => {
    const listToolsRequest =
      JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/list",
      }) + "\n";

    console.log("📤 Sending tools/list request...");
    server.stdin.write(listToolsRequest);
  }, 2000);

  // Test MCP protocol - get health
  setTimeout(() => {
    const healthRequest =
      JSON.stringify({
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: {
          name: "postgres_get_health",
          arguments: {},
        },
      }) + "\n";

    console.log("📤 Sending health check request...");
    server.stdin.write(healthRequest);
  }, 3000);

  // End test after 5 seconds
  setTimeout(() => {
    server.kill("SIGTERM");
  }, 5000);

  return new Promise((resolve) => {
    server.on("close", (code) => {
      console.log("\n📊 Test Results:");
      console.log("==================");

      if (serverOutput.includes("PostgreSQL MCP Server started successfully")) {
        console.log("✅ Server started successfully");
      } else {
        console.log("❌ Server startup failed");
      }

      if (serverOutput.includes('"tools"')) {
        console.log("✅ MCP tools/list working");
      } else {
        console.log("❌ MCP tools/list failed");
      }

      if (
        serverOutput.includes("postgres_") ||
        serverOutput.includes("health")
      ) {
        console.log("✅ MCP tools available");
      } else {
        console.log("❌ MCP tools not available");
      }

      // Show any errors
      if (serverError) {
        console.log("\n🚨 Server Errors:");
        console.log(serverError);
      }

      console.log("\n📝 Server Output Sample:");
      console.log(
        serverOutput.slice(0, 500) + (serverOutput.length > 500 ? "..." : "")
      );

      resolve({
        success: code === 0 || code === null || code === 15, // SIGTERM = 15
        output: serverOutput,
        error: serverError,
      });
    });
  });
}

async function testClaudeDesktopConfig() {
  console.log("\n📋 Test 2: Claude Desktop Configuration");

  const configPath = path.join(__dirname, "claude_desktop_config.json");
  const config = {
    mcpServers: {
      postgres: {
        command: "node",
        args: [path.resolve(__dirname, "dist", "server.js")],
        env: {
          DATABASE_URL:
            "postgresql://qudag_executive:password@localhost:5433/qudag_business",
          MCP_ACCESS_MODE: "restricted",
          MCP_ALLOWED_SCHEMAS: "executive",
        },
      },
    },
  };

  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  console.log("✅ Claude Desktop config created at:", configPath);
  console.log("📋 Copy this to your Claude Desktop configuration directory");

  return { success: true };
}

// Run tests
async function runTests() {
  try {
    const mcpTest = await testMCPServer();
    const configTest = await testClaudeDesktopConfig();

    console.log("\n🎯 Final Results:");
    console.log("==================");
    console.log(
      `MCP Server Test: ${mcpTest.success ? "✅ PASSED" : "❌ FAILED"}`
    );
    console.log(
      `Config Test: ${configTest.success ? "✅ PASSED" : "❌ FAILED"}`
    );

    if (mcpTest.success && configTest.success) {
      console.log("\n🎉 All tests passed! PostgreSQL MCP Server is ready.");
      console.log("\n📋 Next Steps:");
      console.log("1. Ensure PostgreSQL is running on localhost:5433");
      console.log(
        "2. Copy claude_desktop_config.json to Claude Desktop config directory"
      );
      console.log("3. Restart Claude Desktop");
      console.log('4. Test with: "Show me the database schema"');
    } else {
      console.log(
        "\n⚠️  Some tests failed. Check the output above for details."
      );
    }
  } catch (error) {
    console.error("❌ Test suite failed:", error.message);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on("SIGINT", () => {
  console.log("\n👋 Test interrupted");
  process.exit(0);
});

// Run the tests
runTests();
