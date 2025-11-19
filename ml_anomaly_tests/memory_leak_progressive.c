/**
 * Progressive Memory Leak Simulator
 * 
 * Purpose: Trigger ML anomaly detection for memory leak behavior
 * Expected: High anomaly score (0.75-0.90) with "memory_leak" classification
 * 
 * This program simulates a memory leak by allocating memory at an increasing
 * rate without freeing it, creating a clear upward trend.
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>

#define MB (1024 * 1024)

int main(int argc, char* argv[]) {
    printf("╔══════════════════════════════════════════════════════════╗\n");
    printf("║      MEMORY LEAK PROGRESSIVE SIMULATOR (ML Test)        ║\n");
    printf("╚══════════════════════════════════════════════════════════╝\n\n");
    
    printf("⚠️  This program is designed to trigger ML anomaly detection.\n");
    printf("📊 Expected: Memory Leak Anomaly (score: 0.75-0.90)\n");
    printf("🎯 Pattern: Progressive memory growth (10MB/sec+)\n\n");
    
    void* allocations[30];
    size_t total_allocated = 0;
    
    printf("Phase 1/2: Starting memory leak...\n\n");
    
    // Progressive memory leak: each iteration allocates more
    for (int i = 0; i < 25; i++) {
        // Allocate increasing amounts: 5MB, 10MB, 15MB, 20MB...
        size_t alloc_size = (i + 1) * 5 * MB;
        
        allocations[i] = malloc(alloc_size);
        
        if (allocations[i] == NULL) {
            printf("  ❌ [%d/25] Memory allocation FAILED at %zu MB\n", i+1, alloc_size / MB);
            printf("     (System limit reached - this is expected)\n");
            break;
        }
        
        // Touch the memory to ensure it's actually allocated
        memset(allocations[i], 0xAA, alloc_size);
        
        total_allocated += alloc_size;
        
        printf("  🔴 [%d/25] Leaked %zu MB | Total: %zu MB | Growth: +%zu MB/sec\n", 
               i+1, 
               alloc_size / MB, 
               total_allocated / MB,
               (alloc_size / MB));
        
        sleep(1);
        
        // Show the leak is getting worse
        if (i == 5) {
            printf("\n  ⚠️  Memory leak detected! Continuing to worsen...\n\n");
        }
        if (i == 10) {
            printf("\n  🚨 Critical memory leak! Growth accelerating...\n\n");
        }
        if (i == 15) {
            printf("\n  💥 Severe memory leak! System resources depleting...\n\n");
        }
    }
    
    printf("\nPhase 2/2: Memory leak sustained (NOT cleaning up)...\n");
    printf("  Holding %zu MB allocated for 5 seconds...\n", total_allocated / MB);
    
    for (int i = 0; i < 5; i++) {
        printf("  [%d/5] Memory still leaked: %zu MB\n", i+1, total_allocated / MB);
        sleep(1);
    }
    
    printf("\n╔══════════════════════════════════════════════════════════╗\n");
    printf("║                  LEAK TEST COMPLETE                      ║\n");
    printf("╚══════════════════════════════════════════════════════════╝\n");
    printf("\n📈 Total Memory Leaked: %zu MB\n", total_allocated / MB);
    printf("📊 Average Growth Rate: ~%.1f MB/sample\n", (total_allocated / MB) / 25.0);
    printf("🔍 Check ML Anomaly Detection tab for analysis.\n");
    printf("✓ Expected: isAnomalous=true, anomalyType='memory_leak'\n\n");
    
    // Cleanup (but the damage is already done for ML detection)
    printf("Cleaning up allocations...\n");
    for (int i = 0; i < 30; i++) {
        if (allocations[i]) {
            free(allocations[i]);
        }
    }
    
    return 0;
}
