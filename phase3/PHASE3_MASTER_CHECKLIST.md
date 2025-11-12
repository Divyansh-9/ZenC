# Phase 3 Master Checklist

## Task Tracking
- [x] File System Restriction (dev-safe) — ✅ Completed by GitHub Copilot 2025-11-12 03:48 UTC (chroot flag + dev wrapper + tests)
- [~] GUI – File Restriction Panel (Python GUI) — 🔄 In-Progress (started by GitHub Copilot 2025-11-12 12:01 UTC)

## Filesystem Isolation Goals
- [x] Implement chroot() jail for sandboxed processes
- [ ] Provide read-only filesystem mount support
- [ ] Configure mount namespaces via unshare(CLONE_NEWNS)
- [ ] Isolate temporary directories (per-sandbox /tmp)
- [ ] Define directory whitelisting and blacklisting rules
- [ ] Add dedicated filesystem isolation test programs

## Hardening Enhancements
- [ ] Introduce seccomp-based system call filtering
- [ ] Enable network namespace isolation where applicable
- [ ] Implement capability dropping for reduced privileges
