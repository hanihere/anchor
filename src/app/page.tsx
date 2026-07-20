import { redirect } from "next/navigation";

import AnchorWall from "@/features/anchor/AnchorWall";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <main className="anchor-page">
      <header className="anchor-header">
        <div className="anchor-badge">ANCHOR</div>

        <h1 className="anchor-title">Return to what matters.</h1>
      </header>

      <AnchorWall columns={3} gap={24} />

      <style>{`
        .anchor-page {
          min-height: 100vh;
          width: 100%;
          overflow-x: hidden;
          background: #111110;
          color: #ffffff;
          padding: 54px 64px 96px;
          box-sizing: border-box;
          font-family: Figtree, Inter, sans-serif;
        }

        .anchor-header {
  position: sticky;
  top: 54px;

  z-index: 300;

  margin-bottom: 88px;

  pointer-events: none;
}
  .anchor-badge,
.anchor-title {
    pointer-events: auto;
}

        .anchor-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 0;
          border-radius: 0;
          border: 0;
          background: transparent;
          color: rgba(255, 255, 255, 0.34);
          font-family: Figtree, Inter, sans-serif;
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.14em;
          line-height: 1;
          margin-bottom: 12px;
        }

        .anchor-title {
          margin: 0;
          color: #ffffff;
          font-family: Figtree, Inter, sans-serif;
          font-size: clamp(30px, 3vw, 42px);
          font-weight: 450;
          letter-spacing: -0.05em;
          line-height: 1.1;
        }

        @media (max-width: 1049px) {
          .anchor-page {
            padding: 48px 36px 72px;
          }

          .anchor-header {
            margin-bottom: 72px;
          }
        }

        @media (max-width: 699px) {
          .anchor-page {
            min-height: 100dvh;
            padding: 36px 20px 64px;
          }

          .anchor-header {
            margin-bottom: 76px;
          }

          .anchor-badge {
            font-size: 9px;
            margin-bottom: 11px;
          }

          .anchor-title {
            font-size: clamp(30px, 9vw, 36px);
            line-height: 1.08;
            letter-spacing: -0.045em;
          }
        }
      `}</style>
    </main>
  );
}
