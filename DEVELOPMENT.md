# VPNHub — Hướng Dẫn Phát Triển & Đóng Gói (DEVELOPMENT.md)

Tài liệu này cung cấp hướng dẫn toàn diện từ cấu hình môi trường, quy trình chạy phát triển cục bộ (Local Development), kiểm thử (Testing) cho đến quy trình đóng gói và phát hành (Release & Packaging) ứng dụng **VPNHub** trên 3 nền tảng chính: **Linux**, **Windows**, và **macOS**.

---

## 1. Kiến Trúc Dự Án (Architecture Overview)

VPNHub được xây dựng theo mô hình **Monorepo** phân tách đặc quyền bảo mật:

```text
vpnhub/
├── crates/                    # Thư viện thuần Rust cốt lõi (Pure-Rust OpenVPN 3 / Protocols)
│   ├── ovpn-config/           # Parser & Validator cấu hình .ovpn / WireGuard
│   ├── ovpn-core/             # Engine kết nối, state machine & pipeline xử lý packet
│   ├── ovpn-crypto/           # Mật mã hóa & quản lý khóa (zeroize, crypto primitives)
│   ├── ovpn-protocol/         # Định nghĩa các frame giao thức mạng
│   ├── ovpn-transport/        # Giao vận UDP/TCP socket
│   └── ovpn-tun/              # Virtual network interface driver (TUN / Wintun)
├── packages/
│   ├── app/                   # Ứng dụng Desktop UI (Tauri v2 + React 19 + TypeScript + Vite)
│   │   └── src-tauri/         # Tauri Desktop Core & IPC Client
│   └── daemon/                # Background Daemon đặc quyền cao (vpnhub-daemon)
├── .github/workflows/         # CI/CD pipelines đóng gói tự động
└── cliff.toml                 # Cấu hình tự động sinh CHANGELOG với git-cliff
```

### Mô hình IPC & Đặc quyền (Privilege Separation)

- **`vpnhub-daemon` (Root / Administrator / System Service):** Quản lý routing table, virtual network interface (TUN/Wintun), kill switch (nftables / iptables / WFP / pf), DNS leak protection và xử lý tunnel VPN. Lắng nghe các yêu cầu điều khiển thông qua kênh IPC bảo mật:
  - **Linux / macOS:** Unix Domain Socket (Mặc định: `/run/vpnhub/vpnhub.sock`).
  - **Windows:** Windows Named Pipe (Mặc định: `\\.\pipe\vpnhub-daemon`).
- **`vpnhub` (Desktop App - User Mode):** Ứng dụng giao diện người dùng không cần quyền root/admin, giao tiếp với daemon qua giao thức JSON Length-Delimited Framed IPC.

---

## 2. Yêu Cầu Môi Trường (Prerequisites)

### 2.1. Yêu cầu chung cho mọi nền tảng

1. **Rust Toolchain:** Phiên bản `stable` (>= 1.80)

   ```bash
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   rustup default stable
   ```

2. **Node.js & Package Manager:**
   - Node.js >= 20 (Khuyên dùng Node.js 22 hoặc 24 LTS)
   - `pnpm` >= 9 (`corepack enable` hoặc `npm install -g pnpm`)

### 2.2. Cài đặt phụ thuộc theo hệ điều hành

#### Linux (Ubuntu / Debian / Fedora)

Trên Ubuntu/Debian:

```bash
sudo apt-get update
sudo apt-get install -y \
  build-essential \
  curl \
  wget \
  file \
  libssl-dev \
  libwebkit2gtk-4.1-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev \
  libxdo-dev \
  rpm
```

Trên Fedora / RHEL:

```bash
sudo dnf check-update
sudo dnf groupinstall -y "C Development Tools and Libraries"
sudo dnf install -y \
  openssl-devel \
  webkit2gtk4.1-devel \
  libayatana-appindicator-devel \
  librsvg2-devel \
  libxdo-devel \
  rpm-build
```

#### Windows

1. Cài đặt **Visual Studio C++ Build Tools** (hoặc Visual Studio Community có tích hợp workload _"Desktop development with C++"_).
2. **WebView2 Runtime** (Đã có sẵn trên Windows 10/11).
3. (Tùy chọn cho đóng gói) **NSIS** để tạo bộ cài đặt `.exe`.

#### macOS

1. Cài đặt **Xcode Command Line Tools**:

   ```bash
   xcode-select --install
   ```

---

## 3. Quy Trình Chạy Phát Triển Cục Bộ (Local Development)

### Bước 1: Khởi tạo và cài đặt Dependencies

Tại thư mục gốc của repository:

```bash
pnpm install
```

---

### Bước 2: Chạy Background Daemon (`vpnhub-daemon`)

Do daemon quản lý card mạng ảo và tường lửa hệ thống, **daemon bắt buộc phải được chạy với quyền quản trị viên**.

#### Trên Linux

Mở một terminal riêng:

```bash
# Chạy với quyền root
sudo cargo run --bin vpnhub-daemon

# Hoặc bật chế độ log debug chi tiết
sudo cargo run --bin vpnhub-daemon -- --log-level debug
```

#### Trên Windows

Mở **PowerShell (Run as Administrator)**:

```powershell
# Chạy daemon ở chế độ debug
cargo run --bin vpnhub-daemon -- --log-level debug
```

> Daemon sẽ tạo Named Pipe tại `\\.\pipe\vpnhub-daemon`.

#### Trên macOS

Mở terminal:

```bash
sudo cargo run --bin vpnhub-daemon -- --log-level debug
```

---

### Bước 3: Chạy Ứng Dụng Desktop UI (Tauri Dev Mode)

Mở một terminal khác (ở quyền user bình thường):

```bash
# Khởi động ứng dụng Tauri dev
pnpm tauri dev
```

Hoặc:

```bash
pnpm dev
```

Lệnh này sẽ tự động khởi động máy chủ Vite (React UI) tại `http://localhost:1420` và cửa sổ ứng dụng Tauri. Ứng dụng sẽ tự động kết nối đến `vpnhub-daemon` đang chạy.

---

## 4. Kiểm Thử & Định Dạng Code (Testing & Quality Assurance)

Trước khi commit code, đảm bảo tất cả bài test và quy chuẩn định dạng đều vượt qua:

```bash
# 1. Chạy toàn bộ Unit & Integration Test trong Workspace
cargo test --all

# 2. Kiểm tra type TypeScript cho Frontend
pnpm typecheck

# 3. Kiểm tra và định dạng Code (Prettier + Rustfmt)
pnpm format:check       # Kiểm tra
pnpm format             # Tự động sửa format

# 4. Kiểm tra linter Rust
cargo clippy --all -- -D warnings
```

---

## 5. Hướng Dẫn Đóng Gói Phát Hành (Build & Release Packaging)

### 5.1. Đóng gói trên Linux (`.deb`, `.rpm`)

Linux bundle sẽ đóng gói cả binary Desktop UI, binary `vpnhub-daemon`, và file cấu hình systemd `vpnhub-daemon.service` đi kèm các script cài đặt tự động (`postinstall.sh`, `preremove.sh`, `postremove.sh`).

1. **Build bản Release của Daemon:**

   ```bash
   cargo build --release --bin vpnhub-daemon
   ```

2. **Đóng gói ứng dụng Tauri:**

   ```bash
   pnpm tauri build --bundles deb,rpm
   ```

3. **Vị trí file đầu ra:**
   - Debian: `target/release/bundle/deb/VPNHub_<version>_amd64.deb`
   - RPM: `target/release/bundle/rpm/VPNHub-<version>-1.x86_64.rpm`

4. **Cài đặt và kiểm tra thử:**

   ```bash
   # Cài đặt file .deb
   sudo dpkg -i target/release/bundle/deb/VPNHub_*_amd64.deb

   # Kiểm tra trạng thái daemon service
   sudo systemctl status vpnhub-daemon.service
   ```

---

### 5.2. Đóng gói trên Windows (`.exe` NSIS Installer)

Bản cài đặt Windows NSIS được cấu hình tự động đăng ký `vpnhub-daemon.exe` thành **Windows Service** thông qua script hook `hooks.nsh` khi người dùng cài đặt ứng dụng.

1. **Build bản Release của Daemon:**

   ```powershell
   cargo build --release --bin vpnhub-daemon
   ```

2. **Đóng gói bộ cài đặt NSIS:**

   ```powershell
   pnpm tauri build --bundles nsis
   ```

3. **Vị trí file đầu ra:**
   - `target/release/bundle/nsis/VPNHub_<version>_x64-setup.exe`

4. **Kiểm tra Windows Service thủ công (nếu cần):**

   ```powershell
   # Quản lý Windows Service bằng sc.exe (Run as Administrator)
   sc.exe query "VPNHubDaemon"
   sc.exe start "VPNHubDaemon"
   sc.exe stop "VPNHubDaemon"
   ```

---

### 5.3. Đóng gói trên macOS (`.app` & `.pkg`)

Trên macOS, ứng dụng được đóng gói thành `.app` và bộ cài đặt hệ thống `.pkg` để tự động thiết lập **LaunchDaemon** (`/Library/LaunchDaemons/com.hephaestus-studio.vpnhub.daemon.plist`).

1. **Build bản Release của Daemon & App:**

   ```bash
   cargo build --release --bin vpnhub-daemon
   pnpm tauri build --bundles app
   ```

2. **Tạo gói cài đặt `.pkg`:**

   ```bash
   chmod +x packages/app/src-tauri/scripts/macos/build-pkg.sh
   ./packages/app/src-tauri/scripts/macos/build-pkg.sh
   ```

3. **Vị trí file đầu ra:**
   - `.app`: `target/release/bundle/macos/VPNHub.app`
   - `.pkg`: `target/release/bundle/macos/VPNHub_<version>_universal.pkg`

4. **Kiểm tra LaunchDaemon:**

   ```bash
   sudo launchctl list | grep vpnhub
   ```

---

## 6. Biến Môi Trường Cấu Hình (Environment Variables)

| Biến môi trường       | Tham số CLI tương ứng | Mặc định                                                            | Ý nghĩa                                                   |
| :-------------------- | :-------------------- | :------------------------------------------------------------------ | :-------------------------------------------------------- |
| `VPNHUB_SOCKET_PATH`  | `--socket-path`       | `/run/vpnhub/vpnhub.sock` (Linux)<br>`\\.\pipe\vpnhub-daemon` (Win) | Đường dẫn Socket / Named Pipe IPC                         |
| `VPNHUB_LOG_LEVEL`    | `--log-level`         | `info`                                                              | Mức độ log (`trace`, `debug`, `info`, `warn`, `error`)    |
| `VPNHUB_SERVICE_MODE` | `--service-mode`      | `false`                                                             | Bật chế độ chạy ngầm Windows SCM Service / Systemd Notify |
| `VPNHUB_JSON_LOGS`    | `--json-logs`         | `false`                                                             | Xuất log có cấu trúc dạng JSON                            |
| `VPNHUB_AUTH_GROUP`   | `--auth-group`        | `vpnhub`                                                            | Linux group được phép gọi IPC (Anti-LPE)                  |

---

## 7. Xử Lý Sự Cố Thường Gặp (Troubleshooting)

### Lỗi 1: `DaemonOffline` hoặc `Failed to connect to socket/pipe`

- **Nguyên nhân:** `vpnhub-daemon` chưa được chạy hoặc bị lỗi crash khi khởi động.
- **Cách khắc phục:**
  - Kiểm tra xem daemon đã được bật với quyền **Administrator** (Windows) hoặc **sudo** (Linux/macOS) hay chưa.
  - Trên Linux: Kiểm tra thư mục `/run/vpnhub` có quyền ghi: `sudo ls -la /run/vpnhub/`.
  - Kiểm tra log của daemon bằng cách chạy kèm cờ `--log-level trace`.

### Lỗi 2: Lỗi thiếu WebKit2GTK trên Linux

- **Nguyên nhân:** Thiếu thư viện giao diện đồ họa WebKit trên Ubuntu/Debian.
- **Cách khắc phục:** Chạy `sudo apt-get install libwebkit2gtk-4.1-dev`.

### Lỗi 3: Quyền tạo card mạng ảo (TUN / Wintun)

- **Nguyên nhân:** Hệ thống từ chối quyền cấp phát virtual adapter do không có quyền root/admin.
- **Cách khắc phục:** Luôn chạy `vpnhub-daemon` dưới quyền `sudo` hoặc `Run as Administrator`.
