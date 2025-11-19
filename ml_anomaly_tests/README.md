# ML Anomaly Detection Test Suite

This folder contains test programs **designed to trigger ML anomaly detection**. Unlike the `ui_test_programs/bin` folder (which contains whitelisted test utilities), these programs should **always be analyzed** by the ML pipeline and should show anomalies.

## Test Programs

### 1. `cpu_spike_attack.c`
**Expected Detection:** CPU Spike Anomaly  
**Behavior:** Starts with low CPU, then suddenly spikes to 95%+ for extended period  
**Anomaly Score:** High (0.8-0.95)

### 2. `memory_leak_progressive.c`
**Expected Detection:** Memory Leak Anomaly  
**Behavior:** Progressively allocates memory without freeing (10MB/sec growth)  
**Anomaly Score:** High (0.75-0.90)

### 3. `fork_bomb_gradual.c`
**Expected Detection:** Fork Bomb / Resource Exhaustion  
**Behavior:** Gradually increases thread/process count beyond safe thresholds  
**Anomaly Score:** Critical (0.85-0.95)

### 4. `io_storm_writer.c`
**Expected Detection:** I/O Storm Anomaly  
**Behavior:** Writes massive amounts of data rapidly (>10MB/s)  
**Anomaly Score:** Moderate-High (0.6-0.8)

### 5. `resource_exhaustion_combo.c`
**Expected Detection:** Multiple Anomaly Types  
**Behavior:** Combines CPU spike + memory leak + high file descriptor usage  
**Anomaly Score:** Critical (0.9+)

### 6. `ml_test_pattern` (from ui_test_programs)
**Expected Detection:** Various patterns (1-5)  
**Behavior:** Configurable test patterns for ML validation  
**Anomaly Score:** Varies by pattern (patterns 2-5 should trigger anomalies)

## Usage

```bash
# Build all tests
cd ml_anomaly_tests
make all

# Run individual tests via ZenCube GUI
# Navigate to Sandbox tab → Browse → Select test from ml_anomaly_tests/bin/
# Then check ML Anomaly Detection tab for analysis results

# Or run directly with monitoring
./bin/cpu_spike_attack
./bin/memory_leak_progressive
./bin/fork_bomb_gradual 5  # Create 5 worker threads
./bin/io_storm_writer
./bin/resource_exhaustion_combo
```

## Expected vs Actual Results

| Test Program | Expected Anomaly Type | Expected Score | Whitelisted? |
|--------------|----------------------|----------------|--------------|
| cpu_spike_attack | CPU Spike | 0.8-0.95 | ❌ No |
| memory_leak_progressive | Memory Leak | 0.75-0.90 | ❌ No |
| fork_bomb_gradual | Fork Bomb | 0.85-0.95 | ❌ No |
| io_storm_writer | I/O Storm | 0.6-0.8 | ❌ No |
| resource_exhaustion_combo | Resource Exhaustion | 0.9+ | ❌ No |

**Note:** Test programs in `ui_test_programs/bin/` (infinite_loop, memory_hog, fork_bomb, file_writer, network_test) are **whitelisted** and should NOT trigger ML analysis.

## Verification

After running each test:
1. Check the **ML Anomaly Detection** tab in ZenCube GUI
2. Verify `isAnomalous: true` for the test program
3. Verify `anomalyScore` is in the expected range
4. Verify `anomalyType` matches expectations
5. Review AI-generated `recommendations`

## Building

```bash
make all        # Build all tests
make clean      # Remove binaries and temp files
```
