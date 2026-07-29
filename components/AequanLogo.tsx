import React from "react";

interface AequanLogoProps {
  className?: string;
  height?: number;
  /** When false, renders icon mark only (no wordmark). */
  showText?: boolean;
}

/** Measured aspect ratio (width / height) of public/aequan-logo-horizontal.png */
const HORIZONTAL_LOGO_ASPECT = 878 / 248;

export const AequanLogo: React.FC<AequanLogoProps> = ({
  className = "",
  height = 40,
  showText = true,
}) => {
  if (showText) {
    const width = Math.round(height * HORIZONTAL_LOGO_ASPECT);
    return (
      <div className={`flex max-w-full items-center justify-center ${className}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/aequan-logo-horizontal.png"
          alt="AEQUAN"
          width={width}
          height={height}
          className="h-auto max-h-full max-w-full object-contain object-left"
          style={{ height, width: "auto", maxWidth: "100%" }}
        />
      </div>
    );
  }

  const viewBox = "610 210 520 520";

  return (
    <div className={`flex items-center justify-center ${className}`}>
      <svg
        width={height}
        height={height}
        viewBox={viewBox}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="max-w-full h-auto overflow-visible"
        aria-label="AEQUAN"
        role="img"
      >
        {/* Tracciati originali AEQUAN — icona */}
        <path transform="translate(1080,228)" d="m0 0h10l14 2 16 6 14 8 14 11 12 12 10 14 15 26 12 21 14 25 13 23 11 20 26 46 14 25 14 24 8 15 7 19 3 13 1 6v17l-4 16-7 14-11 12-8 6-13 6-9 2h-15l-14-4-11-6-9-7-12-12-15-20-9-15-14-23-10-14-8-7-12-6-5-1h-14l-14 4-13 7-17 12-14 11-16 13-13 10-18 13-23 15-23 12-24 9-21 5-14 2h-28l-17-3-18-6-19-10-13-10-8-7-7-8-11-15-8-16-6-16-4-18-1-7v-24l3-17 5-17 8-16 7-11 11-12 8-8 15-10 15-7 17-5 11-2h29l22 5 15 6 15 8 5 3 11-27 13-28 13-26 12-20 13-18 12-14 9-9 12-9 16-8 15-4z" fill="#345884" />
        <path transform="translate(1118,425)" d="m0 0h26l17 4 7 3 13 24 11 19 6 11 25 45 9 19 3 12 1 8v9l-4 10-8 6-3 1h-14l-2-1-1 2-9-9-15-20-9-15-14-23-10-14-8-7-12-6-5-1h-14l-14 4-13 7-17 12-14 11-16 13-13 10-18 13-23 15-23 12-24 9-21 5-14 2h-28l-17-3-8-3 3-1 13 3 16 2h13l8-2 15-6 15-9 10-8 4-2 2-4 10-11 10-15 8-15 8-18 10-28 14-10 18-13 17-12 18-11 16-9 18-8 16-5z" fill="#2A486D" />
        <path transform="translate(949,681)" d="m0 0h10l15 3 12 5 10 6 10 9 7 10 5 11 3 14v15l-4 18-6 12v4l12 10-4 6-12 13-8-6-7-6-5 2-8 4-14 4-16 1-13-2-12-4-11-6-10-8-7-8-8-16-3-13v-20l4-17 7-13 11-12 14-9 14-5z" fill="#424853" />
        <path transform="translate(858,370)" d="m0 0h29l22 5 15 6 15 8 5 4-3 9-11 26-7 18-2 5-5-2-15-8-13-4-5-1h-15l-13 3-12 7-8 8-6 10-3 9-1 6v11l3 12 6 10 7 6 9 4 5 1h15l-3 2-16 1-6 1h-14l-12-2-14-5-14-9-3-2v-2l-3-1-9-13-5-10-5-13-3-1-1 4h-2l1 30 4 20 5 14-1 3-6-16-4-18-1-7v-24l3-17 5-17 8-16 7-11 11-12 8-8 15-10 15-7 17-5z" fill="#2A486D" />
        <path transform="translate(1080,319)" d="m0 0h11l14 7 10 10 7 11 14 26 26 48 5 10-9-2-14-3h-26l-18 4-19 7-21 11-18 11-20 14-18 13-12 9-1-3 20-60 12-32 13-29 10-18 12-17 12-12z" fill="#FCFDFD" />
        <path transform="translate(868,435)" d="m0 0h15l15 4 17 8 5 4-1 5-9 22-9 17-9 12-10 10-10 5-8 2h-9l-11-3-9-7-6-8-4-10-1-6v-11l3-12 5-10 9-10 10-7 11-4z" fill="#FCFDFD" />
        <path transform="translate(946,705)" d="m0 0h15l11 4 8 6 7 7 5 10 2 8v15l-3 11-2 3-5-2-13-12-5-2-12 13-2 3 11 10 8 7v2l-13 4h-11l-13-4-10-7-7-9-4-9-2-11 1-14 4-11 6-9 8-7 11-5z" fill="#FCFDFD" />
        <path transform="translate(1032,246)" d="m0 0 2 1-29 29 2-4 9-11 11-11z" fill="#2E4F77" />
        <path transform="translate(898,611)" d="m0 0m-2 1h2v3h-25v-2h17z" fill="#2A496F" />
      </svg>
    </div>
  );
};
