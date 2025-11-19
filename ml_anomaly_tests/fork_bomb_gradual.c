/**
 * Gradual Fork Bomb Simulator
 * 
 * Purpose: Trigger ML anomaly detection for fork bomb / resource exhaustion
 * Expected: Critical anomaly score (0.85-0.95) with "fork_bomb" classification
 * 
 * This program gradually increases thread count to simulate a fork bomb attack
 * without actually creating a true fork bomb (uses threads for safety).
 */

#include <stdio.h>
#include <stdlib.h>
#include <pthread.h>
#include <unistd.h>

#define MAX_THREADS 80

pthread_t threads[MAX_THREADS];
volatile int keep_running = 1;

// Worker thread that just sleeps
void* worker_thread(void* arg) {
    int id = *(int*)arg;
    printf("    Thread %d started\n", id);
    
    while (keep_running) {
        sleep(1);
    }
    
    return NULL;
}

int main(int argc, char* argv[]) {
    printf("╔══════════════════════════════════════════════════════════╗\n");
    printf("║       GRADUAL FORK BOMB SIMULATOR (ML Test)             ║\n");
    printf("╚══════════════════════════════════════════════════════════╝\n\n");
    
    printf("⚠️  This program is designed to trigger ML anomaly detection.\n");
    printf("📊 Expected: Fork Bomb Anomaly (score: 0.85-0.95)\n");
    printf("🎯 Pattern: Gradual thread growth from 1 → 80+ threads\n\n");
    
    int max_threads = MAX_THREADS;
    if (argc > 1) {
        max_threads = atoi(argv[1]);
        if (max_threads > MAX_THREADS) max_threads = MAX_THREADS;
        if (max_threads < 5) max_threads = 5;
    }
    
    printf("Phase 1/3: Normal startup (1-5 threads)...\n");
    
    int* thread_ids = malloc(max_threads * sizeof(int));
    int created_threads = 0;
    
    // Phase 1: Normal behavior (5 threads)
    for (int i = 0; i < 5 && i < max_threads; i++) {
        thread_ids[i] = i + 1;
        if (pthread_create(&threads[i], NULL, worker_thread, &thread_ids[i]) == 0) {
            created_threads++;
            printf("  ✓ Created thread %d (total: %d)\n", i+1, created_threads);
            sleep(1);
        }
    }
    
    printf("\n🚨 Phase 2/3: ATTACK - Rapid thread spawning!\n");
    
    // Phase 2: Gradual fork bomb (rapid thread creation)
    for (int i = 5; i < max_threads; i++) {
        thread_ids[i] = i + 1;
        if (pthread_create(&threads[i], NULL, worker_thread, &thread_ids[i]) == 0) {
            created_threads++;
            
            if (created_threads == 10) {
                printf("  ⚠️  Thread count suspicious: %d threads\n", created_threads);
            } else if (created_threads == 25) {
                printf("  🚨 Thread count alarming: %d threads\n", created_threads);
            } else if (created_threads == 50) {
                printf("  💥 CRITICAL thread count: %d threads (FORK BOMB!)\n", created_threads);
            } else if (created_threads % 10 == 0) {
                printf("  🔴 Thread explosion: %d threads\n", created_threads);
            }
        } else {
            printf("  ❌ Failed to create thread %d (limit reached)\n", i+1);
            break;
        }
        
        // Accelerating creation rate
        if (i < 20) {
            usleep(500000);  // 0.5 sec
        } else if (i < 40) {
            usleep(300000);  // 0.3 sec
        } else {
            usleep(100000);  // 0.1 sec (very fast!)
        }
    }
    
    printf("\n📊 Peak thread count: %d threads\n", created_threads);
    printf("\nPhase 3/3: Sustaining high thread count...\n");
    
    // Sustain the load for ML to detect
    for (int i = 0; i < 10; i++) {
        printf("  [%d/10] Maintaining %d threads (ANOMALOUS)\n", i+1, created_threads);
        sleep(1);
    }
    
    printf("\n╔══════════════════════════════════════════════════════════╗\n");
    printf("║                 FORK BOMB TEST COMPLETE                  ║\n");
    printf("╚══════════════════════════════════════════════════════════╝\n");
    printf("\n📈 Total Threads Created: %d\n", created_threads);
    printf("📊 Thread Growth Rate: ~%.1f threads/sample\n", created_threads / 20.0);
    printf("🔍 Check ML Anomaly Detection tab for analysis.\n");
    printf("✓ Expected: isAnomalous=true, anomalyType='fork_bomb'\n\n");
    
    // Cleanup
    printf("Shutting down threads...\n");
    keep_running = 0;
    
    for (int i = 0; i < created_threads; i++) {
        pthread_join(threads[i], NULL);
    }
    
    free(thread_ids);
    
    return 0;
}
