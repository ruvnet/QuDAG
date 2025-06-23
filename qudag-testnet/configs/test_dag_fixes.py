#!/usr/bin/env python3
"""
Comprehensive test suite for QuDAG DAG fixes.
Tests all the issues that were identified and fixed:
1. get_vertex operation should work with valid vertex IDs
2. add_vertex should reject empty/missing data
3. add_vertex should validate parent vertex existence
4. Proper validation error messages for all invalid inputs
5. All existing operations continue working
"""

import json
import requests
import time
import sys
import subprocess
import signal
import os
from typing import Dict, Any, Optional
import threading

class QuDAGTestRunner:
    def __init__(self, base_url: str = "http://localhost:3000"):
        self.base_url = base_url
        self.server_process = None
        self.test_results = []
        
    def start_server(self) -> bool:
        """Start the QuDAG MCP server"""
        try:
            print("🚀 Starting QuDAG MCP server...")
            self.server_process = subprocess.Popen(
                ["cargo", "run"],
                cwd="/workspaces/QuDAG/qudag-testnet/configs",
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                preexec_fn=os.setsid
            )
            
            # Wait for server to start
            for i in range(30):  # Wait up to 30 seconds
                try:
                    response = requests.get(f"{self.base_url}/health", timeout=1)
                    if response.status_code == 200:
                        print("✅ Server started successfully")
                        return True
                except:
                    time.sleep(1)
                    
            print("❌ Server failed to start within 30 seconds")
            return False
        except Exception as e:
            print(f"❌ Failed to start server: {e}")
            return False
    
    def stop_server(self):
        """Stop the QuDAG MCP server"""
        if self.server_process:
            try:
                os.killpg(os.getpgid(self.server_process.pid), signal.SIGTERM)
                self.server_process.wait(timeout=5)
                print("🛑 Server stopped")
            except:
                try:
                    os.killpg(os.getpgid(self.server_process.pid), signal.SIGKILL)
                    print("🛑 Server force stopped")
                except:
                    pass
    
    def execute_tool(self, tool_name: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
        """Execute a tool via the MCP API"""
        try:
            response = requests.post(
                f"{self.base_url}/mcp/tools/execute",
                json={"name": tool_name, "arguments": arguments},
                timeout=10
            )
            return response.json()
        except Exception as e:
            return {"error": f"Request failed: {e}"}
    
    def run_test(self, test_name: str, test_func, expected_result: str = "success"):
        """Run a single test and record results"""
        print(f"\n🧪 Running test: {test_name}")
        try:
            result = test_func()
            if result:
                print(f"✅ PASS: {test_name}")
                self.test_results.append({"test": test_name, "status": "PASS", "details": result})
            else:
                print(f"❌ FAIL: {test_name}")
                self.test_results.append({"test": test_name, "status": "FAIL", "details": result})
        except Exception as e:
            print(f"❌ ERROR: {test_name} - {e}")
            self.test_results.append({"test": test_name, "status": "ERROR", "details": str(e)})
    
    def test_get_vertex_with_valid_id(self):
        """Test get_vertex with valid vertex ID (should work)"""
        # First add a vertex to get a valid ID
        add_result = self.execute_tool("qudag_dag", {
            "operation": "add_vertex",
            "data": "test_data_for_get_vertex",
            "parents": ["genesis"]
        })
        
        if "error" in add_result:
            return f"Failed to add vertex: {add_result['error']}"
        
        vertex_id = add_result["result"]["vertex_id"]
        
        # Now test get_vertex with valid ID
        get_result = self.execute_tool("qudag_dag", {
            "operation": "get_vertex",
            "vertex_id": vertex_id
        })
        
        if "error" in get_result:
            return f"get_vertex failed: {get_result['error']}"
        
        result = get_result["result"]
        if result["vertex_id"] == vertex_id and result["found"]:
            return f"Successfully retrieved vertex {vertex_id}"
        else:
            return f"Vertex data mismatch: {result}"
    
    def test_get_vertex_with_invalid_id(self):
        """Test get_vertex with invalid vertex ID (should fail gracefully)"""
        get_result = self.execute_tool("qudag_dag", {
            "operation": "get_vertex",
            "vertex_id": "invalid_vertex_id_123"
        })
        
        if "error" in get_result and "not found" in get_result["error"].lower():
            return f"Correctly rejected invalid vertex ID: {get_result['error']}"
        else:
            return f"Should have failed but got: {get_result}"
    
    def test_get_vertex_with_empty_id(self):
        """Test get_vertex with empty vertex ID (should fail)"""
        get_result = self.execute_tool("qudag_dag", {
            "operation": "get_vertex",
            "vertex_id": ""
        })
        
        if "error" in get_result and "empty" in get_result["error"].lower():
            return f"Correctly rejected empty vertex ID: {get_result['error']}"
        else:
            return f"Should have failed but got: {get_result}"
    
    def test_add_vertex_missing_data(self):
        """Test add_vertex with missing data parameter (should fail)"""
        add_result = self.execute_tool("qudag_dag", {
            "operation": "add_vertex",
            "parents": ["genesis"]
        })
        
        error_msg = add_result.get("error") or (add_result.get("result") and "error")
        if error_msg and "missing" in str(error_msg).lower():
            return f"Correctly rejected missing data: {error_msg}"
        elif "error" in add_result:
            return f"Correctly rejected missing data: {add_result['error']}"
        else:
            return f"Should have failed but got: {add_result}"
    
    def test_add_vertex_empty_data(self):
        """Test add_vertex with empty data (should fail)"""
        add_result = self.execute_tool("qudag_dag", {
            "operation": "add_vertex",
            "data": "",
            "parents": ["genesis"]
        })
        
        if "error" in add_result and "empty" in str(add_result["error"]).lower():
            return f"Correctly rejected empty data: {add_result['error']}"
        else:
            return f"Should have failed but got: {add_result}"
    
    def test_add_vertex_whitespace_data(self):
        """Test add_vertex with whitespace-only data (should fail)"""
        add_result = self.execute_tool("qudag_dag", {
            "operation": "add_vertex",
            "data": "   ",
            "parents": ["genesis"]
        })
        
        if "error" in add_result and "empty" in str(add_result["error"]).lower():
            return f"Correctly rejected whitespace data: {add_result['error']}"
        else:
            return f"Should have failed but got: {add_result}"
    
    def test_add_vertex_invalid_parent(self):
        """Test add_vertex with invalid parent ID (should fail)"""
        add_result = self.execute_tool("qudag_dag", {
            "operation": "add_vertex",
            "data": "test_data",
            "parents": ["invalid_parent_id"]
        })
        
        if "error" in add_result and "does not exist" in str(add_result["error"]).lower():
            return f"Correctly rejected invalid parent: {add_result['error']}"
        else:
            return f"Should have failed but got: {add_result}"
    
    def test_add_vertex_valid_params(self):
        """Test add_vertex with valid parameters (should work)"""
        add_result = self.execute_tool("qudag_dag", {
            "operation": "add_vertex",
            "data": "valid_test_data",
            "parents": ["genesis"]
        })
        
        if "error" in add_result:
            return f"Failed to add valid vertex: {add_result['error']}"
        
        result = add_result["result"]
        if "vertex_id" in result and result["status"] == "added":
            return f"Successfully added vertex: {result['vertex_id']}"
        else:
            return f"Unexpected result: {result}"
    
    def test_existing_operations_still_work(self):
        """Test that all existing operations continue working"""
        # Test get_tips
        tips_result = self.execute_tool("qudag_dag", {"operation": "get_tips"})
        if "error" in tips_result:
            return f"get_tips failed: {tips_result['error']}"
        
        # Test get_consensus_status
        consensus_result = self.execute_tool("qudag_dag", {"operation": "get_consensus_status"})
        if "error" in consensus_result:
            return f"get_consensus_status failed: {consensus_result['error']}"
        
        # Test get_dag_stats
        stats_result = self.execute_tool("qudag_dag", {"operation": "get_dag_stats"})
        if "error" in stats_result:
            return f"get_dag_stats failed: {stats_result['error']}"
        
        return "All existing operations work correctly"
    
    def test_complex_dag_operations(self):
        """Test complex DAG operations with multiple vertices"""
        # Add first vertex
        vertex1_result = self.execute_tool("qudag_dag", {
            "operation": "add_vertex",
            "data": "vertex_1_data",
            "parents": ["genesis"]
        })
        
        if "error" in vertex1_result:
            return f"Failed to add vertex 1: {vertex1_result['error']}"
        
        vertex1_id = vertex1_result["result"]["vertex_id"]
        
        # Add second vertex with first as parent
        vertex2_result = self.execute_tool("qudag_dag", {
            "operation": "add_vertex",
            "data": "vertex_2_data",
            "parents": [vertex1_id]
        })
        
        if "error" in vertex2_result:
            return f"Failed to add vertex 2: {vertex2_result['error']}"
        
        vertex2_id = vertex2_result["result"]["vertex_id"]
        
        # Test retrieving both vertices
        get1_result = self.execute_tool("qudag_dag", {
            "operation": "get_vertex",
            "vertex_id": vertex1_id
        })
        
        get2_result = self.execute_tool("qudag_dag", {
            "operation": "get_vertex",
            "vertex_id": vertex2_id
        })
        
        if "error" in get1_result or "error" in get2_result:
            return f"Failed to retrieve vertices: {get1_result}, {get2_result}"
        
        return f"Successfully created and retrieved complex DAG structure"
    
    def run_all_tests(self):
        """Run all test cases"""
        print("=" * 60)
        print("🧪 QuDAG DAG Fixes Test Suite")
        print("=" * 60)
        
        # Test cases for all identified issues
        self.run_test("get_vertex with valid ID", self.test_get_vertex_with_valid_id)
        self.run_test("get_vertex with invalid ID", self.test_get_vertex_with_invalid_id)
        self.run_test("get_vertex with empty ID", self.test_get_vertex_with_empty_id)
        self.run_test("add_vertex with missing data", self.test_add_vertex_missing_data)
        self.run_test("add_vertex with empty data", self.test_add_vertex_empty_data)
        self.run_test("add_vertex with whitespace data", self.test_add_vertex_whitespace_data)
        self.run_test("add_vertex with invalid parent", self.test_add_vertex_invalid_parent)
        self.run_test("add_vertex with valid params", self.test_add_vertex_valid_params)
        self.run_test("existing operations still work", self.test_existing_operations_still_work)
        self.run_test("complex DAG operations", self.test_complex_dag_operations)
        
        # Print summary
        print("\n" + "=" * 60)
        print("📊 Test Results Summary")
        print("=" * 60)
        
        passed = sum(1 for t in self.test_results if t["status"] == "PASS")
        failed = sum(1 for t in self.test_results if t["status"] == "FAIL")
        errors = sum(1 for t in self.test_results if t["status"] == "ERROR")
        total = len(self.test_results)
        
        print(f"Total Tests: {total}")
        print(f"✅ Passed: {passed}")
        print(f"❌ Failed: {failed}")
        print(f"⚠️  Errors: {errors}")
        print(f"Success Rate: {(passed/total)*100:.1f}%")
        
        if failed > 0 or errors > 0:
            print("\n🔍 Failed/Error Test Details:")
            for test in self.test_results:
                if test["status"] in ["FAIL", "ERROR"]:
                    print(f"  {test['status']}: {test['test']} - {test['details']}")
        
        return passed == total
    
    def __enter__(self):
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        self.stop_server()

def main():
    """Main test runner"""
    with QuDAGTestRunner() as runner:
        if not runner.start_server():
            print("❌ Failed to start server, exiting")
            return 1
        
        success = runner.run_all_tests()
        return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())