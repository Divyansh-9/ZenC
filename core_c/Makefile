CC = gcc
CFLAGS = -std=c11 -Wall -Wextra -Wpedantic -O2 -D_GNU_SOURCE -D_POSIX_C_SOURCE=200809L
LDFLAGS = -pthread -lm -lz
BINDIR = bin
SRCDIR = .

# Targets
SAMPLER = $(BINDIR)/sampler
ALERTD = $(BINDIR)/alertd
LOGROTATE = $(BINDIR)/logrotate_core
PROM_EXPORTER = $(BINDIR)/prom_exporter

# Object files
COMMON_OBJS = cJSON.o logutil.o
SAMPLER_OBJS = sampler_main.o sampler.o $(COMMON_OBJS)
ALERTD_OBJS = alert_main.o alert_engine.o $(COMMON_OBJS)
LOGROTATE_OBJS = logrotate_main.o logutil.o
PROM_OBJS = prom_main.o prom_exporter.o sampler.o $(COMMON_OBJS)

.PHONY: all clean test install

all: $(BINDIR) $(SAMPLER) $(ALERTD) $(LOGROTATE) $(PROM_EXPORTER)

$(BINDIR):
	mkdir -p $(BINDIR)

# Sampler daemon
$(SAMPLER): $(SAMPLER_OBJS)
	$(CC) $(CFLAGS) -o $@ $^ $(LDFLAGS)

# Alert evaluation daemon
$(ALERTD): $(ALERTD_OBJS)
	$(CC) $(CFLAGS) -o $@ $^ $(LDFLAGS)

# Log rotation utility
$(LOGROTATE): $(LOGROTATE_OBJS)
	$(CC) $(CFLAGS) -o $@ $^ $(LDFLAGS)

# Prometheus exporter
$(PROM_EXPORTER): $(PROM_OBJS)
	$(CC) $(CFLAGS) -o $@ $^ $(LDFLAGS)

# Compile rules
%.o: %.c
	$(CC) $(CFLAGS) -c $< -o $@

test: all
	@echo "========================================="
	@echo "Running Phase-3 Core C Tests"
	@echo "========================================="
	@bash tests/test_sampler.sh
	@bash tests/test_alert_engine.sh
	@bash tests/test_prom_exporter.sh
	@echo "========================================="
	@echo "All tests completed!"
	@echo "========================================="

clean:
	rm -f *.o
	rm -rf $(BINDIR)
	rm -f test_*.jsonl test_*.log

install: all
	@echo "Binaries built in $(BINDIR)/"
	@echo "Run 'make test' to validate installation"
