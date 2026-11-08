/// The icon's side in pixels; the OS scales it for the menu bar or tray.
pub const ICON_SIZE: u32 = 32;

/// SendMock's mint, the accent of the web UI.
const MINT: [u8; 4] = [45, 212, 167, 255];
const WHITE: [u8; 4] = [255, 255, 255, 255];
const CLEAR: [u8; 4] = [0, 0, 0, 0];

/// How far the point is from the segment from `start` to `end`.
fn distance_to_segment(point: (f32, f32), start: (f32, f32), end: (f32, f32)) -> f32 {
    let (segment_x, segment_y) = (end.0 - start.0, end.1 - start.1);
    let length_squared = segment_x * segment_x + segment_y * segment_y;
    let position = (((point.0 - start.0) * segment_x + (point.1 - start.1) * segment_y)
        / length_squared)
        .clamp(0.0, 1.0);
    let (nearest_x, nearest_y) = (
        start.0 + position * segment_x,
        start.1 + position * segment_y,
    );
    ((point.0 - nearest_x).powi(2) + (point.1 - nearest_y).powi(2)).sqrt()
}

fn pick_pixel_colour(pixel_x: u32, pixel_y: u32) -> [u8; 4] {
    let is_in_envelope = (3..29).contains(&pixel_x) && (7..25).contains(&pixel_y);
    if !is_in_envelope {
        return CLEAR;
    }
    let point = (pixel_x as f32 + 0.5, pixel_y as f32 + 0.5);
    let flap_distance = distance_to_segment(point, (4.0, 8.0), (16.0, 17.0))
        .min(distance_to_segment(point, (28.0, 8.0), (16.0, 17.0)));
    if flap_distance < 1.2 { WHITE } else { MINT }
}

/// An envelope in SendMock's mint, as RGBA bytes, drawn here so no image decoder is needed.
pub fn draw_icon_rgba() -> Vec<u8> {
    (0..ICON_SIZE)
        .flat_map(|pixel_y| (0..ICON_SIZE).map(move |pixel_x| (pixel_x, pixel_y)))
        .flat_map(|(pixel_x, pixel_y)| pick_pixel_colour(pixel_x, pixel_y))
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_icon_is_a_mint_envelope_with_a_white_flap_on_a_clear_ground() {
        let icon_rgba = draw_icon_rgba();
        let read_pixel = |pixel_x: u32, pixel_y: u32| {
            let offset = ((pixel_y * ICON_SIZE + pixel_x) * 4) as usize;
            icon_rgba.get(offset..offset + 4).map(<[u8]>::to_vec)
        };

        assert_eq!(icon_rgba.len(), (ICON_SIZE * ICON_SIZE * 4) as usize);
        assert_eq!(read_pixel(0, 0), Some(CLEAR.to_vec()));
        assert_eq!(read_pixel(16, 16), Some(WHITE.to_vec()));
        assert_eq!(read_pixel(5, 22), Some(MINT.to_vec()));
    }
}
