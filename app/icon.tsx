import { ImageResponse } from "next/og";

export const size = {
  width: 512,
  height: 512,
};

export const contentType = "image/png";

export default function Icon() {
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
            width: "155%",
            height: "155%",
            objectFit: "contain",
            flexShrink: 0,
          }}
        />
      </div>
    ),
    {
      ...size,
    }
  );
}
