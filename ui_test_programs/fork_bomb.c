/*
 * fork_bomb.c - Process stress test
 * Rapidly forks processes to test process limits
 */
#include <stdio.h>
#include <stdlib.h>
#include <unistd.h>
#include <sys/types.h>

int main(void) {
    printf("Starting fork bomb test...\n");
    printf("WARNING: This will create many processes!\n");
    fflush(stdout);
    
    unsigned int count = 0;
    
    while (1) {
        pid_t pid = fork();
        
        if (pid < 0) {
            // Fork failed
            fprintf(stderr, "Fork failed after %u processes\n", count);
            perror("fork");
            sleep(1);
            continue;
        }
        
        count++;
        
        if (pid == 0) {
            // Child process - just sleep and exit
            sleep(60);
            exit(0);
        } else {
            // Parent process
            if (count % 10 == 0) {
                printf("Forked %u processes (latest PID: %d)\n", count, pid);
                fflush(stdout);
            }
            usleep(50000); // 50ms delay
        }
    }
    
    return 0;
}
