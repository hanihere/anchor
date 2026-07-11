"use client";

import React from "react";

interface BlocksProps {
  quote: string;
  name?: string;
  nameRequired?: boolean;
  barColor?: string;
}

export default function Blocks({
  quote,
  name = "See Incident",
  nameRequired = false,
  barColor = "rgb(37, 37, 37)",
}: BlocksProps) {
  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        width: "max-content",
        height: "max-content",
        paddingLeft: 14,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 0,
          top: "50%",
          transform: "translateY(-50%)",
          width: 4,
          height: "89.6%",
          borderRadius: 85,
          background: barColor,
        }}
      />

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          gap: 8,
          width: "max-content",
          maxWidth: 500,
          padding: "8px 16px",
          borderRadius: 16,
          background:
            "linear-gradient(90deg, rgb(37,37,37) 0%, rgb(20,20,20) 100%)",
        }}
      >
        <div
          style={{
            width: 268,
            whiteSpace: "pre-wrap",
            color: "#FFFFFF",
            fontFamily: "Figtree, sans-serif",
            fontWeight: 500,
            fontSize: 16,
            letterSpacing: "-0.02em",
            lineHeight: "1.4em",
            textAlign: "left",
          }}
        >
          {quote}
        </div>

        {nameRequired && (
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
            }}
          >
            <span
              style={{
                color: "rgba(255,255,255,0.5)",
                fontFamily: "Figtree, sans-serif",
                fontStyle: "italic",
                fontWeight: 700,
                fontSize: 13,
                letterSpacing: "-0.02em",
                lineHeight: "1.4em",
              }}
            >
              -
            </span>

            <span
              style={{
                color: "rgba(255,255,255,0.5)",
                fontFamily: "Figtree, sans-serif",
                fontStyle: "italic",
                fontWeight: 300,
                fontSize: 13,
                letterSpacing: "-0.02em",
                lineHeight: "1.4em",
              }}
            >
              {name}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}