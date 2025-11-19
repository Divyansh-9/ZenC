#!/usr/bin/env bash
# Prepare a development-friendly rootfs for the sandbox `--jail` flag without requiring root.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
JAIL_DIR="${REPO_ROOT}/sandbox_jail"

printf '[build-jail] Target directory: %s\n' "${JAIL_DIR}"
mkdir -p "${JAIL_DIR}" "${JAIL_DIR}/bin" "${JAIL_DIR}/lib" "${JAIL_DIR}/lib64" \
    "${JAIL_DIR}/usr/lib" "${JAIL_DIR}/tmp" "${JAIL_DIR}/etc"

if [[ ! -x /bin/sh ]]; then
    printf '[build-jail] Error: /bin/sh not found or not executable.\n' >&2
    exit 1
fi

printf '[build-jail] Copying /bin/sh into the jail...\n'
cp -f /bin/sh "${JAIL_DIR}/bin/"

printf '[build-jail] Mirroring shared library dependencies...\n'
ldd /bin/sh \
    | awk '/=>/ {print $3} !/=>/ {print $1}' \
    | grep '^/' \
    | sort -u \
    | while read -r lib; do
    dest="${JAIL_DIR}$(dirname "${lib}")"
    mkdir -p "${dest}"
    cp -f "${lib}" "${dest}/"
    printf '  -> %s\n' "${lib}"
done

if [[ ! -e "${JAIL_DIR}/etc/passwd" ]]; then
    printf '[build-jail] Creating stub etc/passwd for compatibility.\n'
    cat > "${JAIL_DIR}/etc/passwd" <<'EOF'
root:x:0:0:root:/root:/bin/sh
nobody:x:65534:65534:nobody:/nonexistent:/usr/sbin/nologin
EOF
fi

cat <<EOF
[build-jail] Done.
  - Jail root: ${JAIL_DIR}
  - Try running: python3 monitor/jail_wrapper.py --jail ${JAIL_DIR} -- /bin/sh -c 'pwd'
  - Remember: activating chroot() still requires root. This script only prepares the directory tree.
EOF
