import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import {
  DaemonHealthStatus,
  VpnProfile,
  SecuritySettings,
  AppRule,
  IpDomainRule,
} from "../types/vpn";

export interface VpnConnectParams {
  profile_id: string;
  protocol: "wireguard" | "openvpn_udp" | "openvpn_tcp";
  server_endpoint: string;
  server_port: number;
  auth_config:
    | { auth_type: "wireguard_key"; private_key: string; preshared_key?: string }
    | {
        auth_type: "user_password";
        username: string;
        password: string;
        ca_cert?: string;
        client_cert?: string;
        client_key?: string;
        tls_auth_key?: string;
        tls_crypt_key?: string;
        key_direction?: string;
        remote_cert_tls_server?: boolean;
        reneg_sec?: number;
        ovpn_config?: string;
      }
    | {
        auth_type: "raw_ovpn_config";
        config_content: string;
        username?: string;
        password?: string;
      };
  enable_kill_switch: boolean;
  custom_dns?: string[];
}

export interface SplitTunnelConfigPayload {
  mode: "include_only" | "exclude";
  ip_subnets: string[];
  app_paths: string[];
}

export type ProfileSecretPayload =
  | { type: "wireguard"; private_key: string; preshared_key?: string }
  | {
      type: "user_password";
      username: string;
      password: string;
      totp_secret?: string;
      totp_format?: string;
      ca_cert?: string;
      client_cert?: string;
      client_key?: string;
      tls_auth_key?: string;
      tls_crypt_key?: string;
      key_direction?: string;
      remote_cert_tls_server?: boolean;
      reneg_sec?: number;
      ovpn_config?: string;
    }
  | {
      type: "raw_ovpn_config";
      config_content: string;
      username?: string;
      password?: string;
      totp_secret?: string;
      totp_format?: string;
    };

export interface FullStorageSnapshotPayload {
  profiles: Array<{
    id: string;
    name: string;
    server_country: string;
    server_flag: string;
    server_host: string;
    server_port: number;
    protocol: string;
    virtual_ip: string;
    tags: string[];
    is_favorite: boolean;
    ping_ms: number;
    last_connected?: string;
    credentials?: {
      username?: string;
      password_mode?: string;
      totp_format?: string;
      has_password: boolean;
      has_private_key: boolean;
      has_client_cert: boolean;
      has_ca_cert?: boolean;
      has_tls_auth?: boolean;
      has_tls_crypt?: boolean;
      has_raw_ovpn: boolean;
    };
  }>;
  secrets?: Record<string, ProfileSecretPayload>;
  security_settings: {
    kill_switch: "off" | "standard" | "strict";
    dns_protection: boolean;
    custom_dns_provider: "cloudflare" | "google" | "quad9" | "custom";
    ipv6_leak_protection: boolean;
    webrtc_leak_protection: boolean;
    lan_traffic_bypass: boolean;
  };
  app_rules: Array<{
    id: string;
    name: string;
    icon?: string;
    path: string;
    mode: "route_vpn" | "bypass";
    enabled: boolean;
  }>;
  ip_rules: Array<{
    id: string;
    target: string;
    type: "cidr" | "domain";
    description: string;
    mode: "route_vpn" | "bypass";
    enabled: boolean;
  }>;
}

export class IpcBridge {
  static isTauriEnvironment(): boolean {
    return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
  }

  // Persistent Storage & Vault API
  static async loadAllStorage(): Promise<FullStorageSnapshotPayload | null> {
    if (this.isTauriEnvironment()) {
      try {
        return await invoke<FullStorageSnapshotPayload>("storage_load_all");
      } catch (err) {
        console.warn("storage_load_all failed:", err);
      }
    }
    return null;
  }

  static async saveProfile(profile: VpnProfile, secret?: ProfileSecretPayload): Promise<unknown> {
    if (this.isTauriEnvironment()) {
      const storedPayload = {
        id: profile.id,
        name: profile.name,
        server_country: profile.serverCountry,
        server_flag: profile.serverFlag,
        server_host: profile.serverHost,
        server_port: profile.serverPort,
        protocol: profile.protocol,
        virtual_ip: profile.virtualIp,
        tags: profile.tags,
        is_favorite: profile.isFavorite,
        ping_ms: profile.pingMs,
        last_connected: profile.lastConnected,
        credentials: profile.credentials
          ? {
              username: profile.credentials.username,
              password_mode: profile.credentials.passwordMode || "static",
              totp_format: profile.credentials.totpFormat || "append",
              has_password: Boolean(
                profile.credentials.hasPassword ||
                profile.credentials.password ||
                (secret && "password" in secret && secret.password)
              ),
              has_private_key: Boolean(
                profile.credentials.hasPrivateKey ||
                profile.credentials.privateKey ||
                (secret && "private_key" in secret && secret.private_key)
              ),
              has_client_cert: Boolean(profile.credentials.hasCert),
              has_raw_ovpn: Boolean(
                profile.rawConfig ||
                (secret && "config_content" in secret && secret.config_content) ||
                (secret && "ovpn_config" in secret && secret.ovpn_config)
              ),
            }
          : undefined,
      };

      return await invoke("storage_save_profile", {
        profile: storedPayload,
        secret: secret || null,
      });
    }
    return null;
  }

  static async deleteProfile(profileId: string): Promise<void> {
    if (this.isTauriEnvironment()) {
      try {
        await invoke("storage_delete_profile", { profileId });
      } catch (err) {
        console.warn("storage_delete_profile failed:", err);
      }
    }
  }

  static async saveSecuritySettings(settings: SecuritySettings): Promise<void> {
    if (this.isTauriEnvironment()) {
      const payload = {
        kill_switch: settings.killSwitch,
        dns_protection: settings.dnsProtection,
        custom_dns_provider: settings.customDnsProvider,
        ipv6_leak_protection: settings.ipv6LeakProtection,
        webrtc_leak_protection: settings.webRtcProtection,
        lan_traffic_bypass: settings.lanBypass,
      };
      try {
        await invoke("storage_save_security_settings", { settings: payload });
      } catch (err) {
        console.warn("storage_save_security_settings failed:", err);
      }
    }
  }

  static async saveSplitRules(appRules: AppRule[], ipRules: IpDomainRule[]): Promise<void> {
    if (this.isTauriEnvironment()) {
      const appPayload = appRules.map((r) => ({
        id: r.id,
        name: r.name,
        icon: r.icon,
        path: r.path,
        mode: r.mode,
        enabled: r.enabled,
      }));
      const ipPayload = ipRules.map((r) => ({
        id: r.id,
        target: r.target,
        type: r.type,
        description: r.description,
        mode: r.mode,
        enabled: r.enabled,
      }));
      try {
        await invoke("storage_save_split_rules", {
          appRules: appPayload,
          ipRules: ipPayload,
        });
      } catch (err) {
        console.warn("storage_save_split_rules failed:", err);
      }
    }
  }

  // VPN Controls
  static async connectVpn(params: VpnConnectParams): Promise<unknown> {
    if (this.isTauriEnvironment()) {
      return await invoke("vpn_connect", { params });
    }
    return { status: "success" };
  }

  static async disconnectVpn(force = false): Promise<unknown> {
    if (this.isTauriEnvironment()) {
      return await invoke("vpn_disconnect", { force });
    }
    return { status: "success" };
  }

  static async getDaemonStatus(): Promise<unknown> {
    if (this.isTauriEnvironment()) {
      return await invoke("get_daemon_status");
    }
    return { status: "status", result: { state: "disconnected", kill_switch_active: true } };
  }

  static async getMetrics(): Promise<unknown> {
    if (this.isTauriEnvironment()) {
      return await invoke("get_metrics");
    }
    return null;
  }

  static async setKillSwitch(enabled: boolean): Promise<unknown> {
    if (this.isTauriEnvironment()) {
      return await invoke("set_kill_switch", { enabled });
    }
    return { status: "success" };
  }

  static async setSplitTunneling(config: SplitTunnelConfigPayload): Promise<unknown> {
    if (this.isTauriEnvironment()) {
      return await invoke("set_split_tunneling", { config });
    }
    return { status: "success" };
  }

  static async getDiagnostics(): Promise<unknown> {
    if (this.isTauriEnvironment()) {
      return await invoke("get_diagnostics");
    }
    return null;
  }

  static async pingDaemon(): Promise<boolean> {
    if (this.isTauriEnvironment()) {
      try {
        return await invoke<boolean>("ping_daemon");
      } catch {
        return false;
      }
    }
    return true;
  }

  // Window Controls
  static async startDragging(): Promise<void> {
    if (this.isTauriEnvironment()) {
      try {
        await invoke("window_start_dragging");
      } catch (err) {
        console.warn("start_dragging invoke failed:", err);
      }
    }
  }

  static async startResizeDragging(direction: string): Promise<void> {
    if (this.isTauriEnvironment()) {
      try {
        await invoke("window_start_resize_dragging", { direction });
      } catch (err) {
        console.warn("start_resize_dragging invoke failed:", err);
      }
    }
  }

  static async windowMinimize(): Promise<void> {
    if (this.isTauriEnvironment()) {
      await invoke("window_minimize");
    }
  }

  static async windowMaximize(): Promise<void> {
    if (this.isTauriEnvironment()) {
      await invoke("window_toggle_maximize");
    }
  }

  static async windowClose(): Promise<void> {
    if (this.isTauriEnvironment()) {
      await invoke("window_close");
    }
  }

  static async windowGetGeometry(): Promise<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null> {
    if (this.isTauriEnvironment()) {
      try {
        return await invoke<{ x: number; y: number; width: number; height: number }>(
          "window_get_geometry"
        );
      } catch (err) {
        console.warn("window_get_geometry failed:", err);
      }
    }
    return null;
  }

  static async windowSetSize(width: number, height: number): Promise<void> {
    if (this.isTauriEnvironment()) {
      try {
        await invoke("window_set_size", { width, height });
      } catch (err) {
        console.warn("window_set_size failed:", err);
      }
    }
  }

  static async windowSetPosition(x: number, y: number): Promise<void> {
    if (this.isTauriEnvironment()) {
      try {
        await invoke("window_set_position", { x, y });
      } catch (err) {
        console.warn("window_set_position failed:", err);
      }
    }
  }

  static async updateTrayStatus(state: string): Promise<void> {
    if (this.isTauriEnvironment()) {
      try {
        await invoke("tray_set_status", { state });
      } catch (err) {
        console.warn("tray_set_status failed:", err);
      }
    }
  }

  // Event Subscriptions
  static async onDaemonStatusChange(
    callback: (status: DaemonHealthStatus) => void
  ): Promise<UnlistenFn> {
    if (this.isTauriEnvironment()) {
      return await listen<string>("daemon-status", (event) => {
        callback(event.payload as DaemonHealthStatus);
      });
    }
    return () => {};
  }

  static async onVpnStatusUpdate(callback: (data: unknown) => void): Promise<UnlistenFn> {
    if (this.isTauriEnvironment()) {
      return await listen("vpn-status-update", (event) => {
        callback(event.payload);
      });
    }
    return () => {};
  }

  static async onMetricsUpdate(callback: (data: unknown) => void): Promise<UnlistenFn> {
    if (this.isTauriEnvironment()) {
      return await listen("vpn-metrics-update", (event) => {
        callback(event.payload);
      });
    }
    return () => {};
  }

  static async pingHost(host: string, port: number): Promise<number | null> {
    if (this.isTauriEnvironment()) {
      try {
        return await invoke<number>("ping_server", { host, port });
      } catch {
        return null;
      }
    }
    return null;
  }
}
