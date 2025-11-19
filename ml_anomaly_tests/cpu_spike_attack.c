/**
 * CPU Spike Attack Simulator
 * 
 * Purpose: Trigger ML anomaly detection for CPU spike behavior
 * Expected: High anomaly score (0.8-0.95) with "cpu_spike" classification
 * 
 * This program simulates a malicious process that suddenly consumes massive CPU
 * after appearing benign initially.
 */

#include <stdio.h>
#include <stdlib.h>
#include <unistd.h>
#include <time.h>

void consume_cpu(int duration_sec) {
    clock_t start = clock();
    clock_t end = start + (duration_sec * CLOCKS_PER_SEC);
    
    volatile long long sum = 0;
    volatile long long counter = 0;
    
    while (clock() < end) {
        // Intensive computation to max out CPU
        for (int i = 0; i < 10000; i++) {
            sum += (counter * counter) % 997;
            counter++;
        }
    }
}

int main(int argc, char* argv[]) {
    printf("╔══════════════════════════════════════════════════════════╗\n");
    printf("║         CPU SPIKE ATTACK SIMULATOR (ML Test)            ║\n");
    printf("╚══════════════════════════════════════════════════════════╝\n\n");
    
    printf("⚠️  This program is designed to trigger ML anomaly detection.\n");
    printf("📊 Expected: CPU Spike Anomaly (score: 0.8-0.95)\n");
    printf("🎯 Pattern: Low CPU (5%) → Sudden spike to 95%+ sustained\n\n");
    
    // Phase 1: Appear benign (5 seconds of low CPU usage)
    printf("Phase 1/3: Benign behavior (low CPU)...\n");
    for (int i = 0; i < 5; i++) {
        printf("  [%d/5] CPU: ~5%% (normal)\n", i+1);
        usleep(900000);  // Sleep 900ms, consume 100ms
        consume_cpu(0);  // Minimal CPU
        usleep(100000);
    }
    
    printf("\n🚨 Phase 2/3: ATTACK - CPU SPIKE!\n");
    printf("  ⚡ Consuming 95%%+ CPU for 15 seconds...\n");
    
    // Phase 2: Sudden CPU spike (15 seconds of near-100% CPU)
    time_t attack_start = time(NULL);
    for (int i = 0; i < 15; i++) {
        printf("  [%d/15] CPU: 95%%+ (ANOMALOUS)\n", i+1);
        consume_cpu(1);  // Max CPU for 1 second
    }
    time_t attack_end = time(NULL);
    
    printf("\n✅ Phase 3/3: Returning to normal behavior...\n");
    for (int i = 0; i < 3; i++) {
        printf("  [%d/3] CPU: ~5%% (normal)\n", i+1);
        sleep(1);
    }
    
    printf("\n╔══════════════════════════════════════════════════════════╗\n");
    printf("║                   ATTACK COMPLETE                        ║\n");
    printf("╚══════════════════════════════════════════════════════════╝\n");
    printf("\n📈 Attack Duration: %ld seconds\n", attack_end - attack_start);
    printf("🔍 Check ML Anomaly Detection tab for analysis.\n");
    printf("✓ Expected: isAnomalous=true, anomalyType='cpu_spike'\n\n");
    
    return 0;
}
