//! # Windows IP Routing Engine
//!
//! Controls routing entries on Windows via native Win32 IP Helper API (CreateIpForwardEntry2).

use crate::error::NetworkError;
use tracing::{debug, error, info, warn};

#[cfg(windows)]
use std::ffi::OsStr;
#[cfg(windows)]
use std::net::Ipv4Addr;
#[cfg(windows)]
use std::os::windows::ffi::OsStrExt;
#[cfg(windows)]
use windows_sys::Win32::NetworkManagement::IpHelper::{
    ConvertInterfaceAliasToLuid, CreateIpForwardEntry2, DeleteIpForwardEntry2,
    InitializeIpForwardEntry, MIB_IPFORWARD_ROW2,
};
#[cfg(windows)]
use windows_sys::Win32::NetworkManagement::Ndis::NET_LUID_LH;
#[cfg(windows)]
use windows_sys::Win32::Networking::WinSock::AF_INET;

/// Windows IP routing controller.
#[derive(Default)]
pub struct WindowsRouteManager {
    #[cfg(windows)]
    added_routes: Vec<(Ipv4Addr, u8)>,
    #[cfg(windows)]
    luid: Option<NET_LUID_LH>,
}

impl WindowsRouteManager {
    /// Creates a new Windows route manager.
    pub fn new() -> Self {
        Self::default()
    }

    /// Sets up default tunnel routing on Windows.
    pub fn setup_vpn_routing(
        &mut self,
        server_ip: &str,
        tunnel_iface: &str,
        _assigned_ip: Option<&str>,
        intranet_only: bool,
        pushed_routes: &[String],
        custom_subnets: &[String],
        _lan_bypass: bool,
    ) -> Result<(), NetworkError> {
        info!(
            "Configuring Windows routing for VPN server {} on interface {} (intranet_only={})",
            server_ip, tunnel_iface, intranet_only
        );

        #[cfg(windows)]
        {
            // 1. Resolve Interface LUID from Alias (e.g. "wintun")
            let wide_name: Vec<u16> = OsStr::new(tunnel_iface)
                .encode_wide()
                .chain(std::iter::once(0))
                .collect();
            let mut luid: NET_LUID_LH = unsafe { std::mem::zeroed() };

            let res = unsafe { ConvertInterfaceAliasToLuid(wide_name.as_ptr(), &mut luid) };
            if res != 0 {
                warn!(
                    "Could not find interface LUID for alias '{}' (win error {}). Retrying after short delay...",
                    tunnel_iface, res
                );
                std::thread::sleep(std::time::Duration::from_millis(500));
                let res2 = unsafe { ConvertInterfaceAliasToLuid(wide_name.as_ptr(), &mut luid) };
                if res2 != 0 {
                    error!(
                        "Failed to convert interface alias '{}' to LUID: error {}",
                        tunnel_iface, res2
                    );
                    return Err(NetworkError::RoutingFailed(format!(
                        "ConvertInterfaceAliasToLuid failed for '{}': win error {}",
                        tunnel_iface, res2
                    )));
                }
            }

            self.luid = Some(luid);
            self.added_routes.clear();

            let mut routes_to_add: Vec<(Ipv4Addr, u8)> = Vec::new();

            if intranet_only {
                // Collect pushed subnets and custom subnets
                for r in pushed_routes.iter().chain(custom_subnets.iter()) {
                    if let Some((ip, prefix)) = parse_cidr_or_mask(r) {
                        routes_to_add.push((ip, prefix));
                    }
                }
            } else {
                // Full tunnel: Route 0.0.0.0/1 and 128.0.0.0/1 through VPN interface
                routes_to_add.push((Ipv4Addr::new(0, 0, 0, 0), 1));
                routes_to_add.push((Ipv4Addr::new(128, 0, 0, 0), 1));

                // Also add any specific subnets
                for r in pushed_routes.iter().chain(custom_subnets.iter()) {
                    if let Some((ip, prefix)) = parse_cidr_or_mask(r) {
                        routes_to_add.push((ip, prefix));
                    }
                }
            }

            info!(
                "Injecting {} routes into Windows Routing Table via IP Helper API for interface '{}'",
                routes_to_add.len(),
                tunnel_iface
            );

            let mut success_count = 0;
            for (dest_ip, prefix_len) in routes_to_add {
                if let Err(e) = Self::add_route_luid(luid, dest_ip, prefix_len) {
                    debug!("Route add notice for {}/{}: {}", dest_ip, prefix_len, e);
                } else {
                    self.added_routes.push((dest_ip, prefix_len));
                    success_count += 1;
                }
            }

            info!(
                "Successfully applied {}/{} VPN routes on Windows",
                success_count,
                self.added_routes.len()
            );

            Ok(())
        }

        #[cfg(not(windows))]
        {
            let _ = (_assigned_ip, pushed_routes, custom_subnets);
            Ok(())
        }
    }

    /// Returns the detected local physical LAN subnet.
    pub fn local_lan_subnet(&self) -> Option<&str> {
        None
    }

    /// Reverts injected routes on Windows.
    pub fn teardown_vpn_routing(
        &mut self,
        _server_ip: &str,
        tunnel_iface: &str,
    ) -> Result<(), NetworkError> {
        info!(
            "Tearing down Windows VPN routes for interface {}",
            tunnel_iface
        );

        #[cfg(windows)]
        {
            if let Some(luid) = self.luid.take() {
                let count = self.added_routes.len();
                for (dest_ip, prefix_len) in self.added_routes.drain(..) {
                    let _ = Self::delete_route_luid(luid, dest_ip, prefix_len);
                }
                info!("Removed {} injected VPN routes on Windows", count);
            }
        }

        Ok(())
    }

    #[cfg(windows)]
    fn add_route_luid(luid: NET_LUID_LH, dest_ip: Ipv4Addr, prefix_len: u8) -> Result<(), String> {
        let mut row: MIB_IPFORWARD_ROW2 = unsafe { std::mem::zeroed() };
        unsafe {
            InitializeIpForwardEntry(&mut row);
        }

        row.InterfaceLuid = luid;
        row.DestinationPrefix.PrefixLength = prefix_len;
        row.DestinationPrefix.Prefix.si_family = AF_INET;

        let ip_bytes = dest_ip.octets();
        row.DestinationPrefix.Prefix.Ipv4.sin_addr.S_un.S_addr = u32::from_ne_bytes(ip_bytes);
        row.NextHop.si_family = AF_INET;

        row.Metric = 5;

        let res = unsafe { CreateIpForwardEntry2(&row) };
        if res == 0 || res == 5010 {
            // 5010 is ERROR_OBJECT_ALREADY_EXISTS
            Ok(())
        } else {
            Err(format!("CreateIpForwardEntry2 failed: win error {}", res))
        }
    }

    #[cfg(windows)]
    fn delete_route_luid(
        luid: NET_LUID_LH,
        dest_ip: Ipv4Addr,
        prefix_len: u8,
    ) -> Result<(), String> {
        let mut row: MIB_IPFORWARD_ROW2 = unsafe { std::mem::zeroed() };
        unsafe {
            InitializeIpForwardEntry(&mut row);
        }

        row.InterfaceLuid = luid;
        row.DestinationPrefix.PrefixLength = prefix_len;
        row.DestinationPrefix.Prefix.si_family = AF_INET;

        let ip_bytes = dest_ip.octets();
        row.DestinationPrefix.Prefix.Ipv4.sin_addr.S_un.S_addr = u32::from_ne_bytes(ip_bytes);
        row.NextHop.si_family = AF_INET;

        let res = unsafe { DeleteIpForwardEntry2(&row) };
        if res == 0 || res == 1168 {
            // 1168 is ERROR_NOT_FOUND
            Ok(())
        } else {
            Err(format!("DeleteIpForwardEntry2 failed: win error {}", res))
        }
    }
}

#[cfg(windows)]
fn parse_cidr_or_mask(route_str: &str) -> Option<(Ipv4Addr, u8)> {
    let trimmed = route_str.trim();
    let parts: Vec<&str> = trimmed.split_whitespace().collect();
    if parts.len() == 2 {
        if let (Ok(ip), Ok(mask)) = (parts[0].parse::<Ipv4Addr>(), parts[1].parse::<Ipv4Addr>()) {
            let mask_u32 = u32::from(mask);
            let prefix_len = mask_u32.count_ones() as u8;
            return Some((ip, prefix_len));
        }
    }

    if let Some((ip_part, prefix_part)) = trimmed.split_once('/') {
        if let (Ok(ip), Ok(prefix)) = (ip_part.parse::<Ipv4Addr>(), prefix_part.parse::<u8>()) {
            return Some((ip, prefix));
        }
    }

    if let Ok(ip) = trimmed.parse::<Ipv4Addr>() {
        return Some((ip, 32));
    }

    None
}
