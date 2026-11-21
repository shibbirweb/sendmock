use std::net::{SocketAddr, TcpListener};

/// The most ports tried when looking for a free one.
const PORTS_TRIED: u16 = 50;

/// Whether something could listen on the address now.
pub fn is_address_free(address: SocketAddr) -> bool {
    TcpListener::bind(address).is_ok()
}

/// The first free port after the address's own, skipping ports already chosen.
pub fn find_next_free_address(
    address: SocketAddr,
    taken_addresses: &[SocketAddr],
    is_free: impl Fn(SocketAddr) -> bool,
) -> Option<SocketAddr> {
    (1..=PORTS_TRIED)
        .filter_map(|offset| address.port().checked_add(offset))
        .map(|port| SocketAddr::new(address.ip(), port))
        .find(|candidate| !taken_addresses.contains(candidate) && is_free(*candidate))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn address(port: u16) -> SocketAddr {
        SocketAddr::from(([127, 0, 0, 1], port))
    }

    // AC: PL-22.3
    #[test]
    fn the_next_free_port_skips_busy_and_already_chosen_ones() {
        let busy_ports = [8031];
        let next_free = find_next_free_address(address(8030), &[address(8032)], |candidate| {
            !busy_ports.contains(&candidate.port())
        });

        assert_eq!(next_free, Some(address(8033)));
    }
}
