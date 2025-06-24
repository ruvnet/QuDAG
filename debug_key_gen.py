#!/usr/bin/env python3
"""
Debug key generation specifically
"""

import requests
import json
import base64

def debug_key_generation():
    """Debug key generation for each algorithm"""
    base_url = "https://quadag-mcp.fly.dev"
    algorithms = ["ml-dsa", "ml-kem", "hqc"]
    
    for algorithm in algorithms:
        print(f"\n{'='*50}")
        print(f"Testing {algorithm} key generation")
        print(f"{'='*50}")
        
        payload = {
            "name": "qudag_crypto",
            "arguments": {
                "operation": "generate_keypair",
                "algorithm": algorithm
            }
        }
        
        try:
            response = requests.post(
                f"{base_url}/mcp/tools/execute",
                json=payload,
                timeout=30
            )
            
            print(f"HTTP Status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                print(f"Response keys: {list(data.keys())}")
                
                if "error" in data:
                    print(f"Error field: {data['error']} (type: {type(data['error'])})")
                
                if "result" in data:
                    result = data["result"]
                    print(f"Result keys: {list(result.keys())}")
                    
                    # Check specific fields
                    for field in ["algorithm", "public_key", "private_key", "quantum_resistant"]:
                        if field in result:
                            if field.endswith("_key"):
                                # For keys, show length
                                key_data = result[field]
                                try:
                                    decoded = base64.b64decode(key_data)
                                    print(f"{field}: {len(key_data)} chars (base64) -> {len(decoded)} bytes")
                                except:
                                    print(f"{field}: {len(key_data)} chars (invalid base64)")
                            else:
                                print(f"{field}: {result[field]}")
                        else:
                            print(f"{field}: MISSING")
                    
                    # Test specific algorithm expectations
                    if algorithm == "ml-dsa" and "public_key" in result and "private_key" in result:
                        try:
                            pub_bytes = base64.b64decode(result["public_key"])
                            priv_bytes = base64.b64decode(result["private_key"])
                            print(f"✅ ML-DSA key sizes: pub={len(pub_bytes)} (expect 1952), priv={len(priv_bytes)} (expect 2592)")
                        except Exception as e:
                            print(f"❌ Error decoding ML-DSA keys: {e}")
                            
                else:
                    print("❌ No 'result' in response")
                    print(f"Full response: {json.dumps(data, indent=2)}")
            else:
                print(f"❌ HTTP Error: {response.text}")
                
        except Exception as e:
            print(f"❌ Request failed: {e}")

if __name__ == "__main__":
    debug_key_generation()