export type ConnectionState =
  "disconnected" | "connecting" | "connected" | "reconnecting" | "disconnecting" | "error";

export type DaemonHealthStatus = "connected" | "reconnecting" | "offline";

export type ProtocolType = "wireguard" | "openvpn_udp" | "openvpn_tcp" | "ipsec";

export type KillSwitchMode = "off" | "standard" | "strict";

export type SplitTunnelMode = "bypass" | "route_vpn";

export interface VpnProfile {
  id: string;
  name: string;
  protocol: ProtocolType;
  serverHost: string;
  serverPort: number;
  serverCountry: string;
  serverCity: string;
  serverFlag: string;
  virtualIp: string;
  assignedIp?: string;
  isFavorite: boolean;
  tags: string[];
  lastConnected?: string;
  pingMs: number;
  credentials?: {
    username?: string;
    password?: string;
    passwordMode?: "static" | "dynamic_prompt" | "totp_auto";
    totpSecret?: string;
    totpFormat?: "append" | "prefix" | "totp_only";
    hasPassword?: boolean;
    hasCert?: boolean;
    hasPrivateKey?: boolean;
    hasCaCert?: boolean;
    hasTlsAuth?: boolean;
    hasTlsCrypt?: boolean;
    privateKey?: string;
    presharedKey?: string;
    caCert?: string;
    clientCert?: string;
    clientKey?: string;
    tlsAuthKey?: string;
    tlsCryptKey?: string;
    keyDirection?: string;
    remoteCertTlsServer?: boolean;
    renegSec?: number;
  };
  rawConfig?: string;
}

export interface TelemetryPoint {
  timestamp: number;
  downloadSpeed: number; // in KB/s
  uploadSpeed: number; // in KB/s
  ping: number;
}

export interface LiveTelemetry {
  currentDownloadKbps: number;
  currentUploadKbps: number;
  totalDownloadedBytes: number;
  totalUploadedBytes: number;
  currentPingMs: number;
  jitterMs: number;
  packetLossPercent: number;
  sparkline: TelemetryPoint[];
}

export type LogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR";

export interface LogEntry {
  id: string;
  timestamp: string;
  level: LogLevel;
  source: string;
  message: string;
}

export interface AppRule {
  id: string;
  name: string;
  path: string;
  icon?: string;
  mode: SplitTunnelMode;
  enabled: boolean;
}

export interface IpDomainRule {
  id: string;
  target: string; // e.g. "10.0.0.0/8" or "*.corp.internal"
  type: "cidr" | "domain";
  description: string;
  mode: SplitTunnelMode;
  enabled: boolean;
}

export interface SecuritySettings {
  killSwitch: KillSwitchMode;
  dnsProtection: boolean;
  customDnsProvider: "cloudflare" | "google" | "quad9" | "custom";
  customDnsIp?: string;
  ipv6LeakProtection: boolean;
  webRtcProtection: boolean;
  lanBypass: boolean;
}

export interface DiagnosticItem {
  name: string;
  status: "ok" | "warning" | "error";
  details: string;
  value: string;
}
