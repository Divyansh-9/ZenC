#include "prom_exporter.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <getopt.h>
#include <signal.h>

static PromExporter *global_exporter = NULL;

static void handle_signal(int sig) {
    (void)sig;
    if (global_exporter) {
        prom_exporter_cleanup(global_exporter);
    }
    exit(0);
}

static void print_usage(const char *prog) {
    fprintf(stderr, "Usage: %s --log <samples.jsonl> [--port <port>]\n", prog);
    fprintf(stderr, "Options:\n");
    fprintf(stderr, "  --log PATH    Sample JSONL log to export\n");
    fprintf(stderr, "  --port PORT   HTTP server port (default: 9090)\n");
    fprintf(stderr, "  --help        Show this help\n");
}

int main(int argc, char **argv) {
    char *log_path = NULL;
    int port = 9090;
    
    static struct option long_options[] = {
        {"log",  required_argument, 0, 'l'},
        {"port", required_argument, 0, 'p'},
        {"help", no_argument,       0, 'h'},
        {0, 0, 0, 0}
    };
    
    int opt;
    while ((opt = getopt_long(argc, argv, "l:p:h", long_options, NULL)) != -1) {
        switch (opt) {
            case 'l': log_path = optarg; break;
            case 'p': port = atoi(optarg); break;
            case 'h':
            default:
                print_usage(argv[0]);
                return opt == 'h' ? 0 : 1;
        }
    }
    
    if (!log_path) {
        fprintf(stderr, "Error: Missing required --log argument\n");
        print_usage(argv[0]);
        return 1;
    }
    
    // Initialize exporter
    PromExporter exporter;
    if (prom_exporter_init(&exporter, port, log_path) != 0) {
        fprintf(stderr, "Failed to initialize Prometheus exporter\n");
        return 1;
    }
    
    global_exporter = &exporter;
    
    // Setup signal handlers
    signal(SIGINT, handle_signal);
    signal(SIGTERM, handle_signal);
    
    printf("Starting Prometheus exporter\n");
    printf("Sample log: %s\n", log_path);
    printf("Listening on port: %d\n", port);
    
    // Run server (blocking)
    int result = prom_exporter_run(&exporter);
    
    prom_exporter_cleanup(&exporter);
    return result;
}
