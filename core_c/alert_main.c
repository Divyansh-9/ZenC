#include "alert_engine.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <getopt.h>
#include <signal.h>
#include <unistd.h>

static volatile int running = 1;

static void handle_signal(int sig) {
    (void)sig;
    running = 0;
}

static void print_usage(const char *prog) {
    fprintf(stderr, "Usage: %s --config <config.json> --log <samples.jsonl> --out <alerts.jsonl> --run-id <id> [--interval <sec>]\n", prog);
    fprintf(stderr, "Options:\n");
    fprintf(stderr, "  --config PATH      Alert rules JSON config\n");
    fprintf(stderr, "  --log PATH         Sample JSONL log to monitor\n");
    fprintf(stderr, "  --out PATH         Output alerts JSONL path\n");
    fprintf(stderr, "  --run-id ID        Run identifier\n");
    fprintf(stderr, "  --interval SEC     Evaluation interval (default: 5)\n");
    fprintf(stderr, "  --help             Show this help\n");
}

int main(int argc, char **argv) {
    char *config_path = NULL;
    char *log_path = NULL;
    char *out_path = NULL;
    char *run_id = NULL;
    int interval = 5;
    
    static struct option long_options[] = {
        {"config",   required_argument, 0, 'c'},
        {"log",      required_argument, 0, 'l'},
        {"out",      required_argument, 0, 'o'},
        {"run-id",   required_argument, 0, 'r'},
        {"interval", required_argument, 0, 'i'},
        {"help",     no_argument,       0, 'h'},
        {0, 0, 0, 0}
    };
    
    int opt;
    while ((opt = getopt_long(argc, argv, "c:l:o:r:i:h", long_options, NULL)) != -1) {
        switch (opt) {
            case 'c': config_path = optarg; break;
            case 'l': log_path = optarg; break;
            case 'o': out_path = optarg; break;
            case 'r': run_id = optarg; break;
            case 'i': interval = atoi(optarg); break;
            case 'h':
            default:
                print_usage(argv[0]);
                return opt == 'h' ? 0 : 1;
        }
    }
    
    if (!config_path || !log_path || !out_path || !run_id) {
        fprintf(stderr, "Error: Missing required arguments\n");
        print_usage(argv[0]);
        return 1;
    }
    
    // Initialize alert engine
    AlertEngine engine;
    if (alert_engine_init(&engine, config_path, out_path) != 0) {
        fprintf(stderr, "Failed to initialize alert engine\n");
        return 1;
    }
    
    printf("Alert engine started (run-id=%s, interval=%ds)\n", run_id, interval);
    printf("Config: %s\n", config_path);
    printf("Monitoring: %s\n", log_path);
    printf("Alerts: %s\n", out_path);
    printf("Loaded %d rules\n", engine.rule_count);
    
    // Setup signal handlers
    signal(SIGINT, handle_signal);
    signal(SIGTERM, handle_signal);
    
    // Main evaluation loop
    while (running) {
        if (alert_engine_evaluate(&engine, log_path, run_id) != 0) {
            fprintf(stderr, "Warning: Evaluation cycle failed\n");
        }
        sleep(interval);
    }
    
    printf("\nShutdown signal received, cleaning up...\n");
    alert_engine_cleanup(&engine);
    
    return 0;
}
