import { areaColors, trailerPalette } from "../trailer/trailer-palette";

const channels = [
  { label: "Email", color: areaColors.email },
  { label: "SMS", color: areaColors.sms },
  { label: "Payments", color: areaColors.payment },
  { label: "Any API", color: areaColors.http },
];

type ChannelChipsProps = {
  leftPx: number;
  topPx: number;
  fontSizePx: number;
};

/** What SendMock covers, as a row of chips with each area's dot. */
export function ChannelChips({ leftPx, topPx, fontSizePx }: ChannelChipsProps) {
  return (
    <div
      style={{
        position: "absolute",
        left: leftPx,
        top: topPx,
        display: "flex",
        gap: fontSizePx / 2,
      }}
    >
      {channels.map((channel) => (
        <div
          key={channel.label}
          style={{
            display: "flex",
            alignItems: "center",
            gap: fontSizePx * 0.36,
            padding: `${fontSizePx * 0.36}px ${fontSizePx * 0.72}px`,
            borderRadius: 999,
            border: `1px solid ${trailerPalette.border}`,
            backgroundColor: trailerPalette.surface,
            fontSize: fontSizePx,
            fontWeight: 500,
          }}
        >
          <div
            style={{
              width: fontSizePx * 0.43,
              height: fontSizePx * 0.43,
              borderRadius: fontSizePx,
              backgroundColor: channel.color,
              boxShadow: `0 0 12px ${channel.color}`,
            }}
          />
          {channel.label}
        </div>
      ))}
    </div>
  );
}
