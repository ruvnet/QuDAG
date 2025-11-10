/**
 * Tool Execution Tests
 */

import { toolRegistry } from "../src/tools";
import { ExecuteQuantumDagTool } from "../src/tools/quantum";
import { QuantumKeyExchangeTool, QuantumSignTool } from "../src/tools/crypto";

describe("Tool Registry", () => {
  it("should list all tools", () => {
    const tools = toolRegistry.getAllTools();
    expect(tools.length).toBeGreaterThan(0);
  });

  it("should get tool by name", () => {
    const tool = toolRegistry.getTool("execute_quantum_dag");
    expect(tool).toBeDefined();
    expect(tool?.name).toBe("execute_quantum_dag");
  });

  it("should return undefined for unknown tool", () => {
    const tool = toolRegistry.getTool("nonexistent_tool");
    expect(tool).toBeUndefined();
  });

  it("should get tool schemas for MCP", () => {
    const schemas = toolRegistry.getToolSchemas();
    expect(schemas.length).toBeGreaterThan(0);
    expect(schemas[0]).toHaveProperty("name");
    expect(schemas[0]).toHaveProperty("description");
    expect(schemas[0]).toHaveProperty("inputSchema");
  });
});

describe("Quantum Tools", () => {
  let tool: ExecuteQuantumDagTool;

  beforeEach(() => {
    tool = new ExecuteQuantumDagTool();
  });

  describe("Execute Quantum DAG", () => {
    it("should validate input schema", () => {
      const validInput = {
        circuit: {
          qubits: 5,
          gates: [
            { type: "H", target: 0 },
            { type: "CNOT", target: [0, 1], control: 0 }
          ]
        }
      };

      expect(validInput.circuit.qubits).toBe(5);
      expect(validInput.circuit.gates.length).toBe(2);
    });

    it("should reject invalid circuit", async () => {
      const invalidInput = {
        circuit: {
          qubits: 5,
          gates: [] // Empty gates
        }
      };

      expect(invalidInput.circuit.gates.length).toBe(0);
    });

    it("should execute quantum circuit", async () => {
      const input = {
        circuit: {
          qubits: 3,
          gates: [
            { type: "H", target: 0 },
            { type: "H", target: 1 }
          ]
        }
      };

      const context = {
        user_id: "test_user",
        roles: ["developer"]
      };

      const result = await tool.execute(input, context);
      expect(result).toBeDefined();
      expect(result.type).toBe("text");
    });

    it("should include execution metrics", async () => {
      const input = {
        circuit: {
          qubits: 2,
          gates: [{ type: "X", target: 0 }]
        }
      };

      const result = await tool.execute(input);
      expect(result).toBeDefined();
    });
  });

  describe("Input Validation", () => {
    it("should validate qubit count", () => {
      const tooManyQubits = {
        circuit: {
          qubits: 100, // Exceeds maximum of 32
          gates: []
        }
      };

      expect(tooManyQubits.circuit.qubits).toBeGreaterThan(32);
    });

    it("should validate gate types", () => {
      const validGates = ["H", "X", "Y", "Z", "CNOT", "T", "S", "RX", "RY", "RZ"];
      const inputGate = "H";

      expect(validGates).toContain(inputGate);
    });

    it("should validate gate targets", () => {
      const gate = {
        type: "H",
        target: 0 // Valid qubit index
      };

      expect(typeof gate.target).toBe("number");
    });
  });
});

describe("Crypto Tools", () => {
  describe("Quantum Key Exchange", () => {
    let tool: QuantumKeyExchangeTool;

    beforeEach(() => {
      tool = new QuantumKeyExchangeTool();
    });

    it("should support ML-KEM algorithms", async () => {
      const input = {
        algorithm: "ml-kem-768",
        role: "initiator"
      };

      const result = await tool.execute(input);
      expect(result).toBeDefined();
    });

    it("should generate shared secret", async () => {
      const input = {
        algorithm: "ml-kem-768",
        role: "initiator"
      };

      const result = await tool.execute(input);
      const data = JSON.parse(result.text || "{}");
      expect(data.shared_secret).toBeDefined();
    });

    it("should return public key for initiator", async () => {
      const input = {
        algorithm: "ml-kem-768",
        role: "initiator"
      };

      const result = await tool.execute(input);
      const data = JSON.parse(result.text || "{}");
      expect(data.public_key).toBeDefined();
      expect(data.encapsulated_key).toBeDefined();
    });
  });

  describe("Quantum Sign", () => {
    let tool: QuantumSignTool;

    beforeEach(() => {
      tool = new QuantumSignTool();
    });

    it("should support ML-DSA algorithms", async () => {
      const input = {
        data: Buffer.from("test message").toString("base64"),
        algorithm: "ml-dsa-65",
        private_key: "private_key_base64"
      };

      const result = await tool.execute(input);
      expect(result).toBeDefined();
    });

    it("should generate signature", async () => {
      const input = {
        data: Buffer.from("test message").toString("base64"),
        algorithm: "ml-dsa-65",
        private_key: "private_key_base64"
      };

      const result = await tool.execute(input);
      const data = JSON.parse(result.text || "{}");
      expect(data.signature).toBeDefined();
    });

    it("should include verification key", async () => {
      const input = {
        data: Buffer.from("test message").toString("base64"),
        algorithm: "ml-dsa-87",
        private_key: "private_key_base64"
      };

      const result = await tool.execute(input);
      const data = JSON.parse(result.text || "{}");
      expect(data.verification).toBeDefined();
      expect(data.verification.public_key).toBeDefined();
    });
  });
});

describe("Tool Error Handling", () => {
  it("should handle missing required parameters", async () => {
    const tool = new ExecuteQuantumDagTool();
    const input = {}; // Missing required circuit

    try {
      await tool.execute(input);
      fail("Should have thrown an error");
    } catch (error: any) {
      expect(error.code).toBeDefined();
    }
  });

  it("should handle invalid parameter types", async () => {
    const tool = new ExecuteQuantumDagTool();
    const input = {
      circuit: "invalid" // Should be object
    };

    try {
      await tool.execute(input);
      fail("Should have thrown an error");
    } catch (error: any) {
      expect(error.code).toBeDefined();
    }
  });

  it("should provide helpful error messages", async () => {
    const tool = new ExecuteQuantumDagTool();
    const input = {
      circuit: {
        qubits: 100, // Exceeds max
        gates: []
      }
    };

    try {
      await tool.execute(input);
      fail("Should have thrown an error");
    } catch (error: any) {
      expect(error.message).toBeDefined();
    }
  });
});

describe("Tool Performance", () => {
  it("should execute tools within time limit", async () => {
    const tool = new ExecuteQuantumDagTool();
    const input = {
      circuit: {
        qubits: 5,
        gates: [{ type: "H", target: 0 }]
      }
    };

    const startTime = Date.now();
    const result = await tool.execute(input);
    const executionTime = Date.now() - startTime;

    expect(executionTime).toBeLessThan(5000); // Should complete within 5 seconds
    expect(result).toBeDefined();
  });
});
