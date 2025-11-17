/*
 * network_test.c - Network connectivity test
 * Attempts to connect to external servers to test network restrictions
 */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <sys/socket.h>
#include <netinet/in.h>
#include <arpa/inet.h>

#define TEST_IP "8.8.8.8"
#define TEST_PORT 53

int main(void) {
    printf("Starting network connectivity test...\n");
    printf("Attempting to connect to %s:%d (Google DNS)...\n", TEST_IP, TEST_PORT);
    fflush(stdout);
    
    int attempt = 0;
    
    while (1) {
        attempt++;
        
        int sock = socket(AF_INET, SOCK_STREAM, 0);
        if (sock < 0) {
            fprintf(stderr, "Attempt %d: socket() failed\n", attempt);
            perror("socket");
            sleep(2);
            continue;
        }
        
        struct sockaddr_in server;
        server.sin_family = AF_INET;
        server.sin_port = htons(TEST_PORT);
        
        if (inet_pton(AF_INET, TEST_IP, &server.sin_addr) <= 0) {
            fprintf(stderr, "Attempt %d: Invalid address\n", attempt);
            close(sock);
            sleep(2);
            continue;
        }
        
        printf("Attempt %d: Connecting...\n", attempt);
        fflush(stdout);
        
        if (connect(sock, (struct sockaddr*)&server, sizeof(server)) < 0) {
            fprintf(stderr, "Attempt %d: Connection failed (Network blocked?)\n", attempt);
            perror("connect");
        } else {
            printf("Attempt %d: Connection successful!\n", attempt);
        }
        
        close(sock);
        sleep(3);
    }
    
    return 0;
}
