# Git Cleanup - Quick Reference Card
**Copy-Paste Commands for ZenCube Repository Cleanup**

---

## 🔴 STEP 1: Backup (MANDATORY)

```bash
cd ~/Downloads
git clone --mirror /home/Idred/Downloads/ZenCube zencube-backup.git
du -sh zencube-backup.git
```

---

## 🔴 STEP 2: Download BFG

```bash
cd ~/Downloads
wget https://repo1.maven.org/maven2/com/madgag/bfg/1.14.0/bfg-1.14.0.jar -O bfg.jar
java -jar bfg.jar --version
```

---

## 🔴 STEP 3: Execute BFG (THE BIG ONE)

```bash
cd ~/Downloads

java -jar bfg.jar \
  --strip-blobs-bigger-than 10M \
  --delete-folders node_modules \
  --delete-folders backup_phase4_archive \
  --delete-folders models \
  --delete-folders dist \
  --delete-folders release \
  --delete-folders build \
  --delete-folders electron-builder-cache \
  --delete-files "*.pt" \
  --delete-files "*.pth" \
  --delete-files "*.pkl" \
  --delete-files "*.pickle" \
  --delete-files "*.AppImage" \
  --delete-files "*.exe" \
  --delete-files "*.deb" \
  --delete-files "*.dmg" \
  --delete-files "*.zip" \
  --no-blob-protection \
  zencube-backup.git
```

**Expected:** BFG will delete several GB of data from history.

---

## 🔴 STEP 4: Garbage Collection (FINALIZE)

```bash
cd ~/Downloads/zencube-backup.git

git reflog expire --expire=now --all
git gc --prune=now --aggressive

# Verify size reduction
du -sh .
```

**Expected:** Repository shrinks from ~4.7 GB to <500 MB

---

## 🔴 STEP 5: Clone Clean Repository

```bash
cd ~/Downloads
git clone zencube-backup.git ZenCube-clean
cd ZenCube-clean

# Verify
du -sh .git
ls -lh
```

**Expected:** `.git` folder <100 MB, all source files present.

---

## 🔴 STEP 6: Test Clean Repository

```bash
cd ~/Downloads/ZenCube-clean

# Install dependencies
npm install

# Build application
npm run build:main && npm run build:preload && npm run build:renderer

# Test run
npm run dev
```

**Expected:** Application builds and runs successfully.

---

## 🔴 STEP 7: Force Push (⚠️ DANGER ZONE)

**⚠️ ONLY AFTER:**
- ✅ Tested clean repo locally
- ✅ Team notified
- ✅ Backup created on GitHub

```bash
cd ~/Downloads/ZenCube-clean

# Add remote (if needed)
git remote add origin git@github.com:Divyansh-9/ZenCube.git

# Force push ALL branches
git push origin --force --all

# Force push ALL tags
git push origin --force --tags
```

---

## 🔴 STEP 8: Team Migration (Send to Everyone)

**Message to team:**

```
🚨 REPOSITORY REWRITE COMPLETE 🚨

Repository size reduced from 4.7 GB → <100 MB

ACTION REQUIRED - RE-CLONE:

1. Backup local work:
   git stash
   git branch my-backup

2. Delete old repo:
   cd ~/path/to && rm -rf ZenCube

3. Fresh clone:
   git clone git@github.com:Divyansh-9/ZenCube.git

DO NOT try to git pull on old clone - it will fail.
```

---

## 📊 Verification Commands

```bash
# Check .git size
du -sh .git

# Check total repo size
du -sh .

# List largest files in repo
find . -type f -size +5M -exec ls -lh {} \;

# Verify no large files in Git
git rev-list --objects --all | \
  git cat-file --batch-check='%(objecttype) %(objectname) %(objectsize) %(rest)' | \
  awk '/^blob/ {print $3, $4}' | \
  sort -n -r | \
  head -20
```

---

## 🛡️ Prevent Future Bloat

**Install pre-commit hook:**

```bash
cat > .git/hooks/pre-commit << 'EOF'
#!/bin/bash
MAX_SIZE=5242880 # 5 MB
for file in $(git diff --cached --name-only); do
    if [ -f "$file" ]; then
        size=$(stat -c%s "$file" 2>/dev/null || stat -f%z "$file" 2>/dev/null)
        if [ $size -gt $MAX_SIZE ]; then
            echo "❌ File $file too large ($(($size/1024/1024))MB). Max: 5MB"
            exit 1
        fi
    fi
done
EOF

chmod +x .git/hooks/pre-commit
```

---

## 🔥 Emergency Rollback (If Something Goes Wrong)

```bash
# If you haven't force-pushed yet:
cd ~/Downloads
rm -rf ZenCube-clean
git clone zencube-backup.git ZenCube-restored

# If you DID force-push and need to restore:
# Contact GitHub support or restore from backup clone
cd ~/Downloads
git clone zencube-backup.git ZenCube-emergency
cd ZenCube-emergency
git push origin --force --all
```

---

## ✅ Success Checklist

- [ ] Backup created (`zencube-backup.git` exists)
- [ ] BFG executed (no errors, deleted X GB)
- [ ] Garbage collection complete (repo <500 MB)
- [ ] Clean clone tested (builds successfully)
- [ ] `.git` folder <100 MB
- [ ] Force push completed
- [ ] Team notified and re-cloning
- [ ] Pre-commit hook installed

---

**⏱️ Estimated Time:** 30-60 minutes  
**⚠️ Difficulty:** High (history rewrite)  
**🎯 Expected Result:** 98% repository size reduction
