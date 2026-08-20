import { create } from "zustand";
import {
  ConnectionState,
  DaemonHealthStatus,
  VpnProfile,
  LiveTelemetry,
  LogEntry,
  SecuritySettings,
  AppRule,
  IpDomainRule,
  DiagnosticItem,
  KillSwitchMode,
} from "../types/vpn";
import { IpcBridge, ProfileSecretPayload } from "../services/ipcBridge";
import { TotpGenerator } from "../utils/totp";

export type NavigationTab =
  "dashboard" | "profiles" | "security" | "split-tunneling" | "logs" | "settings" | "diagnostics";

interface VpnStoreState {
  connectionState: ConnectionState;
  daemonHealth: DaemonHealthStatus;
  daemonVersion: string;
  daemonLatencyMs: number;
  activeProfileId: string;
  activeTab: NavigationTab;
  profiles: VpnProfile[];
  telemetry: LiveTelemetry;
  connectedAt: number | null;
  uptimeSeconds: number;
  logs: LogEntry[];
  securitySettings: SecuritySettings;
  appRules: AppRule[];
  ipRules: IpDomainRule[];
  diagnostics: DiagnosticItem[];
  isSpotlightOpen: boolean;
  isCompactWidget: boolean;
  isLogAutoScroll: boolean;
  logFilterLevel: string;
  logSearchQuery: string;
  isStorageLoaded: boolean;
  mfaPromptProfile: VpnProfile | null;

  // Actions
  loadStorage: (force?: boolean) => Promise<void>;
  setActiveTab: (tab: NavigationTab) => void;
  setSpotlightOpen: (open: boolean) => void;
  setCompactWidget: (compact: boolean) => void;
  setLogAutoScroll: (autoScroll: boolean) => void;
  setLogFilterLevel: (level: string) => void;
  setLogSearchQuery: (query: string) => void;
  setDaemonHealth: (health: DaemonHealthStatus) => void;
  setMfaPromptProfile: (profile: VpnProfile | null) => void;

  connect: (profileId?: string, overridePassword?: string) => Promise<void>;
  disconnect: () => Promise<void>;
  selectProfile: (profileId: string) => void;
  toggleFavorite: (profileId: string) => void;
  addProfile: (profile: VpnProfile, secret?: ProfileSecretPayload) => void;
  updateProfile: (profile: VpnProfile, secret?: ProfileSecretPayload) => void;
  deleteProfile: (profileId: string) => void;

  setKillSwitch: (mode: KillSwitchMode) => void;
  updateSecuritySettings: (settings: Partial<SecuritySettings>) => void;

  addAppRule: (rule: AppRule) => void;
  toggleAppRule: (id: string) => void;
  deleteAppRule: (id: string) => void;

  addIpRule: (rule: IpDomainRule) => void;
  toggleIpRule: (id: string) => void;
  deleteIpRule: (id: string) => void;

  clearLogs: () => void;
  addLog: (level: LogEntry["level"], source: string, message: string) => void;
  tickTelemetry: () => void;
  pingAllProfiles: () => Promise<void>;
}

let telemetryInterval: ReturnType<typeof setInterval> | null = null;
let ipcSubscribed = false;
let isStorageLoading = false;

const setupIpcSubscriptions = async (
  get: () => VpnStoreState,
  set: (
    partial:
      | VpnStoreState
      | Partial<VpnStoreState>
      | ((state: VpnStoreState) => VpnStoreState | Partial<VpnStoreState>)
  ) => void
) => {
  if (ipcSubscribed) return;
  ipcSubscribed = true;

  await IpcBridge.onDaemonStatusChange((status) => {
    get().setDaemonHealth(status);
  });

  await IpcBridge.onVpnStatusUpdate((payload: any) => {
    if (!payload || typeof payload !== "object") return;
    if (payload.status === "status" && payload.result) {
      const snap = payload.result;
      const daemonState = snap.state as ConnectionState;
      const current = get();
      const prevState = current.connectionState;

      if (daemonState !== prevState) {
        if (daemonState === "connected") {
          current.addLog(
            "INFO",
            "TUNNEL_ENGINE",
            `Tunnel established. Interface: ${snap.virtual_interface || "tun0"}, Assigned IP: ${snap.assigned_ip || "DHCP"}`
          );
        } else if (daemonState === "error") {
          current.addLog(
            "ERROR",
            "TUNNEL_ENGINE",
            "VPN tunnel encountered a fatal error / authentication failure."
          );
        } else if (daemonState === "disconnected") {
          if (
            prevState === "connected" ||
            prevState === "connecting" ||
            prevState === "disconnecting"
          ) {
            current.addLog("INFO", "TUNNEL_ENGINE", "VPN tunnel disconnected.");
          }
        }

        const now = Date.now();
        const sessionSecs = snap.session_duration_secs || 0;
        const connectedAt = daemonState === "connected" ? now - sessionSecs * 1000 : null;

        set({
          connectionState: daemonState,
          connectedAt,
          uptimeSeconds: sessionSecs,
        });

        IpcBridge.updateTrayStatus(daemonState);
      }
    }
  });

  await IpcBridge.onMetricsUpdate((payload: any) => {
    if (!payload || typeof payload !== "object") return;
    if (payload.status === "metrics" && payload.result) {
      const m = payload.result;
      // 1 Byte = 8 bits -> 1 KB/s = 8192 bps
      const rxKbps = Math.round(((m.rx_rate_bps || 0) / 8192) * 10) / 10;
      const txKbps = Math.round(((m.tx_rate_bps || 0) / 8192) * 10) / 10;
      const ping = m.latency_rtt_ms || get().telemetry.currentPingMs || 24;

      set((state) => {
        const newSparkline = [
          ...state.telemetry.sparkline.slice(-29),
          {
            timestamp: Date.now(),
            downloadSpeed: rxKbps,
            uploadSpeed: txKbps,
            ping: ping,
          },
        ];

        const updatedProfiles = state.activeProfileId
          ? state.profiles.map((p) => (p.id === state.activeProfileId ? { ...p, pingMs: ping } : p))
          : state.profiles;

        return {
          profiles: updatedProfiles,
          telemetry: {
            ...state.telemetry,
            currentDownloadKbps: rxKbps,
            currentUploadKbps: txKbps,
            totalDownloadedBytes: m.rx_bytes ?? state.telemetry.totalDownloadedBytes,
            totalUploadedBytes: m.tx_bytes ?? state.telemetry.totalUploadedBytes,
            currentPingMs: ping,
            sparkline: newSparkline,
          },
        };
      });
    }
  });
};

const INITIAL_DIAGNOSTICS_DATA: DiagnosticItem[] = [
  {
    name: "WireGuard Module (wireguard.ko)",
    status: "ok",
    details: "Linux kernel module loaded, crypto chacha20poly1305 active",
    value: "5.15.0-generic",
  },
  {
    name: "nftables Kill Switch Chain",
    status: "ok",
    details: "Table inet vpnhub active, hook prerouting & output with priority raw",
    value: "Active",
  },
  {
    name: "systemd-resolved DNS Over TLS",
    status: "ok",
    details: "Strict stub resolver 127.0.0.53:53 forwarding to encrypted 1.1.1.1",
    value: "DoT Active",
  },
  {
    name: "Policy Routing Rule (FwMark 0x51820)",
    status: "ok",
    details: "Routing table 51820 default dev wg0 metric 50 active",
    value: "0x51820 Match",
  },
  {
    name: "IPv6 Interface Blackhole",
    status: "ok",
    details: "sysctl net.ipv6.conf.all.disable_ipv6=1 confirmed",
    value: "Disabled (Protected)",
  },
];

export const useVpnStore = create<VpnStoreState>((set, get) => ({
  connectionState: "disconnected",
  daemonHealth: "offline",
  daemonVersion: "0.1.0",
  daemonLatencyMs: 0.42,
  activeProfileId: "",
  activeTab: "dashboard",
  profiles: [],
  connectedAt: null,
  uptimeSeconds: 0,
  logs: [],
  isSpotlightOpen: false,
  isCompactWidget: false,
  isLogAutoScroll: true,
  logFilterLevel: "ALL",
  logSearchQuery: "",
  isStorageLoaded: false,
  mfaPromptProfile: null,

  telemetry: {
    currentDownloadKbps: 0,
    currentUploadKbps: 0,
    totalDownloadedBytes: 0,
    totalUploadedBytes: 0,
    currentPingMs: 0,
    jitterMs: 0,
    packetLossPercent: 0,
    sparkline: Array.from({ length: 30 }, (_, i) => ({
      timestamp: Date.now() - (30 - i) * 1000,
      downloadSpeed: 0,
      uploadSpeed: 0,
      ping: 0,
    })),
  },

  securitySettings: {
    killSwitch: "strict",
    dnsProtection: true,
    customDnsProvider: "cloudflare",
    ipv6LeakProtection: true,
    webRtcProtection: true,
    lanBypass: true,
  },

  appRules: [],
  ipRules: [],
  diagnostics: INITIAL_DIAGNOSTICS_DATA,

  loadStorage: async (force = false) => {
    if (!force && (get().isStorageLoaded || isStorageLoading)) return;
    isStorageLoading = true;

    try {
      const snapshot = await IpcBridge.loadAllStorage();
      if (!snapshot) return;

      const mappedProfiles: VpnProfile[] = snapshot.profiles.map((p) => {
        const secret = snapshot.secrets ? snapshot.secrets[p.id] : undefined;

        let username = p.credentials?.username;
        let password: string | undefined = undefined;
        let passwordMode: "static" | "dynamic_prompt" | "totp_auto" =
          (p.credentials?.password_mode as "static" | "dynamic_prompt" | "totp_auto") || "static";
        let totpSecret: string | undefined = undefined;
        let totpFormat: "append" | "prefix" | "totp_only" =
          (p.credentials?.totp_format as "append" | "prefix" | "totp_only") || "append";
        let privateKey: string | undefined = undefined;
        let presharedKey: string | undefined = undefined;
        let rawConfig: string | undefined = undefined;

        let caCert: string | undefined = undefined;
        let clientCert: string | undefined = undefined;
        let clientKey: string | undefined = undefined;
        let tlsAuthKey: string | undefined = undefined;
        let tlsCryptKey: string | undefined = undefined;
        let keyDirection: string | undefined = undefined;
        let remoteCertTlsServer: boolean | undefined = undefined;
        let renegSec: number | undefined = undefined;

        if (secret) {
          if (secret.type === "wireguard") {
            privateKey = secret.private_key;
            presharedKey = secret.preshared_key;
          } else if (secret.type === "user_password") {
            username = secret.username || username;
            password = secret.password;
            totpSecret = secret.totp_secret;
            totpFormat = (secret.totp_format as "append" | "prefix" | "totp_only") || totpFormat;
            caCert = secret.ca_cert;
            clientCert = secret.client_cert;
            clientKey = secret.client_key;
            tlsAuthKey = secret.tls_auth_key;
            tlsCryptKey = secret.tls_crypt_key;
            keyDirection = secret.key_direction;
            remoteCertTlsServer = secret.remote_cert_tls_server;
            renegSec = secret.reneg_sec;
            rawConfig = secret.ovpn_config;
            if (totpSecret) {
              passwordMode =
                (p.credentials?.password_mode as "static" | "dynamic_prompt" | "totp_auto") ||
                "totp_auto";
            }
          } else if (secret.type === "raw_ovpn_config") {
            rawConfig = secret.config_content;
            username = secret.username || username;
            password = secret.password;
            totpSecret = secret.totp_secret;
            totpFormat = (secret.totp_format as "append" | "prefix" | "totp_only") || totpFormat;
            if (totpSecret) {
              passwordMode =
                (p.credentials?.password_mode as "static" | "dynamic_prompt" | "totp_auto") ||
                "totp_auto";
            }
          }
        }

        return {
          id: p.id,
          name: p.name,
          serverCountry: p.server_country,
          serverCity: "",
          serverFlag: p.server_flag,
          serverHost: p.server_host,
          serverPort: p.server_port,
          protocol: p.protocol as VpnProfile["protocol"],
          virtualIp: p.virtual_ip,
          tags: p.tags,
          isFavorite: p.is_favorite,
          pingMs: p.ping_ms,
          lastConnected: p.last_connected,
          useOnlyForNetworkResources: p.intranet_only ?? false,
          customSubnets: p.custom_subnets ?? [],
          credentials: {
            username,
            password,
            passwordMode,
            totpSecret,
            totpFormat,
            privateKey,
            presharedKey,
            caCert,
            clientCert,
            clientKey,
            tlsAuthKey,
            tlsCryptKey,
            keyDirection,
            remoteCertTlsServer,
            renegSec,
            hasPassword: Boolean(password || p.credentials?.has_password),
            hasPrivateKey: Boolean(privateKey || p.credentials?.has_private_key),
            hasCert: Boolean(clientCert || p.credentials?.has_client_cert),
            hasCaCert: Boolean(caCert || p.credentials?.has_ca_cert),
            hasTlsAuth: Boolean(tlsAuthKey || p.credentials?.has_tls_auth),
            hasTlsCrypt: Boolean(tlsCryptKey || p.credentials?.has_tls_crypt),
          },
          rawConfig,
        };
      });

      const mappedSettings: SecuritySettings = {
        killSwitch: snapshot.security_settings.kill_switch,
        dnsProtection: snapshot.security_settings.dns_protection,
        customDnsProvider:
          (snapshot.security_settings
            .custom_dns_provider as SecuritySettings["customDnsProvider"]) || "cloudflare",
        customDnsServers: snapshot.security_settings.custom_dns_servers || ["1.1.1.1", "1.0.0.1"],
        ipv6LeakProtection: snapshot.security_settings.ipv6_leak_protection,
        webRtcProtection: snapshot.security_settings.webrtc_leak_protection,
        lanBypass: snapshot.security_settings.lan_traffic_bypass,
        defaultUseOnlyForNetworkResources:
          snapshot.security_settings.default_intranet_only ?? false,
      };

      const mappedAppRules: AppRule[] = snapshot.app_rules.map((r) => ({
        id: r.id,
        name: r.name,
        icon: r.icon,
        path: r.path,
        mode: r.mode,
        enabled: r.enabled,
      }));

      const mappedIpRules: IpDomainRule[] = snapshot.ip_rules.map((r) => ({
        id: r.id,
        target: r.target,
        type: r.type,
        description: r.description,
        mode: r.mode,
        enabled: r.enabled,
      }));

      const activeId = mappedProfiles.find((p) => p.isFavorite)?.id || mappedProfiles[0]?.id || "";

      set({
        profiles: mappedProfiles,
        securitySettings: mappedSettings,
        appRules: mappedAppRules,
        ipRules: mappedIpRules,
        activeProfileId: activeId,
        isStorageLoaded: true,
      });

      get().addLog(
        "INFO",
        "PERSISTENCE",
        `Loaded ${mappedProfiles.length} profiles and encrypted vault keys from disk`
      );

      // Initialize real-time daemon IPC subscriptions
      await setupIpcSubscriptions(get, set);

      // Trigger initial background ping for all profiles
      get().pingAllProfiles();
    } finally {
      isStorageLoading = false;
    }
  },

  setActiveTab: (tab) => set({ activeTab: tab }),
  setSpotlightOpen: (open) => set({ isSpotlightOpen: open }),
  setCompactWidget: (compact) => set({ isCompactWidget: compact }),
  setLogAutoScroll: (autoScroll) => set({ isLogAutoScroll: autoScroll }),
  setLogFilterLevel: (level) => set({ logFilterLevel: level }),
  setLogSearchQuery: (query) => set({ logSearchQuery: query }),
  setDaemonHealth: (health) => set({ daemonHealth: health }),
  setMfaPromptProfile: (profile) => set({ mfaPromptProfile: profile }),

  selectProfile: (profileId) => {
    set({ activeProfileId: profileId });
    get().addLog("INFO", "GUI_MANAGER", `Selected active profile: ${profileId}`);
  },

  toggleFavorite: (profileId) => {
    const state = get();
    const updatedProfiles = state.profiles.map((p) =>
      p.id === profileId ? { ...p, isFavorite: !p.isFavorite } : p
    );
    set({ profiles: updatedProfiles });

    const target = updatedProfiles.find((p) => p.id === profileId);
    if (target) {
      IpcBridge.saveProfile(target);
    }
  },

  addProfile: (profile, secret) => {
    const fullProfile = { ...profile };
    if (secret) {
      if (secret.type === "wireguard") {
        fullProfile.credentials = {
          ...fullProfile.credentials,
          privateKey: secret.private_key,
          presharedKey: secret.preshared_key,
        };
      } else if (secret.type === "user_password") {
        fullProfile.credentials = {
          ...fullProfile.credentials,
          username: secret.username || fullProfile.credentials?.username,
          password: secret.password || fullProfile.credentials?.password,
          totpSecret: secret.totp_secret || fullProfile.credentials?.totpSecret,
          totpFormat:
            (secret.totp_format as "append" | "prefix" | "totp_only") ||
            fullProfile.credentials?.totpFormat ||
            "append",
          caCert: secret.ca_cert || fullProfile.credentials?.caCert,
          clientCert: secret.client_cert || fullProfile.credentials?.clientCert,
          clientKey: secret.client_key || fullProfile.credentials?.clientKey,
          tlsAuthKey: secret.tls_auth_key || fullProfile.credentials?.tlsAuthKey,
          tlsCryptKey: secret.tls_crypt_key || fullProfile.credentials?.tlsCryptKey,
          keyDirection: secret.key_direction || fullProfile.credentials?.keyDirection,
          remoteCertTlsServer:
            secret.remote_cert_tls_server !== undefined
              ? secret.remote_cert_tls_server
              : fullProfile.credentials?.remoteCertTlsServer,
          renegSec: secret.reneg_sec || fullProfile.credentials?.renegSec,
          hasCaCert: Boolean(secret.ca_cert || fullProfile.credentials?.caCert),
          hasTlsAuth: Boolean(secret.tls_auth_key || fullProfile.credentials?.tlsAuthKey),
          hasTlsCrypt: Boolean(secret.tls_crypt_key || fullProfile.credentials?.tlsCryptKey),
          hasCert: Boolean(secret.client_cert || fullProfile.credentials?.clientCert),
        };
      } else if (secret.type === "raw_ovpn_config") {
        fullProfile.credentials = {
          ...fullProfile.credentials,
          username: secret.username || fullProfile.credentials?.username,
          password: secret.password || fullProfile.credentials?.password,
          totpSecret: secret.totp_secret || fullProfile.credentials?.totpSecret,
          totpFormat:
            (secret.totp_format as "append" | "prefix" | "totp_only") ||
            fullProfile.credentials?.totpFormat ||
            "append",
        };
        fullProfile.rawConfig = secret.config_content || fullProfile.rawConfig;
      }
    }

    set((state) => ({
      profiles: [fullProfile, ...state.profiles],
      activeProfileId: fullProfile.id,
    }));
    IpcBridge.saveProfile(fullProfile, secret);
    get().addLog(
      "INFO",
      "PROFILE_MGR",
      `Saved and encrypted profile: ${fullProfile.name} (${fullProfile.protocol})`
    );
  },

  updateProfile: (profile, secret) => {
    const fullProfile = { ...profile };
    if (secret) {
      if (secret.type === "wireguard") {
        fullProfile.credentials = {
          ...fullProfile.credentials,
          privateKey: secret.private_key,
          presharedKey: secret.preshared_key,
        };
      } else if (secret.type === "user_password") {
        fullProfile.credentials = {
          ...fullProfile.credentials,
          username: secret.username || fullProfile.credentials?.username,
          password: secret.password || fullProfile.credentials?.password,
          totpSecret: secret.totp_secret || fullProfile.credentials?.totpSecret,
          totpFormat:
            (secret.totp_format as "append" | "prefix" | "totp_only") ||
            fullProfile.credentials?.totpFormat ||
            "append",
          caCert: secret.ca_cert || fullProfile.credentials?.caCert,
          clientCert: secret.client_cert || fullProfile.credentials?.clientCert,
          clientKey: secret.client_key || fullProfile.credentials?.clientKey,
          tlsAuthKey: secret.tls_auth_key || fullProfile.credentials?.tlsAuthKey,
          tlsCryptKey: secret.tls_crypt_key || fullProfile.credentials?.tlsCryptKey,
          keyDirection: secret.key_direction || fullProfile.credentials?.keyDirection,
          remoteCertTlsServer:
            secret.remote_cert_tls_server !== undefined
              ? secret.remote_cert_tls_server
              : fullProfile.credentials?.remoteCertTlsServer,
          renegSec: secret.reneg_sec || fullProfile.credentials?.renegSec,
          hasCaCert: Boolean(secret.ca_cert || fullProfile.credentials?.caCert),
          hasTlsAuth: Boolean(secret.tls_auth_key || fullProfile.credentials?.tlsAuthKey),
          hasTlsCrypt: Boolean(secret.tls_crypt_key || fullProfile.credentials?.tlsCryptKey),
          hasCert: Boolean(secret.client_cert || fullProfile.credentials?.clientCert),
        };
      } else if (secret.type === "raw_ovpn_config") {
        fullProfile.credentials = {
          ...fullProfile.credentials,
          username: secret.username || fullProfile.credentials?.username,
          password: secret.password || fullProfile.credentials?.password,
          totpSecret: secret.totp_secret || fullProfile.credentials?.totpSecret,
          totpFormat:
            (secret.totp_format as "append" | "prefix" | "totp_only") ||
            fullProfile.credentials?.totpFormat ||
            "append",
        };
        fullProfile.rawConfig = secret.config_content || fullProfile.rawConfig;
      }
    }

    set((state) => ({
      profiles: state.profiles.map((p) => (p.id === fullProfile.id ? fullProfile : p)),
    }));
    IpcBridge.saveProfile(fullProfile, secret);
    get().addLog("INFO", "PROFILE_MGR", `Updated profile: ${fullProfile.name}`);
  },

  deleteProfile: (profileId) => {
    set((state) => ({
      profiles: state.profiles.filter((p) => p.id !== profileId),
      activeProfileId:
        state.activeProfileId === profileId ? (state.profiles[0]?.id ?? "") : state.activeProfileId,
    }));
    IpcBridge.deleteProfile(profileId);
    get().addLog("WARN", "PROFILE_MGR", `Deleted profile and erased secrets: ${profileId}`);
  },

  setKillSwitch: (mode) => {
    const newSettings = { ...get().securitySettings, killSwitch: mode };
    set({ securitySettings: newSettings });
    IpcBridge.saveSecuritySettings(newSettings);
    IpcBridge.setKillSwitch(mode !== "off", mode);
    get().addLog("INFO", "SECURITY_SHIELD", `Kill switch policy persisted: ${mode.toUpperCase()}`);
  },

  updateSecuritySettings: (settings) => {
    const newSettings = { ...get().securitySettings, ...settings };
    set({ securitySettings: newSettings });
    IpcBridge.saveSecuritySettings(newSettings);
    get().addLog("INFO", "SECURITY_SHIELD", "Security settings persisted to disk");
  },

  addAppRule: (rule) => {
    const newRules = [rule, ...get().appRules];
    set({ appRules: newRules });
    IpcBridge.saveSplitRules(newRules, get().ipRules);
    get().addLog("INFO", "SPLIT_TUNNEL", `Added split tunneling app rule: ${rule.name}`);
  },

  toggleAppRule: (id) => {
    const newRules = get().appRules.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r));
    set({ appRules: newRules });
    IpcBridge.saveSplitRules(newRules, get().ipRules);
  },

  deleteAppRule: (id) => {
    const newRules = get().appRules.filter((r) => r.id !== id);
    set({ appRules: newRules });
    IpcBridge.saveSplitRules(newRules, get().ipRules);
  },

  addIpRule: (rule) => {
    const newRules = [rule, ...get().ipRules];
    set({ ipRules: newRules });
    IpcBridge.saveSplitRules(get().appRules, newRules);
    get().addLog("INFO", "SPLIT_TUNNEL", `Added route rule: ${rule.target}`);
  },

  toggleIpRule: (id) => {
    const newRules = get().ipRules.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r));
    set({ ipRules: newRules });
    IpcBridge.saveSplitRules(get().appRules, newRules);
  },

  deleteIpRule: (id) => {
    const newRules = get().ipRules.filter((r) => r.id !== id);
    set({ ipRules: newRules });
    IpcBridge.saveSplitRules(get().appRules, newRules);
  },

  clearLogs: () => set({ logs: [] }),

  addLog: (level, source, message) => {
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(
      2,
      "0"
    )}:${String(now.getSeconds()).padStart(2, "0")}.${String(now.getMilliseconds()).padStart(
      3,
      "0"
    )}`;

    const newEntry: LogEntry = {
      id: crypto.randomUUID(),
      timestamp: timeStr,
      level,
      source,
      message,
    };

    set((state) => ({
      logs: [...state.logs.slice(-499), newEntry],
    }));
  },

  connect: async (targetProfileId, overridePassword) => {
    const state = get();
    if (state.connectionState === "connecting" || state.connectionState === "connected") return;

    const profileToUse = targetProfileId || state.activeProfileId;
    const profile = state.profiles.find((p) => p.id === profileToUse) || state.profiles[0];

    if (!profile) return;

    // Check if profile requires interactive MFA prompt and no password provided yet
    if (profile.credentials?.passwordMode === "dynamic_prompt" && overridePassword === undefined) {
      set({ mfaPromptProfile: profile });
      return;
    }

    set({
      connectionState: "connecting",
      activeProfileId: profile.id,
    });

    state.addLog(
      "INFO",
      "TUNNEL_ENGINE",
      `Initiating tunnel handshake to ${profile.name} (${profile.serverHost}:${profile.serverPort})...`
    );

    // Handle Auto-TOTP combination if configured
    let finalAuthPassword = overridePassword || "";
    if (
      !finalAuthPassword &&
      profile.credentials?.passwordMode === "totp_auto" &&
      profile.credentials?.totpSecret
    ) {
      const liveOtp = await TotpGenerator.generateCode(profile.credentials.totpSecret);
      const basePass = profile.credentials.password || "";
      const format = profile.credentials.totpFormat || "append";

      if (format === "append") {
        finalAuthPassword = `${basePass}${liveOtp}`;
      } else if (format === "prefix") {
        finalAuthPassword = `${liveOtp}${basePass}`;
      } else {
        finalAuthPassword = liveOtp || basePass;
      }
      state.addLog("INFO", "CRYPTO_2FA", `Generated real-time TOTP OTP for OpenVPN 2FA handshake`);
    }

    const authConfig =
      profile.protocol === "wireguard"
        ? {
            auth_type: "wireguard_key" as const,
            private_key: profile.credentials?.privateKey || "",
            preshared_key: profile.credentials?.presharedKey,
          }
        : {
            auth_type: "user_password" as const,
            username: profile.credentials?.username || "",
            password: finalAuthPassword,
            ca_cert: profile.credentials?.caCert,
            client_cert: profile.credentials?.clientCert,
            client_key: profile.credentials?.clientKey,
            tls_auth_key: profile.credentials?.tlsAuthKey,
            tls_crypt_key: profile.credentials?.tlsCryptKey,
            key_direction: profile.credentials?.keyDirection,
            remote_cert_tls_server: profile.credentials?.remoteCertTlsServer,
            reneg_sec: profile.credentials?.renegSec,
            ovpn_config: profile.rawConfig,
          };

    const isIntranetOnly =
      profile.useOnlyForNetworkResources !== undefined
        ? profile.useOnlyForNetworkResources
        : (state.securitySettings.defaultUseOnlyForNetworkResources ?? false);

    const customDnsIps =
      state.securitySettings.customDnsProvider === "cloudflare"
        ? ["1.1.1.1", "1.0.0.1"]
        : state.securitySettings.customDnsProvider === "google"
          ? ["8.8.8.8", "8.8.4.4"]
          : state.securitySettings.customDnsProvider === "quad9"
            ? ["9.9.9.9", "149.112.112.112"]
            : state.securitySettings.customDnsServers || ["1.1.1.1"];

    try {
      const response = (await IpcBridge.connectVpn({
        profile_id: profile.id,
        protocol: profile.protocol === "ipsec" ? "openvpn_udp" : profile.protocol,
        server_endpoint: profile.serverHost,
        server_port: profile.serverPort,
        auth_config: authConfig,
        enable_kill_switch: state.securitySettings.killSwitch !== "off",
        custom_dns: state.securitySettings.dnsProtection ? customDnsIps : undefined,
        security_policy: {
          kill_switch_mode: state.securitySettings.killSwitch,
          dns_protection: state.securitySettings.dnsProtection,
          custom_dns_provider: state.securitySettings.customDnsProvider,
          custom_dns_servers: customDnsIps,
          ipv6_leak_protection: state.securitySettings.ipv6LeakProtection,
          webrtc_protection: state.securitySettings.webRtcProtection,
          lan_bypass: state.securitySettings.lanBypass,
        },
        routing_policy: {
          intranet_only: isIntranetOnly,
          custom_subnets: profile.customSubnets || [],
        },
      })) as any;

      if (response && response.status === "error") {
        const errorMsg = response.result?.message || "Connection request rejected by daemon";
        state.addLog("ERROR", "TUNNEL_ENGINE", `Connection failed: ${errorMsg}`);
        set({ connectionState: "error" });
      }
    } catch (err: any) {
      state.addLog(
        "ERROR",
        "TUNNEL_ENGINE",
        `Failed to invoke vpn_connect: ${err?.message || err}`
      );
      set({ connectionState: "error" });
    }
  },

  disconnect: async () => {
    const state = get();
    if (state.connectionState === "disconnected" || state.connectionState === "disconnecting")
      return;

    set({ connectionState: "disconnecting" });
    state.addLog(
      "WARN",
      "TUNNEL_ENGINE",
      "Disconnect request received. Tearing down tunnel interfaces..."
    );

    try {
      await IpcBridge.disconnectVpn();
      set({ connectionState: "disconnected", connectedAt: null, uptimeSeconds: 0 });
    } catch (err: any) {
      state.addLog("ERROR", "TUNNEL_ENGINE", `Disconnect error: ${err?.message || err}`);
      set({ connectionState: "disconnected", connectedAt: null, uptimeSeconds: 0 });
    }
  },

  tickTelemetry: () => {
    const state = get();
    if (state.connectionState !== "connected") {
      if (
        state.telemetry.currentDownloadKbps !== 0 ||
        state.telemetry.currentUploadKbps !== 0 ||
        state.uptimeSeconds !== 0
      ) {
        set((s) => ({
          uptimeSeconds: 0,
          connectedAt: null,
          telemetry: {
            ...s.telemetry,
            currentDownloadKbps: 0,
            currentUploadKbps: 0,
          },
        }));
      }
      return;
    }

    const activeProf = state.profiles.find((p) => p.id === state.activeProfileId);
    const currentPing = activeProf?.pingMs || state.telemetry.currentPingMs || 25;
    const download = state.telemetry.currentDownloadKbps;
    const upload = state.telemetry.currentUploadKbps;
    const realUptime = state.connectedAt
      ? Math.floor((Date.now() - state.connectedAt) / 1000)
      : state.uptimeSeconds;

    set((s) => {
      const newSparkline = [
        ...s.telemetry.sparkline.slice(-29),
        {
          timestamp: Date.now(),
          downloadSpeed: download,
          uploadSpeed: upload,
          ping: currentPing,
        },
      ];

      return {
        uptimeSeconds: realUptime,
        telemetry: {
          ...s.telemetry,
          currentPingMs: currentPing,
          sparkline: newSparkline,
        },
      };
    });
  },

  pingAllProfiles: async () => {
    const profiles = get().profiles;
    if (!profiles || profiles.length === 0) return;

    for (const prof of profiles) {
      if (prof.serverHost && prof.serverPort) {
        IpcBridge.pingHost(prof.serverHost, prof.serverPort).then((rtt) => {
          if (rtt !== null && rtt > 0) {
            set((state) => ({
              profiles: state.profiles.map((p) => (p.id === prof.id ? { ...p, pingMs: rtt } : p)),
            }));
          }
        });
      }
    }
  },
}));

// Initialize 500ms telemetry heartbeat & IPC listeners
if (typeof window !== "undefined") {
  if (!telemetryInterval) {
    telemetryInterval = setInterval(() => {
      useVpnStore.getState().tickTelemetry();
    }, 600);
  }

  // Load storage from disk on startup
  useVpnStore.getState().loadStorage();

  // Subscribe to Tauri daemon events if running inside desktop
  if (IpcBridge.isTauriEnvironment()) {
    IpcBridge.onDaemonStatusChange((status) => {
      useVpnStore.getState().setDaemonHealth(status);
    });

    IpcBridge.pingDaemon().then((alive) => {
      useVpnStore.getState().setDaemonHealth(alive ? "connected" : "offline");
    });
  }
}
