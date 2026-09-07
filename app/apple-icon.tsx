import { ImageResponse } from "next/og";

export const size = {
  width: 180,
  height: 180,
};

export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#ffffff",
          overflow: "hidden",
        }}
      >
        <img
          src="https://sprintyuzmekursu.com/sprint-logo.png"
          alt="Sprint Yüzme Okulu"
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
            transform: "scale(1.62)",
          }}
        />
      </div>
    ),
    {
      ...size,
    }
  );
}
