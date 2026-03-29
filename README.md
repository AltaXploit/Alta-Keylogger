# 🛡️ Alta-Keylogger


### *Advanced Browser-Level Persistence Keylogger*

*(Replace the link above with your actual screenshot once uploaded to GitHub)*

-----

## 📝 Description

**Alta-Keylogger** is a sophisticated keylogger monitoring tool designed to demonstrate the risks of browser-based extensions attacks. Unlike traditional executable loggers, this tool operates at the **browser level** using a hybrid architecture of **Python, Node.js, and JavaScript**.

The core payload is disguised as a legitimate-looking Chrome Extension. Once sideloaded, it utilizes stealth techniques to remain persistent and transmit intercepted keystrokes to a node.js server.

-----

## ✨ Key Features

  * **🎭 Stealth Payload:** Injected as a legitimate Google Chrome extension to bypass standard OS-level file integrity checks.
  * **🌐 Hybrid Architecture:** \* **Frontend:** JavaScript-based interception engine.
      * **Backend:** Node.js server for real-time log ingestion.
      * **Automation:** Python orchestration scripts for rapid deployment.
  * **隐 Obfuscation:** Designed to blend in with browser background processes.
  * **📊 Structured Logging:** Raw data is processed and stored in a readable format for post-engagement analysis.

-----

## 👨‍💻 Developer

  * **Creator:** [Muhammad Alwaz]
  

-----

## 🚀 Setup & Installation

Follow these steps to deploy the environment in a controlled lab setting:

### 1\. Clone the Environment

```bash
git clone https://github.com/AltaXploit/Alta-Keylogger.git
cd Alta-Keylogger
```

### 2\. Dependency Configuration

Run the setup script to install the necessary Node.js modules and Python requirements.

```bash
python3 setup.py
```

### 3\. Initialize the Framework

Start the C2 server and listener.

```bash
python3 Start.py
```
Upon startup, the terminal will generate a **LAN Access URL** (e.g., `http://192.168.0.196:3000`).

### 3. Access the Control Panel
* Open your web browser.
* Navigate to the **LAN Access** link displayed in your terminal.
* This is your **Control Panel** where you can monitor intercepted logs in real-time.

### 4. Deploy the Payload
The framework automatically generates a `payload.zip` file in the root directory. To deploy it:
1.  Locate `payload.zip` in the `Alta-Keylogger` folder and extract it.
2.  Open **Google Chrome** and navigate to `chrome://extensions/`.
3.  Enable **Developer Mode** (toggle in the top right corner).
4.  Click **Load unpacked** and select the extracted payload folder.
5.  The extension will now appear as a legitimate browser component and begin background logging.

---

## ⚠️ Ethical Disclosure & Warning

> **IMPORTANT:** This repository is for **Educational and Academic purposes only**.
> The unauthorized use of this tool against systems you do not have explicit, written permission to test is illegal and unethical. The developer assumes no liability for misuse.

-----

## 🛡️ Defeated By (Mitigation)

To defend against this type of attack, security administrators should:

1.  **Enforce Extension Whitelisting:** Use GPO/MDM to prevent sideloading of unpacked extensions.
2.  **Monitor Developer Mode:** Audit machines where "Developer Mode" is enabled in Chrome.
3.  **Network Filtering:** Block outbound traffic to unknown C2 IP addresses/ports.

-----

