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

        <h1 className="anchor-title">words I return to.</h1>
      </header>

      <AnchorWall columns={3} gap={20} />

      <style>{`
        .anchor-page {
          min-height: 100vh;
          width: 100%;
          overflow-x: hidden;
          background: #121212;
          color: #ffffff;
          padding: 78px 50px 80px;
          box-sizing: border-box;
          font-family: Figtree, Inter, sans-serif;
        }

        .anchor-header {
          margin-bottom: 72px;
        }

        .anchor-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 8px 9px;
          border-radius: 6px;
          border: 1px solid rgba(255, 75, 36, 0.16);
          background: rgba(255, 75, 36, 0.04);
          color: #ff4b24;
          font-family: Figtree, Inter, sans-serif;
          font-size: 13px;
          font-weight: 600;
          line-height: 1;
          margin-bottom: 16px;
        }

        .anchor-title {
          margin: 0;
          color: #ffffff;
          font-family: Figtree, Inter, sans-serif;
          font-size: 36px;
          font-weight: 500;
          letter-spacing: -0.04em;
          line-height: 1.1;
        }

        @media (max-width: 1049px) {
          .anchor-page {
            padding: 64px 36px 64px;
          }

          .anchor-header {
            margin-bottom: 64px;
          }
        }

        @media (max-width: 699px) {
          .anchor-page {
            min-height: 100dvh;
            padding: 32px 20px 40px;
          }

          .anchor-header {
            margin-bottom: 88px;
          }

          .anchor-badge {
            padding: 7px 8px;
            font-size: 12px;
            margin-bottom: 14px;
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