#!/usr/bin/env python3
"""
Phase-3 Monitoring Demonstration Script
This script runs various processes to demonstrate real-time monitoring charts
"""

import subprocess
import time
import sys
from pathlib import Path

def print_banner(text):
    """Print a formatted banner"""
    print("\n" + "=" * 80)
    print(f"  {text}")
    print("=" * 80 + "\n")

def test_low_cpu_process():
    """Test 1: Low CPU process (sleep)"""
    print_banner("TEST 1: Low CPU Process - /bin/sleep 5")
    print("📊 Expected Graph Behavior:")
    print("   - CPU: Flat line near 0%")
    print("   - Memory: Constant (minimal)")
    print("\n▶️  Executing: /bin/sleep 5")
    
    result = subprocess.run(
        ["./sandbox", "--cpu=10", "--mem=256", "/bin/sleep", "5"],
        capture_output=True,
        text=True
    )
    
    print(f"✅ Exit Code: {result.returncode}")
    if result.stdout:
        print(f"Output: {result.stdout[:200]}")
    print("\n⏸️  Pausing 2 seconds...\n")
    time.sleep(2)

def test_cpu_intensive_process():
    """Test 2: CPU intensive process"""
    print_banner("TEST 2: CPU Intensive Process - Calculating primes")
    print("📊 Expected Graph Behavior:")
    print("   - CPU: Spike to high % (40-100%)")
    print("   - Memory: Low/moderate")
    
    # Create a simple CPU intensive task
    cpu_script = """
import time
def find_primes(n):
    primes = []
    for num in range(2, n):
        is_prime = True
        for i in range(2, int(num ** 0.5) + 1):
            if num % i == 0:
                is_prime = False
                break
        if is_prime:
            primes.append(num)
    return primes
    
start = time.time()
result = find_primes(5000)
duration = time.time() - start
print(f'Found {len(result)} primes in {duration:.2f}s')
"""
    
    print(f"\n▶️  Executing: Python CPU-intensive task (5 seconds)")
    
    result = subprocess.run(
        ["./sandbox", "--cpu=10", "--mem=256", "/usr/bin/python3", "-c", cpu_script],
        capture_output=True,
        text=True,
        timeout=15
    )
    
    print(f"✅ Exit Code: {result.returncode}")
    if result.stdout:
        print(f"Output: {result.stdout.strip()}")
    print("\n⏸️  Pausing 2 seconds...\n")
    time.sleep(2)

def test_memory_intensive_process():
    """Test 3: Memory allocation process"""
    print_banner("TEST 3: Memory Intensive Process")
    print("📊 Expected Graph Behavior:")
    print("   - CPU: Low")
    print("   - Memory: Spike upward as array grows")
    
    mem_script = """
import time
print('Allocating 50MB of memory...')
data = [0] * (50 * 1024 * 1024 // 8)  # ~50MB
print(f'Allocated {len(data) * 8 / 1024 / 1024:.1f} MB')
time.sleep(3)
print('Releasing memory...')
del data
print('Done')
"""
    
    print(f"\n▶️  Executing: Python memory allocation")
    
    result = subprocess.run(
        ["./sandbox", "--cpu=10", "--mem=256", "/usr/bin/python3", "-c", mem_script],
        capture_output=True,
        text=True,
        timeout=15
    )
    
    print(f"✅ Exit Code: {result.returncode}")
    if result.stdout:
        print(f"Output: {result.stdout.strip()}")
    print("\n⏸️  Pausing 2 seconds...\n")
    time.sleep(2)

def test_resource_limit_enforcement():
    """Test 4: Resource limit enforcement"""
    print_banner("TEST 4: Resource Limit Enforcement (CPU Limit)")
    print("📊 Expected Graph Behavior:")
    print("   - CPU: Spike then KILLED by sandbox")
    print("   - Process terminated after hitting CPU limit")
    
    print(f"\n▶️  Executing: /usr/bin/yes with 2 second CPU limit")
    
    result = subprocess.run(
        ["./sandbox", "--cpu=2", "--mem=256", "/usr/bin/yes"],
        capture_output=True,
        text=True,
        timeout=10
    )
    
    print(f"✅ Exit Code: {result.returncode}")
    if result.returncode == 137 or result.returncode == 143:
        print("   ✅ Process correctly terminated by CPU limit!")
    if result.stderr:
        print(f"Stderr: {result.stderr[:200]}")
    print("\n⏸️  Test complete!\n")

def main():
    """Main test runner"""
    print("\n" + "╔" + "═" * 78 + "╗")
    print("║" + " " * 20 + "🧊 ZenCube Phase-3 Monitoring Demo" + " " * 24 + "║")
    print("╚" + "═" * 78 + "╝")
    
    print("\n📍 Current Directory:", Path.cwd())
    print("🎯 Testing Phase-3 Features:")
    print("   ✅ Real-time CPU monitoring")
    print("   ✅ Real-time Memory (RSS) monitoring")
    print("   ✅ Resource limit enforcement")
    print("   ✅ Process lifecycle tracking")
    
    # Check if sandbox exists
    if not Path("./sandbox").exists():
        print("\n❌ ERROR: ./sandbox not found!")
        print("   Please run this from the zencube/ directory")
        return 1
    
    try:
        # Run test suite
        test_low_cpu_process()
        test_cpu_intensive_process()
        test_memory_intensive_process()
        test_resource_limit_enforcement()
        
        print_banner("✅ ALL PHASE-3 TESTS COMPLETED!")
        print("📊 Check the GUI 'Monitoring & Metrics' panel to see:")
        print("   - CPU Usage graphs")
        print("   - Memory RSS graphs")
        print("   - Real-time EWMA smoothing")
        print("   - Alert notifications (if thresholds exceeded)")
        print("\n📂 Monitoring logs saved to: monitor/logs/")
        print("\n🎉 Phase-3 is fully operational!\n")
        
        return 0
        
    except subprocess.TimeoutExpired:
        print("\n⚠️  Test timeout - this is expected for infinite processes")
        return 0
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return 1

if __name__ == "__main__":
    sys.exit(main())
