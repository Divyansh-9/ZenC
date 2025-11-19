/**
 * Combined Resource Exhaustion Attack Simulator
 * 
 * Purpose: Trigger ML anomaly detection with multiple simultaneous anomalies
 * Expected: Critical anomaly score (0.9+) with "resource_exhaustion" classification
 * 
 * This program combines CPU spike, memory leak, thread explosion, and high file
 * descriptor usage to create a complex multi-dimensional anomaly.
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <pthread.h>
#include <unistd.h>
#include <time.h>
#include <fcntl.h>

#define MB (1024 * 1024)
#define MAX_THREADS 60
#define MAX_FILES 100

pthread_t threads[MAX_THREADS];
volatile int keep_running = 1;
int open_fds[MAX_FILES];

void* cpu_consumer_thread(void* arg) {
    volatile long long sum = 0;
    while (keep_running) {
        for (int i = 0; i < 100000; i++) {
            sum += (sum * 31 + i) % 997;
        }
    }
    return NULL;
}

int main(int argc, char* argv[]) {
    printf("╔══════════════════════════════════════════════════════════╗\n");
    printf("║   RESOURCE EXHAUSTION COMBO ATTACK (ML Test)            ║\n");
    printf("╚══════════════════════════════════════════════════════════╝\n\n");
    
    printf("⚠️  This program is designed to trigger ML anomaly detection.\n");
    printf("📊 Expected: Resource Exhaustion Anomaly (score: 0.9+)\n");
    printf("🎯 Pattern: Simultaneous CPU + Memory + Threads + Files\n\n");
    
    void* memory_leaks[30];
    int leak_count = 0;
    int thread_count = 0;
    int file_count = 0;
    
    printf("Phase 1/3: Normal startup...\n");
    sleep(2);
    
    printf("\n🚨 Phase 2/3: COMBINED ATTACK!\n");
    printf("  Triggering all attack vectors simultaneously...\n\n");
    
    for (int i = 0; i < 20; i++) {
        printf("  ⚡ Attack iteration %d/20:\n", i+1);
        
        // Attack Vector 1: Memory Leak
        if (i % 2 == 0 && leak_count < 30) {
            size_t alloc = (leak_count + 1) * 8 * MB;
            memory_leaks[leak_count] = malloc(alloc);
            if (memory_leaks[leak_count]) {
                memset(memory_leaks[leak_count], 0xBB, alloc);
                leak_count++;
                printf("    💧 Memory leak: +%zu MB (total: %d leaks)\n", alloc / MB, leak_count);
            }
        }
        
        // Attack Vector 2: Thread Explosion
        if (i % 3 == 0 && thread_count < MAX_THREADS) {
            // Create 3 threads at once
            for (int j = 0; j < 3 && thread_count < MAX_THREADS; j++) {
                if (pthread_create(&threads[thread_count], NULL, cpu_consumer_thread, NULL) == 0) {
                    thread_count++;
                }
            }
            printf("    🧵 Thread spawn: +3 threads (total: %d threads)\n", thread_count);
        }
        
        // Attack Vector 3: File Descriptor Exhaustion
        if (i % 2 == 1 && file_count < MAX_FILES) {
            char temp_name[256];
            snprintf(temp_name, sizeof(temp_name), "/tmp/exhaust_%d_%d.tmp", getpid(), file_count);
            open_fds[file_count] = open(temp_name, O_CREAT | O_WRONLY, 0644);
            if (open_fds[file_count] >= 0) {
                file_count++;
                printf("    📁 File opened: %d open files\n", file_count);
            }
        }
        
        // Attack Vector 4: CPU Spike (via existing threads)
        if (thread_count > 0) {
            printf("    🔥 CPU spike: %d threads consuming CPU\n", thread_count);
        }
        
        // Show critical threshold warnings
        if (i == 5) {
            printf("\n  ⚠️  WARNING: Resource consumption elevated\n\n");
        }
        if (i == 10) {
            printf("\n  🚨 CRITICAL: Multiple resource exhaustion vectors active\n\n");
        }
        if (i == 15) {
            printf("\n  💥 SEVERE: System resources critically depleted\n\n");
        }
        
        sleep(1);
    }
    
    printf("\n📊 Attack Summary:\n");
    printf("  Memory Leaks: %d (total leaked memory)\n", leak_count);
    printf("  Active Threads: %d (consuming CPU)\n", thread_count);
    printf("  Open Files: %d file descriptors\n", file_count);
    printf("  CPU Usage: Sustained high (~80-95%%)\n");
    
    printf("\nPhase 3/3: Sustaining attack for ML detection...\n");
    for (int i = 0; i < 8; i++) {
        printf("  [%d/8] All attack vectors active (CRITICAL)\n", i+1);
        sleep(1);
    }
    
    printf("\n╔══════════════════════════════════════════════════════════╗\n");
    printf("║           COMBO ATTACK TEST COMPLETE                    ║\n");
    printf("╚══════════════════════════════════════════════════════════╝\n");
    printf("\n📈 Resource Exhaustion Metrics:\n");
    printf("  Memory: %d leaks\n", leak_count);
    printf("  Threads: %d active\n", thread_count);
    printf("  Files: %d open\n", file_count);
    printf("  CPU: Sustained high load\n");
    printf("\n🔍 Check ML Anomaly Detection tab for analysis.\n");
    printf("✓ Expected: isAnomalous=true, anomalyType='resource_exhaustion'\n");
    printf("✓ Expected: anomalyScore > 0.9 (CRITICAL)\n\n");
    
    // Cleanup
    printf("Shutting down attack...\n");
    keep_running = 0;
    
    // Join threads
    for (int i = 0; i < thread_count; i++) {
        pthread_join(threads[i], NULL);
    }
    
    // Free memory
    for (int i = 0; i < leak_count; i++) {
        if (memory_leaks[i]) free(memory_leaks[i]);
    }
    
    // Close files
    for (int i = 0; i < file_count; i++) {
        if (open_fds[i] >= 0) {
            close(open_fds[i]);
            char temp_name[256];
            snprintf(temp_name, sizeof(temp_name), "/tmp/exhaust_%d_%d.tmp", getpid(), i);
            unlink(temp_name);
        }
    }
    
    return 0;
}
