/** Shared app-icon artwork: light-blue tile, navy "P", yellow dot, red ring. */
export function IconArt({ size }: { size: number }) {
  const u = size / 100;
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#07111f",
        position: "relative",
      }}
    >
      <div
        style={{
          width: 72 * u,
          height: 72 * u,
          borderRadius: 20 * u,
          background: "#38bdf8",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#062a45",
          fontSize: 50 * u,
          fontWeight: 900,
          fontFamily: "sans-serif",
        }}
      >
        P
      </div>
      <div
        style={{
          position: "absolute",
          top: 10 * u,
          right: 10 * u,
          width: 22 * u,
          height: 22 * u,
          borderRadius: 999,
          background: "#facc15",
          border: `${4 * u}px solid #07111f`,
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: 9 * u,
          left: 9 * u,
          width: 18 * u,
          height: 18 * u,
          borderRadius: 999,
          border: `${4 * u}px solid #ef4444`,
        }}
      />
    </div>
  );
}
