//! Automatic TCP MSS Clamping (`--mssfix`) for IPv4 and IPv6 packets.

/// Performs TCP MSS clamping on an IP packet in-place.
/// Returns `true` if the packet was a TCP SYN packet and the MSS option was clamped.
pub fn clamp_tcp_mss(packet: &mut [u8], max_mss: u16) -> bool {
    if packet.is_empty() {
        return false;
    }

    let ip_version = packet[0] >> 4;
    match ip_version {
        4 => clamp_ipv4_tcp_mss(packet, max_mss),
        6 => clamp_ipv6_tcp_mss(packet, max_mss),
        _ => false,
    }
}

fn clamp_ipv4_tcp_mss(packet: &mut [u8], max_mss: u16) -> bool {
    if packet.len() < 20 {
        return false;
    }

    let ihl = ((packet[0] & 0x0F) * 4) as usize;
    let protocol = packet[9];

    // Check if Protocol is TCP (6) and packet has enough bytes for IP header + min TCP header (20 bytes)
    if protocol != 6 || packet.len() < ihl + 20 {
        return false;
    }

    let tcp_packet = &mut packet[ihl..];
    clamp_tcp_segment(tcp_packet, max_mss)
}

fn clamp_ipv6_tcp_mss(packet: &mut [u8], max_mss: u16) -> bool {
    if packet.len() < 40 {
        return false;
    }

    let next_header = packet[6];
    if next_header != 6 || packet.len() < 40 + 20 {
        return false;
    }

    let tcp_packet = &mut packet[40..];
    clamp_tcp_segment(tcp_packet, max_mss)
}

fn clamp_tcp_segment(tcp: &mut [u8], max_mss: u16) -> bool {
    if tcp.len() < 20 {
        return false;
    }

    let data_offset = ((tcp[12] >> 4) * 4) as usize;
    let flags = tcp[13];

    // Only process TCP SYN packets (SYN flag is bit 1: 0x02)
    if (flags & 0x02) == 0 || tcp.len() < data_offset || data_offset <= 20 {
        return false;
    }

    let mut opt_idx = 20;
    while opt_idx < data_offset && opt_idx < tcp.len() {
        let kind = tcp[opt_idx];
        match kind {
            0 => break, // End of Option List
            1 => {
                opt_idx += 1; // NOP
            }
            2 => {
                // MSS Option (Kind: 2, Length: 4, Value: u16)
                if opt_idx + 4 <= tcp.len() && tcp[opt_idx + 1] == 4 {
                    let old_mss = u16::from_be_bytes([tcp[opt_idx + 2], tcp[opt_idx + 3]]);
                    if old_mss > max_mss {
                        let new_mss_bytes = max_mss.to_be_bytes();
                        tcp[opt_idx + 2] = new_mss_bytes[0];
                        tcp[opt_idx + 3] = new_mss_bytes[1];

                        // Update TCP Checksum incrementally (RFC 1624)
                        let old_checksum = u16::from_be_bytes([tcp[16], tcp[17]]);
                        let new_checksum = update_checksum(old_checksum, old_mss, max_mss);
                        let cs_bytes = new_checksum.to_be_bytes();
                        tcp[16] = cs_bytes[0];
                        tcp[17] = cs_bytes[1];

                        return true;
                    }
                }
                opt_idx += tcp[opt_idx + 1] as usize;
            }
            _ => {
                if opt_idx + 1 >= tcp.len() {
                    break;
                }
                let len = tcp[opt_idx + 1] as usize;
                if len < 2 {
                    break;
                }
                opt_idx += len;
            }
        }
    }

    false
}

/// Updates an Internet Checksum incrementally (RFC 1624 equation 3: HC' = ~(~HC + ~m + m')).
fn update_checksum(old_checksum: u16, old_val: u16, new_val: u16) -> u16 {
    let mut sum = (!old_checksum as u32) + (!old_val as u32) + (new_val as u32);
    while (sum >> 16) != 0 {
        sum = (sum & 0xFFFF) + (sum >> 16);
    }
    !sum as u16
}
