/*
 * infinite_loop.c - CPU stress test
 * Runs an infinite loop to test CPU limits
 */
#include <stdio.h>

int main(void) {
    printf("Starting infinite CPU loop...\n");
    fflush(stdout);
    
    volatile unsigned long long counter = 0;
    while (1) {
        counter++;
        // Burn CPU cycles
        if (counter % 100000000ULL == 0) {
            printf("Counter: %llu\n", counter);
            fflush(stdout);
        }
    }
    
    return 0;
}
