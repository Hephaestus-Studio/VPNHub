export type AppLanguage = "en" | "vi" | "zh" | "fr";

export interface LanguageOption {
  code: AppLanguage;
  name: string;
  nativeName: string;
  flag: string;
}

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: "en", name: "English", nativeName: "English", flag: "🇺🇸" },
  { code: "vi", name: "Vietnamese", nativeName: "Tiếng Việt", flag: "🇻🇳" },
  { code: "zh", name: "Chinese", nativeName: "简体中文", flag: "🇨🇳" },
  { code: "fr", name: "French", nativeName: "Français", flag: "🇫🇷" },
];

export interface TranslationDictionary {
  common: {
    save: string;
    cancel: string;
    delete: string;
    edit: string;
    close: string;
    copy: string;
    copied: string;
    open: string;
    back: string;
    search: string;
    filter: string;
    reset: string;
    enable: string;
    disable: string;
    active: string;
    ready: string;
    offline: string;
    connected: string;
    connecting: string;
    reconnecting: string;
    disconnecting: string;
    disconnected: string;
    error: string;
    none: string;
    loading: string;
    all: string;
    success: string;
    warning: string;
  };
  nav: {
    menu: string;
    dashboard: string;
    profiles: string;
    security: string;
    logs: string;
    settings: string;
    supportAndDocs: string;
    collapseSidebar: string;
    expandSidebar: string;
    coreTitle: string;
    daemonStatus: string;
  };
  titlebar: {
    searchPlaceholder: string;
    active: string;
    reconnecting: string;
    offline: string;
    searchShortcut: string;
  };
  statusBar: {
    killSwitchStrict: string;
    killSwitchAuto: string;
    killSwitchOff: string;
    ipv6Blocked: string;
    ipv6Pass: string;
    dnsSecured: string;
  };
  dashboard: {
    heroTitleConnected: string;
    heroTitleDisconnected: string;
    heroTitleConnecting: string;
    clickToDisconnect: string;
    clickToConnect: string;
    selectProfilePrompt: string;
    statusSecured: string;
    statusUnprotected: string;
    publicIp: string;
    virtualIp: string;
    gateway: string;
    latency: string;
    uptime: string;
    downloadSpeed: string;
    uploadSpeed: string;
    totalTraffic: string;
    quickSwitchTitle: string;
    manageAll: string;
    liveLogStreamTitle: string;
    clearStream: string;
    noActiveTunnel: string;
    daemonOffline: string;
    retryIpc: string;
    livePing: string;
    activeRules: string;
  };
  profiles: {
    title: string;
    subtitle: string;
    addProfile: string;
    importOvpn: string;
    searchPlaceholder: string;
    allProtocols: string;
    allTags: string;
    favoritesOnly: string;
    noProfilesFound: string;
    createPrompt: string;
    serverHost: string;
    serverPort: string;
    protocol: string;
    status: string;
    lastConnected: string;
    never: string;
    connect: string;
    disconnect: string;
    deleteConfirm: string;
    exportProfile: string;
    qrCode: string;
  };
  security: {
    title: string;
    subtitle: string;
    killSwitchTitle: string;
    killSwitchDesc: string;
    killSwitchEnforced: string;
    killSwitchOff: string;
    ipv6Title: string;
    ipv6Desc: string;
    ipv6Protected: string;
    webrtcTitle: string;
    webrtcDesc: string;
    webrtcProtected: string;
    lanBypassTitle: string;
    lanBypassDesc: string;
    lanBypassActive: string;
    dnsLeakTestTitle: string;
    dnsLeakTestDesc: string;
    runDnsTest: string;
  };
  logs: {
    title: string;
    subtitle: string;
    searchPlaceholder: string;
    clearLogs: string;
    copyAll: string;
    autoScroll: string;
    filterAll: string;
    filterInfo: string;
    filterWarn: string;
    filterError: string;
    filterDebug: string;
    noLogsMessage: string;
    exportDiagnostics: string;
  };
  settings: {
    title: string;
    subtitle: string;
    languageCardTitle: string;
    languageSelectLabel: string;
    languageSelectDesc: string;
    desktopBehaviorTitle: string;
    launchAtStartup: string;
    launchAtStartupDesc: string;
    startMinimized: string;
    startMinimizedDesc: string;
    autoConnectOnLaunch: string;
    autoConnectOnLaunchDesc: string;
    minimizeToTrayOnClose: string;
    minimizeToTrayOnCloseDesc: string;
    networkIntegrationTitle: string;
    autoReconnect: string;
    autoReconnectDesc: string;
    desktopNotifications: string;
    desktopNotificationsDesc: string;
    spotlightTitle: string;
    spotlightDesc: string;
    spotlightButton: string;
    diagnosticsTitle: string;
    engineStatus: string;
    cipherSuiteTitle: string;
    cipherSuiteDesc: string;
    ipcDaemonTitle: string;
    ipcDaemonDesc: string;
    encryptedVaultTitle: string;
    encryptedVaultDesc: string;
    clientVersionText: string;
    resetDefaults: string;
    settingsRestoredTitle: string;
    settingsRestoredMsg: string;
    docsAndGithub: string;
    coreReady: string;
    coreOffline: string;
    vaultAes: string;
  };
  modals: {
    mfaTitle: string;
    mfaSubtitle: string;
    mfaPlaceholder: string;
    mfaConfirm: string;
    dnsLeakTitle: string;
    dnsLeakDesc: string;
    dnsLeakTesting: string;
    dnsLeakPassed: string;
    dnsLeakFailed: string;
    dnsServersFound: string;
    dnsPublicIp: string;
    newProfileTitle: string;
    newProfileWireguardTitle: string;
    newProfileWireguardDesc: string;
    newProfileOpenvpnTitle: string;
    newProfileOpenvpnDesc: string;
    newProfileImportTitle: string;
    newProfileImportDesc: string;
    importDropzoneText: string;
    importDropzoneSubtext: string;
    exportDiagTitle: string;
    exportDiagSubtitle: string;
    exportDownloadJson: string;
    exportCopyText: string;
  };
}
