#ifndef ZENCUBE_PROM_EXPORTER_H
#define ZENCUBE_PROM_EXPORTER_H

// Prometheus metrics structure
typedef struct {
    double cpu_percent;
    double rss_bytes;
    double vms_bytes;
    double threads;
    double fds_open;
    double read_bytes;
    double write_bytes;
    double cpu_max;
    double rss_max;
} PromMetrics;

// Prometheus exporter state
typedef struct {
    int socket_fd;
    int port;
    char sample_log_path[1024];
} PromExporter;

// Initialize Prometheus exporter
int prom_exporter_init(PromExporter *exporter, int port, const char *sample_log_path);

// Run exporter HTTP server (blocking)
int prom_exporter_run(PromExporter *exporter);

// Cleanup exporter resources
void prom_exporter_cleanup(PromExporter *exporter);

#endif // ZENCUBE_PROM_EXPORTER_H
